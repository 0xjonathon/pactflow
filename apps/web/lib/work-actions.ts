import type { Job, Proposal } from "./product";
import type { MessageKey } from "./i18n";
export function workAction(
  job: Job,
  requester: boolean,
  proposal?: Pick<Proposal, "status">,
): { href: string; label: MessageKey } {
  if (job.escrowAddress) {
    const labels: Record<string, [MessageKey, MessageKey]> = {
      Created: ["dashboard.fund", "journey.needFunds"],
      Funded: ["journey.waitingAccept", "dashboard.accept"],
      Active: ["dashboard.wait", "dashboard.submit"],
      Submitted: ["dashboard.review", "journey.waitReview"],
      RevisionRequired: ["dashboard.wait", "journey.needRevision"],
      Completed: ["journey.workCompleted", "journey.workCompleted"],
    };
    return {
      href: `/pacts/${job.escrowAddress}`,
      label:
        labels[job.pactStatus ?? ""]?.[requester ? 0 : 1] ??
        "jobs.openWorkspace",
    };
  }
  if (requester && job.status === "DRAFT")
    return { href: `/jobs/new?draft=${job.id}`, label: "journey.resumeDraft" };
  if (requester && job.status === "MATCHED")
    return { href: `/jobs/${job.id}/collaborate`, label: "jobs.reviewDraft" };
  return {
    href: `/jobs/${job.id}`,
    label: requester
      ? "journey.viewApplications"
      : proposal?.status === "ACCEPTED"
        ? "journey.awaitRequester"
        : "journey.viewApplication",
  };
}
