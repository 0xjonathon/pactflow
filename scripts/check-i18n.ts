import { readFileSync } from "node:fs";
import { join } from "node:path";

interface TreeObject { [key: string]: string | TreeObject }
const root = process.cwd();
const read = (name: string) => JSON.parse(readFileSync(join(root, "apps/web/messages", name), "utf8")) as TreeObject;
const en = read("en.json");
const zh = read("zh-CN.json");
function flatten(tree: TreeObject, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else for (const [nested, text] of flatten(value, path)) result.set(nested, text);
  }
  return result;
}
const a = flatten(en);
const b = flatten(zh);
const missing = [...a.keys()].filter(key => !b.has(key));
const orphan = [...b.keys()].filter(key => !a.has(key));
const placeholders = (value: string) => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]).sort().join(",");
const mismatched = [...a.keys()].filter(key => b.has(key) && placeholders(a.get(key)!) !== placeholders(b.get(key)!));
const requiredDomains = ["common", "navigation", "wallet", "landing", "pact", "milestone", "verification", "dispute", "reputation", "agent", "transaction", "errors", "time"];
const domainsMissing = requiredDomains.filter(domain => !Object.hasOwn(en, domain) || !Object.hasOwn(zh, domain));
if (missing.length || orphan.length || mismatched.length || domainsMissing.length) {
  if (missing.length) console.error("Missing Chinese keys:", missing.join(", "));
  if (orphan.length) console.error("Orphan Chinese keys:", orphan.join(", "));
  if (mismatched.length) console.error("Placeholder mismatch:", mismatched.join(", "));
  if (domainsMissing.length) console.error("Missing domains:", domainsMissing.join(", "));
  process.exitCode = 1;
} else console.log(`i18n key parity PASS (${a.size} keys in each locale)`);
