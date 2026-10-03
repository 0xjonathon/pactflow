import { and, desc, eq, lt, inArray, sql } from "drizzle-orm";
import type { PactFlowDatabase } from "@pactflow/db/client";
import {
  verificationJobs,
  verificationPolicies,
  verificationReports,
  verificationRuleResults,
} from "@pactflow/db";
import type { Address, Hex } from "viem";
import { verificationPolicySchema, type VerificationPolicy } from "../policy";
import type { RuleResult } from "../rules/deterministic";
import type { VerificationReport } from "../pipeline/report";

export type JobStatus =
  | "QUEUED"
  | "FETCHING"
  | "DETERMINISTIC"
  | "SEMANTIC"
  | "AGGREGATING"
  | "SIGNING"
  | "SUBMITTING"
  | "PASSED"
  | "FAILED"
  | "ERROR";
export class VerificationRepository {
  constructor(readonly db: PactFlowDatabase) {}

  async savePolicy(input: {
    escrow: Address;
    pactId: Address;
    milestoneIndex: number;
    policy: VerificationPolicy;
    rulesHash: Hex;
  }) {
    await this.db
      .insert(verificationPolicies)
      .values({
        escrowAddress: input.escrow.toLowerCase(),
        pactId: input.pactId.toLowerCase(),
        milestoneIndex: input.milestoneIndex,
        version: 1,
        policy: input.policy,
        rulesHash: input.rulesHash.toLowerCase(),
      })
      .onConflictDoNothing();
    return this.getPolicy(input.escrow, input.milestoneIndex, input.rulesHash);
  }
  async getPolicy(escrow: Address, milestoneIndex: number, rulesHash: Hex) {
    const rows = await this.db
      .select()
      .from(verificationPolicies)
      .where(
        and(
          eq(verificationPolicies.escrowAddress, escrow.toLowerCase()),
          eq(verificationPolicies.milestoneIndex, milestoneIndex),
          eq(verificationPolicies.rulesHash, rulesHash.toLowerCase()),
        ),
      )
      .limit(1);
    return rows[0]
      ? { ...rows[0], policy: verificationPolicySchema.parse(rows[0].policy) }
      : null;
  }
  async createOrGetJob(input: {
    escrow: Address;
    pactId: Address;
    milestoneIndex: number;
    deliverableHash: Hex;
    deliverableUri: string;
    rulesHash: Hex;
    submissionSequence?: number;
    protocolVersion?: 1 | 2;
  }) {
    const values = {
      submissionSequence: input.submissionSequence ?? 0,
      protocolVersion: input.protocolVersion ?? 1,
      escrowAddress: input.escrow.toLowerCase(),
      pactId: input.pactId.toLowerCase(),
      milestoneIndex: input.milestoneIndex,
      deliverableHash: input.deliverableHash.toLowerCase(),
      deliverableUri: input.deliverableUri,
      rulesHash: input.rulesHash.toLowerCase(),
    };
    await this.db.insert(verificationJobs).values(values).onConflictDoNothing();
    const rows = await this.db
      .select()
      .from(verificationJobs)
      .where(
        and(
          eq(verificationJobs.escrowAddress, values.escrowAddress),
          eq(verificationJobs.milestoneIndex, values.milestoneIndex),
          eq(verificationJobs.submissionSequence, values.submissionSequence),
          eq(verificationJobs.deliverableHash, values.deliverableHash),
          eq(verificationJobs.rulesHash, values.rulesHash),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new Error("Job insert failed");
    return rows[0];
  }
  async claimJob(id: string) {
    const rows = await this.db
      .update(verificationJobs)
      .set({
        status: "FETCHING",
        startedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(verificationJobs.id, id), eq(verificationJobs.status, "QUEUED")),
      )
      .returning();
    return rows[0] ?? null;
  }
  async retryJob(id: string) {
    return this.db
      .update(verificationJobs)
      .set({ status: "QUEUED", updatedAt: new Date() })
      .where(
        and(eq(verificationJobs.id, id), eq(verificationJobs.status, "ERROR")),
      )
      .returning();
  }
  async heartbeat(id: string) {
    await this.db
      .update(verificationJobs)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(verificationJobs.id, id),
          inArray(verificationJobs.status, [
            "FETCHING",
            "DETERMINISTIC",
            "SEMANTIC",
            "AGGREGATING",
            "SIGNING",
            "SUBMITTING",
          ]),
        ),
      );
  }
  async recoverAbandonedJobs() {
    return this.db
      .update(verificationJobs)
      .set({ status: "QUEUED", updatedAt: new Date() })
      .where(
        and(
          inArray(verificationJobs.status, [
            "FETCHING",
            "DETERMINISTIC",
            "SEMANTIC",
            "AGGREGATING",
            "SIGNING",
            "SUBMITTING",
          ]),
          lt(verificationJobs.updatedAt, new Date(Date.now() - 300_000)),
        ),
      )
      .returning();
  }
  async getManifest(
    escrow: string,
    milestoneIndex: number,
    sequence: number,
    expectedHash: string,
  ) {
    const { submissions } = await import("@pactflow/db");
    const row = (
      await this.db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.escrowAddress, escrow.toLowerCase()),
            eq(submissions.milestoneIndex, milestoneIndex),
            eq(submissions.sequence, sequence),
            eq(submissions.manifestHash, expectedHash.toLowerCase()),
          ),
        )
    )[0];
    return row?.manifest ?? null;
  }
  async getJob(id: string) {
    return (
      (
        await this.db
          .select()
          .from(verificationJobs)
          .where(eq(verificationJobs.id, id))
          .limit(1)
      )[0] ?? null
    );
  }
  async listJobs(escrow: Address) {
    return this.db
      .select()
      .from(verificationJobs)
      .where(eq(verificationJobs.escrowAddress, escrow.toLowerCase()))
      .orderBy(desc(verificationJobs.createdAt));
  }
  async setStatus(
    id: string,
    status: JobStatus,
    extra: {
      score?: number;
      passed?: boolean;
      verifierAddress?: string;
      errorCode?: string;
      errorMessage?: string;
    } = {},
  ) {
    await this.db
      .update(verificationJobs)
      .set({
        status,
        ...extra,
        startedAt: status === "FETCHING" ? new Date() : undefined,
        finishedAt: ["PASSED", "FAILED", "ERROR"].includes(status)
          ? new Date()
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(verificationJobs.id, id));
  }
  async saveRuleResults(id: string, results: RuleResult[]) {
    if (!results.length) return;
    await this.db
      .insert(verificationRuleResults)
      .values(
        results.map((result) => ({
          jobId: id,
          ruleId: result.ruleId,
          ruleType: result.ruleType,
          required: result.required,
          weight: result.weight,
          passed: result.passed,
          score: result.score,
          summary: result.summary,
          evidence: result.evidence,
          durationMs: result.durationMs,
        })),
      )
      .onConflictDoUpdate({
        target: [verificationRuleResults.jobId, verificationRuleResults.ruleId],
        set: {
          passed: sql`excluded.passed`,
          score: sql`excluded.score`,
          summary: sql`excluded.summary`,
          evidence: sql`excluded.evidence`,
          durationMs: sql`excluded.duration_ms`,
        },
      });
  }
  async getRuleResults(id: string) {
    return this.db
      .select()
      .from(verificationRuleResults)
      .where(eq(verificationRuleResults.jobId, id));
  }
  async saveReport(
    id: string,
    input: {
      report: VerificationReport;
      hash: Hex;
      uri: string;
      digest?: Hex;
      signature?: Hex;
      txHash?: Hex;
      block?: bigint;
      nonce?: bigint;
      rawTransaction?: Hex;
    },
  ) {
    const previous = await this.getReport(id);
    if (previous && previous.reportHash !== input.hash)
      throw new Error("Signed verification report is immutable");
    await this.db
      .insert(verificationReports)
      .values({
        jobId: id,
        canonicalReport: input.report,
        reportHash: input.hash,
        reportUri: input.uri,
        eip712Digest: input.digest,
        signature: input.signature,
        attestationTxHash: input.txHash,
        attestationBlock: input.block ? Number(input.block) : undefined,
        nonce: input.nonce?.toString(),
        rawTransaction: input.rawTransaction,
      })
      .onConflictDoUpdate({
        target: verificationReports.jobId,
        set: {
          reportHash: input.hash,
          attestationBlock: input.block ? Number(input.block) : undefined,
        },
      });
  }
  async getReport(id: string) {
    return (
      (
        await this.db
          .select()
          .from(verificationReports)
          .where(eq(verificationReports.jobId, id))
          .limit(1)
      )[0] ?? null
    );
  }
}
