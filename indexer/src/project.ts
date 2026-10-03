import {
  resolvePactStatus,
  type PactView,
  type MilestoneView,
} from "@pactflow/sdk";
import type { Address, Hex } from "viem";
import type { IndexedEvent } from "./aggregate";
export function projectV2Pact(
  escrow: Address,
  input: IndexedEvent[],
): PactView | null {
  const events = [
    ...new Map(
      input.map((e) => [`${e.chainId}:${e.txHash}:${e.logIndex}`, e]),
    ).values(),
  ]
    .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
    .filter(
      (e) =>
        e.address.toLowerCase() === escrow.toLowerCase() ||
        String(e.args.pact).toLowerCase() === escrow.toLowerCase(),
    );
  const creation = events.find((e) => e.name === "PactCreated");
  const config = events.find((e) => e.name === "PactConfigured");
  if (!creation || !config) return null;
  const value = (key: string) => BigInt(String(config.args[key]));
  const client = String(creation.args.client) as Address;
  const fixed = String(creation.args.worker) as Address;
  const milestones: MilestoneView[] = events
    .filter((e) => e.name === "MilestoneConfigured")
    .map((e) => ({
      id: BigInt(String(e.args.id)),
      amount: BigInt(String(e.args.amount)),
      dueAt: BigInt(String(e.args.dueAt)),
      rulesHash: String(e.args.rulesHash) as Hex,
      mode: (["ClientOnly", "AIOnly", "Hybrid", "Arbitrator"] as const)[
        Number(e.args.mode)
      ],
      maxRevisions: Number(e.args.maxRevisions),
      verifier: String(e.args.verifier) as Address,
      submissionId: 0n,
      revisionRequired: false,
      deliverableHash: `0x${"0".repeat(64)}` as Hex,
      deliverableURI: "",
      aiAttested: false,
      clientApproved: false,
      status: "Pending" as const,
    }))
    .sort((a, b) => Number(a.id - b.id));
  if (!milestones.length) return null;
  const pact: PactView = {
    protocolVersion: 2,
    pactId: escrow,
    escrowAddress: escrow,
    client,
    fixedWorker: /^0x0{40}$/i.test(fixed) ? undefined : fixed,
    settlementToken: String(config.args.token) as Address,
    totalBudget: value("totalBudget"),
    clientBond: value("clientBond"),
    workerBond: value("workerBond"),
    fundedBudget: 0n,
    releasedBudget: 0n,
    settledBudget: 0n,
    agreementHash: String(config.args.agreementHash) as Hex,
    status: "Created",
    milestones,
    acceptanceDeadline: value("acceptanceDeadline"),
    reviewPeriod: value("reviewPeriod"),
    arbitrator: String(config.args.arbitrator) as Address,
  };
  let accepted = false;
  for (const e of events) {
    const m = milestones[Number(e.args.id)];
    if (e.name === "Funded") pact.fundedBudget = BigInt(String(e.args.budget));
    if (e.name === "Accepted") {
      accepted = true;
      pact.worker = String(e.args.worker) as Address;
    }
    if (e.name === "Submitted" && m) {
      m.submissionId = BigInt(String(e.args.submissionId));
      m.deliverableHash = String(e.args.deliverableHash) as Hex;
      m.deliverableURI = String(e.args.deliverableURI);
      m.submittedAt = BigInt(Math.floor(+e.timestamp / 1000));
      m.reviewDeadline = m.submittedAt + pact.reviewPeriod;
      m.revisionRequired = false;
      m.clientApproved = false;
      m.aiAttested = false;
      m.status = "Submitted";
    }
    if (e.name === "VerificationRecorded" && m) {
      m.aiAttested = e.args.approved === true;
      m.reportHash = String(e.args.reportHash) as Hex;
    }
    if (e.name === "ClientApprovalRecorded" && m) {
      m.clientApproved = true;
      if (m.mode === "ClientOnly")
        m.reportHash = String(e.args.approvalHash) as Hex;
    }
    if (e.name === "RevisionRequested" && m) {
      m.status = "RevisionRequired";
      m.revisionRequired = true;
      m.aiAttested = false;
      m.clientApproved = false;
      m.reportHash = String(e.args.reportHash) as Hex;
    }
    if (e.name === "DisputeOpened" && m) m.status = "Disputed";
    if (e.name === "MilestoneSettled" && m && m.status !== "Paid") {
      m.status = "Paid";
      if (m.mode === "ClientOnly" || m.mode === "Hybrid")
        m.clientApproved = true;
      pact.settledBudget = (pact.settledBudget ?? 0n) + m.amount;
      pact.releasedBudget += BigInt(String(e.args.workerAward));
    }
    if (e.name === "BondSlashed") {
      pact.clientBond -= BigInt(String(e.args.clientSlash));
      pact.workerBond -= BigInt(String(e.args.workerSlash));
    }
    if (e.name === "Completed") {
      pact.status = "Completed";
      pact.clientBond = 0n;
      pact.workerBond = 0n;
    }
    if (e.name === "Cancelled") {
      pact.status = "Cancelled";
      pact.clientBond = 0n;
      pact.workerBond = 0n;
      pact.fundedBudget = 0n;
    }
  }
  pact.status = resolvePactStatus({
    cancelled: pact.status === "Cancelled",
    completed: pact.status === "Completed",
    accepted,
    funded: pact.fundedBudget > 0n,
    milestones,
  });
  return pact;
}
