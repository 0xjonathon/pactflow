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
