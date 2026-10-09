import { resolvePactStatus } from "./state";
export { resolvePactStatus } from "./state";
import {
  decodeEventLog,
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  createPactPublicClient,
  getProtocolAddresses,
  legacyProtocolAddresses,
  monadTestnet,
  pactEscrowAbi,
  pactEscrowV2Abi,
  pactFactoryV2Abi,
  pactFactoryAbi,
  reputationRegistryAbi,
  type ProtocolAddresses,
} from "@pactflow/chain";
import { hashAgreement } from "./agreement";
import type {
  CreatePactInput,
  MilestoneView,
  PactView,
  PactWalletAdapter,
  ReputationFacts,
  TransactionHooks,
} from "./types";

export * from "./agreement";
export * from "./types";

export const attestationTypes = {
  Attestation: [
    { name: "pact", type: "address" },
    { name: "milestoneId", type: "uint256" },
    { name: "deliverableHash", type: "bytes32" },
    { name: "rulesHash", type: "bytes32" },
    { name: "approved", type: "bool" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "verifier", type: "address" },
  ],
} as const;
export function attestationDomain(chainId: number, registry: Address) {
  return {
    name: "PactFlow Verifier",
    version: "1",
    chainId,
    verifyingContract: registry,
  } as const;
}

export const attestationV2Types = {
  Attestation: [
    ...attestationTypes.Attestation.slice(0, 4),
    { name: "submissionId", type: "uint256" },
    { name: "reportHash", type: "bytes32" },
    ...attestationTypes.Attestation.slice(4),
  ],
} as const;

type Reader = ReturnType<typeof createPactPublicClient>;

export class PactFlowSdk {
  readonly publicClient: Reader;
  readonly addresses: ProtocolAddresses;

  constructor(
    options: { rpcUrl?: string; addresses?: ProtocolAddresses } = {},
  ) {
    this.publicClient = createPactPublicClient(options.rpcUrl);
    this.addresses = options.addresses ?? getProtocolAddresses(monadTestnet.id);
  }

  private readonly versions = new Map<string, 1 | 2>();
  private readonly versionRequests = new Map<string, Promise<1 | 2>>();
  async getProtocolVersion(escrow: Address): Promise<1 | 2> {
    const key = escrow.toLowerCase();
    const cached = this.versions.get(key);
    if (cached) return cached;
    const pending = this.versionRequests.get(key);
    if (pending) return pending;
    const request = this.detectProtocolVersion(escrow);
    this.versionRequests.set(key, request);
    try {
      const version = await request;
      this.versions.set(key, version);
      return version;
    } finally {
      this.versionRequests.delete(key);
    }
  }
  private async detectProtocolVersion(escrow: Address): Promise<1 | 2> {
    for (const addresses of [this.addresses, legacyProtocolAddresses]) {
      const registered = await this.publicClient.readContract({
        address: addresses.PactFactory,
        abi: pactFactoryAbi,
        functionName: "isPact",
        args: [escrow],
      });
      if (registered) return addresses.version ?? 1;
    }
    throw new Error("UNRECOGNIZED_PACT");
  }
  async requestRevision(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    submissionId: bigint,
    reasonHash: Hex,
    hooks?: TransactionHooks,
  ) {
    if ((await this.getProtocolVersion(escrow)) !== 2)
      throw new Error("LEGACY_REVISION_UNSUPPORTED");
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowV2Abi,
        functionName: "requestRevision",
        args: [id, submissionId, reasonHash],
      },
      hooks,
    ).then(({ hash }) => hash);
  }
  private assertWallet(wallet: PactWalletAdapter) {
    if (wallet.chainId !== monadTestnet.id)
      throw new Error("Wrong Network: switch to Monad Testnet");
  }

  private async send(
    wallet: PactWalletAdapter,
    request: Parameters<PactWalletAdapter["sendContractTransaction"]>[0],
    hooks?: TransactionHooks,
  ) {
    this.assertWallet(wallet);
    const hash = await wallet.sendContractTransaction(request);
    hooks?.onHash?.(hash);
    const included = await this.publicClient.waitForTransactionReceipt({
      hash,
    });
    if (included.status !== "success")
      throw new Error(`Transaction reverted: ${hash}`);
    hooks?.onIncluded?.(hash, included.blockNumber);
    // Monad finalizes an included block after two additional blocks.
    const finalized = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 3,
    });
    if (finalized.status !== "success")
      throw new Error(`Transaction reverted: ${hash}`);
    hooks?.onFinalized?.(hash, finalized.blockNumber);
    return { hash, receipt: finalized };
  }

  async createPact(
    wallet: PactWalletAdapter,
    input: CreatePactInput,
    hooks?: TransactionHooks,
  ) {
    if (wallet.address.toLowerCase() !== input.client.toLowerCase())
      throw new Error("Only the client can create this Pact");
    const config = {
      client: input.client,
      worker: input.worker,
      token: input.token,
      arbitrator: input.arbitrator,
      totalBudget: input.totalBudget,
      clientBond: input.clientBond,
      workerBond: input.workerBond,
      acceptanceDeadline: input.acceptanceDeadline,
      reviewPeriod: input.reviewPeriod,
    };
    const version = input.protocolVersion ?? this.addresses.version ?? 1;
    if (version === 2 && !input.agreementHash)
      throw new Error("AGREEMENT_REQUIRED");
    if (version === 2 && this.addresses.version !== 2)
      throw new Error("V2_NOT_CONFIGURED");
    const request =
      version === 2
        ? {
            address: this.addresses.PactFactory,
            abi: pactFactoryV2Abi,
            functionName: "createPact",
            args: [
              { ...config, agreementHash: input.agreementHash },
              input.milestones.map((m) => ({
                ...m,
                maxRevisions: m.maxRevisions ?? 2,
                verifier: m.verifier ?? zeroAddress,
              })),
            ],
          }
        : {
            address: legacyProtocolAddresses.PactFactory,
            abi: pactFactoryAbi,
            functionName: "createPact",
            args: [config, input.milestones],
          };
    const { hash, receipt } = await this.send(wallet, request, hooks);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== request.address.toLowerCase()) continue;
      try {
        const event = decodeEventLog({
          abi: pactFactoryAbi,
          data: log.data,
          topics: log.topics,
        });
        if (event.eventName === "PactCreated") {
          const escrowAddress = event.args.pact;
          // Current protocol has no numeric pactId; the unique clone address is its ID.
          return {
            txHash: hash,
            pactId: escrowAddress as Hex,
            escrowAddress,
            blockNumber: receipt.blockNumber,
          };
        }
      } catch {
        /* unrelated factory event */
      }
    }
    throw new Error(`PactCreated event missing from ${hash}`);
  }

  fundPact(
    wallet: PactWalletAdapter,
    escrow: Address,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      { address: escrow, abi: pactEscrowAbi, functionName: "fund" },
      hooks,
    ).then(({ hash }) => hash);
  }
  acceptPact(
    wallet: PactWalletAdapter,
    escrow: Address,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      { address: escrow, abi: pactEscrowAbi, functionName: "accept" },
      hooks,
    ).then(({ hash }) => hash);
  }
  submitMilestone(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    hash: Hex,
    uri: string,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "submit",
        args: [id, hash, uri],
      },
      hooks,
    ).then(({ hash: txHash }) => txHash);
  }
  async approveMilestone(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    hooks?: TransactionHooks,
    reportHash?: Hex,
  ) {
    if ((await this.getProtocolVersion(escrow)) === 2) {
      const milestone = await this.publicClient.readContract({
        address: escrow,
        abi: pactEscrowV2Abi,
        functionName: "milestone",
        args: [id],
      });
      return this.send(
        wallet,
        {
          address: escrow,
          abi: pactEscrowV2Abi,
          functionName: "approve",
          args: [
            id,
            milestone.submissionId,
            reportHash ??
              hashAgreement({
                version: 2,
                escrow: escrow.toLowerCase(),
                milestone: id.toString(),
                submission: milestone.submissionId.toString(),
                evidenceHash: milestone.deliverableHash,
                rulesHash: milestone.rulesHash,
                approved: true,
                reviewer: wallet.address.toLowerCase(),
              }),
          ],
        },
        hooks,
      ).then(({ hash }) => hash);
    }
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "approve",
        args: [id],
      },
      hooks,
    ).then(({ hash }) => hash);
  }
  cancelPact(
    wallet: PactWalletAdapter,
    escrow: Address,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "cancelBeforeAcceptance",
      },
      hooks,
    ).then((r) => r.hash);
  }
  claimReviewTimeout(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "claimReviewTimeout",
        args: [id],
      },
      hooks,
    ).then((r) => r.hash);
  }
  async expireMilestone(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    hooks?: TransactionHooks,
  ) {
    if ((await this.getProtocolVersion(escrow)) !== 2)
      throw new Error("LEGACY_REVISION_UNSUPPORTED");
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowV2Abi,
        functionName: "expireMilestone",
        args: [id],
      },
      hooks,
    ).then((r) => r.hash);
  }
  resolveDispute(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    workerAward: bigint,
    clientSlash: bigint,
    workerSlash: bigint,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "resolveDispute",
        args: [id, workerAward, clientSlash, workerSlash],
      },
      hooks,
    ).then((r) => r.hash);
  }
  raiseDispute(
    wallet: PactWalletAdapter,
    escrow: Address,
    id: bigint,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      {
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "openDispute",
        args: [id],
      },
      hooks,
    ).then(({ hash }) => hash);
  }
  approveToken(
    wallet: PactWalletAdapter,
    token: Address,
    spender: Address,
    amount: bigint,
    hooks?: TransactionHooks,
  ) {
    return this.send(
      wallet,
      {
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      },
      hooks,
    ).then(({ hash }) => hash);
  }

  getAllowance(token: Address, owner: Address, spender: Address) {
    return this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });
  }
  getTokenBalance(token: Address, owner: Address) {
    return this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    });
  }
  async getTokenMetadata(token: Address) {
    const [symbol, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      this.publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);
    return { symbol, decimals };
  }

  async getMilestones(escrow: Address): Promise<MilestoneView[]> {
    const version = await this.getProtocolVersion(escrow);
    const [count, reviewPeriod] = await Promise.all([
      this.publicClient.readContract({
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "milestoneCount",
      }),
      this.publicClient.readContract({
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "reviewPeriod",
      }),
    ]);
    const raw = (await Promise.all(
      Array.from({ length: Number(count) }, (_, i) =>
        version === 2
          ? this.publicClient.readContract({
              address: escrow,
              abi: pactEscrowV2Abi,
              functionName: "milestone",
              args: [BigInt(i)],
            })
          : this.publicClient.readContract({
              address: escrow,
              abi: pactEscrowAbi,
              functionName: "milestone",
              args: [BigInt(i)],
            }),
      ),
    )) as Array<{
      amount: bigint;
      dueAt: bigint;
      rulesHash: Hex;
      mode: number;
      deliverableHash: Hex;
      deliverableURI: string;
      reviewDeadline: bigint;
      submitted: boolean;
      clientApproved: boolean;
      aiAttested: boolean;
      disputed: boolean;
      settled: boolean;
      submissionId?: bigint;
      maxRevisions?: number;
      revisionRequired?: boolean;
      verifier?: Address;
      reportHash?: Hex;
    }>;
    const modes = ["ClientOnly", "AIOnly", "Hybrid", "Arbitrator"] as const;
    return raw.map((m, i) => ({
      ...("submissionId" in m
        ? {
            submissionId: m.submissionId,
            maxRevisions: m.maxRevisions,
            revisionRequired: m.revisionRequired,
            verifier: m.verifier,
            reportHash: m.reportHash,
          }
        : {}),
      id: BigInt(i),
      amount: m.amount,
      dueAt: m.dueAt,
      rulesHash: m.rulesHash,
      mode: modes[m.mode],
      deliverableHash: m.deliverableHash,
      deliverableURI: m.deliverableURI,
      aiAttested: m.aiAttested,
      clientApproved: m.clientApproved,
      submittedAt: m.submitted ? m.reviewDeadline - reviewPeriod : undefined,
      reviewDeadline: m.submitted ? m.reviewDeadline : undefined,
      status: m.settled
        ? "Paid"
        : m.disputed
          ? "Disputed"
          : "revisionRequired" in m && m.revisionRequired
            ? "RevisionRequired"
            : m.submitted
              ? "Submitted"
              : "Pending",
    }));
  }

  async getPact(escrow: Address): Promise<PactView> {
    const protocolVersion = await this.getProtocolVersion(escrow);
    const code = await this.publicClient.getCode({ address: escrow });
    if (!code || code === "0x")
      throw new Error("No Pact contract exists at this address");
    const read = <
      T extends
        | "client"
        | "worker"
        | "fixedWorker"
        | "token"
        | "totalBudget"
        | "clientBondBalance"
        | "workerBondBalance"
        | "releasedBudget"
        | "funded"
        | "accepted"
        | "cancelled"
        | "completed"
        | "acceptanceDeadline"
        | "reviewPeriod"
        | "arbitrator",
    >(
      functionName: T,
    ) =>
      this.publicClient.readContract({
        address: escrow,
        abi: pactEscrowAbi,
        functionName,
      });
    const [
      client,
      worker,
      fixedWorker,
      token,
      totalBudget,
      clientBond,
      workerBond,
      releasedBudget,
      funded,
      accepted,
      cancelled,
      completed,
      acceptanceDeadline,
      reviewPeriod,
      arbitrator,
      milestones,
    ] = await Promise.all([
      read("client"),
      read("worker"),
      read("fixedWorker"),
      read("token"),
      read("totalBudget"),
      read("clientBondBalance"),
      read("workerBondBalance"),
      read("releasedBudget"),
      read("funded"),
      read("accepted"),
      read("cancelled"),
      read("completed"),
      read("acceptanceDeadline"),
      read("reviewPeriod"),
      read("arbitrator"),
      this.getMilestones(escrow),
    ]);
    const status = resolvePactStatus({
      cancelled,
      completed,
      accepted,
      funded,
      milestones,
    });
    return {
      protocolVersion,
      pactId: escrow,
      escrowAddress: escrow,
      client,
      worker: worker === zeroAddress ? undefined : worker,
      fixedWorker: fixedWorker === zeroAddress ? undefined : fixedWorker,
      settlementToken: token,
      totalBudget,
      clientBond,
      workerBond,
      fundedBudget: funded ? totalBudget : 0n,
      releasedBudget,
      settledBudget: await this.publicClient.readContract({
        address: escrow,
        abi: pactEscrowAbi,
        functionName: "settledBudget",
      }),
      agreementHash:
        protocolVersion === 2
          ? await this.publicClient.readContract({
              address: escrow,
              abi: pactEscrowV2Abi,
              functionName: "agreementHash",
            })
          : (milestones[0]?.rulesHash ?? "0x"),
      status,
      milestones,
      acceptanceDeadline,
      reviewPeriod,
      arbitrator,
    };
  }

  async getReputation(account: Address): Promise<ReputationFacts> {
    const facts = await this.publicClient.readContract({
      address: this.addresses.ReputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "facts",
      args: [account],
    });
    return {
      completedPacts: facts[0],
      settledMilestones: facts[1],
      disputes: facts[2],
      slashes: facts[3],
      earned: facts[4],
    };
  }
}
