import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import { context, login, request, root } from "./local-helpers";
for (const locale of ["en", "zh-CN"] as const)
  test(`${locale}: client posts, worker applies, client selects and reviews onchain draft`, async ({
    browser,
  }) => {
    const cc = await context(
        browser,
        "client",
        locale,
        locale === "en" ? 1440 : 390,
      ),
      ww = await context(
        browser,
        "worker",
        locale,
        locale === "en" ? 1440 : 390,
      );
    const client = cc.ctx,
      worker = ww.ctx;
    const c = await client.newPage(),
      w = await worker.newPage();
    const m = locale === "en" ? en : zh;
    const ct = await login(c, m),
      wt = await login(w, m);
    const next = locale === "en" ? "Continue" : "继续";
    const title = `[Browser Test] ${locale} dashboard ${Date.now()}`;
    try {
      await c.goto("/jobs/new");
      await c
        .getByLabel(locale === "en" ? "Project title" : "项目标题", {
          exact: true,
        })
        .fill(title);
      await c
        .getByLabel(locale === "en" ? "Describe the work" : "描述工作内容")
        .fill(
          "Build a usable Monad analytics dashboard with three metrics and navigation.",
        );
      await c
        .getByLabel(
          locale === "en" ? "Skills (comma separated)" : "技能（逗号分隔）",
        )
        .fill("React, TypeScript");
      await c.getByRole("button", { name: next, exact: true }).click();
      await c.getByRole("button", { name: next, exact: true }).click();
      await c
        .getByRole("button", {
          name: locale === "en" ? "Client Approval" : "本人验收",
          exact: true,
        })
        .click();
      await c.getByRole("button", { name: next, exact: true }).click();
      await c.getByRole("button", { name: next, exact: true }).click();
      await c
        .getByRole("button", {
          name: locale === "en" ? "Publish Brief" : "发布需求",
          exact: true,
        })
        .click();
      await expect(
        c.getByText(locale === "en" ? "Your brief is live" : "需求已发布"),
      ).toBeVisible();
      await c.locator("main a.button").click();
      await c.waitForURL(/\/jobs\/[0-9a-f-]+$/);
      await w.goto("/discover");
      await w
        .getByLabel(
          locale === "en" ? "Search briefs or skills" : "搜索需求或技能",
        )
        .fill(title);
      await w.getByRole("heading", { name: title, exact: true }).click();
      await w
        .getByRole("button", {
          name: locale === "en" ? "Propose a collaboration" : "发起合作提案",
          exact: true,
        })
        .click();
      await w
        .getByLabel(
          locale === "en"
            ? "Describe your approach and what you will deliver"
            : "说明你的合作方案与交付成果",
        )
        .fill(
          "I will deliver a working dashboard with reusable React components.",
        );
      await w
        .getByLabel(
          locale === "en" ? "I accept the listed budget" : "我接受所列预算",
        )
        .check();
      await w
        .getByRole("button", {
          name: locale === "en" ? "Send Proposal" : "发送合作提案",
          exact: true,
        })
        .click();
      await expect(
        w
          .locator("aside")
          .getByText(locale === "en" ? "Pending" : "待处理", { exact: true }),
      ).toBeVisible();
      await c.reload();
      await c
        .getByRole("button", {
          name: locale === "en" ? "Choose Partner" : "选择合作伙伴",
          exact: true,
        })
        .click();
      await c
        .getByRole("link", {
          name: locale === "en" ? "Confirm & Lock Funds" : "确认合作并锁定资金",
          exact: true,
        })
        .click();
      await expect(
        c.getByRole("heading", {
          name: locale === "en" ? "Review collaboration" : "确认合作内容",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        c.getByText(
          locale === "en"
            ? "Your wallet confirms creation, token permission, and funding. These are real testnet transactions."
            : "钱包将确认创建合作、代币授权和资金托管。这些是真实测试网交易。",
        ),
      ).toBeVisible();
      mkdirSync("../../docs/screenshots", { recursive: true });
      await c.screenshot({
        path: `../../docs/screenshots/draft-${locale}.png`,
        fullPage: true,
      });
      await c
        .getByRole("button", { name: m.jobs.createCollaboration, exact: true })
        .click();
      await c
        .getByRole("link", { name: m.jobs.openWorkspace, exact: true })
        .click({ timeout: 60000 });
      await c.waitForURL(/\/pacts\/0x[0-9a-fA-F]{40}$/);
      const escrow = c.url().split("/").at(-1)!;
      await w.goto(`/pacts/${escrow}`);
      await w
        .getByRole("button", { name: m.v2.accept, exact: true })
        .click({ timeout: 45000 });
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("Active");
      await w.reload();
      await w.getByRole("tab", { name: m.v2.evidence, exact: true }).click();
      await w.getByLabel(m.v2.type, { exact: true }).selectOption("TEXT");
      await w
        .getByLabel(m.v2.content, { exact: true })
        .fill('{"delivered":true}');
      await w.getByRole("button", { name: m.v2.submit, exact: true }).click();
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("Submitted");
      await c.reload();
      await c.getByRole("tab", { name: m.v2.evidence, exact: true }).click();
      await c
        .getByLabel(m.v2.reason, { exact: true })
        .fill("Add the missing requirement and resubmit");
      await c
        .getByRole("button", { name: m.v2.requestRevision, exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("RevisionRequired");
      await w.reload();
      await w.getByRole("tab", { name: m.v2.evidence, exact: true }).click();
      await w.getByLabel(m.v2.type, { exact: true }).selectOption("TEXT");
      await w
        .getByLabel(m.v2.content, { exact: true })
        .fill('{"delivered":true,"revision":"missing requirement completed"}');
      await w.getByRole("button", { name: m.v2.resubmit, exact: true }).click();
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("Submitted");
      await c.reload();
      await c.getByRole("tab", { name: m.v2.evidence, exact: true }).click();
      await c.getByRole("button", { name: m.v2.approve, exact: true }).click();
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("Completed");
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/audit`, ct)).data.some(
              (e: { type: string }) => e.type === "ManualReviewConfirmed",
            ),
          { timeout: 20000 },
        )
        .toBe(true);
      const audit = (await request(`/pacts/${escrow}/audit`, ct)).data;
      const history = (await request(`/pacts/${escrow}/submissions`, wt)).data;
      expect(history.map((s: { sequence: number }) => s.sequence)).toEqual([
        2, 1,
      ]);
      const manualId = audit.find(
        (e: { type: string }) => e.type === "ManualReviewConfirmed",
      ).payload.id;
      expect(
        (await request(`/verification/jobs/${manualId}/report`)).response
          .status,
      ).toBe(403);
      const consent = {
        title: `Manual receipt ${locale}`,
        description: "Local marketplace test",
      };
      const share = (await request(`/pacts/${escrow}/disclosure`, ct, consent))
        .data;
      await request(`/pacts/${escrow}/disclosure`, wt, consent);
      const manualReport = (
        await request(`/verification/jobs/${manualId}/report`)
      ).data;
      expect(manualReport.canonicalReport.result).toEqual({
        passed: true,
        score: null,
        confidence: "MANUAL",
      });
      expect(manualReport.canonicalReport.submission.sequence).toBe(2);
      expect(JSON.stringify(manualReport)).not.toContain(
        "missing requirement completed",
      );
      await c.goto(`/p/${share.publicId}`);
      await expect(
        c.getByRole("heading", { name: consent.title, exact: true }),
      ).toBeVisible();
      mkdirSync(resolve(root, "qa/evidence"), { recursive: true });
      writeFileSync(
        resolve(root, `qa/evidence/marketplace-${locale}.json`),
        JSON.stringify(
          {
            network: "LOCAL_TEST_ONLY",
            escrow,
            publicId: share.publicId,
            review: audit.filter(
              (e: { type: string }) => e.type === "ManualReviewConfirmed",
            ),
          },
          null,
          2,
        ),
      );
    } finally {
      await client.close();
      await worker.close();
    }
  });
