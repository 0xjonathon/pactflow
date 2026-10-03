import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const env = {
  ...process.env,
  ...JSON.parse(readFileSync(".local/e2e/env.json", "utf8")),
};
const migrate = spawn(process.execPath, ["--import", "tsx", "src/migrate.ts"], {
  cwd: resolve("packages/db"),
  env,
  stdio: "inherit",
});
const code = await new Promise<number | null>((r) => migrate.on("exit", r));
if (code !== 0) process.exit(code ?? 1);
const productionWeb = process.argv.includes("--production-web");
if (productionWeb) {
  const build = spawn(
    process.execPath,
    [resolve("apps/web/node_modules/next/dist/bin/next"), "build"],
    {
      cwd: resolve("apps/web"),
      env: { ...env, NODE_ENV: productionWeb ? "production" : "development" },
      stdio: "inherit",
    },
  );
  const result = await new Promise<number | null>((r) => build.on("exit", r));
  if (result !== 0) process.exit(result ?? 1);
}
const processes = [
  spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: resolve("apps/api"),
    env,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      resolve("apps/web/node_modules/next/dist/bin/next"),
      productionWeb ? "start" : "dev",
      "--port",
      "3011",
    ],
    {
      cwd: resolve("apps/web"),
      env: { ...env, NODE_ENV: productionWeb ? "production" : "development" },
      stdio: "inherit",
    },
  ),
];
const shutdown = () => {
  for (const child of processes) child.kill("SIGTERM");
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
for (const child of processes)
  child.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 1);
  });
