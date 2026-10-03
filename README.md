# PactFlow

PactFlow lets clients publish work, select a worker, protect funds, verify delivery, and settle on Monad Testnet. It includes the tested protocol, typed SDK, AI verifier, offchain marketplace, and indexed work history. Real deployment evidence is tracked in [docs/TESTNET.md](docs/TESTNET.md); pending items there are not claimed as complete.

## Local setup

```sh
pnpm install
sh scripts/bootstrap-foundry.sh
pnpm contracts:abi
cd packages/contracts && forge test && cd ../..
pnpm typecheck
pnpm build
```

Copy `.env.example` to `.env.local` and fill in wallet keys locally. The file is ignored by Git. Do not put keys in terminal arguments, documentation, or the browser. Use the existing deployment record and public configuration for the current testnet protocol; no redeployment is needed.

## Monad Testnet flow

1. `pnpm preflight:testnet` checks three configured addresses, RPC chain ID, live USDC metadata, and MON/token balances. Use the [Monad faucet](https://faucet.monad.xyz) for test MON and the [Circle testnet faucet](https://faucet.circle.com/) for official Monad Testnet USDC.
2. Set `DEPLOYER_PRIVATE_KEY`, `SETTLEMENT_TOKEN_ADDRESS`, and a valid RPC in `.env.local`. Run `pnpm deploy:testnet`. It broadcasts with Foundry, checks receipts and registry links, then writes `packages/chain/src/addresses/monad-testnet.json`, public web variables in `apps/web/.env.local`, and deployment evidence to `docs/TESTNET.md`.
3. The deploy script sets `NEXT_PUBLIC_ARBITRATOR_ADDRESS` to the Deployer address. Check that this address differs from Client and Worker before creating a Pact.
4. Set funded `CLIENT_PRIVATE_KEY` and `WORKER_PRIVATE_KEY` locally. Run `pnpm smoke:testnet` for an actual create, fund, accept, submit, approve, and settlement. It asserts balances, returned bonds, and reputation, then writes transaction evidence to `docs/TESTNET.md`.
5. Start the product services below. Open the site in two browser profiles, publish a job, submit a proposal, select the worker, then confirm creation and funding.

The default chain ID, RPC, and explorer come from [Monad Testnet network information](https://docs.monad.xyz/developer-essentials/testnet).

## Validation

```sh
cd packages/contracts && forge fmt --check && forge test && cd ../..
pnpm typecheck
pnpm build
```

See [architecture](docs/ARCHITECTURE.md), [contract behavior](docs/CONTRACTS.md), and [PRD](docs/PRD.md). See [product architecture](docs/PRODUCT.md), [verification](docs/VERIFIER.md), and [pending usability study](docs/USABILITY.md).

## Run the product locally

Use Node.js and the pnpm version in `packageManager`. From the repository root:

```sh
pnpm db:migrate
pnpm marketplace:seed
pnpm --filter @pactflow/api dev
```

In a second terminal:

```sh
pnpm --filter @pactflow/web dev --port 3001
```

Open http://localhost:3001. API_PORT=3002 and WEB_ORIGIN=http://localhost:3001 belong in the root `.env.local`; NEXT_PUBLIC_API_URL=http://127.0.0.1:3002 belongs in `apps/web/.env.local`. The API refreshes the local event index automatically. Do not run separate indexer or verifier smoke processes against the same PGlite directory while the API is running. External PostgreSQL supports multiple processes.

```sh
pnpm test:product
pnpm --filter @pactflow/web test:e2e
pnpm smoke:marketplace:testnet
```

Real smoke commands use funded test wallets and perform real testnet transfers. Envio generated configuration and handlers are in `indexer`; its hosted runtime requires a valid ENVIO_API_TOKEN and runtime setup. RPC indexing remains available for local development.
