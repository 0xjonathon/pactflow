import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";

export class ArtifactFetchError extends Error {
  constructor(readonly code: "SSRF_BLOCKED" | "ARTIFACT_UNREACHABLE" | "ARTIFACT_TOO_LARGE", message: string) { super(message); }
}
export type FetchedArtifact = { url: string; status: number; contentType: string; body: Buffer; redirects: string[] };
export type FetchLimits = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; allowLocalhost?: boolean };

function isPublicAddress(input: string, allowLocalhost: boolean): boolean {
  const parsed = ipaddr.process(input);
  if (allowLocalhost && parsed.range() === "loopback") return true;
  return parsed.range() === "unicast";
}

export async function validateArtifactUrl(input: string, allowLocalhost = false): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  let url: URL;
  try { url = new URL(input); } catch { throw new ArtifactFetchError("SSRF_BLOCKED", "Invalid artifact URL"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ArtifactFetchError("SSRF_BLOCKED", "Only HTTP and HTTPS are permitted");
  if (url.username || url.password) throw new ArtifactFetchError("SSRF_BLOCKED", "Credential-bearing URLs are blocked");
  if (url.hostname.endsWith(".local") || url.hostname.endsWith(".internal") || url.hostname === "metadata.google.internal") throw new ArtifactFetchError("SSRF_BLOCKED", "Internal host is blocked");
  let results: Array<{ address: string; family: number }>;
  try { results = await lookup(url.hostname, { all: true, verbatim: true }); }
  catch { throw new ArtifactFetchError("ARTIFACT_UNREACHABLE", "DNS lookup failed"); }
  if (!results.length || results.some(item => !isPublicAddress(item.address, allowLocalhost))) throw new ArtifactFetchError("SSRF_BLOCKED", "Host resolves to a non-public address");
  return { url, address: results[0].address, family: results[0].family as 4 | 6 };
}

async function requestOnce(input: string, options: Required<FetchLimits>): Promise<{ artifact: FetchedArtifact; location?: string }> {
  const { url, address, family } = await validateArtifactUrl(input, options.allowLocalhost);
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      method: "GET", timeout: options.timeoutMs, headers: { Accept: "text/html, application/json, text/plain, application/octet-stream;q=0.5", "User-Agent": "PactFlowVerifier/1.0" },
      lookup: (_hostname, _opts, callback) => callback(null, address, family),
    }, response => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) { response.resume(); resolve({ artifact: { url: url.href, status, contentType: "", body: Buffer.alloc(0), redirects: [] }, location: new URL(location, url).href }); return; }
      const declared = Number(response.headers["content-length"] ?? 0);
      if (declared > options.maxBytes) { response.destroy(); reject(new ArtifactFetchError("ARTIFACT_TOO_LARGE", "Content-Length exceeds limit")); return; }
      const chunks: Buffer[] = [];
      let received = 0;
      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > options.maxBytes) { response.destroy(); reject(new ArtifactFetchError("ARTIFACT_TOO_LARGE", "Artifact exceeds size limit")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ artifact: { url: url.href, status, contentType: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks), redirects: [] } }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new ArtifactFetchError("ARTIFACT_UNREACHABLE", "Request timed out")));
    request.on("error", error => reject(error instanceof ArtifactFetchError ? error : new ArtifactFetchError("ARTIFACT_UNREACHABLE", "Network request failed")));
    request.end();
  });
}

export async function fetchArtifact(input: string, limits: FetchLimits = {}): Promise<FetchedArtifact> {
  const options: Required<FetchLimits> = { maxBytes: limits.maxBytes ?? 2_000_000, timeoutMs: limits.timeoutMs ?? 10_000, maxRedirects: limits.maxRedirects ?? 3, allowLocalhost: limits.allowLocalhost ?? false };
  const redirects: string[] = [];
  let current = input;
  for (let i = 0; i <= options.maxRedirects; i++) {
    const result = await requestOnce(current, options);
    if (!result.location) return { ...result.artifact, redirects };
    redirects.push(result.location);
    current = result.location;
  }
  throw new ArtifactFetchError("SSRF_BLOCKED", "Too many redirects");
}
