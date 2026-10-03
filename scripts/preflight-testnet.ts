import { existsSync, readFileSync } from "node:fs";
import {
  erc20Abi,
  formatEther,
  formatUnits,
  parseAbi,
  type Address,
} from "viem";
import {
  createPactPublicClient,
  monadTestnet,
  monadTestnetUSDC,
} from "@pactflow/chain";
import { accountFromEnv, rpcUrl } from "./runtime";

const example = readFileSync(".env.example", "utf8");
if (/^(?:DEPLOYER|CLIENT|WORKER|ARBITRATOR)_PRIVATE_KEY=\S+/m.test(example)) {
  throw new Error(
    "Private key found in tracked .env.example. Remove it and rotate that test wallet before continuing.",
  );
}
if (
  !existsSync(".env.local") &&
  !["DEPLOYER_PRIVATE_KEY", "CLIENT_PRIVATE_KEY", "WORKER_PRIVATE_KEY"].every(
    (name) => process.env[name],
  )
) {
  throw new Error(
    "Missing .env.local and wallet environment variables. Configure fresh test-only wallets locally; do not send keys in chat.",
  );
}

const accounts = {
  Deployer: accountFromEnv("DEPLOYER_PRIVATE_KEY"),
  Client: accountFromEnv("CLIENT_PRIVATE_KEY"),
  Worker: accountFromEnv("WORKER_PRIVATE_KEY"),
};
const values = Object.values(accounts).map((account) =>
  account.address.toLowerCase(),
);
if (new Set(values).size !== values.length)
  throw new Error("Deployer, Client and Worker must be different wallets");
const token = process.env.SETTLEMENT_TOKEN_ADDRESS || monadTestnetUSDC.address;
if (token.toLowerCase() !== monadTestnetUSDC.address.toLowerCase())
  throw new Error("This run requires the official Monad Testnet USDC address");

const client = createPactPublicClient(rpcUrl());
const chainId = await client.getChainId();
if (chainId !== monadTestnet.id)
  throw new Error(`RPC chain ID is ${chainId}, expected ${monadTestnet.id}`);
const code = await client.getCode({ address: token as Address });
if (!code || code === "0x")
  throw new Error("Official Testnet USDC address has no code");
const nameAbi = parseAbi(["function name() view returns (string)"]);
const [name, symbol, decimals] = await Promise.all([
  client.readContract({
    address: token as Address,
    abi: nameAbi,
    functionName: "name",
  }),
  client.readContract({
    address: token as Address,
    abi: erc20Abi,
    functionName: "symbol",
  }),
  client.readContract({
    address: token as Address,
    abi: erc20Abi,
    functionName: "decimals",
  }),
]);
if (!name.trim() || symbol !== "USDC" || decimals !== 6) {
  throw new Error(
    `Unexpected settlement token metadata: name=${name}, symbol=${symbol}, decimals=${decimals}`,
  );
}

const [deployerMon, clientMon, workerMon, clientUsdc, workerUsdc] =
  await Promise.all([
    client.getBalance({ address: accounts.Deployer.address }),
    client.getBalance({ address: accounts.Client.address }),
    client.getBalance({ address: accounts.Worker.address }),
    client.readContract({
      address: token as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.Client.address],
    }),
    client.readContract({
      address: token as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accounts.Worker.address],
    }),
  ]);
console.log("PRE-FLIGHT");
for (const [role, account] of Object.entries(accounts))
  console.log(`${role}: ${account.address}`);
console.log(`RPC chain ID: ${chainId}`);
console.log(`Settlement token: ${token}`);
console.log(`Token metadata: ${name} / ${symbol} / ${decimals} decimals`);
console.log(`Deployer MON: ${formatEther(deployerMon)}`);
console.log(`Client MON: ${formatEther(clientMon)}`);
console.log(`Client USDC: ${formatUnits(clientUsdc, decimals)}`);
console.log(`Worker MON: ${formatEther(workerMon)}`);
console.log(`Worker USDC: ${formatUnits(workerUsdc, decimals)}`);

const gasMinimum = 10n ** 18n;
const blockers: string[] = [];
for (const [role, mon] of [
  ["Deployer", deployerMon],
  ["Client", clientMon],
  ["Worker", workerMon],
] as const) {
  if (mon < gasMinimum)
    blockers.push(`${role} needs at least 1 test MON for gas`);
}
if (clientUsdc < 6n * 10n ** 6n)
  blockers.push("Client needs at least 6 official Testnet USDC");
if (workerUsdc < 1n * 10n ** 6n)
  blockers.push("Worker needs at least 1 official Testnet USDC");
if (blockers.length)
  throw new Error(
    `Preflight blocked:\n${blockers.map((item) => `- ${item}`).join("\n")}`,
  );
console.log("PRE-FLIGHT PASS");
