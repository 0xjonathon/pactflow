import { writeFileSync } from "node:fs";

import {
  pactFactoryAbi,
  pactFactoryV2Abi,
  pactEscrowV2Abi,
  verifierRegistryV2Abi,
  reputationRegistryV2Abi,
  pactEscrowAbi,
  verifierRegistryAbi,
  reputationRegistryAbi,
  monadTestnet,
  getProtocolAddresses,
} from "@pactflow/chain";
import deployment from "../../packages/chain/src/addresses/monad-testnet.json";
const contracts = {
  PactFactory: pactFactoryAbi,
  PactEscrow: pactEscrowAbi,
  VerifierRegistry: verifierRegistryAbi,
  ReputationRegistry: reputationRegistryAbi,
  PactFactoryV2: pactFactoryV2Abi,
  PactEscrowV2: pactEscrowV2Abi,
  VerifierRegistryV2: verifierRegistryV2Abi,
  ReputationRegistryV2: reputationRegistryV2Abi,
};
const addresses: Record<string, string> = {
  PactFactory: deployment.PactFactory,
  ReputationRegistry: deployment.ReputationRegistry,
  VerifierRegistry: deployment.VerifierRegistry,
};
if (process.env.NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS) {
  const v2 = getProtocolAddresses(monadTestnet.id);
  addresses.PactFactoryV2 = v2.PactFactory;
  addresses.VerifierRegistryV2 = v2.VerifierRegistry;
  addresses.ReputationRegistryV2 = v2.ReputationRegistry;
}
let yaml =
  "name: pactflow\ndescription: PactFlow objective cooperation history\naddress_format: lowercase\nhandlers: src/handlers.ts\ncontracts:\n";
for (const [name, abi] of Object.entries(contracts)) {
  yaml += `  - name: ${name}\n    events:\n`;
  for (const item of abi)
    if (
      item.type === "event" &&
      ![
        "RoleGranted",
        "RoleRevoked",
        "RoleAdminChanged",
        "Paused",
        "Unpaused",
      ].includes(item.name)
    )
      yaml += `      - event: "${`${item.name}(${item.inputs.map((i) => `${i.type}${i.indexed ? " indexed" : ""} ${i.name}`).join(", ")})`}"\n`;
}
yaml += `chains:\n  - id: ${monadTestnet.id}\n    start_block: ${deployment.deploymentBlock}\n    rpc: \${MONAD_TESTNET_RPC_URL:-${monadTestnet.rpcUrls.default.http[0]}}\n    contracts:\n`;
for (const name of Object.keys(contracts))
  yaml += `      - name: ${name}\n${!addresses[name] ? "" : `        address: "${addresses[name]}"\n`}`;
writeFileSync("config.yaml", yaml);
console.log("Envio config generated from ABI and deployment record");
