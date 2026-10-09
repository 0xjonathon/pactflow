import test from "node:test";
import assert from "node:assert/strict";
import { getProtocolAddresses, monadTestnet } from "@pactflow/chain";
import { PactFlowSdk } from "./index";
const escrow = "0xb2249dbfd4f4c94a17670d712fd8beea5b522486" as const;
test("protocol reads are deduplicated in flight and cached after success", async () => {
  const sdk = new PactFlowSdk({
    addresses: { ...getProtocolAddresses(monadTestnet.id), version: 2 },
  });
  let calls = 0;
  sdk.publicClient.readContract = (async () => {
    calls++;
    return true;
  }) as typeof sdk.publicClient.readContract;
  assert.deepEqual(
    await Promise.all([
      sdk.getProtocolVersion(escrow),
      sdk.getProtocolVersion(escrow),
    ]),
    [2, 2],
  );
  await sdk.getProtocolVersion(escrow);
  assert.equal(calls, 1);
});
test("failed lookups can be retried and cannot poison the version cache", async () => {
  const sdk = new PactFlowSdk({
    addresses: { ...getProtocolAddresses(monadTestnet.id), version: 2 },
  });
  let calls = 0;
  sdk.publicClient.readContract = (async () => {
    if (++calls === 1) throw new Error("rate limit");
    return true;
  }) as typeof sdk.publicClient.readContract;
  await assert.rejects(sdk.getProtocolVersion(escrow));
  assert.equal(await sdk.getProtocolVersion(escrow), 2);
  assert.equal(calls, 2);
});
