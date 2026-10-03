import { expect, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  type Address,
} from "viem";
import { monadTestnet } from "@pactflow/chain";
import en from "../messages/en.json";
const root = resolve("../..");
const env = JSON.parse(
  readFileSync(resolve(root, ".local/e2e/env.json"), "utf8"),
);
const keys = JSON.parse(
  readFileSync(resolve(root, ".local/e2e/accounts.json"), "utf8"),
);
const api = env.NEXT_PUBLIC_API_URL + "/api/v1";
const reader = createPublicClient({
  chain: monadTestnet,
  transport: http(env.MONAD_TESTNET_RPC_URL),
});
async function request(path: string, token?: string, body?: unknown) {
  const response = await fetch(api + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}
async function context(
  browser: Browser,
  role: string,
  locale: string,
  width: number,
) {
  let denyTransaction = false;
  const account = privateKeyToAccount(keys[role]);
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(env.MONAD_TESTNET_RPC_URL),
  });
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    baseURL: "http://localhost:3011",
  });
  await ctx.exposeFunction(
    "localWallet",
    async ({ method, params = [] }: { method: string; params: unknown[] }) => {
      if (["eth_accounts", "eth_requestAccounts"].includes(method))
        return [account.address];
      if (method === "eth_chainId") return "0x279f";
      if (
        method === "wallet_switchEthereumChain" ||
        method === "wallet_addEthereumChain"
      )
        return null;
      if (method === "personal_sign")
        return account.signMessage({ message: { raw: params[0] as Hex } });
      if (method === "eth_sendTransaction") {
        if (denyTransaction) {
          denyTransaction = false;
          throw new Error("User rejected the request");
        }

        const tx = params[0] as {
          from?: string;
          to: Address;
          data?: Hex;
          value?: Hex;
        };
        if (tx.from?.toLowerCase() !== account.address.toLowerCase())
          throw new Error("Wrong account");
        return wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : 0n,
        });
      }
      return reader.request({
        method: method as never,
        params: params as never,
      });
    },
  );
  await ctx.addCookies([
    { name: "pactflow_locale", value: locale, domain: "localhost", path: "/" },
  ]);
  await ctx.addInitScript((locale) => {
    try {
      localStorage.setItem("pactflow_locale", locale);
    } catch {
      /* about:blank has no storage */
    }
    const handlers = new Map();
    const bridge = window as unknown as {
      ethereum: {
        isMetaMask: boolean;
        request: (args: unknown) => Promise<unknown>;
        on: (name: string, fn: unknown) => void;
        removeListener: (name: string) => void;
      };
      localWallet: (args: unknown) => Promise<unknown>;
    };
    bridge.ethereum = {
      isMetaMask: true,
      request: (args: unknown) => bridge.localWallet(args),
      on: (name: string, fn: unknown) => {
        handlers.set(name, fn);
      },
      removeListener: (name: string) => handlers.delete(name),
    };
  }, locale);
  return {
    ctx,
    account,
    rejectNextTransaction: () => {
      denyTransaction = true;
    },
  };
}
async function login(page: Page, m: typeof en) {
  await page.goto("/pacts/new");
  await page
    .locator("main")
    .getByRole("button", { name: m.wallet.connect, exact: true })
    .click();
  await page
    .locator("main")
    .getByRole("button", { name: m.profile.signIn, exact: true })
    .click();
  await expect(page.getByLabel(m.v2.title, { exact: true })).toBeVisible();
  return page.evaluate(() => localStorage.getItem("pactflow_session")!);
}

export { context, login, request, reader, env, keys, root };
