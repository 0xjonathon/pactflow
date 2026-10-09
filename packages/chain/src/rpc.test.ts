import test from "node:test";
import assert from "node:assert/strict";
import { createRpcRequestQueue, isRpcRateLimit } from "./rpc";
function clock() {
  let time = 0;
  const waits: number[] = [];
  return {
    now: () => time,
    waits,
    wait: async (ms: number) => {
      waits.push(ms);
      time += ms;
    },
  };
}
test("concurrent readers are spaced across one endpoint queue", async () => {
  const runtime = clock(),
    queue = createRpcRequestQueue(160, runtime),
    starts: number[] = [];
  await Promise.all(
    Array.from({ length: 4 }, () =>
      queue("eth_call", async () => {
        starts.push(runtime.now());
        return "ok";
      }),
    ),
  );
  assert.deepEqual(starts, [0, 160, 320, 480]);
});
test("provider limit errors retry reads with backoff and return the actual result", async () => {
  const runtime = clock(),
    queue = createRpcRequestQueue(160, runtime);
  let calls = 0;
  const result = await queue("eth_call", async () => {
    if (++calls < 3) throw new Error("requests limited to 15/sec");
    return "verified";
  });
  assert.equal(result, "verified");
  assert.equal(calls, 3);
  assert.deepEqual(runtime.waits, [0, 1200, 2400]);
});
test("rate retries are bounded and the queue recovers after an exhausted read", async () => {
  const queue = createRpcRequestQueue(160, clock());
  let calls = 0;
  await assert.rejects(
    queue("eth_call", async () => {
      calls++;
      throw { status: 429 };
    }),
  );
  assert.equal(calls, 4);
  assert.equal(await queue("eth_blockNumber", async () => "0x10"), "0x10");
});
test("transactions and signatures are never automatically retried", async () => {
  for (const method of [
    "eth_sendTransaction",
    "eth_sendRawTransaction",
    "personal_sign",
    "eth_signTypedData_v4",
  ]) {
    let calls = 0;
    const queue = createRpcRequestQueue(0, clock());
    await assert.rejects(
      queue(method, async () => {
        calls++;
        throw new Error("requests limited to 15/sec");
      }),
    );
    assert.equal(calls, 1);
  }
});
test("deterministic reverts are not retried and wrapped limits are recognized", async () => {
  let calls = 0;
  const queue = createRpcRequestQueue(0, clock());
  await assert.rejects(
    queue("eth_call", async () => {
      calls++;
      throw new Error("execution reverted: Unauthorized");
    }),
  );
  assert.equal(calls, 1);
  assert.equal(
    isRpcRateLimit(
      new Error("RPC Request failed", {
        cause: { details: "requests limited to 15/sec" },
      }),
    ),
    true,
  );
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  assert.equal(isRpcRateLimit(cycle), false);
});
