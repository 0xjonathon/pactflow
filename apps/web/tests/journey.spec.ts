import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { context, request, reader, root } from "./local-helpers";
import { resolve } from "node:path";
for (const locale of ["en", "zh-CN"] as const) {
  test(`${locale}: first-time request entry, manual brief, private draft recovery and unavailable AI`, async ({
    browser,
  }) => {
    const m = locale === "en" ? en : zh;
    const { ctx, account } = await context(
      browser,
      "client",
      locale,
      locale === "en" ? 1440 : 390,
    );
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto("/how-it-works");
      await expect(
        page.getByText(m.journey.difference, { exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".creation-paths").getByRole("link"),
      ).toHaveCount(2);
      await page.screenshot({
        path: resolve(root, `qa/evidence/journey-${locale}.png`),
        fullPage: true,
      });
      await page.goto("/");
      await page
        .locator("main")
        .getByRole("link", { name: m.marketplace.post, exact: true })
        .first()
        .click();
      await page.waitForURL("**/jobs/new");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: m.auth.guest, exact: true })
        .click();
      await dialog
        .getByRole("button", { name: m.auth.connectWallet, exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByText(m.journey.publishFree, { exact: true }),
      ).toBeVisible();
      const token = await page.evaluate(
        () => localStorage.getItem("pactflow_session")!,
      );
      const title = `设计 ${Date.now()}`;
      await page.getByLabel(m.jobs.title, { exact: true }).fill(title);
      await page
        .getByLabel(m.jobs.description, { exact: true })
        .fill("交付图标");
      const next = page.getByRole("button", {
        name: m.onboarding.continue,
        exact: true,
      });
      await next.click();
      await next.click();
      await expect(
        page.getByRole("button", { name: m.jobs.clientReview, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByLabel(m.jobs.expectedUrl, { exact: true }),
      ).toHaveCount(0);
      await next.click();
      await next.click();
      const before = await reader.getTransactionCount({
        address: account.address,
      });
      // Creation succeeds, then publication fails: My Work must recover that same private draft.
      await page.route("**/api/v1/jobs/*/publish", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
        }),
      );
      await page
        .getByRole("button", { name: m.jobs.publish, exact: true })
        .click();
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      const work = (await request("/me/work", token)).data;
      const draft = work.client.find(
        (j: { title: string }) => j.title === title,
      );
      expect(draft.status).toBe("DRAFT");
      expect((await request(`/jobs/${draft.id}`)).response.status).toBe(401);
      await page.unroute("**/api/v1/jobs/*/publish");
      await page.goto("/app");
      const card = page.locator(".job-card").filter({
        has: page.getByRole("heading", { name: title, exact: true }),
      });
      await card
        .getByRole("link", { name: m.journey.resumeDraft, exact: true })
        .click();
      await expect(page.getByLabel(m.jobs.title, { exact: true })).toHaveValue(
        title,
      );
      await expect(
        page.getByLabel(m.jobs.description, { exact: true }),
      ).toHaveValue("交付图标");
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.jobs.publish, exact: true })
        .click();
      await expect(page.getByText(m.jobs.published)).toBeVisible();
      const after = (await request("/me/work", token)).data.client.filter(
        (j: { title: string }) => j.title === title,
      );
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe(draft.id);
      expect(after[0].status).toBe("OPEN");
      expect(
        await reader.getTransactionCount({ address: account.address }),
      ).toBe(before);
      // An API-created JSON draft must retain its original rules during UI resumption.
      const originalPolicy = {
        version: 1,
        name: "Original JSON checks",
        mode: "AI_ONLY",
        minScore: 100,
        requireAllMandatoryRules: true,
        semanticVerificationEnabled: false,
        rules: [
          {
            id: "original-json",
            type: "JSON_SCHEMA",
            schema: { type: "object", required: ["result"] },
            required: true,
            weight: 100,
          },
        ],
      };
      const due = new Date(Date.now() + 7 * 86400000).toISOString();
      const custom = (
        await request("/jobs", token, {
          title: `${title} JSON`,
          description: "交付数据",
          requirements: "result is required",
          category: "Data",
          skills: ["JSON"],
          budget: "1",
          deadline: due,
          milestones: [{ title: "JSON", amount: "1", dueAt: due }],
          verificationMode: "AIOnly",
          policy: originalPolicy,
          clientDeposit: "0",
          workerDeposit: "0",
        })
      ).data;
      expect(custom.id).toBeTruthy();
      await page.goto(`/jobs/new?draft=${custom.id}`);
      await expect(page.getByLabel(m.jobs.title, { exact: true })).toHaveValue(
        `${title} JSON`,
      );
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await expect(
        page.getByText(m.journey.savedRules, { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".verification-builder pre")).toContainText(
        "original-json",
      );
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.onboarding.continue, exact: true })
        .click();
      await page
        .getByRole("button", { name: m.jobs.publish, exact: true })
        .click();
      await expect(page.getByText(m.jobs.published)).toBeVisible();
      expect((await request(`/jobs/${custom.id}`, token)).data.policy).toEqual(
        originalPolicy,
      );
      // Capabilities are an object. An unavailable provider must never unlock semantic selection.
      await page.route("**/api/v1/verification/capabilities", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ai: { available: false } }),
        }),
      );
      await page.goto("/pacts/new");
      await page.getByLabel(m.v2.title, { exact: true }).fill("设计");
      await page.getByLabel(m.v2.outcome, { exact: true }).fill("交付图标");
      await page.getByRole("button", { name: m.v2.next, exact: true }).click();
      await page
        .getByLabel(`${m.v2.deliverable} 1`, { exact: true })
        .fill("图标");
      await page.getByLabel(m.v2.criteria, { exact: true }).fill("交付 SVG");
      await page.getByRole("button", { name: m.v2.next, exact: true }).click();
      await page
        .getByLabel(m.v2.verifier, { exact: true })
        .selectOption("AIOnly");
      await expect(page.locator('option[value="SEMANTIC"]')).toHaveJSProperty(
        "disabled",
        true,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}
