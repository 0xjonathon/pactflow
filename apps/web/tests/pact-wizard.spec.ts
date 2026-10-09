import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { context, login } from "./local-helpers";

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
}
