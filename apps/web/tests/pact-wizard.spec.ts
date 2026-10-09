import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { privateKeyToAccount } from "viem/accounts";
import { resolve } from "node:path";
import { context, login, keys, reader, root } from "./local-helpers";

for (const locale of ["en", "zh-CN"] as const) {
  const m = locale === "en" ? en : zh;
  test(`${locale}: outcome validation accepts short text and identifies the invalid field`, async ({
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
      await login(page, m);
      const title = page.getByRole("textbox", {
        name: m.v2.title,
        exact: true,
      });
      const outcome = page.getByRole("textbox", {
        name: m.v2.outcome,
        exact: true,
      });
      const alerts = page.locator(".wizard").getByRole("alert");
      const next = page.getByRole("button", { name: m.v2.next, exact: true });
      await title.fill("   ");
      await next.click();
      await expect(title).toBeFocused();
      await expect(title).toHaveAttribute("aria-invalid", "true");
      await expect(alerts).toHaveText([
        m.v2.titleRequired,
        m.v2.outcomeRequired,
      ]);
      await expect(
        page.getByText(m.productErrors.generic, { exact: true }),
      ).toHaveCount(0);

      await title.fill("a".repeat(161));
      await outcome.fill("a".repeat(12001));
      await next.click();
      await expect(alerts).toHaveText([m.v2.titleTooLong, m.v2.outcomeTooLong]);
      await expect(title).toBeFocused();

      await title.fill(locale === "en" ? "UI" : "合作");
      await next.click();
      await expect(outcome).toBeFocused();
      await expect(alerts).toHaveText(m.v2.outcomeTooLong);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await outcome.fill(locale === "en" ? "Build a page" : "完成首页设计");
      await next.click();
      await expect(
        page.getByLabel(`${m.v2.deliverable} 1`, { exact: true }),
      ).toBeVisible();
      await expect(alerts).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test(`${locale}: funding identifies conflicts and deadlines, then accepts corrected inputs`, async ({
    browser,
  }) => {
    const c = await context(
      browser,
      "client",
      locale,
      locale === "en" ? 1440 : 390,
    );
    const page = await c.ctx.newPage();
    const now = Date.now();
    const date = (days: number) => {
      const value = new Date(now + days * 86400000);
      return new Date(+value - value.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    const workerAddress = privateKeyToAccount(keys.worker).address;
    const arbitratorAddress = privateKeyToAccount(keys.arbitrator).address;
    try {
      await login(page, m);
      await page
        .getByRole("textbox", { name: m.v2.title, exact: true })
        .fill("Funding regression");
      await page
        .getByRole("textbox", { name: m.v2.outcome, exact: true })
        .fill("交付首页");
      const next = page.getByRole("button", { name: m.v2.next, exact: true });
      await next.click();
      await page
        .getByLabel(`${m.v2.deliverable} 1`, { exact: true })
        .fill("Landing page");
      await page
        .getByRole("textbox", { name: m.v2.criteria, exact: true })
        .fill("Show the agreed content");
      await page
        .getByRole("button", { name: m.v2.addMilestone, exact: true })
        .click();
      await page
        .getByLabel(`${m.v2.deliverable} 2`, { exact: true })
        .fill("Documentation");
      await page
        .getByRole("textbox", { name: m.v2.criteria, exact: true })
        .nth(1)
        .fill("Explain how to use the page");
      await next.click();
      await next.click();
      const worker = page.getByLabel(m.v2.workerAddress, { exact: true });
      const arbitrator = page.getByLabel(m.v2.arbitrator, { exact: true });
      const acceptance = page.getByLabel(m.v2.acceptBy, { exact: true });
      const amount = page.getByLabel(`Landing page · ${m.v2.amount}`, {
        exact: true,
      });
      const firstDue = page.getByLabel(`Landing page · ${m.v2.due}`, {
        exact: true,
      });
      const secondDue = page.getByLabel(`Documentation · ${m.v2.due}`, {
        exact: true,
      });
      const hours = page.getByLabel(m.v2.reviewPeriod, { exact: true });
      const revisions = page.getByLabel(m.v2.revisionLimit, { exact: true });
      const alerts = page.locator(".wizard").getByRole("alert");
      await expect(
        page.getByText(c.account.address, { exact: true }),
      ).toBeVisible();
      await worker.fill(c.account.address);
      await arbitrator.fill(c.account.address);
      await acceptance.fill(date(1));
      await amount.fill("0.0000001");
      await firstDue.fill(date(1));
      await secondDue.fill(date(1));
      await hours.fill("");
      await revisions.fill("1.5");
      await next.click();
      await expect(worker).toBeFocused();
      await expect(alerts).toHaveText([
        m.v2.workerIsClient,
        m.v2.arbitratorIsClient,
        m.v2.amountInvalid,
        m.v2.dueAfterAcceptance,
        m.v2.dueAfterPrevious,
        m.v2.reviewHoursInvalid,
        m.v2.revisionsInvalid,
      ]);
      await expect(
        page.getByText(m.v2.validation, { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText(m.productErrors.generic, { exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: resolve(root, `qa/evidence/funding-${locale}.png`),
        fullPage: true,
      });

      await worker.fill(`  ${workerAddress}  `);
      await arbitrator.fill(workerAddress);
      await amount.fill(".5");
      await firstDue.fill(date(7));
      await secondDue.fill(date(8));
      await hours.fill("0.5");
      await revisions.fill("2");
      await next.click();
      await expect(alerts).toHaveText(m.v2.arbitratorIsWorker);
      await expect(arbitrator).toBeFocused();
      await expect(worker).toHaveValue(workerAddress);
      await arbitrator.fill(` ${arbitratorAddress} `);
      await next.click();
      await expect(
        page.getByRole("heading", { name: "Funding regression", exact: true }),
      ).toBeVisible();
      await expect(alerts).toHaveCount(0);

      // A deadline can expire while the user reviews. Reject before requesting a transaction.
      const nonce = await reader.getTransactionCount({
        address: c.account.address,
      });
      await page.clock.setFixedTime(new Date(now + 2 * 86400000));
      await page
        .getByRole("button", { name: m.v2.fundCreate, exact: true })
        .click();
      await expect(acceptance).toBeFocused();
      await expect(alerts).toHaveText(m.v2.acceptanceFuture);
      expect(
        await reader.getTransactionCount({ address: c.account.address }),
      ).toBe(nonce);
    } finally {
      await c.ctx.close();
    }
  });
}
