import { hashAgreement, type CanonicalValue } from "@pactflow/sdk";
import { keccak256 } from "viem";
import { z } from "zod";
import type { PactFlowDatabase } from "@pactflow/db/client";
import {
  fetchArtifact,
  type FetchedArtifact,
  type FetchLimits,
} from "../security/fetch-artifact";
import { readPrivateUpload } from "../storage/object-store";
const evidenceSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  source: z.string(),
  label: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});
export async function normalizeEvidence(
  manifest: unknown,
  expectedHash: string,
  db: PactFlowDatabase,
  limits: FetchLimits,
) {
  if (
    hashAgreement(manifest as CanonicalValue).toLowerCase() !==
    expectedHash.toLowerCase()
  )
    throw new Error("EVIDENCE_MANIFEST_MISMATCH");
  const data = z
    .object({ evidence: z.array(evidenceSchema).min(1).max(16) })
    .parse(manifest);
  const normalized = [];
  for (const item of data.evidence) {
    let artifact: FetchedArtifact;
    if (item.type === "TEXT" || item.type === "JSON")
      artifact = {
        url: "https://evidence.invalid/",
        status: 200,
        contentType: item.type === "JSON" ? "application/json" : "text/plain",
        body: Buffer.from(item.source),
        redirects: [],
      };
    else if (item.type === "FILE" || item.type === "IMAGE") {
      const file = await readPrivateUpload(db, item.source);
      artifact = {
        url: "https://evidence.invalid/",
        status: 200,
        contentType: file.mime,
        body: file.body,
        redirects: [],
      };
    } else if (
      item.type === "GITHUB_REPOSITORY" ||
      item.type === "PULL_REQUEST" ||
      item.type === "TRANSACTION"
    )
      artifact = {
        url: "https://evidence.invalid/",
        status: 200,
        contentType: "application/json",
        body: Buffer.from(
          JSON.stringify({ source: item.source, ...item.metadata }),
        ),
        redirects: [],
      };
    else artifact = await fetchArtifact(item.source, limits);
    normalized.push({
      ...item,
      artifact,
      observedContentHash: keccak256(artifact.body),
    });
  }
  return normalized;
}
