import { getProtocolAddresses, monadTestnet } from "@pactflow/chain";
import { PactFlowSdk } from "@pactflow/sdk";

export function protocolConfig() {
  const configuredChainId = Number(
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || monadTestnet.id,
  );
  if (configuredChainId !== monadTestnet.id)
    throw new Error("Public chain ID does not match Monad Testnet");
  const addresses = getProtocolAddresses(configuredChainId, {
    NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS:
      process.env.NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS,
    NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS:
      process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS,
    NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS:
      process.env.NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS,
    NEXT_PUBLIC_PACT_FACTORY_ADDRESS:
      process.env.NEXT_PUBLIC_PACT_FACTORY_ADDRESS,
    NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS:
      process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS,
    NEXT_PUBLIC_VERIFIER_REGISTRY_ADDRESS:
      process.env.NEXT_PUBLIC_VERIFIER_REGISTRY_ADDRESS,
    NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS:
      process.env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS,
  });
  return {
    addresses,
    rpcUrl:
      process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
      monadTestnet.rpcUrls.default.http[0],
  };
}

export function protocolSdk() {
  const { addresses, rpcUrl } = protocolConfig();
  return new PactFlowSdk({ addresses, rpcUrl });
}
