import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { context, login, root } from "./local-helpers";
for (const locale of ["en", "zh-CN"] as const) {
  test(`${locale}: WCAG automated audit of core pages`, async ({ browser }) => {
    const { ctx } = await context(browser, "worker", locale, 1440);
    const page = await ctx.newPage();
    const proof = JSON.parse(
      readFileSync(
        resolve(root, `qa/evidence/local-flow-${locale}.json`),
        "utf8",
      ),
    );
    const findings: unknown[] = [];
    try {
      await login(page, locale === "en" ? en : zh);
      for (const width of [1440, 390]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        for (const path of [
          "/",
          "/discover",
          "/how-it-works",
          "/jobs/new",
          "/network",
          "/activity",
          "/proof",
          "/onboarding",
          "/pacts/new",
          `/pacts/${proof.escrow}`,
          `/p/${proof.publicId}`,
        ]) {
          await page.goto(path);
          await expect(page.locator("main")).toBeVisible();
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          findings.push({
            path,
            width,
            violations: result.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.target),
            })),
          });
        }
      }
      writeFileSync(
        resolve(root, `qa/evidence/accessibility-${locale}.json`),
        JSON.stringify(findings, null, 2),
      );
      expect(
        findings.filter(
          (f) => (f as { violations: unknown[] }).violations.length,
        ),
      ).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}
