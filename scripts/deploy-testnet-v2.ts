/** Explicit operator deployment only. CI never invokes this command. */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { createPactPublicClient, monadTestnet } from "@pactflow/chain";
import { accountFromEnv, requiredAddress, rpcUrl } from "./runtime";
if (existsSync("packages/chain/src/addresses/monad-testnet-v2.json"))
  throw new Error("V2 deployment already recorded");
const rpc = rpcUrl();
const client = createPactPublicClient(rpc);
if ((await client.getChainId()) !== monadTestnet.id)
  throw new Error("Monad testnet only");
const owner = accountFromEnv("DEPLOYER_PRIVATE_KEY");
requiredAddress("NEXT_PUBLIC_VERIFIER_ADDRESS");
if ((await client.getBalance({ address: owner.address })) < 10n ** 17n)
  throw new Error("Deployer needs test MON");
const token = requiredAddress("SETTLEMENT_TOKEN_ADDRESS");
const code = await client.getCode({ address: token });
if (!code || code === "0x") throw new Error("Settlement token has no code");
const forge = process.env.FOUNDRY_BIN || join(homedir(), ".foundry/bin/forge");
const result = spawnSync(
  forge,
  [
    "script",
    "script/DeployProtocolV2.s.sol:DeployProtocolV2",
    "--rpc-url",
    rpc,
    "--broadcast",
  ],
  { cwd: "packages/contracts", env: process.env, stdio: "inherit" },
);
if (result.status !== 0) throw new Error("V2 deployment failed");
const recorded = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/record-deployment-v2.ts"],
  { stdio: "inherit", env: process.env },
);
if (recorded.status !== 0)
  throw new Error("Deployment evidence validation failed");
