import {
  createPactPublicClient,
  monadTestnet,
  monadTestnetUSDC,
} from "@pactflow/chain";
import { erc20Abi, formatEther, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
const client = createPactPublicClient(process.env.MONAD_TESTNET_RPC_URL);
const chainId = await client.getChainId();
if (chainId !== monadTestnet.id)
  throw new Error(`RPC is chain ${chainId}, expected ${monadTestnet.id}`);
for (const name of [
  "DEPLOYER_PRIVATE_KEY",
  "CLIENT_PRIVATE_KEY",
  "WORKER_PRIVATE_KEY",
  "ARBITRATOR_PRIVATE_KEY",
]) {
  const key = process.env[name];
  if (!key) {
    console.log(`${name}: missing`);
    continue;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.log(`${name}: invalid format`);
    continue;
  }
  const address = privateKeyToAccount(key as `0x${string}`).address;
  const [mon, usdc] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: monadTestnetUSDC.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  console.log(
    `${name}: ${address} | MON ${formatEther(mon)} | USDC ${formatUnits(usdc, 6)}`,
  );
  if (mon === 0n) console.log(`  Get test MON: https://faucet.monad.xyz`);
}
