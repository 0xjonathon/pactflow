import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "./product";
import { workAction } from "./work-actions";
const job = { id: "brief", status: "MATCHED" } as Job;
test("only requester reviews and funds selected collaboration; partner waits for it", () => {
  assert.deepEqual(workAction(job, true), {
    href: "/jobs/brief/collaborate",
    label: "jobs.reviewDraft",
  });
  assert.deepEqual(workAction(job, false, { status: "ACCEPTED" }), {
    href: "/jobs/brief",
    label: "journey.awaitRequester",
  });
  assert.equal(
    workAction({ ...job, status: "DRAFT" }, true).href,
    "/jobs/new?draft=brief",
  );
});
test("funding, acceptance, review and revision next actions follow real role and protocol state", () => {
  const linked = { ...job, escrowAddress: "escrow" };
  assert.equal(
    workAction({ ...linked, pactStatus: "Created" }, true).label,
    "dashboard.fund",
  );
  assert.equal(
    workAction({ ...linked, pactStatus: "Created" }, false).label,
    "journey.needFunds",
  );
  assert.equal(
    workAction({ ...linked, pactStatus: "Funded" }, false).label,
    "dashboard.accept",
  );
  assert.equal(
    workAction({ ...linked, pactStatus: "Submitted" }, true).label,
    "dashboard.review",
  );
  assert.equal(
    workAction({ ...linked, pactStatus: "RevisionRequired" }, false).label,
    "journey.needRevision",
  );
  assert.equal(
    workAction({ ...linked, pactStatus: "Completed" }, false).label,
    "journey.workCompleted",
  );
});
