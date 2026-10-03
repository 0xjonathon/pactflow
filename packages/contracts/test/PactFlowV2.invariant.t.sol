// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PactEscrowV2} from "../src/v2/PactEscrowV2.sol";
import {PactFactoryV2} from "../src/v2/PactFactoryV2.sol";
import {VerifierRegistryV2} from "../src/v2/VerifierRegistryV2.sol";
import {ReputationRegistryV2} from "../src/v2/ReputationRegistryV2.sol";
import {TestToken} from "./PactFlow.t.sol";

contract PactV2Handler is Test {
    PactEscrowV2 public pact;
    VerifierRegistryV2 public registry;
    address public client;
    address public worker;
    address public arbitrator;
    uint256 public verifierKey;
    bool public replayAccepted;

    constructor(
        PactEscrowV2 pact_,
        VerifierRegistryV2 registry_,
        address client_,
        address worker_,
        address arbitrator_,
        uint256 key_
    ) {
        pact = pact_;
        registry = registry_;
        client = client_;
        worker = worker_;
        arbitrator = arbitrator_;
        verifierKey = key_;
    }

    function submit(uint256 seed) external {
        uint256 id = seed % 2;
        PactEscrowV2.Milestone memory m = pact.milestone(id);
        if ((m.submitted && !m.revisionRequired) || block.timestamp > m.dueAt || pact.completed()) return;
        vm.prank(worker);
        try pact.submit(id, keccak256(abi.encode(id)), "ipfs://data") {} catch {}
    }

    function approve(uint256 seed) external {
        uint256 id = seed % 2;
        vm.prank(client);
        try pact.approve(id, pact.milestone(id).submissionId, keccak256("manual-report")) {} catch {}
    }

    function attest(uint256 seed) external {
        uint256 id = seed % 2;
        PactEscrowV2.Milestone memory m = pact.milestone(id);
        if (!m.submitted || m.settled || m.aiAttested || block.timestamp > m.reviewDeadline) return;
        VerifierRegistryV2.Attestation memory a = VerifierRegistryV2.Attestation({
            pact: address(pact),
            milestoneId: id,
            deliverableHash: m.deliverableHash,
            rulesHash: m.rulesHash,
            submissionId: m.submissionId,
            reportHash: keccak256(abi.encode(id, m.submissionId)),
            approved: true,
            nonce: id + 1,
            expiry: block.timestamp + 1 hours,
            verifier: vm.addr(verifierKey)
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierKey, registry.hashAttestation(a));
        try pact.attest(id, a, abi.encodePacked(r, s, v)) {} catch {}
    }

    function revise(uint256 seed) external {
        uint256 id = seed % 2;
        PactEscrowV2.Milestone memory m = pact.milestone(id);
        vm.prank(client);
        try pact.requestRevision(id, m.submissionId, keccak256(abi.encode(seed))) {} catch {}
    }

    function dispute(uint256 seed) external {
        vm.prank(client);
        try pact.openDispute(seed % 2) {} catch {}
    }

    function resolve(uint256 seed) external {
        uint256 id = seed % 2;
        PactEscrowV2.Milestone memory m = pact.milestone(id);
        uint256 award = seed % (m.amount + 1);
        uint256 clientSlash = pact.clientBondBalance() == 0 ? 0 : seed % (pact.clientBondBalance() + 1);
        uint256 workerSlash = pact.workerBondBalance() == 0 ? 0 : seed % (pact.workerBondBalance() + 1);
        vm.prank(arbitrator);
        try pact.resolveDispute(id, award, clientSlash, workerSlash) {} catch {}
    }

    function timeout(uint256 seed) external {
        vm.prank(worker);
        try pact.claimReviewTimeout(seed % 2) {} catch {}
    }

    function advance(uint256 seed) external {
        vm.warp(block.timestamp + seed % 12 hours);
    }

    function replay(uint256 seed) external {
        uint256 consumedId = seed % 2;
        uint256 id = 1 - consumedId;
        PactEscrowV2.Milestone memory m = pact.milestone(id);
        if (
            !registry.usedNonce(vm.addr(verifierKey), consumedId + 1) || !m.submitted || m.settled || m.aiAttested
                || m.disputed || block.timestamp > m.reviewDeadline
        ) return;
        VerifierRegistryV2.Attestation memory a = VerifierRegistryV2.Attestation({
            pact: address(pact),
            milestoneId: id,
            deliverableHash: m.deliverableHash,
            rulesHash: m.rulesHash,
            submissionId: m.submissionId,
            reportHash: keccak256(abi.encode(id, m.submissionId)),
            approved: true,
            nonce: consumedId + 1,
            expiry: block.timestamp + 1 hours,
            verifier: vm.addr(verifierKey)
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierKey, registry.hashAttestation(a));
        try pact.attest(id, a, abi.encodePacked(r, s, v)) {
            replayAccepted = true;
        } catch {}
    }
}

contract PactFlowV2Invariant is Test {
    uint256 internal constant KEY = 0xBEEF;
    TestToken internal token;
    PactEscrowV2 internal pact;
    VerifierRegistryV2 internal registry;
    PactV2Handler internal handler;

    function setUp() public {
        address client = makeAddr("invariant-client");
        address worker = makeAddr("invariant-worker");
        address arbitrator = makeAddr("invariant-arbitrator");
        token = new TestToken();
        registry = new VerifierRegistryV2(address(this));
        ReputationRegistryV2 reputation = new ReputationRegistryV2(address(this));
        PactFactoryV2 factory =
            new PactFactoryV2(address(this), address(registry), address(reputation), makeAddr("treasury"), 500);
        registry.setFactory(address(factory));
        reputation.setFactory(address(factory));
        registry.register(vm.addr(KEY), 1, "ipfs://verifier", keccak256("verifier"));
        PactEscrowV2.Config memory c = PactEscrowV2.Config({
            client: client,
            worker: worker,
            token: address(token),
            arbitrator: arbitrator,
            totalBudget: 1_000,
            clientBond: 100,
            workerBond: 80,
            acceptanceDeadline: uint64(block.timestamp + 1 days),
            reviewPeriod: 1 days,
            agreementHash: keccak256("spec")
        });
        PactEscrowV2.MilestoneInput[] memory inputs = new PactEscrowV2.MilestoneInput[](2);
        inputs[0] = PactEscrowV2.MilestoneInput(
            400, uint64(block.timestamp + 2 days), keccak256("rule0"), PactEscrowV2.Mode.Hybrid, 2, vm.addr(KEY)
        );
        inputs[1] = PactEscrowV2.MilestoneInput(
            600, uint64(block.timestamp + 3 days), keccak256("rule1"), PactEscrowV2.Mode.Hybrid, 2, vm.addr(KEY)
        );
        vm.prank(client);
        pact = PactEscrowV2(factory.createPact(c, inputs));
        token.mint(client, 1_100);
        token.mint(worker, 80);
        vm.startPrank(client);
        token.approve(address(pact), 1_100);
        pact.fund();
        vm.stopPrank();
        vm.startPrank(worker);
        token.approve(address(pact), 80);
        pact.accept();
        vm.stopPrank();
        handler = new PactV2Handler(pact, registry, client, worker, arbitrator, KEY);
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = handler.submit.selector;
        selectors[1] = handler.approve.selector;
        selectors[2] = handler.attest.selector;
        selectors[3] = handler.dispute.selector;
        selectors[4] = handler.resolve.selector;
        selectors[5] = handler.timeout.selector;
        selectors[6] = handler.advance.selector;
        selectors[7] = handler.replay.selector;
        selectors[8] = handler.revise.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_releasedBudgetNeverExceedsTotal() public view {
        assertLe(pact.releasedBudget(), pact.totalBudget());
        assertLe(pact.settledBudget(), pact.totalBudget());
    }

    function invariant_escrowCoversAllUnsettledObligations() public view {
        uint256 obligations =
            pact.totalBudget() - pact.settledBudget() + pact.clientBondBalance() + pact.workerBondBalance();
        assertEq(token.balanceOf(address(pact)), obligations);
    }

    function invariant_noMilestoneSettledTwice() public view {
        uint256 count;
        uint256 amount;
        for (uint256 i; i < pact.milestoneCount(); ++i) {
            PactEscrowV2.Milestone memory m = pact.milestone(i);
            if (m.settled) {
                count++;
                amount += m.amount;
            }
        }
        assertEq(pact.settledCount(), count);
        assertEq(pact.settledBudget(), amount);
    }

    function invariant_consumedAttestationNeverReused() public view {
        assertFalse(handler.replayAccepted());
    }
}
