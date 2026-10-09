import test from "node:test";
import assert from "node:assert/strict";
import { currentRoomView } from "./pact-room-navigation";
const milestone = (status: string, submissionId = "0") => ({
  status,
  submissionId,
  aiAttested: false,
  clientApproved: false,
});
const pact = {
  client: "0xCLIENT",
  worker: "0xWORKER",
  status: "Submitted",
  milestones: [milestone("Paid", "1"), milestone("Submitted", "2")],
};
test("client enters the current submitted milestone rather than overview or a paid milestone", () => {
  assert.deepEqual(
    { ...currentRoomView(pact, "0xclient"), fingerprint: "" },
    { fingerprint: "", tab: "verification", selected: 1 },
  );
});
test("manual tab persists only while actual business progress matches", () => {
  const saved = { ...currentRoomView(pact), tab: "overview" as const };
  assert.equal(currentRoomView(pact, undefined, saved).tab, "overview");
  const updated = {
    ...pact,
    milestones: [milestone("Paid", "1"), milestone("Submitted", "3")],
  };
  assert.equal(currentRoomView(updated, undefined, saved).tab, "verification");
});
test("revision routes the worker to delivery and the client to feedback", () => {
  const revision = {
    ...pact,
    status: "RevisionRequired",
    milestones: [milestone("Paid"), milestone("RevisionRequired", "1")],
  };
  assert.equal(currentRoomView(revision, "0xWoRkEr").tab, "evidence");
  assert.equal(currentRoomView(revision, "0xclient").tab, "verification");
});
test("mixed milestone states prioritize the viewer's pending action", () => {
  const mixed = {
    ...pact,
    status: "RevisionRequired",
    milestones: [milestone("RevisionRequired"), milestone("Submitted")],
  };
  assert.equal(currentRoomView(mixed, "0xclient").selected, 1);
  assert.equal(currentRoomView(mixed, "0xworker").selected, 0);
});
test("funding, acceptance, completion, and cancellation use appropriate views", () => {
  for (const status of ["Created", "Funded", "Completed"])
    assert.equal(currentRoomView({ ...pact, status }).tab, "overview");
  assert.equal(
    currentRoomView({ ...pact, status: "Cancelled" }).tab,
    "activity",
  );
  assert.equal(
    currentRoomView(
      { ...pact, status: "Active", milestones: [milestone("Pending")] },
      "0xworker",
    ).tab,
    "evidence",
  );
});
test("invalid stored views and outdated milestone indices are discarded", () => {
  const saved = currentRoomView(pact);
  for (const invalid of [
    { ...saved, tab: "bogus" },
    { ...saved, selected: -1 },
    { ...saved, selected: 32 },
    { ...saved, selected: 1.5 },
    null,
  ])
    assert.equal(currentRoomView(pact, undefined, invalid).tab, "verification");
});
test("disputes enter verification, including for the arbitrator", () => {
  assert.equal(
    currentRoomView(
      { ...pact, status: "Disputed", milestones: [milestone("Disputed")] },
      "0xarb",
    ).tab,
    "verification",
  );
});
