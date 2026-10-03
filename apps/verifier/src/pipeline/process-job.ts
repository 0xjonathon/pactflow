import { createPactPublicClient, monadTestnet } from "@pactflow/chain";
import { type Address, type Hex } from "viem";
import { verificationPolicySchema } from "../policy";
import { fetchArtifact, type FetchLimits } from "../security/fetch-artifact";
import {
  runDeterministicRule,
  type LighthouseRunner,
  type RuleResult,
} from "../rules/deterministic";
import { createLighthouseRunner } from "../rules/lighthouse";
import {
  OpenAISemanticProvider,
  type SemanticVerifierProvider,
} from "../providers/semantic-provider";
import { VerificationRepository } from "../storage/repository";
import { aggregateResults } from "./aggregate";
import { loadAndValidateOnchain } from "./onchain";
import { createVerificationReport } from "./report";
import { signAndSubmitAttestation, verifierAccount } from "./attest";

export type ProcessorOptions = {
  rpcUrl?: string;
  fetchLimits?: FetchLimits;
  lighthouse?: LighthouseRunner;
  semantic?: SemanticVerifierProvider;
  jobTimeoutMs?: number;
};
export async function processVerificationJob(
  jobId: string,
  repository: VerificationRepository,
  options: ProcessorOptions = {},
) {
  const started = performance.now();
  const log = (step: string) =>
    console.log(
      JSON.stringify({
        jobId,
        step,
        durationMs: Math.round(performance.now() - started),
      }),
    );
  const job = await repository.claimJob(jobId);
  if (!job) return;
  const deadline = () => {
    if (performance.now() - started > (options.jobTimeoutMs ?? 120_000))
      throw Object.assign(new Error("Verification service timed out"), {
        code: "VERIFICATION_TIMEOUT",
      });
  };
  const heartbeat = setInterval(() => {
    void repository.heartbeat(jobId).catch(() => {});
  }, 30_000);
  try {
    const existing = await repository.getReport(jobId);
    if (existing?.attestationTxHash && existing.rawTransaction) {
      const client = createPactPublicClient(options.rpcUrl);
      try {
        await client.getTransaction({
          hash: existing.attestationTxHash as Hex,
        });
      } catch {
        await client.sendRawTransaction({
          serializedTransaction: existing.rawTransaction as Hex,
        });
      }
      const receipt = await client.waitForTransactionReceipt({
        hash: existing.attestationTxHash as Hex,
        confirmations: 3,
      });
      if (receipt.status !== "success")
        throw Object.assign(new Error("Attestation reverted"), {
          code: "CHAIN_TX_REVERTED",
        });
      const report =
        existing.canonicalReport as import("./report").VerificationReport;
      await repository.saveReport(jobId, {
        report,
        hash: existing.reportHash as Hex,
        uri: existing.reportUri,
        block: receipt.blockNumber,
      });
      await repository.setStatus(
        jobId,
        report.result.passed ? "PASSED" : "FAILED",
        {
          score: report.result.score,
          passed: report.result.passed,
          verifierAddress: report.verifier.address,
        },
      );
      return {
        status: report.result.passed
          ? ("PASSED" as const)
          : ("FAILED" as const),
        report,
        reportHash: existing.reportHash as Hex,
        canonical: JSON.stringify(report),
        proof: { txHash: existing.attestationTxHash as Hex },
        recovered: true,
      };
    }
    await repository.setStatus(jobId, "FETCHING");
    log("fetching");
    const policyRecord = await repository.getPolicy(
      job.escrowAddress as Address,
      job.milestoneIndex,
      job.rulesHash as Hex,
    );
    if (!policyRecord)
      throw Object.assign(new Error("Policy is missing"), {
        code: "INVALID_POLICY",
      });
    const policy = verificationPolicySchema.parse(policyRecord.policy);
    const chain = await loadAndValidateOnchain({
      escrow: job.escrowAddress as Address,
      milestoneIndex: job.milestoneIndex,
      policy,
      expectedDeliverableHash: job.deliverableHash as Hex,
      rpcUrl: options.rpcUrl,
    });
    if (chain.milestone.deliverableURI !== job.deliverableUri)
      throw Object.assign(new Error("Deliverable URI changed"), {
        code: "DELIVERABLE_HASH_MISMATCH",
      });
    const limits = {
      ...options.fetchLimits,
      allowLocalhost:
        options.fetchLimits?.allowLocalhost ??
        process.env.VERIFIER_ALLOW_LOCALHOST === "true",
    };
    const { normalizeEvidence } = await import("./normalize");
    const normalized =
      job.protocolVersion === 2
        ? await normalizeEvidence(
            await repository.getManifest(
              job.escrowAddress,
              job.milestoneIndex,
              job.submissionSequence,
              job.deliverableHash,
            ),
            job.deliverableHash,
            repository.db,
            limits,
          )
        : [
            {
              id: "v1",
              type: "DEPLOYMENT_URL",
              label: "Evidence",
              source: chain.previewUrl!,
              metadata: {},
              artifact: await fetchArtifact(chain.previewUrl!, limits),
              observedContentHash: job.deliverableHash,
            },
          ];
    const artifact = normalized[0].artifact;
    await repository.setStatus(jobId, "DETERMINISTIC");
    log("deterministic");
    const results: RuleResult[] = [];
    const lighthouse = options.lighthouse ?? createLighthouseRunner(limits);
    for (const rule of policy.rules) {
      deadline();
      if (rule.type === "LLM_RUBRIC") continue;
      const target = rule.evidenceLabel
        ? normalized.find((e) => e.label === rule.evidenceLabel)
        : normalized.find((e) =>
            rule.type === "GITHUB_CI"
              ? ["GITHUB_REPOSITORY", "PULL_REQUEST"].includes(e.type)
              : rule.type === "JSON_SCHEMA"
                ? e.type === "JSON" || e.artifact.contentType.includes("json")
                : rule.type === "FILE_HASH"
                  ? e.type === "FILE"
                  : true,
          );
      if (!target) {
        results.push({
          ruleId: rule.id,
          ruleType: rule.type,
          required: rule.required,
          weight: rule.weight,
          passed: false,
          score: 0,
          summary: "Required evidence was missing",
          evidence: { missing: true },
          durationMs: 0,
        });
        continue;
      }
      if (rule.type === "ORACLE" || rule.type === "CUSTOM") {
        const { runAuthenticatedAdapter } =
          await import("../adapters/authenticated");
        const begin = performance.now();
        const result = await runAuthenticatedAdapter(rule, {
          escrow: job.escrowAddress as Address,
          milestone: job.milestoneIndex,
          submission: job.submissionSequence,
          evidenceHash: job.deliverableHash as Hex,
          rulesHash: job.rulesHash as Hex,
          artifact: target.artifact,
          rpcUrl: options.rpcUrl,
        });
        results.push({
          ruleId: rule.id,
          ruleType: rule.type,
          required: rule.required,
          weight: rule.weight,
          passed: result.passed,
          score: Math.round((rule.weight * result.score) / 100),
          summary: result.summary,
          evidence: result,
          durationMs: Math.round(performance.now() - begin),
        });
        continue;
      }
      const result = await runDeterministicRule(rule, {
        artifact: target.artifact,
        limits,
        lighthouse,
      });
      result.evidence = {
        ...result.evidence,
        evidenceId: target.id,
        contentHash: target.observedContentHash,
      };
      results.push(result);
    }
    await repository.saveRuleResults(jobId, results);
    const requiredFailed = results.some(
      (result) => result.required && !result.passed,
    );
    let confidence: "LOW" | "MEDIUM" | "HIGH" | undefined;
    if (!requiredFailed) {
      const semanticRules = policy.rules.filter(
        (rule) => rule.type === "LLM_RUBRIC",
      );
      if (semanticRules.length) {
        await repository.setStatus(jobId, "SEMANTIC");
        log("semantic");
        const semantic =
          options.semantic ??
          new OpenAISemanticProvider({
            apiKey: process.env.OPENAI_API_KEY ?? "",
            model: process.env.AI_MODEL ?? "",
            baseUrl: process.env.AI_BASE_URL,
            maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS || 12000),
            maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 1200),
            timeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
          });
        for (const rule of semanticRules) {
          deadline();
          const began = performance.now();
          const selectedArtifact = rule.evidenceLabel
            ? normalized.find((e) => e.label === rule.evidenceLabel)?.artifact
            : artifact;
          if (!selectedArtifact) {
            results.push({
              ruleId: rule.id,
              ruleType: rule.type,
              required: rule.required,
              weight: rule.weight,
              passed: false,
              score: 0,
              summary: "Required evidence missing",
              evidence: { missing: true },
              durationMs: 0,
            });
            continue;
          }
          const result = await semantic.verify({
            rubric: rule.rubric,
            criteria: rule.criteria.map((text, i) => ({
              id: `${rule.id}:${i}`,
              text,
            })),
            artifact: selectedArtifact,
            deterministicEvidence: results,
          });
          confidence =
            result.confidence === "LOW"
              ? "LOW"
              : confidence === "LOW"
                ? "LOW"
                : result.confidence;
          results.push({
            ruleId: rule.id,
            ruleType: rule.type,
            required: rule.required,
            weight: rule.weight,
            passed: result.passed && result.confidence !== "LOW",
            score: Math.round((rule.weight * result.score) / 100),
            summary: result.summary,
            evidence: {
              confidence: result.confidence,
              criteria: result.criteria,
            },
            durationMs: Math.round(performance.now() - began),
          });
        }
        await repository.saveRuleResults(
          jobId,
          results.filter((result) => result.ruleType === "LLM_RUBRIC"),
        );
      }
    } else {
      for (const rule of policy.rules.filter(
        (rule) => rule.type === "LLM_RUBRIC",
      ))
        results.push({
          ruleId: rule.id,
          ruleType: rule.type,
          required: rule.required,
          weight: rule.weight,
          passed: false,
          score: 0,
          summary: "Skipped because a required deterministic rule failed",
          evidence: { skipped: true },
          durationMs: 0,
        });
      await repository.saveRuleResults(
        jobId,
        results.filter((result) => result.ruleType === "LLM_RUBRIC"),
      );
    }
    await repository.setStatus(jobId, "AGGREGATING");
    log("aggregating");
    const aggregate = aggregateResults(policy, results, confidence);
    const report = createVerificationReport({
      chainId: monadTestnet.id,
      escrow: job.escrowAddress as Address,
      milestone: job.milestoneIndex,
      deliverableHash: job.deliverableHash as Hex,
      deliverableURI: job.deliverableUri,
      policy,
      rulesHash: chain.rulesHash,
      result: aggregate,
      checks: results,
      submissionSequence:
        job.protocolVersion === 2 ? job.submissionSequence : undefined,
      verifier: verifierAccount().address,
    });
    const reportUri = `data:application/json;charset=utf-8,${encodeURIComponent(report.canonical)}`;
    if (!aggregate.passed && job.protocolVersion !== 2) {
      await repository.saveReport(jobId, {
        report: report.report,
        hash: report.reportHash,
        uri: reportUri,
      });
      await repository.setStatus(jobId, "FAILED", {
        score: aggregate.score,
        passed: false,
        verifierAddress: verifierAccount().address,
      });
      log("failed");
      return { ...report, status: "FAILED" as const };
    }
    if (performance.now() - started > (options.jobTimeoutMs ?? 120_000))
      throw Object.assign(new Error("Job timed out"), {
        code: "SEMANTIC_PROVIDER_ERROR",
      });
    deadline();
    await repository.setStatus(jobId, "SIGNING");
    log("signing");
    // Re-read immutable submission and Pact state immediately before signing.
    await loadAndValidateOnchain({
      escrow: job.escrowAddress as Address,
      milestoneIndex: job.milestoneIndex,
      policy,
      expectedDeliverableHash: job.deliverableHash as Hex,
      rpcUrl: options.rpcUrl,
    });
    await repository.setStatus(jobId, "SUBMITTING");
    log("submitting");
    const proof = await signAndSubmitAttestation({
      escrow: job.escrowAddress as Address,
      milestone: BigInt(job.milestoneIndex),
      deliverableHash: job.deliverableHash as Hex,
      rulesHash: chain.rulesHash,
      reportHash: report.reportHash,
      rpcUrl: options.rpcUrl,
      submissionId:
        job.protocolVersion === 2 ? BigInt(job.submissionSequence) : undefined,
      approved: aggregate.passed,
      beforeBroadcast: async (proof) => {
        await repository.saveReport(jobId, {
          report: report.report,
          hash: report.reportHash,
          uri: reportUri,
          digest: proof.digest,
          signature: proof.signature,
          txHash: proof.txHash,
          nonce: proof.nonce,
          rawTransaction: proof.rawTransaction,
        });
      },
    });
    await repository.saveReport(jobId, {
      report: report.report,
      hash: report.reportHash,
      uri: reportUri,
      digest: proof.digest,
      signature: proof.signature,
      txHash: proof.txHash,
      block: proof.blockNumber,
      nonce: proof.attestation.nonce,
    });
    await repository.setStatus(jobId, aggregate.passed ? "PASSED" : "FAILED", {
      score: aggregate.score,
      passed: aggregate.passed,
      verifierAddress: proof.verifier,
    });
    log("passed");
    return {
      ...report,
      status: aggregate.passed ? ("PASSED" as const) : ("FAILED" as const),
      proof,
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "CHAIN_TX_REVERTED";
    await repository.setStatus(jobId, "ERROR", {
      errorCode: code,
      errorMessage:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown verification error",
    });
    log("error");
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}
