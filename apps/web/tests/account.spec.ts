import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { context, login, root } from "./local-helpers";
import { resolve } from "node:path";
for (const locale of ["en", "zh-CN"] as const) {
  const m = locale === "en" ? en : zh;
  test(`${locale}: optional guest entry, required wallet, signature retry and clean account menu`, async ({
    browser,
  }) => {
    const { ctx, rejectNextSignature } = await context(
      browser,
      "worker",
      locale,
      locale === "en" ? 1440 : 390,
    );
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto("/network");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      const entry = page
        .locator("header")
        .getByRole("button", { name: m.auth.login, exact: true });
      await entry.click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: m.auth.title }),
      ).toBeVisible();
      await expect(dialog.getByText(m.auth.googleUnavailable)).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: resolve(root, `qa/evidence/login-${locale}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(entry).toBeFocused();
      await page.goto("/pacts/new");
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: m.auth.guest, exact: true })
        .click();
      await expect(
        dialog.getByRole("heading", { name: m.auth.walletTitle }),
      ).toBeVisible();
      await expect(
        page.getByLabel(m.v2.title, { exact: true }),
      ).not.toBeVisible();
      rejectNextSignature();
      await dialog
        .getByRole("button", { name: m.auth.connectWallet, exact: true })
        .click();
      await expect(dialog.getByRole("alert")).toHaveText(m.errors.rejected);
      await dialog
        .getByRole("button", { name: m.auth.connectWallet, exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByLabel(m.v2.title, { exact: true })).toBeVisible();
      await page.goto("/network");
      const card = page.locator(".job-card").first();
      await expect(card).toBeVisible();
      const filter = await page.locator(".network-filters").boundingBox();
      const result = await card.boundingBox();
      expect(result!.y - filter!.y - filter!.height).toBeGreaterThanOrEqual(24);
      const menu = page.getByRole("button", { name: m.auth.accountMenu });
      await menu.click();
      await expect(page.locator(".account-heading strong")).toHaveText(
        /^Guest-[A-F0-9]{6}$/,
      );
      await expect(
        page.getByRole("button", { name: m.auth.logout }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: m.auth.loginGoogle, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: m.wallet.disconnect }),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: resolve(root, `qa/evidence/account-${locale}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await page.reload();
      await menu.click();
      await expect(
        page.getByRole("button", { name: m.wallet.disconnect }),
      ).toBeVisible();
      await page.getByRole("button", { name: m.wallet.disconnect }).click();
      await expect(
        page
          .locator("header")
          .getByRole("button", { name: m.auth.login, exact: true }),
      ).toBeVisible();
      await page.goto("/pacts/new");
      await expect(dialog).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  test(`${locale}: missing browser wallet keeps protected access unavailable`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      {
        name: "pactflow_locale",
        value: locale,
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await ctx.newPage();
    try {
      await page.goto("http://localhost:3011/pacts/new");
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", { name: m.auth.guest, exact: true })
        .click();
      await dialog
        .getByRole("button", { name: m.auth.connectWallet, exact: true })
        .click();
      await expect(dialog.getByRole("alert")).toHaveText(
        m.productErrors.WALLET_UNAVAILABLE,
      );
      await expect(dialog).toBeVisible();
      await expect(
        page.getByLabel(m.v2.title, { exact: true }),
      ).not.toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem("pactflow_session")),
      ).toBeNull();
    } finally {
      await ctx.close();
    }
  });

  test(`${locale}: switching wallet invalidates the previous wallet session`, async ({
    browser,
  }) => {
    const { ctx, changeWallet } = await context(
      browser,
      "client",
      locale,
      locale === "en" ? 1440 : 390,
    );
    const page = await ctx.newPage();
    try {
      await login(page, m);
      expect(
        await page.evaluate(() => localStorage.getItem("pactflow_session")),
      ).toBeTruthy();
      await page.goto("/network");
      await changeWallet("worker");
      await expect
        .poll(() =>
          page.evaluate(() => localStorage.getItem("pactflow_session")),
        )
        .toBeNull();
      await page.goto("/pacts/new");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByLabel(m.v2.title, { exact: true }),
      ).not.toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: m.auth.guest, exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: m.auth.connectWallet, exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.getByLabel(m.v2.title, { exact: true })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test(`${locale}: Google account display and logout stay separate from wallet (mock Google provider)`, async ({
    browser,
  }) => {
    const { ctx } = await context(
      browser,
      "client",
      locale,
      locale === "en" ? 1440 : 390,
    );
    const page = await ctx.newPage();
    try {
      let googleLoggedIn = false;
      await ctx.route("**/api/v1/auth/google/**", async (route) => {
        const endpoint = new URL(route.request().url()).pathname
          .split("/")
          .pop();
        if (endpoint === "verify") googleLoggedIn = true;
        if (endpoint === "logout") googleLoggedIn = false;
        const result =
          endpoint === "config"
            ? { enabled: true, clientId: "browser-test" }
            : endpoint === "challenge"
              ? {
                  id: "browser-fixture",
                  nonce: "fixture-nonce",
                  clientId: "browser-test",
                }
              : endpoint === "verify"
                ? {
                    token: "browser-test-account",
                    account: { name: "Ren Google 用户", provider: "google" },
                  }
                : endpoint === "me"
                  ? { name: "Ren Google 用户", provider: "google" }
                  : { ok: true };
        await route.fulfill({
          json: result,
          status: endpoint === "me" && !googleLoggedIn ? 401 : 200,
        });
      });
      await ctx.route("https://accounts.google.com/gsi/client", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: `let callback; window.google={accounts:{id:{initialize:options=>{callback=options.callback},renderButton:element=>{const button=document.createElement('button');button.textContent='Mock Google consent';button.onclick=()=>callback({credential:'browser-provider-fixture'});element.append(button)}}}};`,
        }),
      );
      await page.goto("/network");
      await page
        .locator("header")
        .getByRole("button", { name: m.auth.login, exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Mock Google consent" }).click();
      await expect(
        dialog.getByRole("heading", { name: m.auth.walletTitle }),
      ).toBeVisible();
      await expect(
        dialog.getByText("Ren Google 用户", { exact: true }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: m.auth.connectWallet, exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator(".account-trigger-name")).toHaveText(
        "Ren Google 用户",
      );
      await page.reload();
      await expect(page.locator(".account-trigger-name")).toHaveText(
        "Ren Google 用户",
      );
      await page.getByRole("button", { name: m.auth.accountMenu }).click();
      await expect(
        page.getByRole("button", { name: m.auth.loginGoogle, exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: m.auth.logout }).click();
      await page.getByRole("button", { name: m.auth.accountMenu }).click();
      await expect(
        page.getByRole("button", { name: m.auth.logout }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: m.auth.loginGoogle, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: m.wallet.disconnect }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem("pactflow_account")),
      ).toBeNull();
      expect(
        await page.evaluate(() => localStorage.getItem("pactflow_session")),
      ).toBeTruthy();
    } finally {
      await ctx.close();
    }
  });
}
