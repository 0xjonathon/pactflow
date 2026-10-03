import https from "node:https";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyMessage, isAddress, type Address, type Hex } from "viem";
import { hashAgreement } from "@pactflow/sdk";
import {
  createPactPublicClient,
  getProtocolAddresses,
  verifierRegistryV2Abi,
} from "@pactflow/chain";
import {
  validateArtifactUrl,
  type FetchedArtifact,
} from "../security/fetch-artifact";
const adapter = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["ORACLE", "CUSTOM"]),
  address: z.string().refine(isAddress),
  version: z.string().min(1).max(64),
  endpoint: z.url(),
  tokenEnv: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
});
export function configuredAdapters() {
  return z
    .array(adapter)
    .parse(JSON.parse(process.env.VERIFIER_ADAPTERS_JSON ?? "[]"));
}
export function adapterCapabilities() {
  return configuredAdapters().map(
    ({ id, kind, address, version, tokenEnv }) => ({
      id,
      kind,
      address,
      version,
      available: !!process.env[tokenEnv],
    }),
  );
}
function error(code: string): never {
  throw Object.assign(new Error(code), { code });
}
export async function runAuthenticatedAdapter(
  rule: {
    type: "ORACLE" | "CUSTOM";
    adapterId: string;
    adapterAddress: string;
    adapterVersion: string;
  },
  input: {
    escrow: Address;
    milestone: number;
    submission: number;
    evidenceHash: Hex;
    rulesHash: Hex;
    artifact: FetchedArtifact;
    rpcUrl?: string;
  },
) {
  const config = configuredAdapters().find(
    (c) =>
      c.id === rule.adapterId &&
      c.kind === rule.type &&
      c.address.toLowerCase() === rule.adapterAddress.toLowerCase() &&
      c.version === rule.adapterVersion,
  );
  if (!config || !process.env[config.tokenEnv]) error("ADAPTER_UNAVAILABLE");
  const client = createPactPublicClient(input.rpcUrl);
  const registry = getProtocolAddresses(
    await client.getChainId(),
  ).VerifierRegistry;
  const registered = await client.readContract({
    address: registry,
    abi: verifierRegistryV2Abi,
    functionName: "verifiers",
    args: [config.address as Address],
  });
  if (!registered[0]) error("ADAPTER_NOT_REGISTERED");
  const context = {
    scope: "PactFlowAdapterV2",
    escrow: input.escrow.toLowerCase(),
    milestone: input.milestone,
    submission: input.submission,
    evidenceHash: input.evidenceHash,
    rulesHash: input.rulesHash,
    adapter: config.address.toLowerCase(),
    version: config.version,
    nonce: randomUUID(),
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  };
  if (input.artifact.body.length > 128000) error("ADAPTER_EVIDENCE_TOO_LARGE");
  const { url, address, family } = await validateArtifactUrl(config.endpoint);
  if (url.protocol !== "https:") error("ADAPTER_UNAVAILABLE");
  const body = Buffer.from(
    JSON.stringify({
      context,
      evidence: {
        contentType: input.artifact.contentType,
        encoding: "base64",
        content: input.artifact.body.toString("base64"),
      },
    }),
  );
  const response = await new Promise<Buffer>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        timeout: 20000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body.length,
          Authorization: `Bearer ${process.env[config.tokenEnv]}`,
        },
        lookup: (_host, _options, callback) => callback(null, address, family),
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            Object.assign(new Error("Adapter unavailable"), {
              code: "ADAPTER_UNAVAILABLE",
            }),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 64000)
            res.destroy(new Error("Adapter response too large"));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Adapter timeout")));
    req.on("error", () =>
      reject(
        Object.assign(new Error("Adapter unavailable"), {
          code: "ADAPTER_UNAVAILABLE",
        }),
      ),
    );
    req.end(body);
  });
  const result = await authenticateAdapterResponse(
    hashAgreement(context),
    context.expiresAt,
    config.address as Address,
    JSON.parse(response.toString()),
  );
  return {
    ...result,
    adapter: config.address,
    version: config.version,
    requestContext: context,
  };
}

export async function authenticateAdapterResponse(
  contextHash: Hex,
  expiresAt: number,
  address: Address,
  response: unknown,
) {
  const result = z
    .object({
      contextHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      passed: z.boolean(),
      score: z.number().int().min(0).max(100),
      summary: z.string().max(2000),
      signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
    })
    .parse(response);
  if (result.contextHash !== contextHash || Date.now() / 1000 > expiresAt)
    error("ADAPTER_AUTH_FAILED");
  const message = hashAgreement({
    contextHash: result.contextHash,
    passed: result.passed,
    score: result.score,
    summary: result.summary,
  });
  if (
    !(await verifyMessage({
      address,
      message,
      signature: result.signature as Hex,
    }))
  )
    error("ADAPTER_AUTH_FAILED");
  return result;
}
