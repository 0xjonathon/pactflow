import { ProtocolIndexer } from "@pactflow/indexer";
import { registerProductRoutes, ProductError } from "./product";
import { config } from "dotenv";
import { resolve } from "node:path";
import Fastify from "fastify";
import { z } from "zod";
import { isAddress, type Address } from "viem";
import { connectDatabase } from "@pactflow/db/client";
import { PactFlowSdk } from "@pactflow/sdk";
import { BullMQVerificationQueue, InlineVerificationQueue, VerificationRepository, canonicalizeVerificationPolicy, hashVerificationPolicy, loadAndValidateOnchain, processVerificationJob, verificationPolicySchema } from "@pactflow/verifier";

config({ path: [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), "../../.env.local")], quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for verification API");
if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) throw new Error("REDIS_URL is required in production");
const { db, close: closeDb } = connectDatabase(databaseUrl);
const repository = new VerificationRepository(db);
const sdk = new PactFlowSdk({ rpcUrl: process.env.MONAD_TESTNET_RPC_URL });
const processor = (id: string) => processVerificationJob(id, repository, { rpcUrl: process.env.MONAD_TESTNET_RPC_URL }).then(() => {});
const queue = process.env.REDIS_URL ? new BullMQVerificationQueue(process.env.REDIS_URL, processor) : new InlineVerificationQueue(processor);
const app = Fastify({ logger: true });
const rateLimits = new Map<string, { count: number; reset: number }>();
let indexBusy = false;
const indexer = new ProtocolIndexer(db, process.env.MONAD_TESTNET_RPC_URL);
async function syncIndex() { if (indexBusy) return; indexBusy = true; try { app.log.info(await indexer.sync(), "Protocol index refreshed"); } catch { app.log.warn("Protocol index sync failed; will retry"); } finally { indexBusy = false; } }
const indexTimer = setInterval(() => { void syncIndex(); }, 60_000);
indexTimer.unref();
const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
app.addHook("onRequest", async (request, reply) => {
  const now = Date.now(); const limit = rateLimits.get(request.ip);
  if (!limit || limit.reset < now) rateLimits.set(request.ip, { count: 1, reset: now + 60_000 });
  else if (++limit.count > 240) return reply.code(429).send({ code: "RATE_LIMITED" });
  if (rateLimits.size > 10000) for (const [ip, value] of rateLimits) if (value.reset < now) rateLimits.delete(ip);
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (request.method === "OPTIONS") return reply.code(204).send();
});
app.get("/health", async () => ({ status: "ok" }));
const address = z.string().refine(isAddress, "Invalid escrow address").transform(value => value as Address);
const policyBody = z.object({ escrow: address, milestoneIndex: z.number().int().min(0), policy: verificationPolicySchema });
const jobBody = z.object({ escrow: address, milestoneIndex: z.number().int().min(0) });
const idParams = z.object({ id: z.uuid() });
const escrowParams = z.object({ escrow: address });

await registerProductRoutes(app, db, sdk);
app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ProductError) return reply.code(error.statusCode).send({ code: error.code });
  if (error && typeof error === "object" && "code" in error && error.code === "23505") return reply.code(409).send({ code: "ALREADY_EXISTS" });
  const code = error instanceof z.ZodError ? "INVALID_INPUT" : error && typeof error === "object" && "code" in error ? String(error.code) : "VERIFICATION_ERROR";
  const status = error instanceof z.ZodError ? 400 : code.includes("MISMATCH") ? 409 : 500;
  if(error instanceof z.ZodError)return reply.code(400).send({code,issues:error.issues.map(i=>({path:i.path,code:i.code,message:i.message,...("minimum" in i?{minimum:i.minimum}:{}),...("maximum" in i?{maximum:i.maximum}:{})}))});
  reply.code(status).send({ code, message: status === 500 ? "Verification request failed" : error instanceof Error ? error.message : "Invalid request" });
});
app.post("/api/v1/verification/policies", async request => {
  const input = policyBody.parse(request.body);
  const canonical = canonicalizeVerificationPolicy(input.policy);
  const rulesHash = hashVerificationPolicy(input.policy);
  const pact = await sdk.getPact(input.escrow);
  const milestone = pact.milestones[input.milestoneIndex];
  if (!milestone || milestone.rulesHash.toLowerCase() !== rulesHash.toLowerCase()) throw Object.assign(new Error("Policy hash differs from onchain milestone"), { code: "RULES_HASH_MISMATCH" });
  const record = await repository.savePolicy({ escrow: input.escrow, pactId: pact.pactId, milestoneIndex: input.milestoneIndex, policy: input.policy, rulesHash });
  return { id: record?.id, policy: input.policy, canonical, rulesHash };
});
app.post("/api/v1/verification/jobs", async request => {
  const input = jobBody.parse(request.body);
  const pact = await sdk.getPact(input.escrow);
  const milestone = pact.milestones[input.milestoneIndex];
  if (!milestone) throw Object.assign(new Error("Milestone does not exist"), { code: "CHAIN_STATE_MISMATCH" });
  const record = await repository.getPolicy(input.escrow, input.milestoneIndex, milestone.rulesHash);
  if (!record) throw Object.assign(new Error("Verification policy has not been saved"), { code: "INVALID_POLICY" });
  await loadAndValidateOnchain({ escrow: input.escrow, milestoneIndex: input.milestoneIndex, policy: record.policy, rpcUrl: process.env.MONAD_TESTNET_RPC_URL });
  const job = await repository.createOrGetJob({ escrow: input.escrow, pactId: pact.pactId, milestoneIndex: input.milestoneIndex, deliverableHash: milestone.deliverableHash, deliverableUri: milestone.deliverableURI, rulesHash: milestone.rulesHash });
  if (job.status === "QUEUED") await queue.enqueue(job.id);
  return { id: job.id, status: job.status };
});
app.get("/api/v1/verification/jobs/:id", async (request, reply) => {
  const { id } = idParams.parse(request.params);
  const job = await repository.getJob(id);
  if (!job) return reply.code(404).send({ code: "NOT_FOUND" });
  return job;
});
app.get("/api/v1/verification/jobs/:id/report", async (request, reply) => {
  const { id } = idParams.parse(request.params);
  const report = await repository.getReport(id);
  if (!report) return reply.code(404).send({ code: "NOT_FOUND" });
  return report;
});
app.get("/api/v1/pacts/:escrow/verifications", async request => {
  const { escrow } = escrowParams.parse(request.params);
  return repository.listJobs(escrow);
});
app.addHook("onClose", async () => { clearInterval(indexTimer); await queue.close(); await closeDb(); });
const port = Number(process.env.API_PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).then(() => { void syncIndex(); }).catch((error: unknown) => { app.log.error(error); process.exit(1); });
