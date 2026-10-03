import {
  createWalletClient,
  erc20Abi,
  http,
  parseEther,
  parseUnits,
} from "viem";
import {
  createPactPublicClient,
  monadTestnet,
  monadTestnetUSDC,
} from "@pactflow/chain";
import { accountFromEnv, rpcUrl } from "./runtime";

// Moves only testnet assets between locally configured PactFlow smoke wallets.
const rpc = rpcUrl();
const publicClient = createPactPublicClient(rpc);
if ((await publicClient.getChainId()) !== monadTestnet.id)
  throw new Error("RPC is not Monad Testnet");
const worker = accountFromEnv("WORKER_PRIVATE_KEY");
const client = accountFromEnv("CLIENT_PRIVATE_KEY");
if (worker.address.toLowerCase() === client.address.toLowerCase())
  throw new Error("Wallets must be distinct");
const wallet = createWalletClient({
  account: worker,
  chain: monadTestnet,
  transport: http(rpc),
});
const token = monadTestnetUSDC.address;
const targetMon = parseEther("2");
const targetUsdc = parseUnits("20", 6);

const [clientMon, workerMon, clientUsdc, workerUsdc] = await Promise.all([
  publicClient.getBalance({ address: client.address }),
  publicClient.getBalance({ address: worker.address }),
  publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [client.address],
  }),
  publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [worker.address],
  }),
]);
const monToSend = clientMon < targetMon ? targetMon - clientMon : 0n;
const usdcToSend = clientUsdc < targetUsdc ? targetUsdc - clientUsdc : 0n;
if (
  workerMon - monToSend < parseEther("1") ||
  workerUsdc - usdcToSend < parseUnits("1", 6)
) {
  throw new Error(
    "Worker does not have enough test funds to top up Client while retaining smoke balance",
  );
}
if (monToSend) {
  const hash = await wallet.sendTransaction({
    account: worker,
    chain: monadTestnet,
    to: client.address,
    value: monToSend,
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 3,
  });
  if (receipt.status !== "success")
    throw new Error(`MON top-up reverted: ${hash}`);
  console.log(`Client MON top-up TX: ${hash}`);
}
if (usdcToSend) {
  const hash = await wallet.writeContract({
    account: worker,
    chain: monadTestnet,
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [client.address, usdcToSend],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 3,
  });
  if (receipt.status !== "success")
    throw new Error(`USDC top-up reverted: ${hash}`);
  console.log(`Client USDC top-up TX: ${hash}`);
}
const [finalMon, finalUsdc] = await Promise.all([
  publicClient.getBalance({ address: client.address }),
  publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [client.address],
  }),
]);
if (finalMon < targetMon || finalUsdc < targetUsdc)
  throw new Error("Client top-up balance check failed");
console.log(`Client ready: ${client.address} · MON >= 2 · USDC >= 20`);
