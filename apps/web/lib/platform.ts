import type { Address } from "viem";
// The platform arbitrates disputes; settlement remains in the escrow contract.
export const platformArbitrator = (process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS ||
  "0x786e6F51E928286D35084129f359c6fEa391357E") as Address;
