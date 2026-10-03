export type PactPhase =
  | "AGREED"
  | "FUNDED"
  | "ACCEPTED"
  | "WORKING"
  | "SUBMITTED"
  | "VERIFYING"
  | "VERIFIED"
  | "REVISION_REQUIRED"
  | "SETTLED"
  | "CANCELLED"
  | "EXPIRED"
  | "DISPUTED"
  | "RESOLVED";
export type EvidenceType =
  | "GITHUB_REPOSITORY"
  | "PULL_REQUEST"
  | "DEPLOYMENT_URL"
  | "FILE"
  | "TEXT"
  | "IMAGE"
  | "TRANSACTION"
  | "API_ENDPOINT"
  | "JSON"
  | "OTHER_URL";
export type Visibility = "PUBLIC" | "PARTICIPANTS" | "VERIFIER";
export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  source: string;
  label: string;
  submittedBy: string;
  submittedAt: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  visibility: Visibility;
  status: "READY" | "QUARANTINED" | "REJECTED";
}
export interface VerifierPolicy {
  version: number;
  members: Array<{
    id: string;
    type: "MANUAL" | "AI" | "GITHUB_CI" | "ORACLE" | "CUSTOM";
    required: boolean;
  }>;
  aggregation: "ALL_REQUIRED" | "THRESHOLD";
  threshold: number;
}
export interface PactSpec {
  version: 2;
  title: string;
  outcome: string;
  context?: string;
  skills?: string[];
  client: string;
  worker: string;
  arbitrator: string;
  token: string;
  totalBudget: string;
  clientBond: string;
  workerBond: string;
  acceptanceDeadline: string;
  reviewPeriod: string;
  maxRevisions: number;
  milestones: Array<{
    title: string;
    acceptanceCriteria: string[];
    requiredEvidence: EvidenceType[];
    amount: string;
    dueAt: string;
  }>;
  verifier: string;
  policy: Record<string, unknown> | null;
  visibility: "PUBLIC" | "PARTICIPANTS";
}
export const transitions: Record<PactPhase, readonly PactPhase[]> = {
  AGREED: ["FUNDED", "CANCELLED", "EXPIRED"],
  FUNDED: ["ACCEPTED", "CANCELLED", "EXPIRED"],
  ACCEPTED: ["WORKING", "SUBMITTED", "EXPIRED"],
  WORKING: ["SUBMITTED", "EXPIRED"],
  SUBMITTED: ["VERIFYING", "VERIFIED", "REVISION_REQUIRED", "DISPUTED"],
  VERIFYING: ["VERIFIED", "REVISION_REQUIRED", "DISPUTED"],
  VERIFIED: ["SETTLED", "REVISION_REQUIRED", "DISPUTED"],
  REVISION_REQUIRED: ["SUBMITTED", "DISPUTED", "EXPIRED"],
  SETTLED: [],
  CANCELLED: [],
  EXPIRED: ["DISPUTED", "RESOLVED"],
  DISPUTED: ["RESOLVED"],
  RESOLVED: [],
};
export function assertTransition(from: PactPhase, to: PactPhase) {
  if (!transitions[from].includes(to))
    throw new Error("INVALID_STATE_TRANSITION");
}
export function canRevise(input: {
  submissionId: number;
  maxRevisions: number;
  dueAt: number;
  now: number;
  revisionRequired: boolean;
  settled: boolean;
  disputed: boolean;
}) {
  return (
    input.revisionRequired &&
    !input.settled &&
    !input.disputed &&
    input.submissionId < input.maxRevisions + 1 &&
    input.now <= input.dueAt
  );
}
export function publicEvidence(items: EvidenceItem[]) {
  return items.filter(
    (item) => item.visibility === "PUBLIC" && item.status === "READY",
  );
}

/** API representations use decimal strings, retaining exact token and timestamp values. */
export interface Submission {
  id: string;
  escrowAddress: string;
  milestoneIndex: number;
  sequence: number;
  manifestHash: string;
  reference: string;
  submittedBy: string;
  status: "PREPARED" | "CONFIRMED";
  txHash: string | null;
  manifest: { version: 2; evidence: EvidenceItem[] };
}
export type VerificationProcessingState =
  | "QUEUED"
  | "FETCHING"
  | "DETERMINISTIC"
  | "SEMANTIC"
  | "AGGREGATING"
  | "SIGNING"
  | "SUBMITTING"
  | "PASSED"
  | "FAILED"
  | "ERROR";
export interface VerificationRun {
  id: string;
  protocolVersion: 1 | 2;
  escrowAddress: string;
  milestoneIndex: number;
  submissionSequence: number;
  deliverableHash: string;
  rulesHash: string;
  status: VerificationProcessingState;
  errorCode?: string | null;
}
export interface Attestation {
  pact: string;
  milestoneId: string;
  deliverableHash: string;
  rulesHash: string;
  submissionId: string;
  reportHash: string;
  approved: boolean;
  nonce: string;
  expiry: string;
  verifier: string;
  digest: string;
  signature: string;
}
