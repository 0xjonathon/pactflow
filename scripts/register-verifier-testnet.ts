import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from "viem";
import { verifierRegistryAbi, monadTestnet } from "@pactflow/chain";
import { canonicalizeAgreement } from "@pactflow/sdk";
import { accountFromEnv, deployment, rpcUrl } from "./runtime";

const metadata = {
  name: "PactFlow AI Verifier",
  version: "1.0.0",
  operator: "PactFlow",
  capabilities: [
    "HTTP_STATUS",
    "DOM_SELECTOR",
    "DOM_TEXT",
    "LIGHTHOUSE",
    "JSON_SCHEMA",
    "FILE_HASH",
    "LLM_RUBRIC",
  ],
};
const canonical = canonicalizeAgreement(metadata);
const metadataHash = keccak256(toBytes(canonical));
const metadataURI = `data:application/json;charset=utf-8,${encodeURIComponent(canonical)}`;
const account = accountFromEnv("DEPLOYER_PRIVATE_KEY");
const rpc = rpcUrl();
const addresses = deployment();
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(rpc),
});
if ((await publicClient.getChainId()) !== monadTestnet.id)
  throw new Error("Wrong network");
const current = await publicClient.readContract({
  address: addresses.VerifierRegistry,
  abi: verifierRegistryAbi,
  functionName: "verifiers",
  args: [account.address],
});
if (current[0] && current[3] === metadataHash) {
  console.log(
    `Verifier already registered: ${account.address}\nMetadata Hash: ${metadataHash}`,
  );
} else {
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(rpc),
  });
  const hash = await wallet.writeContract({
    address: addresses.VerifierRegistry,
    abi: verifierRegistryAbi,
    functionName: "register",
    args: [account.address, 1, metadataURI, metadataHash],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 3,
  });
  if (receipt.status !== "success")
    throw new Error(`Registration reverted: ${hash}`);
  console.log(
    `Verifier Address: ${account.address}\nRegistration TX: ${hash}\nRegistration Block: ${receipt.blockNumber}\nMetadata Hash: ${metadataHash}`,
  );
}
