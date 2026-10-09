type Environment = Record<string, string | undefined>;
export function uploadsAvailable(env: Environment) {
  return [
    "S3_ENDPOINT",
    "S3_PUBLIC_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "CLAMAV_HOST",
  ].every((key) => !!env[key]);
}
export function validateRuntime(env: Environment) {
  if (env.NODE_ENV !== "production") return;
  const lightweight = env.PACTFLOW_LIGHTWEIGHT === "true";
  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "WEB_ORIGIN",
    "NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS",
  ];
  if (lightweight) required.push("VERIFIER_PRIVATE_KEY", "INDEXER_START_BLOCK");
  else
    required.push(
      "ENVIO_GRAPHQL_URL",
      "S3_ENDPOINT",
      "S3_PUBLIC_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "CLAMAV_HOST",
    );
  for (const key of required)
    if (!env[key]) throw new Error(`${key} required in production`);
  if (
    env.PACTFLOW_LOCAL_CHAIN === "true" ||
    env.VERIFIER_ALLOW_LOCALHOST === "true"
  )
    throw new Error("Local testing modes forbidden in production");
  if (!env.DATABASE_URL?.startsWith("postgres"))
    throw new Error("Production requires PostgreSQL");
  if (new URL(env.WEB_ORIGIN!).protocol !== "https:")
    throw new Error("Production origin requires HTTPS");
  if (
    lightweight &&
    (!/^0x[0-9a-fA-F]{64}$/.test(env.VERIFIER_PRIVATE_KEY ?? "") ||
      env.PACTFLOW_INDEXER_MODE !== "rpc" ||
      !/^\d+$/.test(env.INDEXER_START_BLOCK ?? ""))
  )
    throw new Error(
      "Lightweight runtime requires a verifier and an explicit RPC indexing window",
    );
}
