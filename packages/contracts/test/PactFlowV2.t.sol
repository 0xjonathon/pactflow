// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Test} from "forge-std/Test.sol";
import {TestToken} from "./PactFlow.t.sol";
import {PactEscrowV2} from "../src/v2/PactEscrowV2.sol";
import {PactFactoryV2} from "../src/v2/PactFactoryV2.sol";
import {VerifierRegistryV2} from "../src/v2/VerifierRegistryV2.sol";
import {ReputationRegistryV2} from "../src/v2/ReputationRegistryV2.sol";

contract PactFlowV2Test is Test {
    uint256 constant KEY = 0xA11CE;
    address client = makeAddr("client");
    address worker = makeAddr("worker");
    address arb = makeAddr("arb");
    TestToken token;
    VerifierRegistryV2 registry;
    ReputationRegistryV2 rep;
    PactFactoryV2 factory;
    PactEscrowV2 pact;

    function setUp() public {
        token = new TestToken();
        registry = new VerifierRegistryV2(address(this));
        rep = new ReputationRegistryV2(address(this));
        factory = new PactFactoryV2(address(this), address(registry), address(rep), address(this), 0);
        registry.setFactory(address(factory));
        rep.setFactory(address(factory));
        registry.register(vm.addr(KEY), 1, "verifier", keccak256("verifier"));
        token.mint(client, 1100);
        token.mint(worker, 100);
    }

    function start(PactEscrowV2.Mode mode, uint8 limit) internal {
        PactEscrowV2.Config memory c = PactEscrowV2.Config(
            client,
            worker,
            address(token),
            arb,
            1000,
            100,
            100,
            uint64(block.timestamp + 1 days),
            1 days,
            keccak256("spec")
        );
        PactEscrowV2.MilestoneInput[] memory m = new PactEscrowV2.MilestoneInput[](1);
        m[0] = PactEscrowV2.MilestoneInput(
            1000, uint64(block.timestamp + 7 days), keccak256("rules"), mode, limit, vm.addr(KEY)
        );
        vm.prank(client);
        pact = PactEscrowV2(factory.createPact(c, m));
        vm.startPrank(client);
        token.approve(address(pact), 1100);
        pact.fund();
        vm.stopPrank();
        vm.startPrank(worker);
        token.approve(address(pact), 100);
        pact.accept();
        vm.stopPrank();
    }

    function submit(bytes32 h) internal {
        vm.prank(worker);
        pact.submit(0, h, "pactflow:evidence:private-reference");
    }

    function attestation(bool pass, uint256 nonce) internal view returns (VerifierRegistryV2.Attestation memory a) {
        PactEscrowV2.Milestone memory m = pact.milestone(0);
        a = VerifierRegistryV2.Attestation(
            address(pact),
            0,
            m.deliverableHash,
            m.rulesHash,
            m.submissionId,
            keccak256(abi.encode(nonce)),
            pass,
            nonce,
            block.timestamp + 1 days,
            vm.addr(KEY)
        );
    }

    function signature(VerifierRegistryV2.Attestation memory a) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(KEY, registry.hashAttestation(a));
        return abi.encodePacked(r, s, v);
    }

    function verify(bool pass, uint256 nonce) internal {
        VerifierRegistryV2.Attestation memory a = attestation(pass, nonce);
        pact.attest(0, a, signature(a));
    }

    function testRevisionAfterFailurePassPaysExactlyOnceAndPreservesHistory() public {
        start(PactEscrowV2.Mode.AIOnly, 2);
        submit(keccak256("first"));
        verify(false, 1);
        assertTrue(pact.milestone(0).revisionRequired);
        assertEq(token.balanceOf(worker), 0);
        assertEq(token.balanceOf(address(pact)), 1200);
        submit(keccak256("second"));
        verify(true, 2);
        assertTrue(pact.completed());
        assertEq(token.balanceOf(worker), 1100);
        assertEq(token.balanceOf(client), 100);
        (bytes32 first,,, bytes32 report, uint8 verdict) = pact.submissions(0, 1);
        assertEq(first, keccak256("first"));
        assertTrue(report != 0);
        assertEq(verdict, 2);
        (, uint64 milestones,,,) = rep.facts(worker);
        assertEq(milestones, 1);
        VerifierRegistryV2.Attestation memory duplicate = attestation(true, 3);
        bytes memory duplicateSig = signature(duplicate);
        vm.expectRevert(PactEscrowV2.InvalidState.selector);
        pact.attest(0, duplicate, duplicateSig);
    }

    function testOldSubmissionSignatureRejectedEvenForSameEvidence() public {
        start(PactEscrowV2.Mode.AIOnly, 2);
        submit(keccak256("same"));
        VerifierRegistryV2.Attestation memory old = attestation(true, 20);
        bytes memory sig = signature(old);
        verify(false, 1);
        submit(keccak256("same"));
        vm.expectRevert(PactEscrowV2.InvalidAttestation.selector);
        pact.attest(0, old, sig);
        verify(true, 2);
    }

    function testDifferentRegisteredVerifierCannotJudgePact() public {
        start(PactEscrowV2.Mode.AIOnly, 2);
        submit(keccak256("work"));
        registry.register(vm.addr(99), 1, "other", keccak256("other"));
        VerifierRegistryV2.Attestation memory a = attestation(true, 1);
        a.verifier = vm.addr(99);
        vm.expectRevert(PactEscrowV2.InvalidAttestation.selector);
        pact.attest(0, a, "");
    }

    function testManualRevisionRequiresClientAndCurrentSequence() public {
        start(PactEscrowV2.Mode.ClientOnly, 2);
        submit(keccak256("work"));
        vm.expectRevert(PactEscrowV2.Unauthorized.selector);
        pact.requestRevision(0, 1, keccak256("reason"));
        vm.prank(client);
        pact.requestRevision(0, 1, keccak256("reason"));
        submit(keccak256("revision"));
        vm.prank(client);
        vm.expectRevert(PactEscrowV2.InvalidState.selector);
        pact.approve(0, 1, keccak256("manual-report"));
        vm.prank(client);
        pact.approve(0, 2, keccak256("manual-report"));
        assertTrue(pact.completed());
    }

    function testLimitExhaustionFreezesFundsForArbitration() public {
        start(PactEscrowV2.Mode.AIOnly, 0);
        submit(keccak256("work"));
        verify(false, 1);
        assertTrue(pact.milestone(0).disputed);
        vm.prank(worker);
        vm.expectRevert(PactEscrowV2.InvalidState.selector);
        pact.submit(0, keccak256("late"), "ref");
        vm.prank(arb);
        pact.resolveDispute(0, 400, 0, 0);
        assertEq(token.balanceOf(worker), 500);
        assertEq(token.balanceOf(client), 700);
        assertEq(token.balanceOf(address(pact)), 0);
    }

    function testExpiryCannotReleaseOrStealFunds() public {
        start(PactEscrowV2.Mode.ClientOnly, 2);
        vm.warp(block.timestamp + 8 days);
        pact.expireMilestone(0);
        assertTrue(pact.milestone(0).disputed);
        assertEq(token.balanceOf(address(pact)), 1200);
        vm.expectRevert(PactEscrowV2.Unauthorized.selector);
        pact.resolveDispute(0, 0, 0, 0);
        vm.prank(arb);
        pact.resolveDispute(0, 0, 0, 0);
        assertEq(token.balanceOf(client), 1100);
    }

    function testHybridRevisionClearsBothApprovalsAndCannotTimeoutSettleFailure() public {
        start(PactEscrowV2.Mode.Hybrid, 2);
        submit(keccak256("work"));
        verify(true, 1);
        vm.prank(client);
        pact.requestRevision(0, 1, keccak256("missing requirement"));
        assertFalse(pact.milestone(0).aiAttested);
        vm.warp(block.timestamp + 2 days);
        vm.prank(worker);
        vm.expectRevert(PactEscrowV2.InvalidState.selector);
        pact.claimReviewTimeout(0);
        submit(keccak256("fixed"));
        verify(true, 2);
        assertFalse(pact.completed());
        vm.prank(client);
        pact.approve(0, 2, keccak256("manual-report"));
        assertTrue(pact.completed());
    }

    function testFuzzBoundedRevisionsAndEscrowInvariant(uint8 revisions) public {
        revisions = uint8(bound(revisions, 0, 10));
        start(PactEscrowV2.Mode.AIOnly, revisions);
        for (uint256 i = 1; i <= uint256(revisions) + 1; i++) {
            submit(keccak256(abi.encode(i)));
            verify(false, i);
            assertEq(token.balanceOf(address(pact)), 1200);
            assertEq(pact.releasedBudget(), 0);
        }
        assertTrue(pact.milestone(0).disputed);
        assertEq(pact.milestone(0).submissionId, uint256(revisions) + 1);
    }

    function testTamperedReportAndExpiredProofFailClosed() public {
        start(PactEscrowV2.Mode.AIOnly, 2);
        submit(keccak256("work"));
        VerifierRegistryV2.Attestation memory a = attestation(true, 1);
        bytes memory sig = signature(a);
        a.reportHash = keccak256("tampered");
        vm.expectRevert(VerifierRegistryV2.InvalidSignature.selector);
        pact.attest(0, a, sig);
        a = attestation(true, 2);
        sig = signature(a);
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(PactEscrowV2.InvalidState.selector);
        pact.attest(0, a, sig);
    }
}
