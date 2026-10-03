import { Queue, Worker } from "bullmq";

export interface VerificationQueue { enqueue(jobId: string): Promise<void>; close(): Promise<void> }
export class InlineVerificationQueue implements VerificationQueue {
  constructor(private readonly processJob: (id: string) => Promise<void>) {}
  async enqueue(jobId: string) { queueMicrotask(() => { void this.processJob(jobId).catch(error => console.error(JSON.stringify({ jobId, step: "worker", error: error instanceof Error ? error.message : "unknown" }))); }); }
  async close() {}
}

function redisConnection(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") throw new Error("REDIS_URL must use redis:// or rediss://");
  return { host: parsed.hostname, port: Number(parsed.port || 6379), username: parsed.username || undefined, password: parsed.password || undefined, db: Number(parsed.pathname.slice(1) || 0), tls: parsed.protocol === "rediss:" ? {} : undefined, maxRetriesPerRequest: null as null };
}
export class BullMQVerificationQueue implements VerificationQueue {
  private readonly queue: Queue;
  private readonly worker: Worker;
  constructor(url: string, processJob: (id: string) => Promise<void>) {
    const connection = redisConnection(url);
    this.queue = new Queue("pactflow-verification", { connection });
    this.worker = new Worker("pactflow-verification", async job => { await processJob(job.data.jobId as string); }, { connection, concurrency: 2 });
    this.worker.on("failed", (job, error) => console.error(JSON.stringify({ jobId: job?.data.jobId, step: "worker", error: error.message })));
  }
  async enqueue(jobId: string) { await this.queue.add("verify", { jobId }, { jobId, attempts: 3, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 1000 }); }
  async close() { await this.worker.close(); await this.queue.close(); }
}
