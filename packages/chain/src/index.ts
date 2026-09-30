import { createPublicClient, http } from "viem";
import { monadTestnetWithRpc } from "./chains";

export { monadTestnet, monadTestnetWithRpc } from "./chains";
export { monadTestnetUSDC } from "./tokens";
export { getExplorerAddressUrl, getExplorerTxUrl } from "./explorer";
export { getProtocolAddresses, type ProtocolAddresses } from "./addresses";
export * from "./abis";

export function createPactPublicClient(rpcUrl?: string) {
  const chain = monadTestnetWithRpc(rpcUrl);
  return createPublicClient({ chain, transport: http(rpcUrl ?? chain.rpcUrls.default.http[0]) });
}
