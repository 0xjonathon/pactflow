import { readFileSync } from "node:fs";
Object.assign(
  process.env,
  JSON.parse(readFileSync(".local/e2e/env.json", "utf8")),
);
const { PactFlowSdk } = await import("@pactflow/sdk");
const sdk = new PactFlowSdk({ rpcUrl: process.env.MONAD_TESTNET_RPC_URL });
console.log({
  rpc: process.env.MONAD_TESTNET_RPC_URL,
  chain: await sdk.publicClient.getChainId(),
  code: (await sdk.publicClient.getCode({ address: sdk.addresses.PactFactory }))
    ?.length,
});
console.log({
  indexHealth: await (
    await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/v1/indexer/health")
  ).json(),
});
