import type { Abi, Address, Hex } from "viem";

export type PactStatus = "Created" | "Funded" | "Active" | "Submitted" | "Disputed" | "Completed" | "Cancelled";
export type MilestoneStatus = "Pending" | "Submitted" | "Disputed" | "Paid";

export interface MilestoneView {
  id: bigint;
  amount: bigint;
  dueAt: bigint;
  rulesHash: Hex;
  mode: "ClientOnly" | "AIOnly" | "Hybrid" | "Arbitrator";
  deliverableHash: Hex;
  deliverableURI: string;
  aiAttested: boolean;
  clientApproved: boolean;
  submittedAt?: bigint;
  reviewDeadline?: bigint;
  status: MilestoneStatus;
}

export interface PactView {
  pactId: Hex;
  escrowAddress: Address;
  client: Address;
  worker?: Address;
  fixedWorker?: Address;
  settlementToken: Address;
  totalBudget: bigint;
  clientBond: bigint;
  workerBond: bigint;
  fundedBudget: bigint;
  releasedBudget: bigint;
  agreementHash: Hex;
  status: PactStatus;
  milestones: MilestoneView[];
  acceptanceDeadline: bigint;
  reviewPeriod: bigint;
  arbitrator: Address;
}

export interface PactWalletAdapter {
  address: Address;
  chainId: number;
  sendContractTransaction(request: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }): Promise<Hex>;
}

export interface TransactionHooks {
  onHash?: (hash: Hex) => void;
  onIncluded?: (hash: Hex, blockNumber: bigint) => void;
  onFinalized?: (hash: Hex, blockNumber: bigint) => void;
}

export interface CreatePactInput {
  client: Address;
  worker: Address;
  token: Address;
  arbitrator: Address;
  totalBudget: bigint;
  clientBond: bigint;
  workerBond: bigint;
  acceptanceDeadline: bigint;
  reviewPeriod: bigint;
  milestones: Array<{ amount: bigint; dueAt: bigint; rulesHash: Hex; mode: 0 | 1 | 2 | 3 }>;
}

export interface ReputationFacts {
  completedPacts: bigint;
  settledMilestones: bigint;
  disputes: bigint;
  slashes: bigint;
  earned: bigint;
}
