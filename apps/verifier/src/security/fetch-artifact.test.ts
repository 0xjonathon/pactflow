import { createServer } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchArtifact, validateArtifactUrl } from "./fetch-artifact";

test("SSRF URL policy blocks local, private, and non-HTTP schemes", async () => {
  for (const url of ["http://localhost:1234/", "http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/", "file:///etc/passwd", "data:text/plain,hello"]) {
    await assert.rejects(() => validateArtifactUrl(url), { code: "SSRF_BLOCKED" });
  }
});
test("local test override is explicit; redirects, size and timeout are bounded", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/redirect") { response.writeHead(302, { Location: "http://10.0.0.1/private" }); response.end(); return; }
    if (request.url === "/large") { response.writeHead(200); response.end("x".repeat(1000)); return; }
    if (request.url === "/slow") return;
    response.writeHead(200); response.end("ok");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetchArtifact(origin, { allowLocalhost: true })).body.toString(), "ok");
    await assert.rejects(() => fetchArtifact(`${origin}/redirect`, { allowLocalhost: true }), { code: "SSRF_BLOCKED" });
    await assert.rejects(() => fetchArtifact(`${origin}/large`, { allowLocalhost: true, maxBytes: 100 }), { code: "ARTIFACT_TOO_LARGE" });
    await assert.rejects(() => fetchArtifact(`${origin}/slow`, { allowLocalhost: true, timeoutMs: 50 }), { code: "ARTIFACT_UNREACHABLE" });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
