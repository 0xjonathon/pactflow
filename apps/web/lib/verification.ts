import { hashVerificationPolicy, verificationPolicySchema, type VerificationPolicy } from "@pactflow/verifier/policy";
import { parseVerifiedDataUri, type CanonicalValue } from "@pactflow/sdk";
import type { Hex } from "viem";

export type VerificationPreset = "WEBSITE" | "JSON" | "API" | "CUSTOM";
export function readAgreementUri(uri: string, onchainHash: Hex, mode: "ClientOnly" | "AIOnly" | "Hybrid" | "Arbitrator"): CanonicalValue | null {
  if (mode === "ClientOnly" || mode === "Arbitrator") return parseVerifiedDataUri(uri, onchainHash);
  const prefix = "data:application/json;charset=utf-8,";
  if (!uri.startsWith(prefix)) return null;
  try {
    const value = JSON.parse(decodeURIComponent(uri.slice(prefix.length))) as Record<string, unknown>;
    const milestone = Array.isArray(value.milestones) ? value.milestones[0] as Record<string, unknown> : null;
    if (!milestone?.verificationPolicy || hashVerificationPolicy(milestone.verificationPolicy).toLowerCase() !== onchainHash.toLowerCase()) return null;
    return value as CanonicalValue;
  } catch { return null; }
}
export function buildVerificationPolicy(input: { preset: VerificationPreset; mode: "AI_ONLY" | "HYBRID"; url: string; requiredText: string; selector: string; minPerformance: number; semanticRequirement: string; minScore: number; advancedJson?: string }): VerificationPolicy {
  if (input.preset === "CUSTOM") return verificationPolicySchema.parse(JSON.parse(input.advancedJson || "{}"));
  const rules: VerificationPolicy["rules"] = [];
  if (input.preset === "WEBSITE") {
    rules.push({ id: "site-reachable", type: "HTTP_STATUS", target: input.url, expected: 200, weight: 20, required: true });
    if (input.selector.trim()) rules.push({ id: "required-selector", type: "DOM_SELECTOR", selector: input.selector.trim(), weight: 20, required: true });
    if (input.requiredText.trim()) rules.push({ id: "required-text", type: "DOM_TEXT", selector: "body", contains: input.requiredText.trim(), weight: 20, required: true });
    if (input.minPerformance > 0) rules.push({ id: "lighthouse-performance", type: "LIGHTHOUSE", category: "performance", operator: ">=", minimum: input.minPerformance, weight: 20, required: true });
  } else if (input.preset === "JSON") {
    rules.push({ id: "json-schema", type: "JSON_SCHEMA", schema: { type: "object" }, weight: 50, required: true });
  } else {
    rules.push({ id: "api-response", type: "API_RESPONSE", target: input.url, expectedStatus: 200, weight: 50, required: true });
  }
  if (input.semanticRequirement.trim()) rules.push({ id: "semantic", type: "LLM_RUBRIC", rubric: input.semanticRequirement.trim(), criteria: [input.semanticRequirement.trim()], weight: 1, required: false });
  const fixed = rules.reduce((sum, rule) => sum + rule.weight, 0);
  rules[rules.length - 1].weight += 100 - fixed;
  const policy = verificationPolicySchema.parse({ version: 1, name: `${input.preset} verification`, mode: input.mode, minScore: input.minScore,
    requireAllMandatoryRules: true, semanticVerificationEnabled: !!input.semanticRequirement.trim(), rules });
  hashVerificationPolicy(policy);
  return policy;
}
