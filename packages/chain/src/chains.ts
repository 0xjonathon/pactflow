import { defineChain } from "viem";
import { monadTestnet as viemMonadTestnet } from "viem/chains";

// Source: https://docs.monad.xyz/developer-essentials/testnet (checked 2026-09-30).
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  // Address from the installed viem chain definition; verified to have code on Testnet.
  contracts: viemMonadTestnet.contracts,
  testnet: true,
});

export function monadTestnetWithRpc(rpcUrl?: string) {
  if (!rpcUrl) return monadTestnet;
  return defineChain({
    ...monadTestnet,
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}
