import { decodeEventLog, erc20Abi, zeroAddress, type Address, type Hex } from "viem";
import {
  createPactPublicClient, getProtocolAddresses, monadTestnet, pactEscrowAbi,
  pactFactoryAbi, reputationRegistryAbi, type ProtocolAddresses,
} from "@pactflow/chain";
import type { CreatePactInput, MilestoneView, PactView, PactWalletAdapter, ReputationFacts, TransactionHooks } from "./types";

export * from "./agreement";
export * from "./types";

export const attestationTypes = {
  Attestation: [
    { name: "pact", type: "address" }, { name: "milestoneId", type: "uint256" },
    { name: "deliverableHash", type: "bytes32" }, { name: "rulesHash", type: "bytes32" },
    { name: "approved", type: "bool" }, { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" }, { name: "verifier", type: "address" },
  ],
} as const;
export function attestationDomain(chainId: number, registry: Address) {
  return { name: "PactFlow Verifier", version: "1", chainId, verifyingContract: registry } as const;
}

type Reader = ReturnType<typeof createPactPublicClient>;

export class PactFlowSdk {
  readonly publicClient: Reader;
  readonly addresses: ProtocolAddresses;

  constructor(options: { rpcUrl?: string; addresses?: ProtocolAddresses } = {}) {
    this.publicClient = createPactPublicClient(options.rpcUrl);
    this.addresses = options.addresses ?? getProtocolAddresses(monadTestnet.id);
  }

  private assertWallet(wallet: PactWalletAdapter) {
    if (wallet.chainId !== monadTestnet.id) throw new Error("Wrong Network: switch to Monad Testnet");
  }

  private async send(wallet: PactWalletAdapter, request: Parameters<PactWalletAdapter["sendContractTransaction"]>[0], hooks?: TransactionHooks) {
    this.assertWallet(wallet);
    const hash = await wallet.sendContractTransaction(request);
    hooks?.onHash?.(hash);
    const included = await this.publicClient.waitForTransactionReceipt({ hash });
    if (included.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
    hooks?.onIncluded?.(hash, included.blockNumber);
    // Monad finalizes an included block after two additional blocks.
    const finalized = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 3 });
    if (finalized.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
    hooks?.onFinalized?.(hash, finalized.blockNumber);
    return { hash, receipt: finalized };
  }

  async createPact(wallet: PactWalletAdapter, input: CreatePactInput, hooks?: TransactionHooks) {
    if (wallet.address.toLowerCase() !== input.client.toLowerCase()) throw new Error("Only the client can create this Pact");
    const config = {
      client: input.client, worker: input.worker, token: input.token, arbitrator: input.arbitrator,
      totalBudget: input.totalBudget, clientBond: input.clientBond, workerBond: input.workerBond,
      acceptanceDeadline: input.acceptanceDeadline, reviewPeriod: input.reviewPeriod,
    };
    const { hash, receipt } = await this.send(wallet, {
      address: this.addresses.PactFactory, abi: pactFactoryAbi,
      functionName: "createPact", args: [config, input.milestones],
    }, hooks);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.addresses.PactFactory.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: pactFactoryAbi, data: log.data, topics: log.topics });
        if (event.eventName === "PactCreated") {
          const escrowAddress = event.args.pact;
          // Current protocol has no numeric pactId; the unique clone address is its ID.
          return { txHash: hash, pactId: escrowAddress as Hex, escrowAddress, blockNumber: receipt.blockNumber };
        }
      } catch { /* unrelated factory event */ }
    }
    throw new Error(`PactCreated event missing from ${hash}`);
  }

  fundPact(wallet: PactWalletAdapter, escrow: Address, hooks?: TransactionHooks) {
    return this.send(wallet, { address: escrow, abi: pactEscrowAbi, functionName: "fund" }, hooks).then(({ hash }) => hash);
  }
  acceptPact(wallet: PactWalletAdapter, escrow: Address, hooks?: TransactionHooks) {
    return this.send(wallet, { address: escrow, abi: pactEscrowAbi, functionName: "accept" }, hooks).then(({ hash }) => hash);
  }
  submitMilestone(wallet: PactWalletAdapter, escrow: Address, id: bigint, hash: Hex, uri: string, hooks?: TransactionHooks) {
    return this.send(wallet, { address: escrow, abi: pactEscrowAbi, functionName: "submit", args: [id, hash, uri] }, hooks).then(({ hash: txHash }) => txHash);
  }
  approveMilestone(wallet: PactWalletAdapter, escrow: Address, id: bigint, hooks?: TransactionHooks) {
    return this.send(wallet, { address: escrow, abi: pactEscrowAbi, functionName: "approve", args: [id] }, hooks).then(({ hash }) => hash);
  }
  raiseDispute(wallet: PactWalletAdapter, escrow: Address, id: bigint, hooks?: TransactionHooks) {
    return this.send(wallet, { address: escrow, abi: pactEscrowAbi, functionName: "openDispute", args: [id] }, hooks).then(({ hash }) => hash);
  }
  approveToken(wallet: PactWalletAdapter, token: Address, spender: Address, amount: bigint, hooks?: TransactionHooks) {
    return this.send(wallet, { address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }, hooks).then(({ hash }) => hash);
  }

  getAllowance(token: Address, owner: Address, spender: Address) {
    return this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  }
  getTokenBalance(token: Address, owner: Address) {
    return this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
  }
  async getTokenMetadata(token: Address) {
    const [symbol, decimals] = await Promise.all([
      this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    ]);
    return { symbol, decimals };
  }

  async getMilestones(escrow: Address): Promise<MilestoneView[]> {
    const [count, reviewPeriod] = await Promise.all([
      this.publicClient.readContract({ address: escrow, abi: pactEscrowAbi, functionName: "milestoneCount" }),
      this.publicClient.readContract({ address: escrow, abi: pactEscrowAbi, functionName: "reviewPeriod" }),
    ]);
    const raw = await Promise.all(Array.from({ length: Number(count) }, (_, i) =>
      this.publicClient.readContract({ address: escrow, abi: pactEscrowAbi, functionName: "milestone", args: [BigInt(i)] })
    ));
    const modes = ["ClientOnly", "AIOnly", "Hybrid", "Arbitrator"] as const;
    return raw.map((m, i) => ({
      id: BigInt(i), amount: m.amount, dueAt: m.dueAt, rulesHash: m.rulesHash,
      mode: modes[m.mode], deliverableHash: m.deliverableHash, deliverableURI: m.deliverableURI,
      aiAttested: m.aiAttested, clientApproved: m.clientApproved,
      submittedAt: m.submitted ? m.reviewDeadline - reviewPeriod : undefined,
      reviewDeadline: m.submitted ? m.reviewDeadline : undefined,
      status: m.settled ? "Paid" : m.disputed ? "Disputed" : m.submitted ? "Submitted" : "Pending",
    }));
  }

  async getPact(escrow: Address): Promise<PactView> {
    const authorized = await this.publicClient.readContract({ address: this.addresses.PactFactory, abi: pactFactoryAbi, functionName: "isPact", args: [escrow] });
    if (!authorized) throw new Error("Address is not a PactFlow Pact on Monad Testnet");
    const code = await this.publicClient.getCode({ address: escrow });
    if (!code || code === "0x") throw new Error("No Pact contract exists at this address");
    const read = <T extends "client" | "worker" | "fixedWorker" | "token" | "totalBudget" | "clientBondBalance" | "workerBondBalance" | "releasedBudget" | "funded" | "accepted" | "cancelled" | "completed" | "acceptanceDeadline" | "reviewPeriod" | "arbitrator">(functionName: T) =>
      this.publicClient.readContract({ address: escrow, abi: pactEscrowAbi, functionName });
    const [client, worker, fixedWorker, token, totalBudget, clientBond, workerBond, releasedBudget,
      funded, accepted, cancelled, completed, acceptanceDeadline, reviewPeriod, arbitrator, milestones] = await Promise.all([
      read("client"), read("worker"), read("fixedWorker"), read("token"), read("totalBudget"),
      read("clientBondBalance"), read("workerBondBalance"), read("releasedBudget"),
      read("funded"), read("accepted"), read("cancelled"), read("completed"),
      read("acceptanceDeadline"), read("reviewPeriod"), read("arbitrator"), this.getMilestones(escrow),
    ]);
    const status = cancelled ? "Cancelled" : completed ? "Completed" : milestones.some(m => m.status === "Disputed") ? "Disputed"
      : milestones.some(m => m.status === "Submitted") ? "Submitted" : accepted ? "Active" : funded ? "Funded" : "Created";
    return {
      pactId: escrow, escrowAddress: escrow, client, worker: worker === zeroAddress ? undefined : worker,
      fixedWorker: fixedWorker === zeroAddress ? undefined : fixedWorker,
      settlementToken: token, totalBudget, clientBond, workerBond, fundedBudget: funded ? totalBudget : 0n,
      releasedBudget, agreementHash: milestones[0]?.rulesHash ?? "0x", status, milestones,
      acceptanceDeadline, reviewPeriod, arbitrator,
    };
  }

  async getReputation(account: Address): Promise<ReputationFacts> {
    const facts = await this.publicClient.readContract({ address: this.addresses.ReputationRegistry, abi: reputationRegistryAbi, functionName: "facts", args: [account] });
    return { completedPacts: facts[0], settledMilestones: facts[1], disputes: facts[2], slashes: facts[3], earned: facts[4] };
  }
}
