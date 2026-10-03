/** Validate actual broadcast evidence; preserve the complete V1 record. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  createPactPublicClient,
  monadTestnet,
  pactFactoryV2Abi,
  verifierRegistryV2Abi,
  reputationRegistryV2Abi,
} from "@pactflow/chain";
import { type Address, type Hex, keccak256 } from "viem";
import { rpcUrl, requiredAddress } from "./runtime";
const output = "packages/chain/src/addresses/monad-testnet-v2.json";
if (existsSync(output))
  throw new Error(
    "V2 deployment already recorded; preserve it before another deployment",
  );
const broadcast = JSON.parse(
  readFileSync(
    "packages/contracts/broadcast/DeployProtocolV2.s.sol/10143/run-latest.json",
    "utf8",
  ),
) as {
  transactions: {
    contractName?: string;
    contractAddress?: Address;
    hash?: Hex;
  }[];
};
const client = createPactPublicClient(rpcUrl());
if ((await client.getChainId()) !== monadTestnet.id)
  throw new Error("Wrong chain");
const names = [
  "PactFactoryV2",
  "VerifierRegistryV2",
  "ReputationRegistryV2",
] as const;
const addresses = {} as Record<(typeof names)[number], Address>;
const transactions: Record<
  string,
  { hash: Hex; block: string; codeHash: Hex }
> = {};
for (const name of names) {
  const tx = broadcast.transactions.find(
    (t) => t.contractName === name && t.contractAddress && t.hash,
  );
  if (!tx?.hash || !tx.contractAddress) throw new Error(`Missing ${name}`);
  const receipt = await client.waitForTransactionReceipt({
    hash: tx.hash,
    confirmations: 3,
  });
  const code = await client.getCode({ address: tx.contractAddress });
  if (receipt.status !== "success" || !code || code === "0x")
    throw new Error(`Invalid deployment ${name}`);
  addresses[name] = tx.contractAddress;
  transactions[name] = {
    hash: tx.hash,
    block: receipt.blockNumber.toString(),
    codeHash: keccak256(code),
  };
}
const factory = addresses.PactFactoryV2;
for (const [address, abi] of [
  [addresses.VerifierRegistryV2, verifierRegistryV2Abi],
  [addresses.ReputationRegistryV2, reputationRegistryV2Abi],
] as const) {
  if (
    (
      await client.readContract({ address, abi, functionName: "factory" })
    ).toLowerCase() !== factory.toLowerCase()
  )
    throw new Error("Registry binding mismatch");
}
const verifier = requiredAddress("NEXT_PUBLIC_VERIFIER_ADDRESS");
const registered = await client.readContract({
  address: addresses.VerifierRegistryV2,
  abi: verifierRegistryV2Abi,
  functionName: "verifiers",
  args: [verifier],
});
if (!registered[0]) throw new Error("Verifier not registered");
const implementation = await client.readContract({
  address: factory,
  abi: pactFactoryV2Abi,
  functionName: "implementation",
});
writeFileSync(
  output,
  JSON.stringify(
    {
      protocolVersion: 2,
      chainId: 10143,
      ...addresses,
      Implementation: implementation,
      SettlementToken: requiredAddress("SETTLEMENT_TOKEN_ADDRESS"),
      Verifier: verifier,
      deploymentBlock: Math.min(
        ...Object.values(transactions).map((t) => Number(t.block)),
      ),
      transactions,
      recordedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log("Validated V2 deployment recorded. V1 record preserved.");
