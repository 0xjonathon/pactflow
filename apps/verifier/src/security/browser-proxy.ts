import http, { type IncomingMessage, type ServerResponse } from "node:http";
import https from "node:https";
import net, { type Socket } from "node:net";
import { validateArtifactUrl, type FetchLimits } from "./fetch-artifact";

/** Per-audit network gate for Chrome, including HTTPS CONNECT and subresources. */
export async function startBrowserProxy(limits: FetchLimits = {}) {
  const sockets = new Set<Socket>();
  const maxBytes = limits.maxBytes ?? 2_000_000;
  const maxTotalBytes = maxBytes * 10;
  const maxRequests = 150;
  const timeoutMs = limits.timeoutMs ?? 10_000;
  let totalBytes = 0;
  let requests = 0;
  const allowed = async (url: string) => {
    if (++requests > maxRequests) throw new Error("Browser request limit exceeded");
    const result = await validateArtifactUrl(url, limits.allowLocalhost ?? false);
    if (!limits.allowLocalhost && ![80, 443].includes(Number(result.url.port || (result.url.protocol === "https:" ? 443 : 80)))) throw new Error("Non-standard browser port blocked");
    return result;
  };
  const accountBytes = (count: number) => { totalBytes += count; if (totalBytes > maxTotalBytes) throw new Error("Browser response limit exceeded"); };
  const server = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
      const target = await allowed(request.url ?? "");
      const transport = target.url.protocol === "https:" ? https : http;
      const upstream = transport.request(target.url, { method: request.method, timeout: timeoutMs,
        headers: { "user-agent": String(request.headers["user-agent"] ?? "PactFlowVerifier/1.0"), accept: String(request.headers.accept ?? "*/*") },
        lookup: (_host, _options, callback) => callback(null, target.address, target.family),
      }, incoming => {
        const declared = Number(incoming.headers["content-length"] ?? 0);
        if (declared > maxBytes) { incoming.destroy(); response.writeHead(413).end(); return; }
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        let bytes = 0;
        incoming.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          try { accountBytes(chunk.length); if (bytes > maxBytes) throw new Error("Resource too large"); }
          catch { incoming.destroy(); response.destroy(); }
        });
        incoming.pipe(response);
      });
      upstream.on("timeout", () => upstream.destroy());
      upstream.on("error", () => { if (!response.headersSent) response.writeHead(502).end(); else response.destroy(); });
      upstream.end();
    } catch { response.writeHead(403).end(); }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.setTimeout(timeoutMs * 2, () => socket.destroy()); });
  server.on("connect", async (request, browserSocket, head) => {
    try {
      const target = await allowed(`https://${request.url}/`);
      const upstream = net.connect(Number(target.url.port || 443), target.address);
      sockets.add(upstream);
      upstream.on("close", () => sockets.delete(upstream));
      upstream.setTimeout(timeoutMs * 2, () => upstream.destroy());
      upstream.on("error", () => browserSocket.destroy());
      upstream.once("connect", () => {
        browserSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        browserSocket.pipe(upstream);
        upstream.on("data", (chunk: Buffer) => { try { accountBytes(chunk.length); } catch { upstream.destroy(); browserSocket.destroy(); } });
        upstream.pipe(browserSocket);
      });
    } catch { browserSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); browserSocket.destroy(); }
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Browser proxy failed to bind");
  return { port: address.port, stats: () => ({ requests, totalBytes }), close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(done => server.close(() => done())); } };
}
