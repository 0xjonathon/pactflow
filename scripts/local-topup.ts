/** Mint test tokens on the isolated local chain. Refuses public RPCs. */
import { readFileSync } from "node:fs";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "@pactflow/chain";
const env = JSON.parse(readFileSync(".local/e2e/env.json", "utf8"));
const keys = JSON.parse(readFileSync(".local/e2e/accounts.json", "utf8"));
if (env.MONAD_TESTNET_RPC_URL !== "http://127.0.0.1:8547")
  throw new Error("Local RPC only");
const client = createPublicClient({
  chain: monadTestnet,
  transport: http(env.MONAD_TESTNET_RPC_URL),
});
await client.request({ method: "web3_clientVersion" }).then((v) => {
  if (!v.toLowerCase().includes("anvil")) throw new Error("Anvil only");
});
const wallet = createWalletClient({
  account: privateKeyToAccount(keys.owner),
  chain: monadTestnet,
  transport: http(env.MONAD_TESTNET_RPC_URL),
});
const hash = await wallet.writeContract({
  address: env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS,
  abi: [
    {
      type: "function",
      name: "mint",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    },
  ],
  functionName: "mint",
  args: [privateKeyToAccount(keys.client).address, 10_000_000_000n],
});
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("Local mint failed");
console.log("Local test tokens minted", hash);
