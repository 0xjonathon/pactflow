import { ProtocolIndexer } from "@pactflow/indexer";
import { registerUploadRoutes } from "./uploads";
import { registerTrustRoutes } from "./trust";
import { registerProductRoutes, ProductError } from "./product";
import { config } from "dotenv";
import { resolve } from "node:path";
import Fastify from "fastify";
import { z } from "zod";
import { isAddress, type Address } from "viem";
import { connectDatabase } from "@pactflow/db/client";
import { PactFlowSdk } from "@pactflow/sdk";
import {
  BullMQVerificationQueue,
  InlineVerificationQueue,
  VerificationRepository,
  canonicalizeVerificationPolicy,
  hashVerificationPolicy,
  loadAndValidateOnchain,
  processVerificationJob,
  verificationPolicySchema,
  adapterCapabilities,
} from "@pactflow/verifier";

config({
  path: [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
  ],
  quiet: true,
});
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for verification API");
if (process.env.NODE_ENV === "production") {
  for (const name of [
    "REDIS_URL",
    "ENVIO_GRAPHQL_URL",
    "S3_ENDPOINT",
    "S3_PUBLIC_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "CLAMAV_HOST",
    "WEB_ORIGIN",
    "NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS",
  ])
    if (!process.env[name]) throw new Error(`${name} required in production`);
  if (
    process.env.PACTFLOW_LOCAL_CHAIN === "true" ||
    process.env.VERIFIER_ALLOW_LOCALHOST === "true"
  )
    throw new Error("Local testing modes forbidden in production");
  if (!databaseUrl.startsWith("postgres"))
    throw new Error("Production requires PostgreSQL");
  if (new URL(process.env.WEB_ORIGIN!).protocol !== "https:")
    throw new Error("Production origin requires HTTPS");
}
const { db, close: closeDb } = connectDatabase(databaseUrl);
const repository = new VerificationRepository(db);
const sdk = new PactFlowSdk({ rpcUrl: process.env.MONAD_TESTNET_RPC_URL });
const processor = (id: string) =>
  processVerificationJob(id, repository, {
    rpcUrl: process.env.MONAD_TESTNET_RPC_URL,
  }).then(() => {});
const queue = process.env.REDIS_URL
  ? new BullMQVerificationQueue(process.env.REDIS_URL)
  : new InlineVerificationQueue(processor);
const app = Fastify({
  logger: true,
  trustProxy:
    process.env.NODE_ENV === "production"
      ? (_address: string, hop: number) => hop === 0
      : false,
});
const rateLimits = new Map<string, { count: number; reset: number }>();
let indexBusy = false;
const indexer = new ProtocolIndexer(db, process.env.MONAD_TESTNET_RPC_URL);
async function syncIndex() {
  if (indexBusy) return;
  indexBusy = true;
  try {
    app.log.info(await indexer.sync(), "Protocol index refreshed");
  } catch {
    app.log.warn("Protocol index sync failed; will retry");
  } finally {
    indexBusy = false;
  }
}
const indexTimer = setInterval(
  () => {
    void syncIndex();
  },
  process.env.PACTFLOW_LOCAL_CHAIN === "true"
    ? Number(process.env.INDEXER_INTERVAL_MS || 4000)
    : 60_000,
);
indexTimer.unref();
const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
app.addHook("onRequest", async (request, reply) => {
  const now = Date.now();
  if (queue instanceof BullMQVerificationQueue) {
    try {
      if (
        !(await Promise.race([
          queue.takeRateLimit(request.ip, 240),
          new Promise<never>((_r, reject) =>
            setTimeout(
              () => reject(new Error("Redis rate limit timeout")),
              2000,
            ),
          ),
        ]))
      )
        return reply.code(429).send({ code: "RATE_LIMITED" });
    } catch {
      return reply.code(503).send({ code: "RATE_LIMIT_UNAVAILABLE" });
    }
  }
  const limit = rateLimits.get(request.ip);
  if (
    !(queue instanceof BullMQVerificationQueue) &&
    (!limit || limit.reset < now)
  )
    rateLimits.set(request.ip, { count: 1, reset: now + 60_000 });
  else if (
    !(queue instanceof BullMQVerificationQueue) &&
    limit &&
    ++limit.count >
      (process.env.PACTFLOW_LOCAL_CHAIN === "true" &&
      process.env.NODE_ENV !== "production"
        ? 5000
        : 240)
  )
    return reply.code(429).send({ code: "RATE_LIMITED" });
  if (rateLimits.size > 10000)
    for (const [ip, value] of rateLimits)
      if (value.reset < now) rateLimits.delete(ip);
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (request.method === "OPTIONS") return reply.code(204).send();
});
app.get("/health", async (_request, reply) => {
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`select 1`);
    return { status: "ok" };
  } catch {
    return reply.code(503).send({ status: "unavailable" });
  }
});
app.get("/api/v1/indexer/health", async () => {
  const { indexerCursors } = await import("@pactflow/db");
  const [cursor] = await db.select().from(indexerCursors);
  const head = await sdk.publicClient.getBlock({
    blockTag:
      process.env.PACTFLOW_LOCAL_CHAIN === "true" ? "latest" : "finalized",
  });
  return {
    source: process.env.ENVIO_GRAPHQL_URL ? "ENVIO" : "LOCAL_RPC",
    status: cursor ? "INDEXED" : "PENDING",
    indexedBlock: cursor?.blockNumber ?? null,
    finalizedBlock: Number(head.number),
    lag: cursor ? Number(head.number) - cursor.blockNumber : null,
    indexedAt: cursor?.updatedAt ?? null,
  };
});

const address = z
  .string()
  .refine(isAddress, "Invalid escrow address")
  .transform((value) => value as Address);
const policyBody = z.object({
  escrow: address,
  milestoneIndex: z.number().int().min(0),
  policy: verificationPolicySchema,
});
const jobBody = z.object({
  escrow: address,
  milestoneIndex: z.number().int().min(0),
});
const idParams = z.object({ id: z.uuid() });
const escrowParams = z.object({ escrow: address });

const product = await registerProductRoutes(app, db, sdk);
const trust = await registerTrustRoutes(app, db, sdk, product.actor);
registerUploadRoutes(app, db, product.actor, trust.participant);
async function verificationAccess(
  request: import("fastify").FastifyRequest,
  escrow: string,
) {
  if (request.headers.authorization) {
    await trust.participant(request, escrow as Address);
    return true;
  }
  const { and, eq } = await import("drizzle-orm");
  const { publicDisclosures } = await import("@pactflow/db");
  const [disclosure] = await db
    .select()
    .from(publicDisclosures)
    .where(
      and(
        eq(publicDisclosures.escrowAddress, escrow.toLowerCase()),
        eq(publicDisclosures.clientApproved, true),
        eq(publicDisclosures.workerApproved, true),
      ),
    );
  if (!disclosure) throw new ProductError(403, "PRIVATE_VERIFICATION");
  return false;
}
function publicJob(
  job: NonNullable<Awaited<ReturnType<typeof repository.getJob>>>,
) {
  return {
    id: job.id,
    status: job.status,
    milestoneIndex: job.milestoneIndex,
    submissionSequence: job.submissionSequence,
    protocolVersion: job.protocolVersion,
    escrowAddress: job.escrowAddress,
    score: job.score,
    passed: job.passed,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}
function publicReport(
  report: NonNullable<Awaited<ReturnType<typeof repository.getReport>>>,
) {
  const full =
    report.canonicalReport as import("@pactflow/verifier").VerificationReport;
  return {
    jobId: report.jobId,
    reportHash: report.reportHash,
    attestationTxHash: report.attestationTxHash,
    attestationBlock: report.attestationBlock,
    canonicalReport: {
      version: full.version,
      network: full.network,
      pact: full.pact,
      policy: full.policy,
      result: full.result,
      verifier: full.verifier,
      generatedAt: full.generatedAt,
      submission: {
        deliverableHash: full.submission.deliverableHash,
        deliverableURI: "",
        sequence: full.submission.sequence,
      },
      checks: full.checks.map((c) => ({
        ruleId: c.ruleId,
        ruleType: c.ruleType,
        required: c.required,
        weight: c.weight,
        passed: c.passed,
        score: c.score,
        durationMs: c.durationMs,
        summary: "",
        evidence: {},
      })),
    },
    redacted: true,
  };
}
app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ProductError)
    return reply.code(error.statusCode).send({ code: error.code });
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return reply.code(409).send({ code: "ALREADY_EXISTS" });
  const code =
    error instanceof z.ZodError
      ? "INVALID_INPUT"
      : error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "VERIFICATION_ERROR";
  const status =
    error instanceof z.ZodError ? 400 : code.includes("MISMATCH") ? 409 : 500;
  if (error instanceof z.ZodError)
    return reply.code(400).send({
      code,
      issues: error.issues.map((i) => ({
        path: i.path,
        code: i.code,
        message: i.message,
        ...("minimum" in i ? { minimum: i.minimum } : {}),
        ...("maximum" in i ? { maximum: i.maximum } : {}),
      })),
    });
  reply.code(status).send({
    code,
    message:
      status === 500
        ? "Verification request failed"
        : error instanceof Error
          ? error.message
          : "Invalid request",
  });
});
app.get("/api/v1/verification/capabilities", async () => ({
  manual: { available: true },
  ai: { available: !!process.env.OPENAI_API_KEY && !!process.env.AI_MODEL },
  github: { available: true, requiresPinnedCommit: true },
  adapters: adapterCapabilities(),
}));
app.post("/api/v1/verification/policies", async (request) => {
  const input = policyBody.parse(request.body);
  const { a, pact: authorizedPact } = await trust.participant(
    request,
    input.escrow,
  );
  if (authorizedPact.client.toLowerCase() !== a.address)
    throw new ProductError(403, "ONLY_CLIENT");
  const canonical = canonicalizeVerificationPolicy(input.policy);
  const rulesHash = hashVerificationPolicy(input.policy);
  const pact = await sdk.getPact(input.escrow);
  const milestone = pact.milestones[input.milestoneIndex];
  if (
    !milestone ||
    milestone.rulesHash.toLowerCase() !== rulesHash.toLowerCase()
  )
    throw Object.assign(
      new Error("Policy hash differs from onchain milestone"),
      { code: "RULES_HASH_MISMATCH" },
    );
  const record = await repository.savePolicy({
    escrow: input.escrow,
    pactId: pact.pactId,
    milestoneIndex: input.milestoneIndex,
    policy: input.policy,
    rulesHash,
  });
  return { id: record?.id, policy: input.policy, canonical, rulesHash };
});
app.post("/api/v1/verification/jobs", async (request) => {
  const input = jobBody.parse(request.body);
  const { pact } = await trust.participant(request, input.escrow);
  const milestone = pact.milestones[input.milestoneIndex];
  if (!milestone)
    throw Object.assign(new Error("Milestone does not exist"), {
      code: "CHAIN_STATE_MISMATCH",
    });
  const record = await repository.getPolicy(
    input.escrow,
    input.milestoneIndex,
    milestone.rulesHash,
  );
  if (!record)
    throw Object.assign(new Error("Verification policy has not been saved"), {
      code: "INVALID_POLICY",
    });
  await loadAndValidateOnchain({
    escrow: input.escrow,
    milestoneIndex: input.milestoneIndex,
    policy: record.policy,
    rpcUrl: process.env.MONAD_TESTNET_RPC_URL,
  });
  const job = await repository.createOrGetJob({
    escrow: input.escrow,
    pactId: pact.pactId,
    milestoneIndex: input.milestoneIndex,
    deliverableHash: milestone.deliverableHash,
    deliverableUri: milestone.deliverableURI,
    rulesHash: milestone.rulesHash,
    submissionSequence: Number(milestone.submissionId ?? 0n),
    protocolVersion: pact.protocolVersion,
  });
  if (job.status === "ERROR") {
    await repository.retryJob(job.id);
    await queue.enqueue(job.id);
    return { id: job.id, status: "QUEUED" };
  }
  if (job.status === "QUEUED") await queue.enqueue(job.id);
  return { id: job.id, status: job.status };
});
app.get("/api/v1/verification/jobs/:id", async (request, reply) => {
  const { id } = idParams.parse(request.params);
  const job = await repository.getJob(id);
  if (!job) {
    const manual = await trust.manualReview(id);
    if (!manual) return reply.code(404).send({ code: "NOT_FOUND" });
    await verificationAccess(request, manual.job.escrowAddress);
    return manual.job;
  }
  return (await verificationAccess(request, job.escrowAddress))
    ? job
    : publicJob(job);
});
app.get("/api/v1/verification/jobs/:id/report", async (request, reply) => {
  const { id } = idParams.parse(request.params);
  const report = await repository.getReport(id);
  if (!report) {
    const manual = await trust.manualReview(id);
    if (!manual) return reply.code(404).send({ code: "NOT_FOUND" });
    await verificationAccess(request, manual.job.escrowAddress);
    return manual.report;
  }
  const job = await repository.getJob(id);
  if (!job) throw new ProductError(404, "NOT_FOUND");
  return (await verificationAccess(request, job.escrowAddress))
    ? Object.fromEntries(
        Object.entries(report).filter(([key]) => key !== "rawTransaction"),
      )
    : publicReport(report);
});
app.get("/api/v1/pacts/:escrow/verifications", async (request) => {
  const { escrow } = escrowParams.parse(request.params);
  const full = await verificationAccess(request, escrow);
  const rows = await repository.listJobs(escrow);
  return full ? rows : rows.map(publicJob);
});
app.addHook("onClose", async () => {
  clearInterval(indexTimer);
  await queue.close();
  await closeDb();
});
const port = Number(process.env.API_PORT ?? 3001);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    void syncIndex();
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
