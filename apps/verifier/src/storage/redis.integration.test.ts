import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BullMQVerificationQueue } from "../queue";
const url = process.env.TEST_REDIS_URL;
test(
  "Redis retries, shared rate limits and re-enqueue after recovery",
  { skip: !url, timeout: 30000 },
  async () => {
    if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
      throw new Error("Local disposable Redis required");
    let attempts = 0;
    const id = randomUUID();
    const worker = new BullMQVerificationQueue(url, async (job) => {
      if (job !== id) return;
      attempts++;
      if (attempts === 1) throw new Error("Recoverable provider outage");
    });
    const producer = new BullMQVerificationQueue(url);
    async function until(condition: () => boolean) {
      const expires = Date.now() + 20000;
      while (!condition()) {
        if (Date.now() > expires) throw new Error("Queue recovery timeout");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    try {
      assert.equal(await producer.takeRateLimit(id, 1), true);
      assert.equal(await worker.takeRateLimit(id, 1), false);
      await producer.enqueue(id);
      await until(() => attempts >= 2);
      // Let the completed state persist before simulating a manual retry.
      await new Promise((r) => setTimeout(r, 250));
      await producer.enqueue(id);
      await until(() => attempts >= 3);
      assert.equal(attempts, 3);
    } finally {
      await worker.close();
      await producer.close();
    }
  },
);
