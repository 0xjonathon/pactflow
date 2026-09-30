import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { monadTestnet } from "@pactflow/chain";

config({ path: [".env.local", ".env"], quiet: true });

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Set it in an ignored .env.local file.`);
  return value;
}

export function requiredKey(name: string): Hex {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte hex private key`);
  return value as Hex;
}

export function requiredAddress(name: string): Address {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${name} must be an address`);
  return value as Address;
}

export function rpcUrl() { return process.env.MONAD_TESTNET_RPC_URL || monadTestnet.rpcUrls.default.http[0]; }

export interface DeploymentFile {
  chainId: number;
  deployedAt: string;
  deploymentBlock: number;
  PactFactory: Address;
  PactEscrowImplementation: Address;
  ReputationRegistry: Address;
  VerifierRegistry: Address;
  SettlementToken: Address;
  deploymentTxHashes: Record<string, Hex>;
  deploymentBlocks: Record<string, number>;
}

export function deployment(): DeploymentFile {
  const path = join(process.cwd(), "packages/chain/src/addresses/monad-testnet.json");
  if (!existsSync(path)) throw new Error("Monad Testnet deployment is not recorded. Run pnpm deploy:testnet with a locally configured deployer wallet first.");
  const value = JSON.parse(readFileSync(path, "utf8")) as DeploymentFile;
  if (value.chainId !== monadTestnet.id) throw new Error("Deployment file is for another chain");
  return value;
}

export function accountFromEnv(name: string) { return privateKeyToAccount(requiredKey(name)); }
