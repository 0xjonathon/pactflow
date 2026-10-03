import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runDeterministicRule } from "./deterministic";
import type { FetchedArtifact } from "../security/fetch-artifact";
import type { VerificationRule } from "../policy";

const body = Buffer.from("<html><body><h1>Monad analytics</h1><button data-testid='connect-wallet'>Connect Wallet</button></body></html>");
const artifact: FetchedArtifact = { url: "https://example.com/", status: 200, contentType: "text/html", body, redirects: [] };
const base = { id: "test", weight: 100, required: true };
const run = (rule: VerificationRule, value = artifact) => runDeterministicRule(rule as Exclude<VerificationRule, { type: "LLM_RUBRIC" }>, { artifact: value, lighthouse: async () => ({ performance: 92, accessibility: 90, "best-practices": 88, seo: 95 }) });

test("HTTP, DOM, and Lighthouse pass and fail on actual evidence", async () => {
  assert.equal((await run({ ...base, type: "HTTP_STATUS", target: "", expected: 200 })).passed, true);
  assert.equal((await run({ ...base, type: "HTTP_STATUS", target: "", expected: 404 })).passed, false);
  assert.equal((await run({ ...base, type: "DOM_SELECTOR", selector: "[data-testid='connect-wallet']" })).passed, true);
  assert.equal((await run({ ...base, type: "DOM_SELECTOR", selector: "#missing" })).passed, false);
  assert.equal((await run({ ...base, type: "DOM_TEXT", selector: "h1", contains: "Monad" })).passed, true);
  assert.equal((await run({ ...base, type: "DOM_TEXT", selector: "h1", contains: "Ethereum" })).passed, false);
  assert.equal((await run({ ...base, type: "LIGHTHOUSE", category: "performance", operator: ">=", minimum: 90 })).passed, true);
  assert.equal((await run({ ...base, type: "LIGHTHOUSE", category: "performance", operator: ">=", minimum: 95 })).passed, false);
});
test("JSON schema, API path, and file hash validate content", async () => {
  const jsonArtifact = { ...artifact, contentType: "application/json", body: Buffer.from('{"name":"PactFlow","count":3}') };
  assert.equal((await run({ ...base, type: "JSON_SCHEMA", schema: { type: "object", required: ["name"] } }, jsonArtifact)).passed, true);
  assert.equal((await run({ ...base, type: "JSON_SCHEMA", schema: { type: "object", required: ["missing"] } }, jsonArtifact)).passed, false);
  assert.equal((await run({ ...base, type: "API_RESPONSE", target: "", expectedStatus: 200, jsonPath: "count", operator: "GTE", expected: 3 }, jsonArtifact)).passed, true);
  assert.equal((await run({ ...base, type: "API_RESPONSE", target: "", expectedStatus: 200, jsonPath: "count", operator: "GT", expected: 3 }, jsonArtifact)).passed, false);
  const hash = `0x${createHash("sha256").update(body).digest("hex")}`;
  assert.equal((await run({ ...base, type: "FILE_HASH", expectedHash: hash }, artifact)).passed, true);
  assert.equal((await run({ ...base, type: "FILE_HASH", expectedHash: `0x${"0".repeat(64)}` }, artifact)).passed, false);
});
