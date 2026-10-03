import { config } from "dotenv";
import { writeFile, unlink } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { resolve } from "node:path";
import { connectDatabase } from "@pactflow/db/client";
import { BullMQVerificationQueue } from "./queue";
import { VerificationRepository } from "./storage/repository";
import { processVerificationJob } from "./pipeline/process-job";
config({
  path: [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
  ],
  quiet: true,
});
if (!process.env.DATABASE_URL || !process.env.REDIS_URL)
  throw new Error("DATABASE_URL and REDIS_URL required");
if (
  process.env.NODE_ENV === "production" &&
  (!/^0x[0-9a-fA-F]{64}$/.test(process.env.VERIFIER_PRIVATE_KEY ?? "") ||
    !process.env.NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS ||
    process.env.PACTFLOW_LOCAL_CHAIN === "true" ||
    process.env.VERIFIER_ALLOW_LOCALHOST === "true")
)
  throw new Error(
    "Production worker requires a configured verifier and V2; local testing modes forbidden",
  );
const connection = connectDatabase(process.env.DATABASE_URL);
const repository = new VerificationRepository(connection.db);
const queue = new BullMQVerificationQueue(process.env.REDIS_URL, async (id) => {
  await repository.retryJob(id);
  await processVerificationJob(id, repository, {
    rpcUrl: process.env.MONAD_TESTNET_RPC_URL,
  });
});
const healthFile = "/tmp/pactflow-worker-health";
const recordHealth = async () => {
  try {
    await Promise.race([
      Promise.all([connection.db.execute(sql`SELECT 1`), queue.health()]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Worker health timeout")), 3000),
      ),
    ]);
    await writeFile(healthFile, String(Date.now()), { mode: 0o600 });
  } catch {
    await unlink(healthFile).catch(() => {});
  }
};
void recordHealth();
const health = setInterval(() => {
  void recordHealth();
}, 15000);
health.unref();
const recovery = setInterval(() => {
  void repository
    .recoverAbandonedJobs()
    .then((jobs) => Promise.all(jobs.map((job) => queue.enqueue(job.id))))
    .catch(() => console.error("Job recovery failed"));
}, 30000);
recovery.unref();
async function close() {
  clearInterval(recovery);
  clearInterval(health);
  await unlink(healthFile).catch(() => {});
  await queue.close();
  await connection.close();
  process.exit(0);
}
process.on("SIGTERM", () => {
  void close();
});
process.on("SIGINT", () => {
  void close();
});
