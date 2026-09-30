import type { Address } from "viem";
import { monadTestnet } from "../chains";

export interface ProtocolAddresses {
  PactFactory: Address;
  ReputationRegistry: Address;
  VerifierRegistry: Address;
  SettlementToken: Address;
}

function checkedAddress(value: string | undefined, name: string): Address {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${name} is not configured with a deployed address`);
  }
  return value as Address;
}

export function getProtocolAddresses(chainId: number, env: Record<string, string | undefined> = process.env): ProtocolAddresses {
  if (chainId !== monadTestnet.id) throw new Error(`Unsupported PactFlow chain: ${chainId}`);
  return {
    PactFactory: checkedAddress(env.NEXT_PUBLIC_PACT_FACTORY_ADDRESS, "PactFactory"),
    ReputationRegistry: checkedAddress(env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS, "ReputationRegistry"),
    VerifierRegistry: checkedAddress(env.NEXT_PUBLIC_VERIFIER_REGISTRY_ADDRESS, "VerifierRegistry"),
    SettlementToken: checkedAddress(env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS, "SettlementToken"),
  };
}
