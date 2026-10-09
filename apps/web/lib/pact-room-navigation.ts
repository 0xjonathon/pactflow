export const pactRoomTabs = [
  "overview",
  "milestones",
  "evidence",
  "verification",
  "activity",
] as const;
export type PactRoomTab = (typeof pactRoomTabs)[number];
type Progress = {
  status: string;
  client: string;
  worker?: string;
  fixedWorker?: string;
  milestones: Array<{
    status: string;
    submissionId?: string;
    aiAttested: boolean;
    clientApproved: boolean;
  }>;
};
export type RoomView = {
  fingerprint: string;
  tab: PactRoomTab;
  selected: number;
};
export function progressFingerprint(pact: Progress) {
  return JSON.stringify([
    pact.status,
    pact.milestones.map((m) => [
      m.status,
      m.submissionId ?? "0",
      m.aiAttested,
      m.clientApproved,
    ]),
  ]);
}
export function currentRoomView(
  pact: Progress,
  address?: string,
  saved?: unknown,
): RoomView {
  const fingerprint = progressFingerprint(pact);
  if (saved && typeof saved === "object") {
    const view = saved as Partial<RoomView>;
    if (
      view.fingerprint === fingerprint &&
      pactRoomTabs.includes(view.tab as PactRoomTab) &&
      Number.isInteger(view.selected) &&
      view.selected! >= 0 &&
      view.selected! < pact.milestones.length
    )
      return view as RoomView;
  }
  const builder =
    !!address &&
    (pact.worker ?? pact.fixedWorker)?.toLowerCase() === address.toLowerCase();
  const priority = builder
    ? ["Disputed", "RevisionRequired", "Pending", "Submitted"]
    : ["Disputed", "Submitted", "RevisionRequired", "Pending"];
  let selected = 0;
  for (const status of priority) {
    const index = pact.milestones.findIndex((m) => m.status === status);
    if (index >= 0) {
      selected = index;
      break;
    }
  }
  let tab: PactRoomTab = "overview";
  if (pact.status === "Cancelled") tab = "activity";
  else if (!["Created", "Funded", "Completed"].includes(pact.status)) {
    const status = pact.milestones[selected]?.status;
    if (status === "Disputed" || status === "Submitted") tab = "verification";
    else if (status === "RevisionRequired")
      tab = builder ? "evidence" : "verification";
    else tab = builder ? "evidence" : "milestones";
  }
  return { fingerprint, tab, selected };
}
