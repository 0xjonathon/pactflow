import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import Fastify from "fastify";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hashAgreement, type PactFlowSdk, type PactView } from "@pactflow/sdk";
import type { PactFlowDatabase } from "@pactflow/db/client";
import * as schema from "@pactflow/db";
import { registerProductRoutes, ProductError } from "./product";
import { registerTrustRoutes } from "./trust";
import { VerificationRepository } from "@pactflow/verifier";
test("V1 migration, private evidence, immutable agreement, logout and verification claim concurrency", async () => {
  const storage = new PGlite();
  for (const file of readdirSync(
    new URL("../../../packages/db/drizzle", import.meta.url),
  )
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (file.startsWith("0002"))
      await storage.exec(
        "INSERT INTO verification_jobs (escrow_address,pact_id,milestone_index,deliverable_hash,deliverable_uri,rules_hash) VALUES ('v1-history','v1-history',0,'v1-hash','private-v1-ref','v1-rules')",
      );
    await storage.exec(
      readFileSync(
        new URL("../../../packages/db/drizzle/" + file, import.meta.url),
        "utf8",
      ),
    );
  }
  const db = drizzle(storage, { schema }) as unknown as PactFlowDatabase;
  const [legacy] = await db.select().from(schema.verificationJobs);
  assert.equal(legacy.protocolVersion, 1);
  assert.equal(legacy.submissionSequence, 0);
  assert.equal(legacy.deliverableUri, "private-v1-ref");
  const client = privateKeyToAccount(generatePrivateKey()),
    worker = privateKeyToAccount(generatePrivateKey()),
    other = privateKeyToAccount(generatePrivateKey());
  const escrow = "0x1111111111111111111111111111111111111111";
  const spec = {
    version: 2,
    title: "Private outcome",
    outcome: "Never publicly expose these acceptance criteria",
    visibility: "PARTICIPANTS",
    client: client.address,
    worker: worker.address,
    arbitrator: other.address,
    token: escrow,
    totalBudget: "1000000",
    clientBond: "0",
    workerBond: "0",
    acceptanceDeadline: "2000000000",
    reviewPeriod: "86400",
    maxRevisions: 2,
    verifier: client.address,
    policy: null,
    milestones: [
      {
        title: "Private task",
        acceptanceCriteria: ["complete"],
        requiredEvidence: ["JSON"],
        amount: "1000000",
        dueAt: String(Math.floor(Date.now() / 1000) + 86400),
      },
    ],
  };
  const rulesHash = hashAgreement({ rules: true });
  const pact = {
    escrowAddress: escrow,
    pactId: escrow,
    protocolVersion: 2,
    status: "Active",
    client: client.address,
    worker: worker.address,
    fixedWorker: worker.address,
    agreementHash: hashAgreement(spec),
    arbitrator: other.address,
    settlementToken: escrow,
    totalBudget: 1000000n,
    clientBond: 0n,
    workerBond: 0n,
    acceptanceDeadline: 2000000000n,
    reviewPeriod: 86400n,
    milestones: [
      {
        id: 0n,
        amount: 1000000n,
        mode: "ClientOnly",
        status: "Pending",
        dueAt: BigInt(spec.milestones[0].dueAt),
        submissionId: 0n,
        maxRevisions: 2,
        rulesHash,
      },
    ],
  } as unknown as PactView;
  const sdk = { getPact: async () => pact } as unknown as PactFlowSdk;
  const app = Fastify();
  const product = await registerProductRoutes(app, db, sdk);
  await registerTrustRoutes(app, db, sdk, product.actor);
  app.setErrorHandler((e, _r, reply) =>
    reply
      .code(e instanceof ProductError ? e.statusCode : 400)
      .send({ code: e instanceof ProductError ? e.code : "INVALID_INPUT" }),
  );
  async function login(account: typeof client) {
    const ch = (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/challenge",
        payload: { address: account.address },
      })
    ).json();
    const signature = await account.signMessage({ message: ch.message });
    const auth = (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
        payload: { id: ch.id, signature },
      })
    ).json();
    return { authorization: `Bearer ${auth.token}` };
  }
  try {
    const c = await login(client),
      w = await login(worker),
      o = await login(other);
    const path = `/api/v1/pacts/${escrow}`;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/spec",
          headers: w,
          payload: spec,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/spec",
          headers: c,
          payload: spec,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/spec",
          headers: c,
          payload: { ...spec, outcome: "Tampered frozen terms" },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await app.inject({ url: path + "/spec", headers: o })).statusCode,
      403,
    );
    assert.equal((await app.inject({ url: path + "/spec" })).statusCode, 401);
    const payload = {
      milestoneIndex: 0,
      evidence: [
        {
          type: "JSON",
          source: '{"private":true}',
          label: "Secret criteria",
          visibility: "VERIFIER",
          metadata: {},
        },
      ],
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/submissions",
          headers: c,
          payload,
        })
      ).statusCode,
      409,
    );
    const preparations = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({
          method: "POST",
          url: path + "/submissions",
          headers: w,
          payload,
        }),
      ),
    );
    assert.ok(preparations.every((p) => p.statusCode === 200));
    assert.equal(new Set(preparations.map((p) => p.json().id)).size, 1);
    const first = preparations[0].json();
    const retry = (
      await app.inject({
        method: "POST",
        url: path + "/submissions",
        headers: w,
        payload,
      })
    ).json();
    assert.equal(first.id, retry.id);
    assert.equal(first.manifestHash, retry.manifestHash);
    assert.equal(
      (await app.inject({ url: path + "/submissions", headers: c })).json()[0]
        .manifest.evidence.length,
      0,
    );
    assert.equal(
      (await app.inject({ url: path + "/submissions", headers: w })).json()[0]
        .manifest.evidence.length,
      1,
    );
    assert.equal(
      (await app.inject({ url: path + "/submissions", headers: o })).statusCode,
      403,
    );
    const repo = new VerificationRepository(db);
    const jobs = await Promise.all(
      Array.from({ length: 8 }, () =>
        repo.createOrGetJob({
          escrow,
          pactId: escrow,
          milestoneIndex: 0,
          submissionSequence: 1,
          protocolVersion: 2,
          deliverableHash: first.manifestHash,
          deliverableUri: first.reference,
          rulesHash,
        }),
      ),
    );
    assert.equal(new Set(jobs.map((j) => j.id)).size, 1);
    const claims = await Promise.all(jobs.map((j) => repo.claimJob(j.id)));
    assert.equal(claims.filter(Boolean).length, 1);
    await repo.setStatus(jobs[0].id, "ERROR", {
      errorCode: "SEMANTIC_PROVIDER_ERROR",
    });
    await repo.retryJob(jobs[0].id);
    assert.equal((await repo.getJob(jobs[0].id))?.status, "QUEUED");
    assert.equal((await db.select().from(schema.submissions)).length, 1);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/logout",
          headers: w,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: path + "/submissions", headers: w })).statusCode,
      401,
    );
  } finally {
    await app.close();
    await storage.close();
  }
});
