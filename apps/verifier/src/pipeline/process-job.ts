import { createPactPublicClient, monadTestnet } from "@pactflow/chain";
import { type Address, type Hex } from "viem";
import { verificationPolicySchema } from "../policy";
import { fetchArtifact, type FetchLimits } from "../security/fetch-artifact";
import { runDeterministicRule, type LighthouseRunner, type RuleResult } from "../rules/deterministic";
import { createLighthouseRunner } from "../rules/lighthouse";
import { OpenAISemanticProvider, type SemanticVerifierProvider } from "../providers/semantic-provider";
import { VerificationRepository } from "../storage/repository";
import { aggregateResults } from "./aggregate";
import { loadAndValidateOnchain } from "./onchain";
import { createVerificationReport } from "./report";
import { signAndSubmitAttestation, verifierAccount } from "./attest";

export type ProcessorOptions = { rpcUrl?: string; fetchLimits?: FetchLimits; lighthouse?: LighthouseRunner; semantic?: SemanticVerifierProvider; jobTimeoutMs?: number };
export async function processVerificationJob(jobId: string, repository: VerificationRepository, options: ProcessorOptions = {}) {
  const started = performance.now();
  const log = (step: string) => console.log(JSON.stringify({ jobId, step, durationMs: Math.round(performance.now() - started) }));
  const job = await repository.getJob(jobId);
  if (!job || job.status !== "QUEUED") return;
  try {
    await repository.setStatus(jobId, "FETCHING"); log("fetching");
    const policyRecord = await repository.getPolicy(job.escrowAddress as Address, job.milestoneIndex, job.rulesHash as Hex);
    if (!policyRecord) throw Object.assign(new Error("Policy is missing"), { code: "INVALID_POLICY" });
    const policy = verificationPolicySchema.parse(policyRecord.policy);
    const chain = await loadAndValidateOnchain({ escrow: job.escrowAddress as Address, milestoneIndex: job.milestoneIndex, policy, expectedDeliverableHash: job.deliverableHash as Hex, rpcUrl: options.rpcUrl });
    if (chain.milestone.deliverableURI !== job.deliverableUri) throw Object.assign(new Error("Deliverable URI changed"), { code: "DELIVERABLE_HASH_MISMATCH" });
    const limits = { ...options.fetchLimits, allowLocalhost: options.fetchLimits?.allowLocalhost ?? process.env.VERIFIER_ALLOW_LOCALHOST === "true" };
    const artifact = await fetchArtifact(chain.previewUrl, limits);
    await repository.setStatus(jobId, "DETERMINISTIC"); log("deterministic");
    const results: RuleResult[] = [];
    const lighthouse = options.lighthouse ?? createLighthouseRunner(limits);
    for (const rule of policy.rules) {
      if (rule.type === "LLM_RUBRIC") continue;
      results.push(await runDeterministicRule(rule, { artifact, limits, lighthouse }));
    }
    await repository.saveRuleResults(jobId, results);
    const requiredFailed = results.some(result => result.required && !result.passed);
    let confidence: "LOW" | "MEDIUM" | "HIGH" | undefined;
    if (!requiredFailed) {
      const semanticRules = policy.rules.filter(rule => rule.type === "LLM_RUBRIC");
      if (semanticRules.length) {
        await repository.setStatus(jobId, "SEMANTIC"); log("semantic");
        const semantic = options.semantic ?? new OpenAISemanticProvider({ apiKey: process.env.OPENAI_API_KEY ?? "", model: process.env.AI_MODEL ?? "", baseUrl: process.env.AI_BASE_URL,
          maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS || 12000), maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 1200), timeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000) });
        for (const rule of semanticRules) {
          const began = performance.now();
          const result = await semantic.verify({ rubric: rule.rubric, criteria: rule.criteria.map((text, i) => ({ id: `${rule.id}:${i}`, text })), artifact, deterministicEvidence: results });
          confidence = result.confidence === "LOW" ? "LOW" : confidence === "LOW" ? "LOW" : result.confidence;
          results.push({ ruleId: rule.id, ruleType: rule.type, required: rule.required, weight: rule.weight, passed: result.passed && result.confidence !== "LOW", score: Math.round(rule.weight * result.score / 100), summary: result.summary,
            evidence: { confidence: result.confidence, criteria: result.criteria }, durationMs: Math.round(performance.now() - began) });
        }
        await repository.saveRuleResults(jobId, results.filter(result => result.ruleType === "LLM_RUBRIC"));
      }
    } else {
      for (const rule of policy.rules.filter(rule => rule.type === "LLM_RUBRIC")) results.push({ ruleId: rule.id, ruleType: rule.type, required: rule.required, weight: rule.weight, passed: false, score: 0, summary: "Skipped because a required deterministic rule failed", evidence: { skipped: true }, durationMs: 0 });
      await repository.saveRuleResults(jobId, results.filter(result => result.ruleType === "LLM_RUBRIC"));
    }
    await repository.setStatus(jobId, "AGGREGATING"); log("aggregating");
    const aggregate = aggregateResults(policy, results, confidence);
    const report = createVerificationReport({ chainId: monadTestnet.id, escrow: job.escrowAddress as Address, milestone: job.milestoneIndex, deliverableHash: job.deliverableHash as Hex,
      deliverableURI: job.deliverableUri, policy, rulesHash: chain.rulesHash, result: aggregate, checks: results, verifier: verifierAccount().address });
    const reportUri = `data:application/json;charset=utf-8,${encodeURIComponent(report.canonical)}`;
    if (!aggregate.passed) {
      await repository.saveReport(jobId, { report: report.report, hash: report.reportHash, uri: reportUri });
      await repository.setStatus(jobId, "FAILED", { score: aggregate.score, passed: false, verifierAddress: verifierAccount().address }); log("failed");
      return { ...report, status: "FAILED" as const };
    }
    if (performance.now() - started > (options.jobTimeoutMs ?? 120_000)) throw Object.assign(new Error("Job timed out"), { code: "SEMANTIC_PROVIDER_ERROR" });
    await repository.setStatus(jobId, "SIGNING"); log("signing");
    // Re-read immutable submission and Pact state immediately before signing.
    await loadAndValidateOnchain({ escrow: job.escrowAddress as Address, milestoneIndex: job.milestoneIndex, policy, expectedDeliverableHash: job.deliverableHash as Hex, rpcUrl: options.rpcUrl });
    await repository.setStatus(jobId, "SUBMITTING"); log("submitting");
    const proof = await signAndSubmitAttestation({ escrow: job.escrowAddress as Address, milestone: BigInt(job.milestoneIndex), deliverableHash: job.deliverableHash as Hex, rulesHash: chain.rulesHash, reportHash: report.reportHash, rpcUrl: options.rpcUrl });
    await repository.saveReport(jobId, { report: report.report, hash: report.reportHash, uri: reportUri, digest: proof.digest, signature: proof.signature, txHash: proof.txHash, block: proof.blockNumber, nonce: proof.attestation.nonce });
    await repository.setStatus(jobId, "PASSED", { score: aggregate.score, passed: true, verifierAddress: proof.verifier }); log("passed");
    return { ...report, status: "PASSED" as const, proof };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "CHAIN_TX_REVERTED";
    await repository.setStatus(jobId, "ERROR", { errorCode: code, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown verification error" });
    log("error");
    throw error;
  }
}
