import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBrief, type BriefFields } from "./brief-validation";
const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
const fields: BriefFields = {
  title: "设计",
  description: "完成图标",
  requirements: "",
  skills: "设计，SVG",
  budget: "1",
  deadline,
  verificationMode: "ClientOnly",
  clientDeposit: "0",
  url: "",
  performance: "80",
  minScore: "80",
};
const milestones = [{ title: "图标", amount: "1", dueAt: deadline }];
test("manual briefs accept short Chinese work and do not require partner wallets or websites", () => {
  assert.deepEqual(validateBrief(fields, milestones), []);
  assert.equal(
    validateBrief({ ...fields, title: " " }, milestones)[0].field,
    "title",
  );
});
test("automatic briefs reject unavailable semantic checks and malformed website input", () => {
  const issues = validateBrief(
    {
      ...fields,
      verificationMode: "Hybrid",
      semantic: "pixel accuracy",
      aiAvailable: false,
    },
    milestones,
  );
  assert.ok(
    issues.some((i) => i.field === "semantic" && i.code === "aiUnavailable"),
  );
  assert.ok(issues.some((i) => i.field === "url"));
  assert.deepEqual(
    validateBrief(
      {
        ...fields,
        verificationMode: "Hybrid",
        url: "https://example.com",
        semantic: "",
        aiAvailable: false,
      },
      milestones,
    ),
    [],
  );
});
test("brief money and dates reject zero, excess precision, mismatched budget and unsupported expiry", () => {
  assert.ok(
    validateBrief(fields, [{ ...milestones[0], amount: "0" }]).some(
      (i) => i.code === "positiveAmount",
    ),
  );
  assert.ok(
    validateBrief({ ...fields, budget: "1.0000001" }, milestones).some(
      (i) => i.field === "budget",
    ),
  );
  assert.ok(
    validateBrief({ ...fields, budget: "2" }, milestones).some(
      (i) => i.code === "milestoneTotal",
    ),
  );
  assert.ok(
    validateBrief(
      {
        ...fields,
        deadline: new Date(Date.now() + 366 * 86400000).toISOString(),
      },
      milestones,
    ).some((i) => i.code === "deadlineRange"),
  );
});
