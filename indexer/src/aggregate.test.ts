import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateReputation, eventId, type IndexedEvent } from "./aggregate";
import type { PactView } from "@pactflow/sdk";
test("duplicate logs never inflate settlement or counterparty facts", () => {
  const pact = {
    escrowAddress: "0x1111111111111111111111111111111111111111",
    client: "0x2222222222222222222222222222222222222222",
    worker: "0x3333333333333333333333333333333333333333",
    milestones: [
      {
        id: 0n,
        amount: 1000000n,
        dueAt: 2000n,
        aiAttested: true,
        mode: "Hybrid",
      },
    ],
  } as unknown as PactView;
  const make = (
    name: string,
    args: Record<string, unknown>,
    logIndex: number,
  ) =>
    ({
      chainId: 10143,
      txHash: "0xabc",
      logIndex,
      id: "",
      blockNumber: 1,
      blockHash: "0xblock",
      address: pact.escrowAddress,
      name,
      args,
      timestamp: new Date(1000_000),
    }) as IndexedEvent;
  const events = [
    make("Submitted", { id: "0" }, 0),
    make("MilestoneSettled", { id: "0", workerAward: "1000000" }, 1),
    make("Completed", {}, 2),
  ];
  const result = aggregateReputation([pact], [...events, ...events]);
  const worker = result.facts.get(pact.worker!.toLowerCase())!;
  assert.equal(worker.completedPacts, 1);
  assert.equal(worker.settledVolume, "1000000");
  assert.equal(worker.aiVerified, 1);
  assert.equal(worker.humanVerified, 1);
  assert.equal(worker.onTimeRate, 100);
  assert.equal(worker.disputeRate, 0);
  assert.equal(result.relationships[0].completedPacts, 1);
  assert.equal(eventId(events[0]), "10143:0xabc:0");
  const partial = aggregateReputation(
    [pact],
    [
      make("DisputeOpened", { id: "0" }, 0),
      make("MilestoneSettled", { id: "0", workerAward: "500000" }, 1),
    ],
  );
  assert.equal(partial.facts.get(pact.worker!)!.disputesLost, 1);
  assert.equal(partial.facts.get(pact.worker!)!.disputeRate, 100);
  assert.equal(partial.facts.get(pact.client)!.disputesLost, 0);
});

import { connectDatabase } from "@pactflow/db/client";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import * as schema from "@pactflow/db";
import { ProtocolIndexer } from "./index";
test("persistent event ingestion is idempotent across replay", async () => {
  const { db, close } = connectDatabase(
    `pglite:${mkdtempSync(join(tmpdir(), "pactflow-index-test-"))}`,
  );
  try {
    for (const file of [
      "0000_yielding_natasha_romanoff.sql",
      "0001_famous_vapor.sql",
    ])
      for (const statement of readFileSync(
        new URL(`../../packages/db/drizzle/${file}`, import.meta.url),
        "utf8",
      ).split("--> statement-breakpoint"))
        if (statement.trim()) await db.execute(sql.raw(statement));
    const event = {
      id: "",
      chainId: 10143,
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 1,
      blockHash: "0xblock",
      address: "0x1111111111111111111111111111111111111111",
      name: "Completed",
      args: {},
      timestamp: new Date(),
    } as IndexedEvent;
    const persist = (events: IndexedEvent[]) =>
      ProtocolIndexer.prototype.ingest.call({ db } as ProtocolIndexer, events);
    await persist([event, event]);
    await persist([event]);
    const rows = await db.select().from(schema.reputationEvents);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, eventId(event));
  } finally {
    await close();
  }
});
