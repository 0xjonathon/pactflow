import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPactPublicClient, getExplorerAddressUrl, getExplorerTxUrl, monadTestnet, pactFactoryAbi, reputationRegistryAbi, verifierRegistryAbi } from "@pactflow/chain";
import type { Address, Hex } from "viem";
import { requiredAddress, rpcUrl, type DeploymentFile } from "./runtime";

type BroadcastTx = { transactionType?: string; contractName?: string; contractAddress?: Address; hash?: Hex };
const path = join(process.cwd(), "packages/contracts/broadcast/DeployProtocol.s.sol", String(monadTestnet.id), "run-latest.json");
const broadcast = JSON.parse(readFileSync(path, "utf8")) as { transactions: BroadcastTx[] };
const client = createPactPublicClient(rpcUrl());
if (await client.getChainId() !== monadTestnet.id) throw new Error("RPC chain ID mismatch");
const names = ["VerifierRegistry", "ReputationRegistry", "PactFactory"] as const;
const creates = Object.fromEntries(names.map(name => {
  const tx = broadcast.transactions.find(tx => tx.contractName === name && tx.contractAddress && tx.hash);
  if (!tx?.contractAddress || !tx.hash) throw new Error(`Missing ${name} deployment in Foundry broadcast`);
  return [name, tx];
})) as Record<typeof names[number], BroadcastTx & { contractAddress: Address; hash: Hex }>;
const receipts = await Promise.all(names.map(name => client.getTransactionReceipt({ hash: creates[name].hash })));
for (const receipt of receipts) if (receipt.status !== "success") throw new Error(`Deployment reverted: ${receipt.transactionHash}`);
const factory = creates.PactFactory.contractAddress;
const [implementation, verifierFactory, reputationFactory] = await Promise.all([
  client.readContract({ address: factory, abi: pactFactoryAbi, functionName: "implementation" }),
  client.readContract({ address: creates.VerifierRegistry.contractAddress, abi: verifierRegistryAbi, functionName: "factory" }),
  client.readContract({ address: creates.ReputationRegistry.contractAddress, abi: reputationRegistryAbi, functionName: "factory" }),
]);
if (verifierFactory.toLowerCase() !== factory.toLowerCase() || reputationFactory.toLowerCase() !== factory.toLowerCase()) {
  throw new Error("Registry factory linkage is incomplete");
}
const token = requiredAddress("SETTLEMENT_TOKEN_ADDRESS");
if (!await client.getCode({ address: token })) throw new Error("Settlement token has no code");
const block = await client.getBlock({ blockNumber: receipts[2].blockNumber });
const file: DeploymentFile = {
  chainId: monadTestnet.id, deployedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
  deploymentBlock: Number(receipts[2].blockNumber),
  PactFactory: factory, PactEscrowImplementation: implementation,
  ReputationRegistry: creates.ReputationRegistry.contractAddress,
  VerifierRegistry: creates.VerifierRegistry.contractAddress, SettlementToken: token,
  deploymentTxHashes: Object.fromEntries(names.map((name, i) => [name, receipts[i].transactionHash])),
  deploymentBlocks: Object.fromEntries(names.map((name, i) => [name, Number(receipts[i].blockNumber)])),
};
writeFileSync(join(process.cwd(), "packages/chain/src/addresses/monad-testnet.json"), JSON.stringify(file, null, 2) + "\n");
const lines = [
  "# Monad Testnet evidence", "", `Network: ${monadTestnet.name}`, `Chain ID: ${monadTestnet.id}`,
  `Deployed at: ${file.deployedAt}`, "", "## Deployment", "",
  ...names.map(name => `- ${name}: [${creates[name].contractAddress}](${getExplorerAddressUrl(creates[name].contractAddress)}) · [tx](${getExplorerTxUrl(creates[name].hash)}) · block ${file.deploymentBlocks[name]}`),
  `- PactEscrow implementation: [${implementation}](${getExplorerAddressUrl(implementation)})`,
  `- Settlement token: [${token}](${getExplorerAddressUrl(token)})`, "", "## Smoke test", "", "Pending real execution.",
  "", "## Source verification", "", "Pending attempt.", "",
];
writeFileSync(join(process.cwd(), "docs/TESTNET.md"), lines.join("\n"));
console.log(`Recorded deployment at block ${file.deploymentBlock}`);
