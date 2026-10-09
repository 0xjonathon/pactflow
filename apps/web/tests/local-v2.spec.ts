import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";
import {
  context,
  login,
  request,
  reader,
  env,
  keys,
  root,
} from "./local-helpers";
for (const [locale, width] of [
  ["en", 1440],
  ["zh-CN", 390],
] as const)
  test(`${locale} ${width}: signed V2 failure, revision, payment and consent`, async ({
    browser,
  }) => {
    test.setTimeout(300000);
    const m = locale === "en" ? en : zh;
    const c = await context(browser, "client", locale, width),
      w = await context(browser, "worker", locale, width);
    const cp = await c.ctx.newPage(),
      wp = await w.ctx.newPage();
    const errors: string[] = [];
    cp.on("pageerror", (e) => errors.push(e.message));
    wp.on("pageerror", (e) => errors.push(e.message));
    try {
      const ct = await login(cp, m),
        wt = await login(wp, m);
      console.log("Wallet sessions ready");
      await cp
        .getByLabel(m.v2.title, { exact: true })
        .fill(`Local V2 ${locale} ${Date.now()}`);
      await cp
        .getByLabel(m.v2.outcome, { exact: true })
        .fill("Deliver validated JSON that demonstrates the approved outcome.");
      await cp.getByRole("button", { name: m.v2.next, exact: true }).click();
      await cp
        .getByLabel(`${m.v2.deliverable} 1`, { exact: true })
        .fill("Approved JSON");
      await cp
        .getByLabel(m.v2.criteria, { exact: true })
        .fill("delivered must equal true");
      await cp.getByRole("button", { name: m.v2.next, exact: true }).click();
      await cp
        .getByLabel(m.v2.verifier, { exact: true })
        .selectOption("AIOnly");
      await cp.getByRole("button", { name: m.v2.next, exact: true }).click();
      await cp
        .getByLabel(m.v2.workerAddress, { exact: true })
        .fill(w.account.address);
      await cp
        .getByLabel(m.v2.arbitrator, { exact: true })
        .fill(privateKeyToAccount(keys.arbitrator).address);
      await cp.getByRole("button", { name: m.v2.next, exact: true }).click();
      console.log("Pact review ready");
      if (locale === "en") {
        const nonce = await reader.getTransactionCount({
          address: c.account.address,
        });
        c.rejectNextTransaction();
        await cp
          .getByRole("button", { name: m.v2.fundCreate, exact: true })
          .click();
        await expect(
          cp.getByRole("alert").filter({ hasText: m.errors.rejected }),
        ).toBeVisible();
        expect(
          await reader.getTransactionCount({ address: c.account.address }),
        ).toBe(nonce);
      }

      await cp
        .getByRole("button", { name: m.v2.fundCreate, exact: true })
        .click();
      await expect(
        cp.getByRole("link", { name: m.navigation.openPact, exact: true }),
      ).toBeVisible({ timeout: 60000 });
      await cp
        .getByRole("link", { name: m.navigation.openPact, exact: true })
        .click();
      await cp.waitForURL(/\/pacts\/0x[0-9a-fA-F]{40}$/);
      const escrow = cp.url().split("/").at(-1)!;
      await wp.goto(`/pacts/${escrow}`);
      await wp
        .getByRole("button", { name: m.v2.accept, exact: true })
        .click({ timeout: 45000 });
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("Active");
      await wp.reload();
      const starting = await reader.readContract({
        address: env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS,
        abi: [
          {
            type: "function",
            name: "balanceOf",
            stateMutability: "view",
            inputs: [{ name: "owner", type: "address" }],
            outputs: [{ type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [w.account.address],
      });
      async function submit(delivered: boolean) {
        if (!delivered && locale === "en") {
          let interrupted = false;
          await wp.route("**/api/v1/submissions/*/confirm", async (route) => {
            if (!interrupted) {
              interrupted = true;
              await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
              });
            } else await route.continue();
          });
        }

        await wp.getByRole("tab", { name: m.v2.evidence, exact: true }).click();
        await wp.getByLabel(m.v2.content, { exact: true }).fill(
          JSON.stringify({
            delivered,
            privateNote: "participant-only-secret",
          }),
        );
        await wp
          .getByRole("button", {
            name: delivered ? m.v2.resubmit : m.v2.submit,
            exact: true,
          })
          .click();
        if (!delivered && locale === "en") {
          await wp
            .getByRole("button", { name: m.v2.recoverSubmission, exact: true })
            .click();
          await expect(
            wp.getByRole("button", {
              name: m.v2.recoverSubmission,
              exact: true,
            }),
          ).toHaveCount(0);
        }
        await expect
          .poll(
            async () =>
              (await request(`/pacts/${escrow}/submissions`, wt)).data.filter(
                (s: {
                  status: string;
                  sequence: number;
                  txHash: string;
                  manifestHash: string;
                }) => s.status === "CONFIRMED",
              ).length,
            { timeout: 45000 },
          )
          .toBe(delivered ? 2 : 1);
        await wp
          .getByRole("button", { name: m.v2.startVerification, exact: true })
          .click({ timeout: 45000 });
      }
      await submit(false);
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/verifications`, wt)).data[0]
              ?.status,
          { timeout: 60000 },
        )
        .toBe("FAILED");
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("RevisionRequired");
      await wp.reload();
      await submit(true);
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/verifications`, wt)).data[0]
              ?.status,
          { timeout: 60000 },
        )
        .toBe("PASSED");
      await expect
        .poll(
          async () =>
            (await request(`/pacts/${escrow}/state`)).data.snapshot.status,
          { timeout: 45000 },
        )
        .toBe("Completed");
      const ending = await reader.readContract({
        address: env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS,
        abi: [
          {
            type: "function",
            name: "balanceOf",
            stateMutability: "view",
            inputs: [{ name: "owner", type: "address" }],
            outputs: [{ type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [w.account.address],
      });
      expect(ending - starting).toBe(1_000_000n);
      const history = (await request(`/pacts/${escrow}/submissions`, wt)).data;
      expect(
        history.map(
          (s: {
            status: string;
            sequence: number;
            txHash: string;
            manifestHash: string;
          }) => s.sequence,
        ),
      ).toEqual([2, 1]);
      expect(
        (await request(`/pacts/${escrow}/submissions`)).response.status,
      ).toBe(401);
      const job = (await request(`/pacts/${escrow}/verifications`, wt)).data[0];
      expect(
        (await request(`/verification/jobs/${job.id}/report`)).response.status,
      ).toBe(403);
      const payload = {
        title: `Approved local receipt ${locale}`,
        description: "A local test result, not public chain work.",
      };
      const consent = (
        await request(`/pacts/${escrow}/disclosure`, ct, payload)
      ).data;
      expect(
        (await request(`/receipts/${consent.publicId}`)).response.status,
      ).toBe(404);
      await request(`/pacts/${escrow}/disclosure`, wt, payload);
      const publicReport = await request(`/verification/jobs/${job.id}/report`);
      expect(publicReport.response.status).toBe(200);
      expect(JSON.stringify(publicReport.data)).not.toContain(
        "participant-only-secret",
      );
      expect(publicReport.data.redacted).toBe(true);
      const profile = (await request("/me", ct)).data;
      const passport = (await request(`/users/${profile.handle}/history`)).data;
      expect(
        passport.receipts.some(
          (r: { publicId: string }) => r.publicId === consent.publicId,
        ),
      ).toBe(true);
      await cp.goto(`/p/${consent.publicId}`);
      await expect(
        cp.getByRole("heading", { name: payload.title, exact: true }),
      ).toBeVisible();
      expect(
        await cp.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      mkdirSync(resolve(root, "qa/evidence"), { recursive: true });
      await cp.screenshot({
        path: resolve(root, `qa/evidence/receipt-${locale}-${width}.png`),
        fullPage: true,
      });
      // Chain settlement can complete before the asynchronous activity projection catches up.
      await expect
        .poll(
          async () => {
            const items = (await request(`/activity?escrow=${escrow}`)).data
              .items as Array<{ name: string }>;
            return {
              settled: items.filter((e) => e.name === "MilestoneSettled")
                .length,
              revisions: items.filter((e) => e.name === "RevisionRequested")
                .length,
            };
          },
          { timeout: 45000 },
        )
        .toEqual({ settled: 1, revisions: 1 });
      const events = (await request(`/activity?escrow=${escrow}`)).data.items;
      expect(
        events.filter(
          (e: {
            name: string;
            txHash: string;
            blockNumber: number;
            logIndex: number;
          }) => e.name === "MilestoneSettled",
        ),
      ).toHaveLength(1);
      expect(
        events.filter(
          (e: {
            name: string;
            txHash: string;
            blockNumber: number;
            logIndex: number;
          }) => e.name === "RevisionRequested",
        ),
      ).toHaveLength(1);
      writeFileSync(
        resolve(root, `qa/evidence/local-flow-${locale}.json`),
        JSON.stringify(
          {
            network: "LOCAL_TEST_ONLY",
            escrow,
            publicId: consent.publicId,
            workerReceived: (ending - starting).toString(),
            history: history.map(
              (s: {
                status: string;
                sequence: number;
                txHash: string;
                manifestHash: string;
              }) => ({
                sequence: s.sequence,
                txHash: s.txHash,
                manifestHash: s.manifestHash,
              }),
            ),
            events: events.map(
              (e: {
                name: string;
                txHash: string;
                blockNumber: number;
                logIndex: number;
              }) => ({
                name: e.name,
                txHash: e.txHash,
                block: e.blockNumber,
                logIndex: e.logIndex,
              }),
            ),
          },
          null,
          2,
        ),
      );
    } finally {
      await c.ctx.close();
      await w.ctx.close();
    }
  });
