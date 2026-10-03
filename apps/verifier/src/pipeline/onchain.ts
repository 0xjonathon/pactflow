import {
  createPactPublicClient,
  monadTestnet,
  pactEscrowAbi,
  pactEscrowV2Abi,
} from "@pactflow/chain";
import { PactFlowSdk, parseVerifiedDataUri } from "@pactflow/sdk";
import { isAddress, type Address, type Hex } from "viem";
import { hashVerificationPolicy, type VerificationPolicy } from "../policy";

export class ChainStateError extends Error {
  constructor(
    readonly code:
      | "CHAIN_STATE_MISMATCH"
      | "RULES_HASH_MISMATCH"
      | "DELIVERABLE_HASH_MISMATCH",
    message: string,
  ) {
    super(message);
  }
}
export async function loadAndValidateOnchain(input: {
  escrow: Address;
  milestoneIndex: number;
  policy: VerificationPolicy;
  expectedDeliverableHash?: Hex;
  rpcUrl?: string;
}) {
  if (
    !isAddress(input.escrow) ||
    !Number.isSafeInteger(input.milestoneIndex) ||
    input.milestoneIndex < 0
  )
    throw new ChainStateError(
      "CHAIN_STATE_MISMATCH",
      "Invalid Pact or milestone",
    );
  const client = createPactPublicClient(input.rpcUrl);
  if ((await client.getChainId()) !== monadTestnet.id)
    throw new ChainStateError("CHAIN_STATE_MISMATCH", "Wrong chain");
  const sdk = new PactFlowSdk({ rpcUrl: input.rpcUrl });
  const pact = await sdk.getPact(input.escrow);
  const milestone = pact.milestones[input.milestoneIndex];
  if (!milestone || milestone.status !== "Submitted" || !pact.worker)
    throw new ChainStateError(
      "CHAIN_STATE_MISMATCH",
      "Pact has no active submission",
    );
  if (
    milestone.mode !== (input.policy.mode === "AI_ONLY" ? "AIOnly" : "Hybrid")
  )
    throw new ChainStateError(
      "CHAIN_STATE_MISMATCH",
      "Verification mode differs from policy",
    );
  const rulesHash = hashVerificationPolicy(input.policy);
  if (rulesHash.toLowerCase() !== milestone.rulesHash.toLowerCase())
    throw new ChainStateError(
      "RULES_HASH_MISMATCH",
      "Onchain rules hash differs from policy",
    );
  if (
    input.expectedDeliverableHash &&
    input.expectedDeliverableHash.toLowerCase() !==
      milestone.deliverableHash.toLowerCase()
  )
    throw new ChainStateError(
      "DELIVERABLE_HASH_MISMATCH",
      "Submission changed",
    );
  if (pact.protocolVersion === 2) {
    const raw = await client.readContract({
      address: input.escrow,
      abi: pactEscrowV2Abi,
      functionName: "milestone",
      args: [BigInt(input.milestoneIndex)],
    });
    if (raw.aiAttested || raw.settled || raw.disputed || raw.revisionRequired)
      throw new ChainStateError(
        "CHAIN_STATE_MISMATCH",
        "Submission no longer verifiable",
      );
    return { pact, milestone, rulesHash, previewUrl: null, metadata: null };
  }
  const metadata = parseVerifiedDataUri(
    milestone.deliverableURI,
    milestone.deliverableHash,
  );
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    throw new ChainStateError(
      "DELIVERABLE_HASH_MISMATCH",
      "Deliverable metadata does not match onchain hash",
    );
  const previewUrl = (metadata as Record<string, unknown>).previewUrl;
  if (typeof previewUrl !== "string")
    throw new ChainStateError(
      "DELIVERABLE_HASH_MISMATCH",
      "Deliverable URL is missing",
    );
  const raw = await client.readContract({
    address: input.escrow,
    abi: pactEscrowAbi,
    functionName: "milestone",
    args: [BigInt(input.milestoneIndex)],
  });
  if (raw.aiAttested || raw.settled || raw.disputed)
    throw new ChainStateError(
      "CHAIN_STATE_MISMATCH",
      "Milestone is no longer verifiable",
    );
  return { pact, milestone, rulesHash, previewUrl, metadata };
}
