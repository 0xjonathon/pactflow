import { config } from "dotenv";
import { resolve } from "node:path";
import { connectDatabase } from "@pactflow/db/client";
import { verifiers } from "@pactflow/db";
import { createPactPublicClient, getProtocolAddresses, monadTestnet, verifierRegistryAbi } from "@pactflow/chain";
import { verifierAccount } from "./pipeline/attest";

config({ path: resolve(process.cwd(), "../../.env.local"), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const account = verifierAccount();
const client = createPactPublicClient(process.env.MONAD_TESTNET_RPC_URL);
if (await client.getChainId() !== monadTestnet.id) throw new Error("Wrong chain");
const current = await client.readContract({ address: getProtocolAddresses(monadTestnet.id).VerifierRegistry, abi: verifierRegistryAbi, functionName: "verifiers", args: [account.address] });
if (!current[0]) throw new Error("Verifier is not registered on Monad Testnet");
const prefix = "data:application/json;charset=utf-8,";
if (!current[2].startsWith(prefix)) throw new Error("Verifier metadata URI is unsupported");
const metadata = JSON.parse(decodeURIComponent(current[2].slice(prefix.length))) as Record<string, unknown>;
const { db, close } = connectDatabase(process.env.DATABASE_URL);
try {
  await db.insert(verifiers).values({ address: account.address.toLowerCase(), metadata, metadataHash: current[3], active: current[0] }).onConflictDoUpdate({ target: verifiers.address, set: { metadata, metadataHash: current[3], active: current[0] } });
  console.log(`Verifier metadata synced: ${account.address}, hash ${current[3]}`);
} finally { await close(); }
