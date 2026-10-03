import type { VerificationPolicy } from "../policy";
import type { RuleResult } from "../rules/deterministic";

export type AggregateResult = {
  passed: boolean;
  score: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  failedRequired: string[];
};
export function aggregateResults(
  policy: VerificationPolicy,
  results: RuleResult[],
  semanticConfidence?: "LOW" | "MEDIUM" | "HIGH",
  fatalError = false,
): AggregateResult {
  const required = policy.rules.filter((rule) => rule.required);
  const failedRequired = required
    .filter(
      (rule) =>
        !results.some((result) => result.ruleId === rule.id && result.passed),
    )
    .map((rule) => rule.id);
  const unique = new Map(results.map((r) => [r.ruleId, r]));
  const complete =
    results.length === policy.rules.length &&
    unique.size === results.length &&
    policy.rules.every((rule) => unique.has(rule.id));
  const score = policy.rules.reduce((total, rule) => {
    const result = unique.get(rule.id);
    return (
      total + (result ? Math.min(rule.weight, Math.max(0, result.score)) : 0)
    );
  }, 0);
  const confidence =
    semanticConfidence ??
    (results.length === policy.rules.length ? "HIGH" : "LOW");
  const passed =
    !fatalError &&
    policy.rules.length > 0 &&
    complete &&
    failedRequired.length === 0 &&
    score >= policy.minScore &&
    confidence !== "LOW" &&
    (policy.aggregation?.mode !== "THRESHOLD" ||
      results.filter((r) => r.passed).length >= policy.aggregation.threshold) &&
    (policy.aggregation?.mode !== "ALL_REQUIRED" ||
      results.every((r) => !r.required || r.passed));
  return { passed, score, confidence, failedRequired };
}
