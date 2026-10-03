import type { Address } from "viem";
import legacy from "./monad-testnet.json";
import { monadTestnet } from "../chains";

export interface ProtocolAddresses {
  version?: 1 | 2;
  PactFactory: Address;
  ReputationRegistry: Address;
  VerifierRegistry: Address;
  SettlementToken: Address;
}

function checkedAddress(value: string | undefined, name: string): Address {
  if (
    !value ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  ) {
    throw new Error(`${name} is not configured with a deployed address`);
  }
  return value as Address;
}

export function getProtocolAddresses(
  chainId: number,
  env: Record<string, string | undefined> = process.env,
): ProtocolAddresses {
  if (chainId !== monadTestnet.id)
    throw new Error(`Unsupported PactFlow chain: ${chainId}`);
  const v2 = !!env.NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS;
  return {
    version: v2 ? 2 : 1,
    PactFactory: checkedAddress(
      env.NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS ??
        env.NEXT_PUBLIC_PACT_FACTORY_ADDRESS ??
        legacy.PactFactory,
      "PactFactory",
    ),
    ReputationRegistry: checkedAddress(
      (v2
        ? env.NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS
        : env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS) ??
        (!v2 ? legacy.ReputationRegistry : undefined),
      "ReputationRegistry",
    ),
    VerifierRegistry: checkedAddress(
      (v2
        ? env.NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS
        : env.NEXT_PUBLIC_VERIFIER_REGISTRY_ADDRESS) ??
        (!v2 ? legacy.VerifierRegistry : undefined),
      "VerifierRegistry",
    ),
    SettlementToken: checkedAddress(
      env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS ?? legacy.SettlementToken,
      "SettlementToken",
    ),
  };
}

export const legacyProtocolAddresses: ProtocolAddresses = {
  ...legacy,
  version: 1,
} as ProtocolAddresses;
