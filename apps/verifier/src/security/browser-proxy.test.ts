import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { test } from "node:test";
import { startBrowserProxy } from "./browser-proxy";

function proxyGet(port: number, target: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: target }, response => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    }).on("error", reject);
  });
}

function proxyConnect(port: number, target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
    socket.once("data", chunk => { resolve(chunk.toString()); socket.destroy(); });
    socket.once("error", reject);
  });
}

test("browser proxy rejects private HTTP and HTTPS destinations", async () => {
  const proxy = await startBrowserProxy();
  try {
    assert.equal(await proxyGet(proxy.port, "http://127.0.0.1/"), 403);
    assert.equal(await proxyGet(proxy.port, "http://169.254.169.254/latest/meta-data/"), 403);
    assert.match(await proxyConnect(proxy.port, "127.0.0.1:443"), /403 Forbidden/);
    assert.equal(proxy.stats().requests, 3);
  } finally { await proxy.close(); }
});
