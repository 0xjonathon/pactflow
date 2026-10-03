import type { VerificationPolicy } from "../policy";
import type { RuleResult } from "../rules/deterministic";

export type AggregateResult = { passed: boolean; score: number; confidence: "LOW" | "MEDIUM" | "HIGH"; failedRequired: string[] };
export function aggregateResults(policy: VerificationPolicy, results: RuleResult[], semanticConfidence?: "LOW" | "MEDIUM" | "HIGH", fatalError = false): AggregateResult {
  const required = policy.rules.filter(rule => rule.required);
  const failedRequired = required.filter(rule => !results.some(result => result.ruleId === rule.id && result.passed)).map(rule => rule.id);
  const score = results.reduce((total, result) => total + Math.min(result.weight, Math.max(0, result.score)), 0);
  const confidence = semanticConfidence ?? (results.length === policy.rules.length ? "HIGH" : "LOW");
  const passed = !fatalError && policy.rules.length > 0 && results.length === policy.rules.length && failedRequired.length === 0 && score >= policy.minScore && confidence !== "LOW";
  return { passed, score, confidence, failedRequired };
}
