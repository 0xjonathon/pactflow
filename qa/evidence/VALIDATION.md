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
