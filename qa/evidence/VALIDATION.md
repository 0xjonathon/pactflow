# Local validation evidence

Date: 2026-10-04 (Asia/Shanghai). Code: protocol `bb775ba`, trust `3473b6a`, indexer `14ea805`, Web `dadffa2`, operations `2501449`.

- `pnpm typecheck`: scripts + ten packages PASS; 697 en/zh-CN keys.
- `pnpm lint`: PASS, zero errors/warnings. `pnpm format:check`: PASS.
- `node --import tsx --test ...`: 20 total, 18 PASS, 2 SKIP (real PostgreSQL/Redis unavailable).
- `forge fmt --check`: PASS; `forge test`: 23 reported PASS; 21 behavior/fuzz tests, two invariant suites/eight invariant assertions.
- `pnpm --filter @pactflow/indexer codegen`: PASS; hosted runtime unverified.
- Optimized Next build in the local production harness: PASS; known non-fatal build messages recorded in audit.
- `playwright test --config playwright.local.config.ts`: 8 PASS, 2.9 minutes, fixed production Web against actual loopback Anvil transactions.

`local-flow-en.json` / `local-flow-zh-CN.json` contain actual escrow, public receipt ID, sequence-one/two evidence hashes/transaction hashes, worker balance increase and event block/log identities. `marketplace-*.json` record actual client approval reports/transactions. Receipt PNGs are actual rendered desktop/mobile pages. `accessibility-*.json` record nine routes × two widths per language with no rule violations.

All chain evidence is `LOCAL_TEST_ONLY`, chain ID 10143 on loopback Anvil, test token without value. Do not submit local hashes as public Monad links. No ephemeral private key, authorization token, signed raw transaction or database is included. Runtime keys/env/database remain ignored under `.local` and are excluded from artifact uploads.

See `qa/PRODUCTION_AUDIT.md` for the public service/deployment blockers. CI provisioning is committed but no remote CI execution is claimed.

## Account access acceptance — 2026-10-09

- `pnpm typecheck`: scripts and ten packages PASS; 727 bilingual keys.
- `pnpm lint`, `pnpm format:check`, `git diff --check`: PASS.
- Application/security suite: 22 cases, 20 PASS and 2 real PostgreSQL/Redis SKIP. New Google tests verify issuer/audience/nonce/expiry/signature, replay, account-vs-wallet authorization, session hashing/logout, and legacy placeholder migration.
- Final optimized production Web build: PASS.
- Final complete browser run: **16/16 PASS in 3.1 minutes**. Eight account cases (four per language), plus the original automatic/manual collaboration, viewport and accessibility cases. Local Activity indexing is explicitly awaited before asserting exactly one settlement and revision event.
- `login-{en,zh-CN}.png`, `account-{en,zh-CN}.png`: actual guest login dialog and account menu at desktop/mobile sizes. No authorization token or private key is shown.
- Google browser account-name/refresh/logout tests use an explicitly mocked provider. Real Google OAuth login remains BLOCKED until `GOOGLE_CLIENT_ID` and its authorized origin are configured. Guest wallet signatures and all collaboration transactions use the actual local chain.

Earlier account failures (active-cache deletion) and one index-lag assertion were corrected and rechecked; the final full run has zero failures. Startup build/dev conflicts were resolved, the old local databases were retained, and normal API termination now closes database resources. Unchanged contract evidence remains the prior 2026-10-04 run. No public chain transaction or external deployment is claimed.

## Creation outcome validation fix — 2026-10-09

The first V2 creation step incorrectly imposed undocumented minima of five title characters and twenty outcome characters, while the API requires nonempty text with maxima of 160/12,000. Short Chinese text was therefore rejected before any request or wallet transaction. The form now matches the API, trims submitted title/outcome, and shows translated field errors with invalid/described-by attributes and focuses the first invalid field.

- Web typecheck, changed-file lint/format and diff checks: PASS; 731 matching bilingual keys. Optimized local production build: PASS; preview restarted with the fix.
- Signed full English/desktop and Chinese/mobile collaboration tests: **2/2 PASS**. Chinese test creates a Pact with the four-character title `合作测试` and short outcome, then completes failure, revision, payment, disclosure and privacy checks on the local chain.
- New field-validation regression tests: **2/2 PASS** in the final run (4.2s). Empty/whitespace, title/outcome maximum lengths, focus, translated errors, short text progression, and automated WCAG checks are covered at 1440px English and 390px Chinese.
- Two earlier regression-test runs had locator failures (a global empty alert and implicit textarea label text after React rerender). The final tests scope alerts to the wizard and identify editable fields by their accessible role/name. No application-code changes followed the successful full collaboration run.

The earlier 16-case account/product baseline is unchanged; this fix reran the two affected full collaboration cases and added the two field regressions. Real Google/provider/public-deployment gates remain as recorded above. No public chain transactions were sent.

## Funding validation acceptance — 2026-10-09

- Application suite: 31 total, **29 PASS / 2 SKIP** (real PostgreSQL/Redis remain unavailable). Nine new funding unit cases cover role conflicts/zero addresses, copied whitespace, exact USDC precision without rounding, uint256 budget overflow, V2 acceptance/submission boundaries, review durations and integer revisions. The root test command includes these cases in CI.
- Final complete browser suite: **20/20 PASS in 3.1 minutes**, including the earlier sixteen cases and four outcome/funding regressions. Funding is checked at 1440px English and 390px Chinese with multiple invalid fields, specific translated messages/focus, corrected progression and wallet whitespace normalization. An acceptance deadline expiring on the review page returns to funding before any transaction; the account nonce is unchanged. Automated error-state WCAG and horizontal overflow checks pass.
- Web typecheck, root lint/format, 758-key bilingual parity, diff check and optimized local production build: PASS. The preview runs the updated optimized build.
- `funding-{en,zh-CN}.png` are inspected actual error-state screenshots with local wallets only. The existing automatic/manual chain JSON, rendered receipts and viewport/accessibility evidence were refreshed by the full run. No authorization token, private key or public transaction is included.

The page now explains three distinct roles, shows the current requester wallet, places acceptance before submission deadlines, and points each funding failure to its own field. Address/amount normalization is consistent between the canonical spec and the actual transaction. Created escrows keep their frozen terms and existing upload/funding recovery paths. Contract source is unchanged; real external services and production release gates remain blocked as previously recorded.


## Demand-to-agreement acceptance — 2026-10-09

- Fixed optimized Web build and full browser suite: **22/22 PASS in 3.3 minutes**. No source changes during final execution.
- Public home→Publish Brief→Google/guest choice→wallet verification works in English 1440px and Chinese 390px. Short Chinese manual briefs need no URL/counterparty. Publication does not send a wallet transaction. Injected publish failure resumes the same private draft from My Work; existing API-created JSON verification rules are preserved unchanged.
- Marketplace flow now starts at the active home and verifies the selected wallet, configured review/revision values and application display. English interrupts spec saving after actual creation, refreshes and funds that original escrow. Both locales complete acceptance, revision, resubmission, manual settlement and mutual redacted disclosure. `marketplace-*.json` retains confirmed terms and same-escrow recovery evidence.
- Existing signed automatic settlement/receipt/Activity/balance tests, account/guest/Google-mock separation, funding validation/focus and missing-wallet cases pass. Google mocks remain labelled; they do not replace real provider acceptance.
- **36 application tests: 34 PASS / 2 SKIP**. Five new brief/role-action cases and extended API lifecycle assertions cover private/idempotent drafts, published-term protection, zero/unsupported amounts/dates, status filters, pending duplication/withdrawn reapplication, expiry and linked closure guards.
- **44 automated WCAG audits** (11 routes × 2 viewports × 2 locales) have zero violations. **168 viewport route checks** (12 × 7 × 2) pass, plus Room keyboard/reduced-motion and public/private social previews. Screenshot inspection covers flow explanations and selected-partner terms. `journey-*.png`, `docs/screenshots/draft-*.png` and existing flow/receipt evidence are refreshed.
- 843-key parity, scripts/all ten package types, root lint/format/diff and optimized production Web build pass. No contract changes or public-chain transactions in this update.

Earlier recommendation naming/inline-footer links and test locator assumptions were repaired. A trace archive failed during an earlier run because its test source was changed while executing; the final fixed-files run is the acceptance evidence. Real PostgreSQL/Redis, provider/Google/Envio, private storage/worker and public-deployment gates remain open as recorded in `qa/PRODUCTION_AUDIT.md`. User guide: `docs/PRODUCT_JOURNEY.md`; global audit: `product/JOURNEY_REVIEW.md`.
