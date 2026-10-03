import type { PactStatus, MilestoneStatus } from "./types";
/** Deterministic projection of contract facts. Processing jobs never alter this state. */
export function resolvePactStatus(input: {
  cancelled: boolean;
  completed: boolean;
  accepted: boolean;
  funded: boolean;
  milestones: ReadonlyArray<{ status: MilestoneStatus }>;
}): PactStatus {
  if (input.cancelled) return "Cancelled";
  if (input.completed) return "Completed";
  if (input.milestones.some((m) => m.status === "Disputed")) return "Disputed";
  if (input.milestones.some((m) => m.status === "RevisionRequired"))
    return "RevisionRequired";
  if (input.milestones.some((m) => m.status === "Submitted"))
    return "Submitted";
  return input.accepted ? "Active" : input.funded ? "Funded" : "Created";
}
