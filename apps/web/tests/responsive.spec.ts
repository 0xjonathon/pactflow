import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { context, login, root } from "./local-helpers";
for (const locale of ["en", "zh-CN"] as const)
  test(`${locale}: all required viewports, keyboard navigation and reduced motion`, async ({
    browser,
  }) => {
    const m = locale === "en" ? en : zh;
    const { ctx } = await context(browser, "worker", locale, 1440);
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const evidence = JSON.parse(
      readFileSync(
        resolve(root, `qa/evidence/local-flow-${locale}.json`),
        "utf8",
      ),
    );
    try {
      await login(page, m);
      for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
        for (const url of [
          "/",
          "/discover",
          "/how-it-works",
          "/jobs/new",
          "/network",
          "/activity",
          "/proof",
          "/onboarding",
          "/app",
          "/pacts/new",
          `/pacts/${evidence.escrow}`,
          `/p/${evidence.publicId}`,
        ]) {
          await page.goto(url);
          await expect(page.locator("main")).toBeVisible();
          if (
            !(await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 2,
            ))
          )
            console.log(
              await page.evaluate(() =>
                [...document.querySelectorAll("main *")]
                  .map((element) => ({
                    tag: element.tagName,
                    class: element.className,
                    left: element.getBoundingClientRect().left,
                    right: element.getBoundingClientRect().right,
                  }))
                  .filter((e) => e.right > innerWidth + 2 || e.left < 0),
              ),
            );
          console.log(`Viewport check ${locale} ${width} ${url}`);
          await expect
            .poll(() =>
              page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 2,
              ),
            )
            .toBe(true);
          const landmarks = await page.locator("main").count();
          expect(landmarks).toBe(1);
          expect(await page.locator('a[href="#"],button:empty').count()).toBe(
            0,
          );
        }
      }
      await page.goto(`/pacts/${evidence.escrow}`);
      const tabs = page.getByRole("tab");
      await expect(tabs).toHaveCount(5);
      await tabs.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("End");
      await expect(tabs.last()).toBeFocused();
      const missing = "00000000-0000-4000-8000-000000000000";
      const preview = await page.request.get(`/p/${missing}/opengraph-image`);
      expect(preview.status()).toBe(404);
      const publicPreview = await page.request.get(
        `/p/${evidence.publicId}/opengraph-image`,
      );
      expect(publicPreview.status()).toBe(200);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
