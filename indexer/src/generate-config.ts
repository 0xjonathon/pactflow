import { writeFileSync, mkdirSync } from "node:fs";

import { pactFactoryAbi, pactEscrowAbi, verifierRegistryAbi, reputationRegistryAbi, monadTestnet, getProtocolAddresses } from "@pactflow/chain";
import deployment from "../../packages/chain/src/addresses/monad-testnet.json";
const contracts = { PactFactory:pactFactoryAbi, PactEscrow:pactEscrowAbi, VerifierRegistry:verifierRegistryAbi, ReputationRegistry:reputationRegistryAbi };
const addresses=deployment;
let yaml='name: pactflow\ndescription: PactFlow objective cooperation history\naddress_format: lowercase\nhandlers: src/handlers.ts\ncontracts:\n';
for(const [name,abi]of Object.entries(contracts)){yaml+=`  - name: ${name}\n    events:\n`;for(const item of abi)if(item.type==='event'&&!['RoleGranted','RoleRevoked','RoleAdminChanged','Paused','Unpaused'].includes(item.name))yaml+=`      - event: "${`${item.name}(${item.inputs.map(i => `${i.type}${i.indexed ? " indexed" : ""} ${i.name}`).join(", ")})`}"\n`;}
yaml+=`chains:\n  - id: ${monadTestnet.id}\n    start_block: ${deployment.deploymentBlock}\n    rpc: \${MONAD_TESTNET_RPC_URL:-${monadTestnet.rpcUrls.default.http[0]}}\n    contracts:\n`;
for(const name of Object.keys(contracts))yaml+=`      - name: ${name}\n${name==='PactEscrow'?'':`        address: "${addresses[name as keyof typeof addresses]}"\n`}`;
writeFileSync('config.yaml',yaml);
console.log('Envio config generated from ABI and deployment record');
