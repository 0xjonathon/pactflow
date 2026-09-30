import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createPactPublicClient, monadTestnet } from "@pactflow/chain";
import { accountFromEnv, requiredAddress, rpcUrl } from "./runtime";

const rpc = rpcUrl();
if (existsSync("packages/chain/src/addresses/monad-testnet.json")) {
  throw new Error("A Monad Testnet deployment is already recorded. Preserve its evidence before another deployment.");
}
const publicClient = createPactPublicClient(rpc);
if (await publicClient.getChainId() !== monadTestnet.id) throw new Error("RPC is not Monad Testnet");
const deployer = accountFromEnv("DEPLOYER_PRIVATE_KEY");
const mon = await publicClient.getBalance({ address: deployer.address });
if (mon < 1_000_000_000_000_000_000n) throw new Error("Deployer needs test MON. Faucet: https://faucet.monad.xyz");
const token = requiredAddress("SETTLEMENT_TOKEN_ADDRESS");
if (!await publicClient.getCode({ address: token })) throw new Error("Settlement token has no code on Monad Testnet");

const env: NodeJS.ProcessEnv = { ...process.env, NEXT_PUBLIC_MONAD_CHAIN_ID: String(monadTestnet.id) };
if (!env.PROTOCOL_TREASURY_ADDRESS) delete env.PROTOCOL_TREASURY_ADDRESS;
const forge = process.env.FOUNDRY_BIN || join(homedir(), ".foundry/bin/forge");
const result = spawnSync(forge, ["script", "script/DeployProtocol.s.sol:DeployProtocol", "--rpc-url", rpc, "--broadcast"], {
  cwd: "packages/contracts", env, stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Foundry deployment failed with exit code ${result.status}`);
const record = spawnSync(process.execPath, ["--import", "tsx", "scripts/record-deployment.ts"], { env, stdio: "inherit" });
if (record.error) throw record.error;
if (record.status !== 0) throw new Error(`Deployment recording failed with exit code ${record.status}`);
