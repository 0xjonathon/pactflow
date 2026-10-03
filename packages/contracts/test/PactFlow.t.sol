// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PactFactory} from "../src/PactFactory.sol";
import {PactEscrow} from "../src/PactEscrow.sol";
import {VerifierRegistry} from "../src/VerifierRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract TestToken is ERC20 {
    address public callbackTarget;
    bool public attemptedReentry;
    constructor() ERC20("Test USD", "TUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target) external {
        callbackTarget = target;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (callbackTarget != address(0) && from != address(0) && to == callbackTarget) {
            address target = callbackTarget;
            callbackTarget = address(0);
            (bool ok,) = target.call(abi.encodeWithSignature("fund()"));
            attemptedReentry = !ok;
        }
        super._update(from, to, amount);
    }
}

contract PactFlowTest is Test {
    uint256 internal constant VERIFIER_KEY = 0xA11CE;
    address internal client = makeAddr("client");
    address internal worker = makeAddr("worker");
    address internal arbitrator = makeAddr("arbitrator");
    address internal treasury = makeAddr("treasury");
    address internal stranger = makeAddr("stranger");
    TestToken internal token;
    PactFactory internal factory;
    VerifierRegistry internal verifierRegistry;
    ReputationRegistry internal reputationRegistry;
    PactEscrow internal pact;

    function setUp() public {
        token = new TestToken();
        verifierRegistry = new VerifierRegistry(address(this));
        reputationRegistry = new ReputationRegistry(address(this));
        factory = new PactFactory(address(this), address(verifierRegistry), address(reputationRegistry), treasury, 500);
        verifierRegistry.setFactory(address(factory));
        reputationRegistry.setFactory(address(factory));
        verifierRegistry.register(vm.addr(VERIFIER_KEY), 1, "ipfs://verifier", keccak256("verifier"));
        token.mint(client, 1_000_000);
        token.mint(worker, 1_000_000);
    }

    function _config(address specifiedWorker) internal view returns (PactEscrow.Config memory) {
        return PactEscrow.Config({
            client: client,
            worker: specifiedWorker,
            token: address(token),
            arbitrator: arbitrator,
            totalBudget: 1_000,
            clientBond: 100,
            workerBond: 80,
            acceptanceDeadline: uint64(block.timestamp + 1 days),
            reviewPeriod: 1 days
        });
    }

    function _inputs(PactEscrow.Mode mode) internal view returns (PactEscrow.MilestoneInput[] memory inputs) {
        inputs = new PactEscrow.MilestoneInput[](2);
        inputs[0] = PactEscrow.MilestoneInput(400, uint64(block.timestamp + 2 days), keccak256("rule0"), mode);
        inputs[1] = PactEscrow.MilestoneInput(600, uint64(block.timestamp + 3 days), keccak256("rule1"), mode);
    }

    function _create(PactEscrow.Mode mode, address specifiedWorker) internal returns (PactEscrow) {
        vm.prank(client);
        return PactEscrow(factory.createPact(_config(specifiedWorker), _inputs(mode)));
    }

    function _fundAccept(PactEscrow.Mode mode) internal {
        pact = _create(mode, worker);
        vm.startPrank(client);
        token.approve(address(pact), 1_100);
        pact.fund();
        vm.stopPrank();
        vm.startPrank(worker);
        token.approve(address(pact), 80);
        pact.accept();
        vm.stopPrank();
    }

    function _submit(uint256 id) internal {
        vm.prank(worker);
        pact.submit(id, keccak256(abi.encodePacked("deliverable", id)), "ipfs://deliverable");
    }

    function _attestation(uint256 id, uint256 nonce, uint256 expiry)
        internal
        view
        returns (VerifierRegistry.Attestation memory a)
    {
        PactEscrow.Milestone memory m = pact.milestone(id);
        a = VerifierRegistry.Attestation({
            pact: address(pact),
            milestoneId: id,
            deliverableHash: m.deliverableHash,
            rulesHash: m.rulesHash,
            approved: true,
            nonce: nonce,
            expiry: expiry,
            verifier: vm.addr(VERIFIER_KEY)
        });
    }

    function _signature(VerifierRegistry.Attestation memory a) internal view returns (bytes memory) {
        bytes32 digest = verifierRegistry.hashAttestation(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VERIFIER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function testCreatePactAndOpenWorker() public {
        pact = _create(PactEscrow.Mode.ClientOnly, address(0));
        assertTrue(factory.isPact(address(pact)));
        assertEq(pact.milestoneCount(), 2);
        vm.prank(client);
        token.approve(address(pact), 1_100);
        vm.prank(client);
        pact.fund();
        vm.prank(stranger);
        token.mint(stranger, 80);
        vm.prank(stranger);
        token.approve(address(pact), 80);
        vm.prank(stranger);
        pact.accept();
        assertEq(pact.worker(), stranger);
    }

    function testInvalidMilestoneTotalAndDeadline() public {
        PactEscrow.MilestoneInput[] memory inputs = _inputs(PactEscrow.Mode.ClientOnly);
        inputs[1].amount = 599;
        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidMilestones.selector);
        factory.createPact(_config(worker), inputs);
        inputs[1].amount = 600;
        inputs[1].dueAt = inputs[0].dueAt;
        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidDeadline.selector);
        factory.createPact(_config(worker), inputs);
    }

    function testImplementationCannotBeInitialized() public {
        address implementation = factory.implementation();
        vm.expectRevert(PactEscrow.InvalidState.selector);
        PactEscrow(implementation)
            .initialize(
                _config(worker),
                _inputs(PactEscrow.Mode.ClientOnly),
                address(verifierRegistry),
                address(reputationRegistry),
                treasury,
                address(this),
                500
            );
    }

    function testFundingAcceptanceSubmissionApprovalFeeAndRefund() public {
        _fundAccept(PactEscrow.Mode.ClientOnly);
        assertEq(token.balanceOf(address(pact)), 1_180);
        _submit(0);
        vm.prank(client);
        pact.approve(0);
        assertEq(token.balanceOf(worker), 1_000_000 - 80 + 380);
        assertEq(token.balanceOf(treasury), 20);
        vm.expectRevert(PactEscrow.InvalidState.selector);
        vm.prank(client);
        pact.approve(0);
        _submit(1);
        vm.prank(client);
        pact.approve(1);
        assertTrue(pact.completed());
        assertEq(token.balanceOf(address(pact)), 0);
        assertEq(token.balanceOf(treasury), 50);
        assertEq(token.balanceOf(worker), 1_000_950);
        assertEq(token.balanceOf(client), 999_000);
        (uint64 completedPacts, uint64 settledMilestones,,, uint256 earned) = reputationRegistry.facts(worker);
        assertEq(completedPacts, 1);
        assertEq(settledMilestones, 2);
        assertEq(earned, 1_000);
    }

    function testAIAndHybridAttestation() public {
        _fundAccept(PactEscrow.Mode.AIOnly);
        _submit(0);
        VerifierRegistry.Attestation memory a = _attestation(0, 1, block.timestamp + 1 hours);
        pact.attest(0, a, _signature(a));
        assertTrue(pact.milestone(0).settled);
        assertTrue(verifierRegistry.usedNonce(a.verifier, a.nonce));

        _submit(1);
        VerifierRegistry.Attestation memory b = _attestation(1, 2, block.timestamp + 1 hours);
        pact.attest(1, b, _signature(b));
        assertTrue(pact.completed());
    }

    function testHybridRequiresBothChecks() public {
        _fundAccept(PactEscrow.Mode.Hybrid);
        _submit(0);
        vm.prank(client);
        pact.approve(0);
        assertFalse(pact.milestone(0).settled);
        VerifierRegistry.Attestation memory a = _attestation(0, 10, block.timestamp + 1 hours);
        pact.attest(0, a, _signature(a));
        assertTrue(pact.milestone(0).settled);
    }

    function testInvalidExpiredReplayAndRulesHash() public {
        _fundAccept(PactEscrow.Mode.Hybrid);
        _submit(0);
        VerifierRegistry.Attestation memory a = _attestation(0, 3, block.timestamp + 1 hours);
        a.rulesHash = keccak256("wrong");
        bytes memory signature = _signature(a);
        vm.expectRevert(PactEscrow.InvalidAttestation.selector);
        pact.attest(0, a, signature);
        a.rulesHash = pact.milestone(0).rulesHash;
        a.pact = stranger;
        signature = _signature(a);
        vm.expectRevert(PactEscrow.InvalidAttestation.selector);
        pact.attest(0, a, signature);
        a.pact = address(pact);
        a.milestoneId = 1;
        signature = _signature(a);
        vm.expectRevert(PactEscrow.InvalidAttestation.selector);
        pact.attest(0, a, signature);
        a.milestoneId = 0;
        a.deliverableHash = keccak256("wrong deliverable");
        signature = _signature(a);
        vm.expectRevert(PactEscrow.InvalidAttestation.selector);
        pact.attest(0, a, signature);
        a.deliverableHash = pact.milestone(0).deliverableHash;
        a.verifier = stranger;
        signature = _signature(a);
        vm.expectRevert(VerifierRegistry.InvalidVerifier.selector);
        pact.attest(0, a, signature);
        a.verifier = vm.addr(VERIFIER_KEY);
        a.expiry = block.timestamp - 1;
        signature = _signature(a);
        vm.expectRevert(VerifierRegistry.ExpiredAttestation.selector);
        pact.attest(0, a, signature);
        a.expiry = block.timestamp + 1 hours;
        bytes32 digest = verifierRegistry.hashAttestation(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, digest);
        vm.expectRevert(VerifierRegistry.InvalidSignature.selector);
        pact.attest(0, a, abi.encodePacked(r, s, v));
        signature = _signature(a);
        pact.attest(0, a, signature);
        assertFalse(pact.milestone(0).settled);
        vm.expectRevert(PactEscrow.InvalidState.selector);
        pact.attest(0, a, signature);
        vm.prank(client);
        pact.approve(0);
        _submit(1);
        VerifierRegistry.Attestation memory b = _attestation(1, 3, block.timestamp + 1 hours);
        signature = _signature(b);
        vm.expectRevert(VerifierRegistry.ReplayedAttestation.selector);
        pact.attest(1, b, signature);
    }

    function testReviewTimeoutAndDisputePartialSettlementSlashes() public {
        _fundAccept(PactEscrow.Mode.ClientOnly);
        _submit(0);
        vm.prank(client);
        pact.openDispute(0);
        vm.prank(worker);
        vm.expectRevert(PactEscrow.InvalidState.selector);
        pact.claimReviewTimeout(0);
        vm.prank(arbitrator);
        pact.resolveDispute(0, 150, 30, 20);
        assertEq(pact.releasedBudget(), 150);
        assertEq(token.balanceOf(treasury), 7);
        assertEq(pact.clientBondBalance(), 70);
        assertEq(pact.workerBondBalance(), 60);
        _submit(1);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(worker);
        pact.claimReviewTimeout(1);
        assertTrue(pact.completed());
        assertEq(token.balanceOf(address(pact)), 0);
        assertEq(token.balanceOf(client), 1_000_000 - 1_100 + 250 + 20 + 70);
        assertEq(token.balanceOf(worker), 1_000_000 - 80 + 143 + 30 + 570 + 60);
        assertEq(token.balanceOf(treasury), 37);
    }

    function testBothBondSlashesOnFinalMilestone() public {
        _fundAccept(PactEscrow.Mode.ClientOnly);
        _submit(0);
        vm.prank(client);
        pact.approve(0);
        _submit(1);
        vm.prank(worker);
        pact.openDispute(1);
        vm.prank(arbitrator);
        pact.resolveDispute(1, 300, 100, 80);
        assertTrue(pact.completed());
        assertEq(token.balanceOf(address(pact)), 0);
        assertEq(pact.clientBondBalance(), 0);
        assertEq(pact.workerBondBalance(), 0);
    }

    function testCancellationAndUnauthorizedCalls() public {
        pact = _create(PactEscrow.Mode.ClientOnly, worker);
        vm.prank(stranger);
        vm.expectRevert(PactEscrow.Unauthorized.selector);
        pact.fund();
        vm.startPrank(client);
        token.approve(address(pact), 1_100);
        pact.fund();
        pact.cancelBeforeAcceptance();
        vm.stopPrank();
        assertTrue(pact.cancelled());
        assertEq(token.balanceOf(client), 1_000_000);
        assertEq(token.balanceOf(address(pact)), 0);
        vm.prank(worker);
        vm.expectRevert(PactEscrow.InvalidState.selector);
        pact.accept();
        vm.expectRevert(ReputationRegistry.UnauthorizedPact.selector);
        reputationRegistry.recordCompletion(client, worker);
        vm.expectRevert(VerifierRegistry.UnauthorizedPact.selector);
        VerifierRegistry.Attestation memory a;
        verifierRegistry.consume(a, "");
    }

    function testReentrancySensitiveFund() public {
        pact = _create(PactEscrow.Mode.ClientOnly, worker);
        vm.prank(client);
        token.approve(address(pact), 1_100);
        token.arm(address(pact));
        vm.prank(client);
        pact.fund();
        assertTrue(token.attemptedReentry());
        assertEq(token.balanceOf(address(pact)), 1_100);
    }

    function testArbitratorApprovalAndFixedWorker() public {
        _fundAccept(PactEscrow.Mode.Arbitrator);
        _submit(0);
        vm.prank(client);
        vm.expectRevert(PactEscrow.Unauthorized.selector);
        pact.approve(0);
        vm.prank(arbitrator);
        pact.approve(0);
        assertTrue(pact.milestone(0).settled);
    }
}
