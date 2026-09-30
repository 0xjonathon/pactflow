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

1. `pnpm wallets:check` checks configured addresses and MON/token balances. Use the [official faucet](https://faucet.monad.xyz) for test MON and the [official token list](https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json) for settlement token information.
2. Set `DEPLOYER_PRIVATE_KEY`, `SETTLEMENT_TOKEN_ADDRESS`, and a valid RPC in `.env.local`. Run `pnpm deploy:testnet`. It broadcasts with Foundry, checks receipts and registry links, then writes `packages/chain/src/addresses/monad-testnet.json` and deployment evidence to `docs/TESTNET.md`.
3. Copy recorded contract addresses into the matching `NEXT_PUBLIC_` fields in `.env.local`. Set `NEXT_PUBLIC_ARBITRATOR_ADDRESS` to a third address distinct from client and worker.
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
