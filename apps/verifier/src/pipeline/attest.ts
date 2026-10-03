import { randomBytes } from "node:crypto";
import { createPactPublicClient, getProtocolAddresses, monadTestnet, pactEscrowAbi, verifierRegistryAbi } from "@pactflow/chain";
import { attestationDomain, attestationTypes } from "@pactflow/sdk";
import { createWalletClient, http, isHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function verifierAccount() {
  // Existing compromised wallet is allowed only for Monad Testnet by explicit user policy.
  const value = process.env.VERIFIER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!value || !isHex(value) || value.length !== 66) throw new Error("VERIFIER_PRIVATE_KEY is not configured");
  return privateKeyToAccount(value as Hex);
}

export async function signAndSubmitAttestation(input: {
  escrow: Address; milestone: bigint; deliverableHash: Hex; rulesHash: Hex; reportHash: Hex; rpcUrl?: string; ttlSeconds?: number;
}) {
  const account = verifierAccount();
  const publicClient = createPactPublicClient(input.rpcUrl);
  const chainId = await publicClient.getChainId();
  if (chainId !== monadTestnet.id) throw new Error("Verifier refuses non-Monad Testnet chain");
  const addresses = getProtocolAddresses(chainId);
  const registered = await publicClient.readContract({ address: addresses.VerifierRegistry, abi: verifierRegistryAbi, functionName: "verifiers", args: [account.address] });
  if (!registered[0]) throw new Error("Verifier is not active in VerifierRegistry");
  const nonce = BigInt(`0x${randomBytes(32).toString("hex")}`);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? Number(process.env.VERIFICATION_ATTESTATION_TTL_SECONDS || 900)));
  const attestation = { pact: input.escrow, milestoneId: input.milestone, deliverableHash: input.deliverableHash, rulesHash: input.rulesHash,
    approved: true, nonce, expiry, verifier: account.address } as const;
  const domain = attestationDomain(chainId, addresses.VerifierRegistry);
  const signature = await account.signTypedData({ domain, types: attestationTypes, primaryType: "Attestation", message: attestation });
  const digest = await publicClient.readContract({ address: addresses.VerifierRegistry, abi: verifierRegistryAbi, functionName: "hashAttestation", args: [attestation] });
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(input.rpcUrl ?? monadTestnet.rpcUrls.default.http[0]) });
  const txHash = await wallet.writeContract({ address: input.escrow, abi: pactEscrowAbi, functionName: "attest", args: [input.milestone, attestation, signature] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
  if (receipt.status !== "success") throw new Error(`Attestation transaction reverted: ${txHash}`);
  return { verifier: account.address, attestation, signature, digest, txHash, blockNumber: receipt.blockNumber, reportHash: input.reportHash };
}
