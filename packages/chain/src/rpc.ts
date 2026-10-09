import { custom, http, type Transport } from "viem";

export function isRpcRateLimit(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as {
      status?: number;
      code?: number;
      message?: string;
      details?: string;
      cause?: unknown;
    };
    if (
      e.status === 429 ||
      /requests limited|rate.?limit|too many requests|\b429\b|compute units per second/i.test(
        `${e.message ?? ""} ${e.details ?? ""}`,
      )
    )
      return true;
    current = e.cause;
  }
  return (
    typeof error === "string" &&
    /requests limited|rate.?limit|too many requests|\b429\b/i.test(error)
  );
}
const readMethods = new Set([
  "eth_call",
  "eth_estimateGas",
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getTransactionCount",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "net_version",
]);
type Runtime = { now: () => number; wait: (ms: number) => Promise<void> };
export function createRpcRequestQueue(
  interval = 160,
  runtime: Runtime = {
    now: Date.now,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
) {
  let tail = Promise.resolve();
  let nextStart = 0;
  return <T>(method: string, request: () => Promise<T>): Promise<T> => {
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        await runtime.wait(Math.max(0, nextStart - runtime.now()));
        nextStart = runtime.now() + interval;
        try {
          return await request();
        } catch (error) {
          // Never retry broadcasts or signatures, nor deterministic reverts.
          if (
            !readMethods.has(method) ||
            !isRpcRateLimit(error) ||
            attempt >= 3
          )
            throw error;
          nextStart = runtime.now() + 1200 * 2 ** attempt;
        }
      }
    };
    const result = tail.then(run, run);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
const queues = new Map<string, ReturnType<typeof createRpcRequestQueue>>();
export function pactHttp(url: string): Transport {
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(
    new URL(url).hostname,
  );
  let queue = queues.get(url);
  if (!queue) {
    queue = createRpcRequestQueue(local ? 0 : 160);
    queues.set(url, queue);
  }
  const schedule = queue;
  return (options) => {
    const upstream = http(url, { retryCount: 0 })(options);
    return custom(
      {
        request: (args: Parameters<typeof upstream.request>[0]) =>
          schedule(args.method, () => upstream.request(args)),
      },
      { retryCount: 0, name: "PactFlow RPC" },
    )(options);
  };
}
