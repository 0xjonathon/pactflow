import type { Address, Hex } from "viem";
import { monadTestnet } from "./chains";

const base = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || monadTestnet.blockExplorers.default.url;
export function getExplorerTxUrl(hash: Hex, explorerUrl = base) {
  return `${explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}
export function getExplorerAddressUrl(address: Address, explorerUrl = base) {
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
