import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateResults } from "./aggregate";
import { verificationPolicySchema, type VerificationPolicy } from "../policy";
import type { RuleResult } from "../rules/deterministic";

const policy: VerificationPolicy = {
  version: 1,
  name: "test",
  mode: "AI_ONLY",
  minScore: 80,
  requireAllMandatoryRules: true,
  semanticVerificationEnabled: true,
  rules: [
    {
      id: "http",
      type: "HTTP_STATUS",
      target: "",
      expected: 200,
      weight: 40,
      required: true,
    },
    {
      id: "semantic",
      type: "LLM_RUBRIC",
      rubric: "Check completion",
      criteria: ["Complete"],
      weight: 60,
      required: false,
    },
  ],
};
const result = (id: string, passed: boolean, score: number): RuleResult => ({
  ruleId: id,
  ruleType: id === "http" ? "HTTP_STATUS" : "LLM_RUBRIC",
  required: id === "http",
  weight: id === "http" ? 40 : 60,
  passed,
  score,
  summary: "",
  evidence: {},
  durationMs: 0,
});
test("required failure and low confidence prevent automatic settlement", () => {
  assert.equal(
    aggregateResults(
      policy,
      [result("http", false, 0), result("semantic", true, 60)],
      "HIGH",
    ).passed,
    false,
  );
  assert.equal(
    aggregateResults(
      policy,
      [result("http", true, 40), result("semantic", true, 50)],
      "LOW",
    ).passed,
    false,
  );
  assert.equal(
    aggregateResults(
      policy,
      [result("http", true, 40), result("semantic", true, 30)],
      "HIGH",
    ).passed,
    false,
  );
  assert.equal(
    aggregateResults(
      policy,
      [result("http", true, 40), result("semantic", true, 60)],
      "HIGH",
      true,
    ).passed,
    false,
  );
  assert.equal(
    aggregateResults(
      policy,
      [result("http", true, 40), result("semantic", true, 60)],
      "HIGH",
    ).passed,
    true,
  );
});

test("aggregation binds rule identities, weights and threshold cardinality", () => {
  const checked = [
    { ...result("http", true, 40), required: false },
    { ...result("semantic", false, 0), required: false },
  ];
  const threshold = {
    ...policy,
    minScore: 0,
    rules: policy.rules.map((r) => ({ ...r, required: false })),
    aggregation: { mode: "THRESHOLD" as const, threshold: 2 },
  };
  assert.equal(aggregateResults(threshold, checked, "HIGH").passed, false);
  assert.equal(
    aggregateResults(
      { ...threshold, aggregation: { mode: "THRESHOLD", threshold: 1 } },
      checked,
      "HIGH",
    ).passed,
    true,
  );
  assert.equal(
    aggregateResults(
      policy,
      [result("http", true, 100), result("http", true, 100)],
      "HIGH",
    ).passed,
    false,
  );
  assert.equal(
    aggregateResults(
      policy,
      [
        result("http", true, 100),
        { ...result("semantic", true, 100), ruleId: "forged" },
      ],
      "HIGH",
    ).passed,
    false,
  );
  assert.equal(
    aggregateResults(
      policy,
      [result("http", true, 100), result("semantic", true, 100)],
      "HIGH",
    ).score,
    100,
  );
  assert.equal(
    verificationPolicySchema.safeParse({
      ...threshold,
      aggregation: { mode: "THRESHOLD", threshold: 3 },
    }).success,
    false,
  );
  assert.equal(
    verificationPolicySchema.safeParse({
      ...threshold,
      aggregation: { mode: "SINGLE", threshold: 1 },
    }).success,
    false,
  );
});
