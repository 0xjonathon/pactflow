# PactFlow

PactFlow is a milestone based ERC20 escrow protocol. Phase 1 includes four Solidity contracts and Foundry tests. Phase 2 adds a Monad Testnet SDK, deployment and smoke scripts, and a minimal two wallet web flow. Real deployment evidence is tracked in [docs/TESTNET.md](docs/TESTNET.md); pending items there are not claimed as complete.

## Local setup

```sh
pnpm install
sh scripts/bootstrap-foundry.sh
pnpm contracts:abi
cd packages/contracts && forge test && cd ../..
pnpm typecheck
pnpm build
```

Copy `.env.example` to `.env.local` and fill in wallet keys locally. The file is ignored by Git. Do not put keys in terminal arguments, documentation, or the browser. Contract addresses remain blank until a real deployment.

## Monad Testnet flow

1. `pnpm preflight:testnet` checks three configured addresses, RPC chain ID, live USDC metadata, and MON/token balances. Use the [Monad faucet](https://faucet.monad.xyz) for test MON and the [Circle testnet faucet](https://faucet.circle.com/) for official Monad Testnet USDC.
2. Set `DEPLOYER_PRIVATE_KEY`, `SETTLEMENT_TOKEN_ADDRESS`, and a valid RPC in `.env.local`. Run `pnpm deploy:testnet`. It broadcasts with Foundry, checks receipts and registry links, then writes `packages/chain/src/addresses/monad-testnet.json`, public web variables in `apps/web/.env.local`, and deployment evidence to `docs/TESTNET.md`.
3. The deploy script sets `NEXT_PUBLIC_ARBITRATOR_ADDRESS` to the Deployer address. Check that this address differs from Client and Worker before creating a Pact.
4. Set funded `CLIENT_PRIVATE_KEY` and `WORKER_PRIVATE_KEY` locally. Run `pnpm smoke:testnet` for an actual create, fund, accept, submit, approve, and settlement. It asserts balances, returned bonds, and reputation, then writes transaction evidence to `docs/TESTNET.md`.
5. Run `pnpm dev` and open `/` in two browser profiles with two injected wallets. Share the Pact link from `/pacts/new` to the worker profile and follow the transaction timeline.

The default chain ID, RPC, and explorer come from [Monad Testnet network information](https://docs.monad.xyz/developer-essentials/testnet).

## Validation

```sh
cd packages/contracts && forge fmt --check && forge test && cd ../..
pnpm typecheck
pnpm build
```

See [architecture](docs/ARCHITECTURE.md), [contract behavior](docs/CONTRACTS.md), and [PRD](docs/PRD.md). The API, verifier, and indexer remain later phase skeletons.
