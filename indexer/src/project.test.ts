import { test } from "node:test";
import assert from "node:assert/strict";
import { projectV2Pact } from "./project";
import { aggregateReputation, type IndexedEvent } from "./aggregate";
const escrow = "0x1111111111111111111111111111111111111111";
const client = "0x2222222222222222222222222222222222222222";
const worker = "0x3333333333333333333333333333333333333333";
const hash = "0x" + "a".repeat(64);
let index = 0;
function event(name: string, args: Record<string, unknown>): IndexedEvent {
  const i = index++;
  return {
    id: String(i),
    chainId: 10143,
    txHash: `0x${String(i).padStart(64, "0")}`,
    logIndex: 0,
    blockNumber: i + 1,
    blockHash: hash,
    address: escrow,
    name,
    args,
    timestamp: new Date(1000_000 + i * 1000),
  };
}
const configuration = () => [
  event("PactCreated", { pact: escrow, client, worker }),
  event("PactConfigured", {
    pact: escrow,
    token: client,
    totalBudget: "100",
    clientBond: "5",
    workerBond: "2",
    agreementHash: hash,
    acceptanceDeadline: "1100",
    reviewPeriod: "60",
    arbitrator: client,
  }),
  event("MilestoneConfigured", {
    pact: escrow,
    id: "0",
    amount: "100",
    dueAt: "1200",
    rulesHash: hash,
    mode: 2,
    maxRevisions: 2,
    verifier: client,
  }),
  event("Funded", { budget: "100" }),
  event("Accepted", { worker }),
];
test("V2 event model reconstructs revision history, same-transaction settlement and hybrid metrics without RPC", () => {
  index = 0;
  const logs = configuration();
  logs.push(
    event("Submitted", {
      id: 0,
      submissionId: 1,
      deliverableHash: hash,
      deliverableURI: "pactflow:first",
    }),
    event("VerificationRecorded", {
      id: 0,
      submissionId: 1,
      approved: false,
      reportHash: hash,
    }),
    event("RevisionRequested", { id: 0, submissionId: 1, reportHash: hash }),
  );
  let pact = projectV2Pact(escrow, logs)!;
  assert.equal(pact.status, "RevisionRequired");
  assert.equal(pact.releasedBudget, 0n);
  logs.push(
    event("Submitted", {
      id: 0,
      submissionId: 2,
      deliverableHash: hash,
      deliverableURI: "pactflow:second",
    }),
  );
  pact = projectV2Pact(escrow, logs)!;
  assert.equal(pact.milestones[0].aiAttested, false);
  assert.equal(pact.milestones[0].clientApproved, false);
  logs.push(
    event("VerificationRecorded", {
      id: 0,
      submissionId: 2,
      approved: true,
      reportHash: hash,
    }),
    event("ClientApprovalRecorded", {
      id: 0,
      submissionId: 2,
      approvalHash: hash,
    }),
    event("MilestoneSettled", {
      id: 0,
      workerAward: "99",
      clientRefund: "0",
      fee: "1",
    }),
    event("Completed", {}),
  );
  pact = projectV2Pact(escrow, [...logs].reverse().concat(logs))!;
  assert.equal(pact.status, "Completed");
  assert.equal(pact.settledBudget, 100n);
  assert.equal(pact.releasedBudget, 99n);
  assert.equal(pact.clientBond, 0n);
  assert.equal(pact.milestones[0].submissionId, 2n);
  const metrics = aggregateReputation([pact], [...logs, ...logs]).facts.get(
    worker,
  )!;
  assert.equal(metrics.verificationRuns, 2);
  assert.equal(metrics.passRate, 50);
  assert.equal(metrics.revisionRate, 100);
  assert.equal(metrics.onTimeRate, 100);
  assert.equal(metrics.settledVolume, "99");
  // Reorg replacement removes the orphan settlement and its resulting reputation.
  const canonical = logs.slice(0, -2);
  const reverted = projectV2Pact(escrow, canonical)!;
  assert.equal(reverted.status, "Submitted");
  assert.equal(reverted.releasedBudget, 0n);
  assert.equal(
    aggregateReputation([reverted], canonical).facts.get(worker)!
      .completedPacts,
    0,
  );
});
test("missing V2 configuration never manufactures a Pact", () => {
  assert.equal(projectV2Pact(escrow, [event("Completed", {})]), null);
});
