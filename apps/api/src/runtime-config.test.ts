import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRuntime, uploadsAvailable } from "./runtime-config";
const env = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://test/db",
  REDIS_URL: "redis://redis:6379",
  WEB_ORIGIN: "https://pactflow-lovat.vercel.app",
  NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS: "0x1",
  PACTFLOW_LIGHTWEIGHT: "true",
  PACTFLOW_INDEXER_MODE: "rpc",
  INDEXER_START_BLOCK: "123",
  VERIFIER_PRIVATE_KEY: `0x${"1".repeat(64)}`,
};
test("lightweight mode keeps production authentication, PostgreSQL, HTTPS and verifier guards", () => {
  assert.doesNotThrow(() => validateRuntime(env));
  for (const patch of [
    { PACTFLOW_LOCAL_CHAIN: "true" },
    { VERIFIER_ALLOW_LOCALHOST: "true" },
    { DATABASE_URL: "pglite://test" },
    { WEB_ORIGIN: "http://test" },
    { REDIS_URL: "" },
    { VERIFIER_PRIVATE_KEY: "" },
    { INDEXER_START_BLOCK: "" },
    { PACTFLOW_INDEXER_MODE: "" },
  ])
    assert.throws(() => validateRuntime({ ...env, ...patch }));
});
test("full production still requires Envio and scanned private object storage", () => {
  assert.throws(
    () => validateRuntime({ ...env, PACTFLOW_LIGHTWEIGHT: "false" }),
    /ENVIO_GRAPHQL_URL/,
  );
  assert.equal(uploadsAvailable(env), false);
  const storage = {
    S3_ENDPOINT: "http://minio",
    S3_PUBLIC_ENDPOINT: "https://objects.example",
    S3_BUCKET: "private",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
    CLAMAV_HOST: "clamav",
  };
  assert.equal(uploadsAvailable({ ...env, ...storage }), true);
  assert.doesNotThrow(() =>
    validateRuntime({
      ...env,
      ...storage,
      PACTFLOW_LIGHTWEIGHT: "false",
      ENVIO_GRAPHQL_URL: "http://envio",
    }),
  );
});
