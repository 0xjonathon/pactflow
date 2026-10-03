import { projectV2Pact } from "./project";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { decodeEventLog, type Address, type Log, type Abi } from "viem";
import { PactFlowSdk, type PactView } from "@pactflow/sdk";
import {
  createPactPublicClient,
  pactFactoryAbi,
  pactEscrowAbi,
  pactEscrowV2Abi,
  pactFactoryV2Abi,
  verifierRegistryV2Abi,
  legacyProtocolAddresses,
  verifierRegistryAbi,
  getProtocolAddresses,
  monadTestnet,
} from "@pactflow/chain";
import deployment from "../../packages/chain/src/addresses/monad-testnet.json";
import type { PactFlowDatabase } from "@pactflow/db/client";
import * as s from "@pactflow/db";
import { aggregateReputation, eventId, type IndexedEvent } from "./aggregate";
const json = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
export class ProtocolIndexer {
  readonly client;
  readonly sdk;
  readonly addresses;
  constructor(
    readonly db: PactFlowDatabase,
    rpcUrl?: string,
  ) {
    this.client = createPactPublicClient(rpcUrl);
    this.sdk = new PactFlowSdk({ rpcUrl });
    this.addresses = getProtocolAddresses(monadTestnet.id);
  }
  async readPact(address: Address) {
    for (let attempt = 0; ; attempt++) {
      try {
        const pact = await this.sdk.getPact(address);
        if (process.env.PACTFLOW_LOCAL_CHAIN !== "true")
          await new Promise((r) => setTimeout(r, 1200));
        return pact;
      } catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  async ingest(events: IndexedEvent[]) {
    for (const event of events)
      await this.db
        .insert(s.reputationEvents)
        .values({ ...event, id: eventId(event) })
        .onConflictDoNothing();
  }
  async logs(address: Address | Address[], abi: Abi, from: bigint, to: bigint) {
    const logs: Log[] = [];
    const ranges: bigint[] = [];
    for (let start = from; start <= to; start += 100n) ranges.push(start);
    for (let i = 0; i < ranges.length; i += 8) {
      const batch = ranges.slice(i, i + 8);
      const results = await Promise.all(
        batch.map(async (start) => {
          for (let attempt = 0; ; attempt++) {
            try {
              return await this.client.getLogs({
                address,
                fromBlock: start,
                toBlock: start + 99n > to ? to : start + 99n,
              });
            } catch (e) {
              if (attempt >= 5) throw e;
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
        }),
      );
      for (const result of results) logs.push(...result);
      await new Promise((r) => setTimeout(r, 500));
      if (i % 120 === 0) console.log(`Indexed log range ${i}/${ranges.length}`);
    }
    const events: IndexedEvent[] = [];
    const blocks = new Map<
      bigint,
      Awaited<ReturnType<typeof this.client.getBlock>>
    >();
    for (const log of logs) {
      if (
        !log.transactionHash ||
        log.logIndex === null ||
        log.blockNumber === null ||
        !log.blockHash
      )
        continue;
      let decoded;
      try {
        decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
      } catch {
        continue;
      }
      let block = blocks.get(log.blockNumber);
      if (!block) {
        block = await this.client.getBlock({ blockNumber: log.blockNumber });
        blocks.set(log.blockNumber, block);
      }
      const args = json(decoded.args ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(args))
        if (typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v))
          args[k] = v.toLowerCase();
      events.push({
        id: "",
        chainId: monadTestnet.id,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: Number(log.blockNumber),
        blockHash: log.blockHash,
        address: log.address.toLowerCase(),
        name: decoded.eventName!,
        args,
        timestamp: new Date(Number(block.timestamp) * 1000),
      });
    }
    return events;
  }
  async syncEnvio(url: string) {
    const headers = {
      "Content-Type": "application/json",
      ...(process.env.HASURA_GRAPHQL_ADMIN_SECRET
        ? { "X-Hasura-Admin-Secret": process.env.HASURA_GRAPHQL_ADMIN_SECRET }
        : {}),
      ...(process.env.ENVIO_GRAPHQL_TOKEN
        ? { Authorization: `Bearer ${process.env.ENVIO_GRAPHQL_TOKEN}` }
        : {}),
    };
    const query = async <T>(
      query: string,
      variables: Record<string, unknown> = {},
    ) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("ENVIO_UNAVAILABLE");
      const body = (await response.json()) as { errors?: unknown[]; data?: T };
      if (body.errors || !body.data) throw new Error("ENVIO_QUERY_FAILED");
      return body.data;
    };
    const health = await query<{
      envio_chains: Array<{
        id: number;
        progress_block: number;
        source_block: number;
      }>;
    }>("query IndexHealth { envio_chains { id progress_block source_block } }");
    const indexed = health.envio_chains.find(
      (row) => Number(row.id) === monadTestnet.id,
    );
    if (!indexed || indexed.progress_block < 0)
      throw new Error("ENVIO_INDEXING_PENDING");
    const finalized = await this.client.getBlock({ blockTag: "finalized" });
    const upper = Math.min(indexed.progress_block, Number(finalized.number));
    const anchor = await this.client.getBlock({ blockNumber: BigInt(upper) });
    const events: IndexedEvent[] = [];
    let block = -1,
      log = -1,
      id = "";
    while (true) {
      const page = await query<{
        ProtocolEvent: Array<
          Omit<IndexedEvent, "args" | "timestamp"> & {
            args: string;
            timestamp: number;
          }
        >;
      }>(
        `query Events($upper:Int!,$block:Int!,$log:Int!,$id:String!){ProtocolEvent(limit:1000,order_by:[{blockNumber:asc},{logIndex:asc},{id:asc}],where:{chainId:{_eq:10143},blockNumber:{_lte:$upper},_or:[{blockNumber:{_gt:$block}},{blockNumber:{_eq:$block},logIndex:{_gt:$log}},{blockNumber:{_eq:$block},logIndex:{_eq:$log},id:{_gt:$id}}]}){id chainId txHash logIndex blockNumber blockHash address name args timestamp}}`,
        { upper, block, log, id },
      );
      const rows = page.ProtocolEvent;
      for (const row of rows)
        events.push({
          ...row,
          address: row.address.toLowerCase(),
          args: JSON.parse(row.args),
          timestamp: new Date(row.timestamp * 1000),
        });
      if (rows.length < 1000) break;
      const last = rows.at(-1)!;
      block = last.blockNumber;
      log = last.logIndex;
      id = last.id;
    }
    if (
      (await this.client.getBlock({ blockNumber: BigInt(upper) })).hash !==
      anchor.hash
    )
      throw new Error("INDEX_REORG_RETRY");
    const created = [
      ...new Set(
        events
          .filter((e) => e.name === "PactCreated")
          .map((e) => String(e.args.pact).toLowerCase()),
      ),
    ];
    const pacts: PactView[] = [];
    for (const address of created)
      pacts.push(
        projectV2Pact(address as Address, events) ??
          (await this.readPact(address as Address)),
      );
    await this.db.transaction(async (tx) => {
      const orphaned = (
        await tx
          .select()
          .from(s.pacts)
          .where(eq(s.pacts.chainId, monadTestnet.id))
      ).filter((row) => !created.includes(row.address));
      for (const row of orphaned) {
        await tx
          .delete(s.milestones)
          .where(eq(s.milestones.escrowAddress, row.address));
        await tx.delete(s.pacts).where(eq(s.pacts.address, row.address));
      }
      for (const pact of pacts) {
        const address = pact.escrowAddress.toLowerCase();
        const snapshot = json(pact);
        const values = {
          address,
          chainId: monadTestnet.id,
          client: pact.client.toLowerCase(),
          worker: pact.worker?.toLowerCase() ?? pact.fixedWorker?.toLowerCase(),
          completed: pact.status === "Completed",
          snapshot,
        };
        await tx
          .insert(s.pacts)
          .values(values)
          .onConflictDoUpdate({
            target: s.pacts.address,
            set: { ...values, updatedAt: new Date() },
          });
        for (const m of pact.milestones)
          await tx
            .insert(s.milestones)
            .values({
              id: `${address}:${m.id}`,
              escrowAddress: address,
              index: Number(m.id),
              snapshot: json(m),
            })
            .onConflictDoUpdate({
              target: s.milestones.id,
              set: { snapshot: json(m) },
            });
      }
      await tx
        .delete(s.reputationEvents)
        .where(eq(s.reputationEvents.chainId, monadTestnet.id));
      for (const event of events)
        await tx
          .insert(s.reputationEvents)
          .values({ ...event, id: eventId(event) })
          .onConflictDoNothing();
      const [old] = await tx
        .select()
        .from(s.indexerCursors)
        .where(eq(s.indexerCursors.chainId, monadTestnet.id));
      await tx
        .insert(s.indexerCursors)
        .values({ chainId: monadTestnet.id, blockNumber: upper })
        .onConflictDoUpdate({
          target: s.indexerCursors.chainId,
          set: {
            blockNumber: upper,
            updatedAt: old?.blockNumber === upper ? old.updatedAt : new Date(),
          },
        });
    });
    await this.rebuild(pacts);
    return {
      pacts: pacts.length,
      events: events.length,
      indexedBlock: upper,
      finalizedBlock: Number(finalized.number),
      lag: Number(finalized.number) - upper,
      source: "ENVIO",
    };
  }
  async sync(reindex = false) {
    if (process.env.ENVIO_GRAPHQL_URL)
      return this.syncEnvio(process.env.ENVIO_GRAPHQL_URL);
    if (process.env.NODE_ENV === "production")
      throw new Error("ENVIO_GRAPHQL_URL_REQUIRED");
    const head = await this.client.getBlock({
      blockTag:
        process.env.PACTFLOW_LOCAL_CHAIN === "true" ? "latest" : "finalized",
    });
    const to = head.number;
    const startBlock =
      process.env.PACTFLOW_LOCAL_CHAIN === "true"
        ? Number(process.env.INDEXER_START_BLOCK ?? 0)
        : deployment.deploymentBlock;
    if (to === null) throw new Error("Finalized head unavailable");
    const [cursor] = await this.db
      .select()
      .from(s.indexerCursors)
      .where(eq(s.indexerCursors.chainId, monadTestnet.id));
    const from = BigInt(
      reindex
        ? startBlock
        : Math.max(startBlock, (cursor?.blockNumber ?? startBlock) - 32),
    );
    // Re-read a finalized overlap: replace its canonical events atomically before rebuilding derived facts.
    const registryAndFactory = await this.logs(
      [
        ...new Set([
          this.addresses.PactFactory,
          this.addresses.VerifierRegistry,
          legacyProtocolAddresses.PactFactory,
          legacyProtocolAddresses.VerifierRegistry,
        ]),
      ],
      [
        ...pactFactoryAbi,
        ...pactFactoryV2Abi,
        ...verifierRegistryAbi,
        ...verifierRegistryV2Abi,
      ],
      from,
      to,
    );
    const factory = registryAndFactory.filter((e) =>
      [
        this.addresses.PactFactory.toLowerCase(),
        legacyProtocolAddresses.PactFactory.toLowerCase(),
      ].includes(e.address),
    );
    const known = await this.db.select().from(s.pacts);
    const created = [
      ...new Set([
        ...known.map((p) => p.address),
        ...factory
          .filter((e) => e.name === "PactCreated")
          .map((e) => String(e.args.pact)),
      ]),
    ];
    const raw = [...registryAndFactory];
    for (let i = 0; i < created.length; i += 30)
      raw.push(
        ...(await this.logs(
          created.slice(i, i + 30) as Address[],
          [...pactEscrowAbi, ...pactEscrowV2Abi],
          from,
          to,
        )),
      );
    await this.db.transaction(async (tx) => {
      await tx
        .delete(s.reputationEvents)
        .where(
          and(
            eq(s.reputationEvents.chainId, monadTestnet.id),
            sql`${s.reputationEvents.blockNumber} >= ${Number(from)}`,
          ),
        );
      for (const event of raw)
        await tx
          .insert(s.reputationEvents)
          .values({ ...event, id: eventId(event) })
          .onConflictDoNothing();
    });
    const pacts: PactView[] = [];
    for (const address of created) {
      const pact = await this.readPact(address as Address);
      pacts.push(pact);
      const creation = factory.find((e) => e.args.pact === address);
      await this.db
        .insert(s.pacts)
        .values({
          address: address.toLowerCase(),
          chainId: monadTestnet.id,
          client: pact.client.toLowerCase(),
          worker: pact.worker?.toLowerCase() ?? pact.fixedWorker?.toLowerCase(),
          completed: pact.status === "Completed",
          snapshot: json(pact),
          creationBlock: creation?.blockNumber,
        })
        .onConflictDoUpdate({
          target: s.pacts.address,
          set: {
            worker:
              pact.worker?.toLowerCase() ?? pact.fixedWorker?.toLowerCase(),
            completed: pact.status === "Completed",
            snapshot: json(pact),
            updatedAt: new Date(),
          },
        });
      for (const m of pact.milestones)
        await this.db
          .insert(s.milestones)
          .values({
            id: `${address}:${m.id}`,
            escrowAddress: address.toLowerCase(),
            index: Number(m.id),
            snapshot: json(m),
          })
          .onConflictDoUpdate({
            target: s.milestones.id,
            set: { snapshot: json(m) },
          });
    }
    await this.rebuild(pacts);
    await this.db
      .insert(s.indexerCursors)
      .values({ chainId: monadTestnet.id, blockNumber: Number(to) })
      .onConflictDoUpdate({
        target: s.indexerCursors.chainId,
        set: { blockNumber: Number(to), updatedAt: new Date() },
      });
    return {
      pacts: pacts.length,
      events: raw.length,
      finalizedBlock: Number(to),
    };
  }
  async rebuild(pacts: PactView[]) {
    const events = await this.db.select().from(s.reputationEvents);
    const result = aggregateReputation(pacts, events as IndexedEvent[]);
    await this.db.transaction(async (tx) => {
      await tx.delete(s.reputationSnapshots);
      await tx.delete(s.actorRelationships);
      for (const [address, metrics] of result.facts)
        await tx.insert(s.reputationSnapshots).values({ address, metrics });
      for (const relation of result.relationships)
        await tx.insert(s.actorRelationships).values(relation);
    });
    const wallets = await this.db.select().from(s.wallets);
    const byAddress = new Map(wallets.map((w) => [w.address, w.userId]));
    const jobRows = await this.db.select().from(s.jobs);
    for (const job of jobRows)
      if (
        job.status === "MATCHED" &&
        pacts.some(
          (p) =>
            p.escrowAddress.toLowerCase() === job.escrowAddress &&
            p.status === "Completed",
        )
      )
        await this.db
          .update(s.jobs)
          .set({ status: "CLOSED", updatedAt: new Date() })
          .where(eq(s.jobs.id, job.id));
    for (const event of events) {
      const pact = pacts.find(
        (p) =>
          p.escrowAddress.toLowerCase() === event.address ||
          p.escrowAddress.toLowerCase() ===
            String((event.args as Record<string, unknown>).pact),
      );
      if (!pact) continue;
      const type = (
        {
          Funded: "pact_funded",
          Accepted: "pact_accepted",
          Submitted: "work_submitted",
          AttestationConsumed: "verification_completed",
          VerificationRecorded: "verification_completed",
          RevisionRequested: "revision_requested",
          MilestoneSettled: "payment_released",
          DisputeOpened: "dispute_opened",
        } as Record<string, string>
      )[event.name];
      if (!type) continue;
      const analyticsType = (
        {
          pact_funded: "pact_funded",
          work_submitted: "milestone_submitted",
          verification_completed: "verification_completed",
          payment_released: "settlement_completed",
        } as Record<string, string>
      )[type];
      if (analyticsType) {
        const h = createHash("sha256")
          .update(event.id)
          .digest("hex")
          .slice(0, 32);
        const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        await this.db
          .insert(s.analytics)
          .values({
            id,
            event: analyticsType,
            properties: {
              escrow: pact.escrowAddress,
              txHash: event.txHash,
              logIndex: event.logIndex,
            },
            createdAt: event.timestamp,
          })
          .onConflictDoNothing();
      }
      const job = jobRows.find(
        (j) => j.escrowAddress === pact.escrowAddress.toLowerCase(),
      );
      for (const address of [pact.client, pact.worker].filter(
        Boolean,
      ) as Address[]) {
        const userId = byAddress.get(address.toLowerCase());
        if (!userId) continue;
        await this.db
          .insert(s.notifications)
          .values({
            id: `${event.id}:${userId}`,
            userId,
            type,
            href: `/pacts/${pact.escrowAddress}`,
            title: job?.title ?? "PactFlow collaboration",
            createdAt: event.timestamp,
          })
          .onConflictDoNothing();
        if (
          type === "verification_completed" &&
          pact.milestones.some(
            (m) => m.mode === "Hybrid" && m.aiAttested && !m.clientApproved,
          ) &&
          address.toLowerCase() === pact.client.toLowerCase()
        )
          await this.db
            .insert(s.notifications)
            .values({
              id: `${event.id}:review:${userId}`,
              userId,
              type: "client_approval_required",
              href: `/pacts/${pact.escrowAddress}`,
              title: job?.title ?? "PactFlow collaboration",
            })
            .onConflictDoNothing();
        if (
          type === "payment_released" &&
          pact.milestones.some((m) => m.status === "Paid") &&
          events.some(
            (e) =>
              e.address === pact.escrowAddress.toLowerCase() &&
              e.name === "DisputeOpened" &&
              (e.args as Record<string, unknown>).id ===
                (event.args as Record<string, unknown>).id &&
              e.blockNumber <= event.blockNumber,
          )
        )
          await this.db
            .insert(s.notifications)
            .values({
              id: `${event.id}:resolved:${userId}`,
              userId,
              type: "dispute_resolved",
              href: `/pacts/${pact.escrowAddress}`,
              title: job?.title ?? "PactFlow collaboration",
            })
            .onConflictDoNothing();
      }
    }
    const jobs = await this.db.select().from(s.verificationJobs);
    for (const job of jobs) {
      if (!["PASSED", "FAILED", "ERROR"].includes(job.status)) continue;
      const pact = pacts.find(
        (p) =>
          p.escrowAddress.toLowerCase() === job.escrowAddress.toLowerCase(),
      );
      if (!pact) continue;
      for (const address of [pact.client, pact.worker].filter(
        Boolean,
      ) as Address[]) {
        const userId = byAddress.get(address.toLowerCase());
        if (userId)
          await this.db
            .insert(s.notifications)
            .values({
              id: `verification-job:${job.id}:${userId}`,
              userId,
              type: "verification_completed",
              href: `/verifications/${job.id}`,
              title:
                jobRows.find(
                  (j) => j.escrowAddress === job.escrowAddress.toLowerCase(),
                )?.title ?? "PactFlow collaboration",
            })
            .onConflictDoNothing();
      }
    }
  }
}
