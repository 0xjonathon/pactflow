import { Queue, Worker, RedisQueueBackend } from "bullmq";

export interface VerificationQueue {
  enqueue(jobId: string): Promise<void>;
  close(): Promise<void>;
}
export class InlineVerificationQueue implements VerificationQueue {
  constructor(private readonly processJob: (id: string) => Promise<void>) {}
  async enqueue(jobId: string) {
    queueMicrotask(() => {
      void this.processJob(jobId).catch((error) =>
        console.error(
          JSON.stringify({
            jobId,
            step: "worker",
            error: error instanceof Error ? error.message : "unknown",
          }),
        ),
      );
    });
  }
  async close() {}
}

function redisConnection(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:")
    throw new Error("REDIS_URL must use redis:// or rediss://");
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number(parsed.pathname.slice(1) || 0),
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}
export class BullMQVerificationQueue implements VerificationQueue {
  private readonly queue: Queue;
  private readonly worker: Worker | null;
  private readonly ready: Promise<void>;
  constructor(url: string, processJob?: (id: string) => Promise<void>) {
    const connection = redisConnection(url);
    this.queue = new Queue("pactflow-verification", { connection });
    this.queue.on("error", () =>
      console.error("Verification queue connection unavailable"),
    );
    this.ready = this.queue.setGlobalConcurrency(1).then(() => {});
    void this.ready.catch(() =>
      console.error("Verification queue initialization failed"),
    );
    this.worker = processJob
      ? new Worker(
          "pactflow-verification",
          async (job) => {
            await processJob(job.data.jobId as string);
          },
          { connection, concurrency: 1, autorun: false },
        )
      : null;
    if (this.worker)
      void this.ready
        .then(() => this.worker!.run())
        .catch(() => console.error("Verification queue unavailable"));
    this.worker?.on("error", () =>
      console.error("Verification worker connection unavailable"),
    );
    this.worker?.on("failed", (job, error) =>
      console.error(
        JSON.stringify({
          jobId: job?.data.jobId,
          step: "worker",
          error: error.message,
        }),
      ),
    );
  }
  async health() {
    await this.ready;
    const backend = this.queue.getBackend();
    if (!(backend instanceof RedisQueueBackend))
      throw new Error("Redis backend required");
    const client = await backend.client;
    await client.runCommand("ping", []);
  }
  async takeRateLimit(key: string, maximum: number, windowMs = 60_000) {
    const backend = this.queue.getBackend();
    if (!(backend instanceof RedisQueueBackend))
      throw new Error("Redis backend required");
    const client = await backend.client;
    client.defineCommand("pactflowRate", {
      numberOfKeys: 1,
      lua: "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end; return n",
    });
    const count = Number(
      await client.runCommand("pactflowRate", [
        `pactflow:rate:${key}`,
        windowMs,
      ]),
    );
    return count <= maximum;
  }
  async enqueue(jobId: string) {
    await this.ready;
    const existing = await this.queue.getJob(jobId);
    if (existing && ["completed", "failed"].includes(await existing.getState()))
      await existing.remove();
    await this.queue.add(
      "verify",
      { jobId },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 1000,
      },
    );
  }
  async close() {
    await this.worker?.close();
    await this.queue.close();
  }
}
