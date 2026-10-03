/** Isolated development deployment. Never broadcasts to a public RPC. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Address,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "@pactflow/chain";
const rpc = "http://127.0.0.1:8547";
const client = createPublicClient({
  chain: monadTestnet,
  transport: http(rpc),
});
if ((await client.getChainId()) !== 10143)
  throw new Error("Local chain ID mismatch");
const keys = Object.fromEntries(
  ["owner", "client", "worker", "verifier", "arbitrator"].map((role) => [
    role,
    generatePrivateKey(),
  ]),
);
const accounts = Object.fromEntries(
  Object.entries(keys).map(([role, key]) => [role, privateKeyToAccount(key)]),
);
for (const account of Object.values(accounts))
  await client.request({
    method: "anvil_setBalance" as never,
    params: [account.address, "0x56BC75E2D63100000"] as never,
  });
const wallet = createWalletClient({
  account: accounts.owner,
  chain: monadTestnet,
  transport: http(rpc),
});
const artifact = (name: string) =>
  JSON.parse(
    readFileSync(
      resolve(
        `packages/contracts/out/${name === "TestToken" ? "PactFlow.t" : name}.sol/${name}.json`,
      ),
      "utf8",
    ),
  );
async function deploy(name: string, args: unknown[] = []) {
  const data = artifact(name);
  const hash = await wallet.deployContract({
    abi: data.abi,
    bytecode: data.bytecode.object,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress)
    throw new Error("Deploy failed");
  return receipt.contractAddress;
}
async function write(
  name: string,
  address: Address,
  functionName: string,
  args: unknown[],
) {
  const hash = await wallet.writeContract({
    address,
    abi: artifact(name).abi,
    functionName,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Configure failed");
}
const token = await deploy("TestToken");
const registry = await deploy("VerifierRegistryV2", [accounts.owner.address]);
const reputation = await deploy("ReputationRegistryV2", [
  accounts.owner.address,
]);
const factory = await deploy("PactFactoryV2", [
  accounts.owner.address,
  registry,
  reputation,
  accounts.owner.address,
  0,
]);
await write("VerifierRegistryV2", registry, "setFactory", [factory]);
await write("ReputationRegistryV2", reputation, "setFactory", [factory]);
await write("VerifierRegistryV2", registry, "register", [
  accounts.verifier.address,
  1,
  "local-test:deterministic-v2",
  keccak256(stringToHex("local-test")),
]);
for (const role of ["client", "worker"])
  await write("TestToken", token, "mint", [
    accounts[role].address,
    1_000_000_000n,
  ]);
mkdirSync(".local/e2e", { recursive: true });
const env = {
  DATABASE_URL: `pglite:${resolve(`.local/e2e/database-${Date.now()}`)}`,
  API_PORT: "3012",
  WEB_ORIGIN: "http://localhost:3011",
  AUTH_DOMAIN: "localhost:3011",
  MONAD_TESTNET_RPC_URL: rpc,
  NEXT_PUBLIC_MONAD_RPC_URL: rpc,
  NEXT_PUBLIC_MONAD_CHAIN_ID: "10143",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:3012",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3011",
  NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS: factory,
  NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS: reputation,
  NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS: registry,
  NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS: token,
  NEXT_PUBLIC_VERIFIER_ADDRESS: accounts.verifier.address,
  NEXT_PUBLIC_ARBITRATOR_ADDRESS: accounts.arbitrator.address,
  VERIFIER_PRIVATE_KEY: keys.verifier,
  PACTFLOW_LOCAL_CHAIN: "true",
  NEXT_PUBLIC_LOCAL_CHAIN: "true",
  INDEXER_START_BLOCK: "0",
  INDEXER_INTERVAL_MS: "4000",
  NODE_ENV: "development",
};
writeFileSync(".local/e2e/env.json", JSON.stringify(env, null, 2), {
  mode: 0o600,
});
writeFileSync(".local/e2e/accounts.json", JSON.stringify(keys), {
  mode: 0o600,
});
console.log(
  JSON.stringify(
    {
      network: "LOCAL_TEST_ONLY",
      factory,
      token,
      registry,
      reputation,
      accounts: Object.fromEntries(
        Object.entries(accounts).map(([k, v]) => [k, v.address]),
      ),
    },
    null,
    2,
  ),
);
