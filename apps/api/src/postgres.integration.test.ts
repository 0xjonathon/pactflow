import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connectDatabase } from "@pactflow/db/client";
import { VerificationRepository } from "@pactflow/verifier";
import { hashAgreement } from "@pactflow/sdk";
const url = process.env.TEST_DATABASE_URL;
test(
  "PostgreSQL migrations, atomic claims and reconnect persistence",
  { skip: !url, timeout: 30000 },
  async () => {
    const parsed = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
      parsed.pathname !== "/pactflow_ci_test"
    )
      throw new Error("Disposable local CI database required");
    let connection = connectDatabase(url!);
    const migrations = new URL(
      "../../../packages/db/drizzle/",
      import.meta.url,
    );
    try {
      await migrate(connection.db, {
        migrationsFolder: fileURLToPath(migrations),
      });
      // Running the same journal twice must not repeat ALTER or drop V1 data.
      await migrate(connection.db, {
        migrationsFolder: fileURLToPath(migrations),
      });
      const repo = new VerificationRepository(connection.db);
      const input = {
        escrow: "0x1111111111111111111111111111111111111111" as const,
        pactId: "0x1111111111111111111111111111111111111111" as const,
        milestoneIndex: 0,
        protocolVersion: 2 as const,
        submissionSequence: 1,
        deliverableHash: hashAgreement({ localCi: true }),
        deliverableUri: "pactflow:ci",
        rulesHash: hashAgreement({ rules: true }),
      };
      const jobs = await Promise.all(
        Array.from({ length: 20 }, () => repo.createOrGetJob(input)),
      );
      assert.equal(new Set(jobs.map((j) => j.id)).size, 1);
      const claimed = await Promise.all(jobs.map((j) => repo.claimJob(j.id)));
      assert.equal(claimed.filter(Boolean).length, 1);
      await repo.setStatus(jobs[0].id, "ERROR", {
        errorCode: "VERIFICATION_TIMEOUT",
      });
      await connection.close();
      connection = connectDatabase(url!);
      const recovered = new VerificationRepository(connection.db);
      assert.equal(
        (await recovered.getJob(jobs[0].id))?.errorCode,
        "VERIFICATION_TIMEOUT",
      );
      assert.equal((await recovered.retryJob(jobs[0].id)).length, 1);
      assert.equal((await recovered.getJob(jobs[0].id))?.status, "QUEUED");
    } finally {
      await connection.close();
    }
  },
);
