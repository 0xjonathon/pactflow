import { verifyGitHubCI } from "./github";
import { createHash } from "node:crypto";
import Ajv from "ajv";
import { load } from "cheerio";
import type { VerificationRule } from "../policy";
import {
  fetchArtifact,
  type FetchedArtifact,
  type FetchLimits,
} from "../security/fetch-artifact";

export type RuleResult = {
  ruleId: string;
  ruleType: VerificationRule["type"];
  required: boolean;
  weight: number;
  passed: boolean;
  score: number;
  summary: string;
  evidence: Record<string, unknown>;
  durationMs: number;
};
export type LighthouseScores = Record<
  "performance" | "accessibility" | "best-practices" | "seo",
  number
>;
export type LighthouseRunner = (url: string) => Promise<LighthouseScores>;
export type RuleContext = {
  artifact: FetchedArtifact;
  limits?: FetchLimits;
  lighthouse?: LighthouseRunner;
};
const ajv = new Ajv({ allErrors: true, strict: false });

function targetUrl(artifact: FetchedArtifact, target: string): string {
  return new URL(target || ".", artifact.url).href;
}
async function targetArtifact(
  context: RuleContext,
  target: string,
): Promise<FetchedArtifact> {
  const url = targetUrl(context.artifact, target);
  return url === context.artifact.url
    ? context.artifact
    : fetchArtifact(url, context.limits);
}
function jsonPath(root: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      root,
    );
}
function apiMatches(
  value: unknown,
  operator: string,
  expected: unknown,
): boolean {
  if (operator === "EXISTS") return value !== undefined;
  if (operator === "EQUALS") return value === expected;
  if (operator === "CONTAINS")
    return (
      typeof value === "string" &&
      typeof expected === "string" &&
      value.includes(expected)
    );
  if (operator === "GTE")
    return (
      typeof value === "number" &&
      typeof expected === "number" &&
      value >= expected
    );
  if (operator === "GT")
    return (
      typeof value === "number" &&
      typeof expected === "number" &&
      value > expected
    );
  return false;
}

export async function runDeterministicRule(
  rule: Exclude<VerificationRule, { type: "LLM_RUBRIC" }>,
  context: RuleContext,
): Promise<RuleResult> {
  const started = performance.now();
  let passed = false;
  let evidence: Record<string, unknown> = {};
  let summary = "Rule failed";
  try {
    switch (rule.type) {
      case "GITHUB_CI": {
        const item = JSON.parse(context.artifact.body.toString()) as {
          commit?: string;
          source?: string;
        };
        if (!item.commit)
          throw Object.assign(new Error("Pinned commit missing"), {
            code: "INVALID_GITHUB_EVIDENCE",
          });
        const source = new URL(item.source ?? "");
        if (
          source.hostname !== "github.com" ||
          source.pathname
            .split("/")
            .filter(Boolean)
            .slice(0, 2)
            .join("/")
            .toLowerCase() !== rule.repository.toLowerCase()
        )
          throw new Error("GITHUB_REPOSITORY_MISMATCH");
        const result = await verifyGitHubCI(rule, item.commit);
        passed = result.passed;
        evidence = result;
        summary = passed
          ? "Required checks passed for pinned commit"
          : "Required checks missing or failed";
        break;
      }
      case "HTTP_STATUS": {
        const response = await targetArtifact(context, rule.target);
        passed = response.status === rule.expected;
        evidence = {
          url: response.url,
          status: response.status,
          expected: rule.expected,
        };
        summary = passed ? "HTTP status matched" : "HTTP status did not match";
        break;
      }
      case "DOM_SELECTOR": {
        const $ = load(context.artifact.body.toString("utf8"));
        const found = $(rule.selector).length > 0;
        passed = found;
        evidence = { selector: rule.selector, found };
        summary = found ? "Selector was found" : "Selector was missing";
        break;
      }
      case "DOM_TEXT": {
        const $ = load(context.artifact.body.toString("utf8"));
        const text = $(rule.selector)
          .first()
          .text()
          .replace(/\s+/g, " ")
          .trim();
        passed = text.includes(rule.contains);
        evidence = {
          selector: rule.selector,
          contains: rule.contains,
          textExcerpt: text.slice(0, 300),
        };
        summary = passed
          ? "Required text was found"
          : "Required text was missing";
        break;
      }
      case "JSON_SCHEMA": {
        const value: unknown = JSON.parse(
          context.artifact.body.toString("utf8"),
        );
        const validate = ajv.compile(rule.schema);
        passed = !!validate(value);
        evidence = {
          valid: passed,
          errors:
            validate.errors?.slice(0, 5).map((item) => ({
              path: item.instancePath,
              message: item.message,
            })) ?? [],
        };
        summary = passed ? "JSON schema matched" : "JSON schema did not match";
        break;
      }
      case "API_RESPONSE": {
        const response = await targetArtifact(context, rule.target);
        const statusMatched = response.status === rule.expectedStatus;
        const value: unknown = rule.jsonPath
          ? jsonPath(JSON.parse(response.body.toString("utf8")), rule.jsonPath)
          : undefined;
        passed =
          statusMatched &&
          (!rule.jsonPath ||
            apiMatches(value, rule.operator ?? "EXISTS", rule.expected));
        evidence = {
          url: response.url,
          status: response.status,
          expectedStatus: rule.expectedStatus,
          jsonPath: rule.jsonPath,
          actual: value,
        };
        summary = passed
          ? "API response matched"
          : "API response did not match";
        break;
      }
      case "LIGHTHOUSE": {
        if (!context.lighthouse)
          throw new Error("Lighthouse runner is unavailable");
        const scores = await context.lighthouse(context.artifact.url);
        const actual = scores[rule.category];
        passed =
          rule.operator === ">="
            ? actual >= rule.minimum
            : rule.operator === ">"
              ? actual > rule.minimum
              : actual === rule.minimum;
        evidence = {
          category: rule.category,
          actual,
          operator: rule.operator,
          minimum: rule.minimum,
        };
        summary = passed
          ? "Lighthouse threshold met"
          : "Lighthouse threshold not met";
        break;
      }
      case "FILE_HASH": {
        const actualHash = `0x${createHash("sha256").update(context.artifact.body).digest("hex")}`;
        passed = actualHash.toLowerCase() === rule.expectedHash.toLowerCase();
        evidence = {
          algorithm: "SHA-256",
          expectedHash: rule.expectedHash,
          actualHash,
          bytes: context.artifact.body.length,
        };
        summary = passed ? "File hash matched" : "File hash did not match";
        break;
      }
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (
      [
        "ARTIFACT_UNREACHABLE",
        "GITHUB_UNAVAILABLE",
        "CI_PENDING",
        "SCANNER_UNAVAILABLE",
        "STORAGE_UNAVAILABLE",
      ].includes(code)
    )
      throw error;
    if (rule.type === "LIGHTHOUSE" && !(error instanceof SyntaxError))
      throw Object.assign(new Error("Check runner unavailable"), {
        code: "CHECK_UNAVAILABLE",
      });
    // An invalid artifact or missing runner is a failed rule, never an implicit pass.
    evidence = {
      errorCode:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "RULE_ERROR",
    };
    summary = "Rule could not be completed";
  }
  return {
    ruleId: rule.id,
    ruleType: rule.type,
    required: rule.required,
    weight: rule.weight,
    passed,
    score: passed ? rule.weight : 0,
    summary,
    evidence,
    durationMs: Math.round(performance.now() - started),
  };
}
