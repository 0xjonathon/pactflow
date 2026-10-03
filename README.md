# PactFlow 2.0

Agreement → Escrow → Evidence → Verification → Settlement → Reputation.

Independent rebuild on `codex/pactflow-2.0`, preserving the original Git history and working sources. V1 contracts and deployment records remain available; new revision-capable Pacts use separately configured V2 contracts. This project has passed local chain acceptance, but public deployment and production service acceptance remain blocked. See [production audit](qa/PRODUCTION_AUDIT.md).

## Local acceptance

Use Node 24, pnpm 11.25.0 and Monad Foundry. Install with `corepack pnpm install --frozen-lockfile`; run `sh scripts/bootstrap-foundry.sh` for the pinned contract test library.

Start Anvil in its own terminal:

```sh
anvil --host 127.0.0.1 --port 8547 --chain-id 10143 --block-time 1
```

Then from this independent directory:

```sh
corepack pnpm local:deploy
corepack pnpm local:services
```

Open http://localhost:3011. The helper uses a new private local database and generated test wallets, deploys V2 only on loopback Anvil and mints valueless test tokens. Generated `.local` files contain private keys and must never be uploaded or reused publicly. Browser tests inject signing through their Node process; keys do not enter browser code.

In another terminal:

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm test:contracts
corepack pnpm test:e2e:local
```

Production build: stop local Next dev before `corepack pnpm build`. Real PostgreSQL/Redis integration tests run only with `TEST_DATABASE_URL` / `TEST_REDIS_URL` pointing at dedicated loopback test services; skipped tests are not passes. CI provisions both services and runs local-chain browser acceptance without public-chain broadcasting.

## Production and protocol

[Linux Compose setup](deploy/README.md) covers PostgreSQL, Redis, private objects/scanner, separate worker, Envio and TLS, backups and restore checks. Public V2 deployment is an explicit operator command (`deploy:v2:testnet`) using funded local credentials; it validates and records fresh contracts without replacing V1. Do not run it as a local or CI prerequisite.

Read [product source of truth](product/PRODUCT.md), [dependency graph](product/P0_DEPENDENCIES.md), [state machine](specs/pact-state-machine.md), [API contract](specs/api-contracts.md), [acceptance matrix](qa/E2E_MATRIX.md) and [judge demonstration](qa/JUDGE_DEMO.md). Original V1 instructions are retained in [README-V1](docs/README-V1.md).
