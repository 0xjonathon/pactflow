import { createPublicClient, http } from "viem";
import { monadTestnetWithRpc } from "./chains";

export { monadTestnet, monadTestnetWithRpc } from "./chains";
export { monadTestnetUSDC } from "./tokens";
export { getExplorerAddressUrl, getExplorerTxUrl } from "./explorer";
export {
  getProtocolAddresses,
  legacyProtocolAddresses,
  type ProtocolAddresses,
} from "./addresses";
export * from "./abis";

export function createPactPublicClient(rpcUrl?: string) {
  const chain = monadTestnetWithRpc(rpcUrl);
  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? chain.rpcUrls.default.http[0]),
    batch: {
      multicall:
        !rpcUrl ||
        !["127.0.0.1", "localhost", "[::1]"].includes(new URL(rpcUrl).hostname),
    },
  });
}
