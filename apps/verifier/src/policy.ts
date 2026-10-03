import { z } from "zod";
import { canonicalizeAgreement, type CanonicalValue } from "@pactflow/sdk";
import { keccak256, toBytes, type Hex } from "viem";

const ruleBase = {
  id: z.string().min(1).max(80),
  required: z.boolean(),
  weight: z.number().int().min(0).max(100),
  evidenceLabel: z.string().max(160).optional(),
};
const httpRule = z.object({
  ...ruleBase,
  type: z.literal("HTTP_STATUS"),
  target: z.string().max(2048),
  expected: z.number().int().min(100).max(599),
});
const selectorRule = z.object({
  ...ruleBase,
  type: z.literal("DOM_SELECTOR"),
  selector: z.string().min(1).max(300),
});
const textRule = z.object({
  ...ruleBase,
  type: z.literal("DOM_TEXT"),
  selector: z.string().min(1).max(300),
  contains: z.string().min(1).max(500),
});
const jsonRule = z.object({
  ...ruleBase,
  type: z.literal("JSON_SCHEMA"),
  schema: z.record(z.string(), z.unknown()),
});
const apiRule = z.object({
  ...ruleBase,
  type: z.literal("API_RESPONSE"),
  target: z.string().max(2048),
  expectedStatus: z.number().int().min(100).max(599),
  jsonPath: z.string().max(200).optional(),
  operator: z.enum(["EXISTS", "EQUALS", "CONTAINS", "GTE", "GT"]).optional(),
  expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
const lighthouseRule = z.object({
  ...ruleBase,
  type: z.literal("LIGHTHOUSE"),
  category: z.enum(["performance", "accessibility", "best-practices", "seo"]),
  operator: z.enum([">=", ">", "=="]),
  minimum: z.number().int().min(0).max(100),
});
const fileHashRule = z.object({
  ...ruleBase,
  type: z.literal("FILE_HASH"),
  expectedHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});
const rubricRule = z.object({
  ...ruleBase,
  type: z.literal("LLM_RUBRIC"),
  rubric: z.string().min(1).max(2000),
  criteria: z.array(z.string().min(1).max(500)).min(1).max(12),
});

const githubRule = z.object({
  ...ruleBase,
  type: z.literal("GITHUB_CI"),
  repository: z.string().regex(/^[-\w.]+\/[-\w.]+$/),
  requiredChecks: z.array(z.string().min(1).max(100)).min(1).max(20),
  requiredAppId: z.number().int().positive(),
});
export const verificationRuleSchema = z.discriminatedUnion("type", [
  httpRule,
  selectorRule,
  textRule,
  jsonRule,
  apiRule,
  lighthouseRule,
  fileHashRule,
  rubricRule,
  githubRule,
  z.object({
    ...ruleBase,
    type: z.literal("ORACLE"),
    adapterId: z.string().min(1).max(80),
    adapterAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    adapterVersion: z.string().min(1).max(64),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("CUSTOM"),
    adapterId: z.string().min(1).max(80),
    adapterAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    adapterVersion: z.string().min(1).max(64),
  }),
]);
export const verificationPolicySchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(120),
    mode: z.enum(["AI_ONLY", "HYBRID"]),
    minScore: z.number().int().min(0).max(100),
    requireAllMandatoryRules: z.literal(true),
    aggregation: z
      .object({
        mode: z.enum(["SINGLE", "ALL_REQUIRED", "THRESHOLD"]),
        threshold: z.number().int().positive(),
      })
      .optional(),
    semanticVerificationEnabled: z.boolean(),
    rules: z.array(verificationRuleSchema).min(1).max(32),
  })
  .superRefine((policy, context) => {
    if (
      policy.aggregation &&
      (policy.aggregation.threshold > policy.rules.length ||
        (policy.aggregation.mode === "SINGLE" && policy.rules.length !== 1))
    )
      context.addIssue({
        code: "custom",
        message: "Invalid aggregation cardinality",
        path: ["aggregation"],
      });
    if (
      new Set(policy.rules.map((rule) => rule.id)).size !== policy.rules.length
    )
      context.addIssue({
        code: "custom",
        message: "Rule IDs must be unique",
        path: ["rules"],
      });
    if (policy.rules.reduce((sum, rule) => sum + rule.weight, 0) !== 100)
      context.addIssue({
        code: "custom",
        message: "Rule weights must sum to 100",
        path: ["rules"],
      });
    if (
      !policy.semanticVerificationEnabled &&
      policy.rules.some((rule) => rule.type === "LLM_RUBRIC")
    )
      context.addIssue({
        code: "custom",
        message: "Semantic rule requires semanticVerificationEnabled",
        path: ["rules"],
      });
  });

export type VerificationRule = z.infer<typeof verificationRuleSchema>;
export type VerificationPolicy = z.infer<typeof verificationPolicySchema>;
export function canonicalizeVerificationPolicy(input: unknown): string {
  const policy = verificationPolicySchema.parse(input);
  return canonicalizeAgreement(policy as CanonicalValue);
}
export function hashVerificationPolicy(input: unknown): Hex {
  return keccak256(toBytes(canonicalizeVerificationPolicy(input)));
}

export const artifactDescriptorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("WEB"), url: z.url() }),
  z.object({ kind: z.literal("JSON"), url: z.url() }),
  z.object({ kind: z.literal("API"), url: z.url() }),
  z.object({ kind: z.literal("FILE"), url: z.url() }),
  z.object({ kind: z.literal("TEXT"), text: z.string().max(100_000) }),
]);
export type ArtifactDescriptor = z.infer<typeof artifactDescriptorSchema>;
