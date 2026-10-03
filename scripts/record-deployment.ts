import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPactPublicClient,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  monadTestnet,
  pactFactoryAbi,
  reputationRegistryAbi,
  verifierRegistryAbi,
} from "@pactflow/chain";
import type { Address, Hex } from "viem";
import {
  accountFromEnv,
  requiredAddress,
  rpcUrl,
  type DeploymentFile,
} from "./runtime";

type BroadcastTx = {
  transactionType?: string;
  contractName?: string;
  contractAddress?: Address;
  hash?: Hex;
};
const path = join(
  process.cwd(),
  "packages/contracts/broadcast/DeployProtocol.s.sol",
  String(monadTestnet.id),
  "run-latest.json",
);
const broadcast = JSON.parse(readFileSync(path, "utf8")) as {
  transactions: BroadcastTx[];
};
const client = createPactPublicClient(rpcUrl());
if ((await client.getChainId()) !== monadTestnet.id)
  throw new Error("RPC chain ID mismatch");
const names = [
  "VerifierRegistry",
  "ReputationRegistry",
  "PactFactory",
] as const;
const creates = Object.fromEntries(
  names.map((name) => {
    const tx = broadcast.transactions.find(
      (tx) => tx.contractName === name && tx.contractAddress && tx.hash,
    );
    if (!tx?.contractAddress || !tx.hash)
      throw new Error(`Missing ${name} deployment in Foundry broadcast`);
    return [name, tx];
  }),
) as Record<
  (typeof names)[number],
  BroadcastTx & { contractAddress: Address; hash: Hex }
>;
const receipts = await Promise.all(
  names.map((name) =>
    client.getTransactionReceipt({ hash: creates[name].hash }),
  ),
);
for (const receipt of receipts)
  if (receipt.status !== "success")
    throw new Error(`Deployment reverted: ${receipt.transactionHash}`);
const factory = creates.PactFactory.contractAddress;
const [
  implementation,
  verifierFactory,
  reputationFactory,
  verifierFromFactory,
  reputationFromFactory,
  feeBps,
  feeTreasury,
] = await Promise.all([
  client.readContract({
    address: factory,
    abi: pactFactoryAbi,
    functionName: "implementation",
  }),
  client.readContract({
    address: creates.VerifierRegistry.contractAddress,
    abi: verifierRegistryAbi,
    functionName: "factory",
  }),
  client.readContract({
    address: creates.ReputationRegistry.contractAddress,
    abi: reputationRegistryAbi,
    functionName: "factory",
  }),
  client.readContract({
    address: factory,
    abi: pactFactoryAbi,
    functionName: "verifierRegistry",
  }),
  client.readContract({
    address: factory,
    abi: pactFactoryAbi,
    functionName: "reputationRegistry",
  }),
  client.readContract({
    address: factory,
    abi: pactFactoryAbi,
    functionName: "feeBps",
  }),
  client.readContract({
    address: factory,
    abi: pactFactoryAbi,
    functionName: "feeTreasury",
  }),
]);
if (
  verifierFactory.toLowerCase() !== factory.toLowerCase() ||
  reputationFactory.toLowerCase() !== factory.toLowerCase() ||
  verifierFromFactory.toLowerCase() !==
    creates.VerifierRegistry.contractAddress.toLowerCase() ||
  reputationFromFactory.toLowerCase() !==
    creates.ReputationRegistry.contractAddress.toLowerCase()
) {
  throw new Error("Registry factory linkage is incomplete");
}
if (
  feeBps !== 0 ||
  feeTreasury === "0x0000000000000000000000000000000000000000"
)
  throw new Error("Factory fee configuration is wrong");
const token = requiredAddress("SETTLEMENT_TOKEN_ADDRESS");
for (const [name, address] of Object.entries({
  PactFactory: factory,
  PactEscrowImplementation: implementation,
  VerifierRegistry: creates.VerifierRegistry.contractAddress,
  ReputationRegistry: creates.ReputationRegistry.contractAddress,
  SettlementToken: token,
})) {
  const code = await client.getCode({ address });
  if (!code || code === "0x")
    throw new Error(`${name} has no code on Monad Testnet`);
}
const block = await client.getBlock({ blockNumber: receipts[2].blockNumber });
const file: DeploymentFile = {
  chainId: monadTestnet.id,
  deployedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
  deploymentBlock: Number(receipts[2].blockNumber),
  PactFactory: factory,
  PactEscrowImplementation: implementation,
  ReputationRegistry: creates.ReputationRegistry.contractAddress,
  VerifierRegistry: creates.VerifierRegistry.contractAddress,
  SettlementToken: token,
  deploymentTxHashes: Object.fromEntries(
    names.map((name, i) => [name, receipts[i].transactionHash]),
  ),
  deploymentBlocks: Object.fromEntries(
    names.map((name, i) => [name, Number(receipts[i].blockNumber)]),
  ),
};
writeFileSync(
  join(process.cwd(), "packages/chain/src/addresses/monad-testnet.json"),
  JSON.stringify(file, null, 2) + "\n",
);
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  let local = readFileSync(envPath, "utf8");
  const publicValues: Record<string, string> = {
    NEXT_PUBLIC_PACT_FACTORY_ADDRESS: file.PactFactory,
    NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS: file.ReputationRegistry,
    NEXT_PUBLIC_VERIFIER_REGISTRY_ADDRESS: file.VerifierRegistry,
    NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS: file.SettlementToken,
    NEXT_PUBLIC_ARBITRATOR_ADDRESS: accountFromEnv("DEPLOYER_PRIVATE_KEY")
      .address,
  };
  for (const [name, value] of Object.entries(publicValues)) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    local = pattern.test(local)
      ? local.replace(pattern, `${name}=${value}`)
      : `${local.trimEnd()}\n${name}=${value}\n`;
  }
  writeFileSync(envPath, local, { mode: 0o600 });
}
const webEnvPath = join(process.cwd(), "apps/web/.env.local");
let webEnv = existsSync(webEnvPath) ? readFileSync(webEnvPath, "utf8") : "";
const webValues: Record<string, string> = {
  NEXT_PUBLIC_MONAD_CHAIN_ID: String(monadTestnet.id),
  NEXT_PUBLIC_MONAD_RPC_URL:
    process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
    monadTestnet.rpcUrls.default.http[0],
  NEXT_PUBLIC_MONAD_EXPLORER_URL:
    process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL ||
    monadTestnet.blockExplorers.default.url,
  NEXT_PUBLIC_PACT_FACTORY_ADDRESS: file.PactFactory,
  NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS: file.ReputationRegistry,
  NEXT_PUBLIC_VERIFIER_REGISTRY_ADDRESS: file.VerifierRegistry,
  NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS: file.SettlementToken,
  NEXT_PUBLIC_ARBITRATOR_ADDRESS: accountFromEnv("DEPLOYER_PRIVATE_KEY")
    .address,
};
for (const [name, value] of Object.entries(webValues)) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  webEnv = pattern.test(webEnv)
    ? webEnv.replace(pattern, `${name}=${value}`)
    : `${webEnv.trimEnd()}\n${name}=${value}\n`;
}
writeFileSync(webEnvPath, webEnv, { mode: 0o600 });
const lines = [
  "# Monad Testnet evidence",
  "",
  `Network: ${monadTestnet.name}`,
  `Chain ID: ${monadTestnet.id}`,
  `Deployed at: ${file.deployedAt}`,
  "",
  "## Deployment",
  "",
  ...names.map(
    (name) =>
      `- ${name}: [${creates[name].contractAddress}](${getExplorerAddressUrl(creates[name].contractAddress)}) · [tx](${getExplorerTxUrl(creates[name].hash)}) · block ${file.deploymentBlocks[name]}`,
  ),
  `- PactEscrow implementation: [${implementation}](${getExplorerAddressUrl(implementation)})`,
  `- Settlement token: [${token}](${getExplorerAddressUrl(token)})`,
  "",
  "## Smoke test",
  "",
  "Pending real execution.",
  "",
  "## Browser wallet walkthrough",
  "",
  "Manual Browser E2E Pending.",
  "",
  "## Source verification",
  "",
  "Pending attempt.",
  "",
];
writeFileSync(join(process.cwd(), "docs/TESTNET.md"), lines.join("\n"));
console.log(`Recorded deployment at block ${file.deploymentBlock}`);
