import { randomBytes } from "node:crypto";
import {
  createPactPublicClient,
  getProtocolAddresses,
  monadTestnet,
  pactEscrowAbi,
  pactEscrowV2Abi,
  verifierRegistryV2Abi,
  verifierRegistryAbi,
  legacyProtocolAddresses,
} from "@pactflow/chain";
import {
  attestationDomain,
  attestationTypes,
  attestationV2Types,
} from "@pactflow/sdk";
import {
  createWalletClient,
  http,
  isHex,
  encodeFunctionData,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function verifierAccount() {
  const value = process.env.VERIFIER_PRIVATE_KEY;
  if (!value || !isHex(value) || value.length !== 66)
    throw new Error("VERIFIER_PRIVATE_KEY is not configured");
  return privateKeyToAccount(value as Hex);
}

export async function signAndSubmitAttestation(input: {
  escrow: Address;
  milestone: bigint;
  deliverableHash: Hex;
  rulesHash: Hex;
  reportHash: Hex;
  rpcUrl?: string;
  ttlSeconds?: number;
  submissionId?: bigint;
  approved?: boolean;
  beforeBroadcast?: (proof: {
    rawTransaction: Hex;
    txHash: Hex;
    digest: Hex;
    signature: Hex;
    nonce: bigint;
  }) => Promise<void>;
}) {
  const account = verifierAccount();
  const publicClient = createPactPublicClient(input.rpcUrl);
  const chainId = await publicClient.getChainId();
  if (chainId !== monadTestnet.id)
    throw new Error("Verifier refuses non-Monad Testnet chain");
  const addresses =
    input.submissionId === undefined
      ? legacyProtocolAddresses
      : getProtocolAddresses(chainId);
  if (input.submissionId !== undefined) {
    if (addresses.version !== 2) throw new Error("V2_NOT_CONFIGURED");
    const attestation = {
      pact: input.escrow,
      milestoneId: input.milestone,
      deliverableHash: input.deliverableHash,
      rulesHash: input.rulesHash,
      submissionId: input.submissionId,
      reportHash: input.reportHash,
      approved: input.approved ?? true,
      nonce: BigInt(`0x${randomBytes(32).toString("hex")}`),
      expiry: BigInt(Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 900)),
      verifier: account.address,
    };
    const signature = await account.signTypedData({
      domain: {
        ...attestationDomain(chainId, addresses.VerifierRegistry),
        version: "2",
      },
      types: attestationV2Types,
      primaryType: "Attestation",
      message: attestation,
    });
    const digest = await publicClient.readContract({
      address: addresses.VerifierRegistry,
      abi: verifierRegistryV2Abi,
      functionName: "hashAttestation",
      args: [attestation],
    });
    const wallet = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(input.rpcUrl ?? monadTestnet.rpcUrls.default.http[0]),
    });
    const data = encodeFunctionData({
      abi: pactEscrowV2Abi,
      functionName: "attest",
      args: [input.milestone, attestation, signature],
    });
    const request = await wallet.prepareTransactionRequest({
      account,
      chain: monadTestnet,
      to: input.escrow,
      data,
    });
    const rawTransaction = await wallet.signTransaction(request);
    const txHash = keccak256(rawTransaction);
    await input.beforeBroadcast?.({
      rawTransaction,
      txHash,
      digest,
      signature,
      nonce: attestation.nonce,
    });
    await publicClient.sendRawTransaction({
      serializedTransaction: rawTransaction,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 3,
    });
    if (receipt.status !== "success") throw new Error("ATTESTATION_REVERTED");
    return {
      verifier: account.address,
      attestation,
      signature,
      digest,
      txHash,
      blockNumber: receipt.blockNumber,
      reportHash: input.reportHash,
    };
  }
  const registered = await publicClient.readContract({
    address: addresses.VerifierRegistry,
    abi: verifierRegistryAbi,
    functionName: "verifiers",
    args: [account.address],
  });
  if (!registered[0])
    throw new Error("Verifier is not active in VerifierRegistry");
  const nonce = BigInt(`0x${randomBytes(32).toString("hex")}`);
  const expiry = BigInt(
    Math.floor(Date.now() / 1000) +
      (input.ttlSeconds ??
        Number(process.env.VERIFICATION_ATTESTATION_TTL_SECONDS || 900)),
  );
  const attestation = {
    pact: input.escrow,
    milestoneId: input.milestone,
    deliverableHash: input.deliverableHash,
    rulesHash: input.rulesHash,
    approved: true,
    nonce,
    expiry,
    verifier: account.address,
  } as const;
  const domain = attestationDomain(chainId, addresses.VerifierRegistry);
  const signature = await account.signTypedData({
    domain,
    types: attestationTypes,
    primaryType: "Attestation",
    message: attestation,
  });
  const digest = await publicClient.readContract({
    address: addresses.VerifierRegistry,
    abi: verifierRegistryAbi,
    functionName: "hashAttestation",
    args: [attestation],
  });
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(input.rpcUrl ?? monadTestnet.rpcUrls.default.http[0]),
  });
  const txHash = await wallet.writeContract({
    address: input.escrow,
    abi: pactEscrowAbi,
    functionName: "attest",
    args: [input.milestone, attestation, signature],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 3,
  });
  if (receipt.status !== "success")
    throw new Error(`Attestation transaction reverted: ${txHash}`);
  return {
    verifier: account.address,
    attestation,
    signature,
    digest,
    txHash,
    blockNumber: receipt.blockNumber,
    reportHash: input.reportHash,
  };
}
