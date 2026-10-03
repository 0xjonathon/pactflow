import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateResults } from "./aggregate";
import type { VerificationPolicy } from "../policy";
import type { RuleResult } from "../rules/deterministic";

const policy: VerificationPolicy = { version: 1, name: "test", mode: "AI_ONLY", minScore: 80, requireAllMandatoryRules: true, semanticVerificationEnabled: true,
  rules: [{ id: "http", type: "HTTP_STATUS", target: "", expected: 200, weight: 40, required: true }, { id: "semantic", type: "LLM_RUBRIC", rubric: "Check completion", criteria: ["Complete"], weight: 60, required: false }] };
const result = (id: string, passed: boolean, score: number): RuleResult => ({ ruleId: id, ruleType: id === "http" ? "HTTP_STATUS" : "LLM_RUBRIC", required: id === "http", weight: id === "http" ? 40 : 60, passed, score, summary: "", evidence: {}, durationMs: 0 });
test("required failure and low confidence prevent automatic settlement", () => {
  assert.equal(aggregateResults(policy, [result("http", false, 0), result("semantic", true, 60)], "HIGH").passed, false);
  assert.equal(aggregateResults(policy, [result("http", true, 40), result("semantic", true, 50)], "LOW").passed, false);
  assert.equal(aggregateResults(policy, [result("http", true, 40), result("semantic", true, 30)], "HIGH").passed, false);
  assert.equal(aggregateResults(policy, [result("http", true, 40), result("semantic", true, 60)], "HIGH", true).passed, false);
  assert.equal(aggregateResults(policy, [result("http", true, 40), result("semantic", true, 60)], "HIGH").passed, true);
});
