import type { Address } from "viem";

// Official list: https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json
// Listing does not imply faucet availability.
export const monadTestnetUSDC = {
  address: "0x534b2f3A21130d7a60830c2Df862319e593943A3" as Address,
  symbol: "USDC",
  decimals: 6,
  source: "official-token-list",
} as const;
