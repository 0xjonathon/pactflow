import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { fetchArtifact, type FetchLimits } from "../security/fetch-artifact";
import type { LighthouseRunner, LighthouseScores } from "./deterministic";
import { startBrowserProxy } from "../security/browser-proxy";

export function createLighthouseRunner(limits: FetchLimits = {}): LighthouseRunner {
  const cache = new Map<string, Promise<LighthouseScores>>();
  return url => {
    const existing = cache.get(url);
    if (existing) return existing;
    const current = (async () => {
      // Validate the target and its redirect chain before opening a browser.
      const artifact = await fetchArtifact(url, limits);
      if (!artifact.contentType.includes("html")) throw new Error("Lighthouse requires an HTML page");
      const proxy = await startBrowserProxy(limits);
      let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>> | undefined;
      try {
        chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--disable-extensions", "--disable-background-networking", "--no-first-run", "--disable-gpu", "--disable-downloads", "--disable-quic", `--proxy-server=http://127.0.0.1:${proxy.port}`, "--proxy-bypass-list=<-loopback>"] });
        const result = await lighthouse(artifact.url, { port: chrome.port, logLevel: "silent", output: "json", onlyCategories: ["performance", "accessibility", "best-practices", "seo"], maxWaitForLoad: 15_000 });
        if (!result) throw new Error("Lighthouse produced no result");
        const categories = result.lhr.categories;
        return Object.fromEntries(["performance", "accessibility", "best-practices", "seo"].map(name => [name, Math.round((categories[name]?.score ?? 0) * 100)])) as LighthouseScores;
      } finally { try { await chrome?.kill(); } finally { await proxy.close(); } }
    })();
    cache.set(url, current);
    return current;
  };
}
