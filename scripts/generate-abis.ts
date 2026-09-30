import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const contracts = ["PactFactory", "PactEscrow", "ReputationRegistry", "VerifierRegistry"] as const;
const root = process.cwd();
const out = join(root, "packages/chain/src/abis");
mkdirSync(out, { recursive: true });
for (const name of contracts) {
  const artifactPath = join(root, "packages/contracts/out", `${name}.sol`, `${name}.json`);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi: unknown };
  if (!Array.isArray(artifact.abi)) throw new Error(`Missing ABI in ${artifactPath}`);
  writeFileSync(join(out, `${name}.ts`), `// Generated from Foundry artifact. Run pnpm contracts:abi.\nexport const ${name[0].toLowerCase() + name.slice(1)}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);
}
writeFileSync(join(out, "index.ts"), contracts.map(name => `export { ${name[0].toLowerCase() + name.slice(1)}Abi } from "./${name}";`).join("\n") + "\n");
console.log(`Generated ${contracts.length} ABIs from Foundry artifacts`);
