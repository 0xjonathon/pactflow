# Monad Testnet Deployment

Network: Monad Testnet
Chain ID: 10143
Deployed at: 2026-09-30T12:52:32.000Z
Settlement: official Testnet USDC (`0x534b2f3A21130d7a60830c2Df862319e593943A3`, 6 decimals)

## Contracts

- VerifierRegistry: [0x9d8bf04dc4eab73de1df0ffc6f87ff66d4748835](https://testnet.monadvision.com/address/0x9d8bf04dc4eab73de1df0ffc6f87ff66d4748835) · [tx](https://testnet.monadvision.com/tx/0xc52ae1b1d33cc35f5a84c8e0d7a51f5ece3efec6635f90504ab3371b9599de6a) · block 66976177
- ReputationRegistry: [0xd8faa6cd67161c67f69bd47909a1225c82e242a3](https://testnet.monadvision.com/address/0xd8faa6cd67161c67f69bd47909a1225c82e242a3) · [tx](https://testnet.monadvision.com/tx/0x7f5b1622325784f2c8ebfdf7b4ae22980600065c0c6df5671c7dafd60cb43f6e) · block 66976186
- PactFactory: [0xb9d75193df4ab985e5c2a5a1b0e332946d405d1a](https://testnet.monadvision.com/address/0xb9d75193df4ab985e5c2a5a1b0e332946d405d1a) · [tx](https://testnet.monadvision.com/tx/0x65937b27dde041c984a9de9b3a346acca0a7d35bbac87fef0d9325f02dddb3b6) · block 66976195
- PactEscrow implementation: [0x12028aC76b4769Cc489BeFCbd6ded8E61a8E6225](https://testnet.monadvision.com/address/0x12028aC76b4769Cc489BeFCbd6ded8E61a8E6225)
- Settlement token: [0x534b2f3A21130d7a60830c2Df862319e593943A3](https://testnet.monadvision.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3)

## Genesis Pact

Client: `0x6677BcF814D7c23A4aFd565691c6b24494BF5e9a`.
Worker: `0x786e6F51E928286D35084129f359c6fEa391357E`.
Budget: 5 USDC.
Client Bond: 1 USDC.
Worker Bond: 1 USDC.
Verification: ClientOnly.
Protocol fee: 0%

## Transactions and smoke test

- Pact ID: 0xc81d11742de5d947992fc9006DC358FB9D7f8707
- Escrow: [0xc81d11742de5d947992fc9006DC358FB9D7f8707](https://testnet.monadvision.com/address/0xc81d11742de5d947992fc9006DC358FB9D7f8707)
- Create TX: [0xf68d26929b7e916b4caba029b6c88cd386cb7b474b1da629fd4f73851195ac83](https://testnet.monadvision.com/tx/0xf68d26929b7e916b4caba029b6c88cd386cb7b474b1da629fd4f73851195ac83)
- Client token approval TX: [0x93a54a3d4684704930fdd37b76229e04f2e37ce01c620312d4efd8bcc3b59d91](https://testnet.monadvision.com/tx/0x93a54a3d4684704930fdd37b76229e04f2e37ce01c620312d4efd8bcc3b59d91)
- Fund TX: [0x551f082b8e569179ee4be694227199028d344de3c278b6c665db5a04c8736ed5](https://testnet.monadvision.com/tx/0x551f082b8e569179ee4be694227199028d344de3c278b6c665db5a04c8736ed5)
- Worker token approval TX: [0x547cc450057f0933932b75f34f72ae19549442e6cc723ee7db5b85e56e7b1a25](https://testnet.monadvision.com/tx/0x547cc450057f0933932b75f34f72ae19549442e6cc723ee7db5b85e56e7b1a25)
- Accept TX: [0x1371bdf41505cc4841345ce5e70e1b40aade83b128232517fc03986039b33bed](https://testnet.monadvision.com/tx/0x1371bdf41505cc4841345ce5e70e1b40aade83b128232517fc03986039b33bed)
- Submit TX: [0x9e27392c78216f86742155dc9a5ca174c357dcd615d8d653b206e8877dca97eb](https://testnet.monadvision.com/tx/0x9e27392c78216f86742155dc9a5ca174c357dcd615d8d653b206e8877dca97eb)
- Settlement TX: [0x25046d2746859220db81f9e07a9131c9c436963931efc125ed823d541bba3455](https://testnet.monadvision.com/tx/0x25046d2746859220db81f9e07a9131c9c436963931efc125ed823d541bba3455)
- Agreement hash: 0x3949a7a88f0eea568e48f5291fe00a5e87539995d108ee988bbde3a0e32fd5b0
- Worker USDC before: 20
- Before settlement — Client: 34, Worker: 19, Escrow: 7
- Worker USDC after: 25
- After settlement — Client: 35, Worker: 25, Escrow: 0
- Worker difference: 5
- Fee basis points at Pact creation: 0
- Final Pact status: Completed; milestone: Paid; funded: 5; released: 5
- Worker completed pacts: 0 → 1
- Worker settled milestones: 0 → 1
- Worker earned (gross raw units): 0 → 5000000
- Client completed pacts: 0 → 1


## Browser wallet walkthrough

Completed in Chrome with the original Client and Worker MetaMask wallets on 2026-09-30. The Pact page was refreshed between wallet switches and read its state from Monad Testnet.

- Pact ID / Escrow: [0x3b3b08d1f90FbC1F50FeeB52ad011f4056B6aFE6](https://testnet.monadvision.com/address/0x3b3b08d1f90FbC1F50FeeB52ad011f4056B6aFE6)
- Client: `0x6677BcF814D7c23A4aFd565691c6b24494BF5e9a`
- Worker: `0x786e6F51E928286D35084129f359c6fEa391357E`
- Budget: 1 USDC; Client bond: 0.1 USDC; Worker bond: 0.1 USDC
- Agreement hash: `0x4cea8b6735e197e2bd1af0e9c9a9c4d607cd563eb4fb33d62a4cd1970dd96f66`
- Create: [0x957b3a9a17d7d65dceb367e69c086d23cfa26943143711155fa8a8eef14e5e20](https://testnet.monadvision.com/tx/0x957b3a9a17d7d65dceb367e69c086d23cfa26943143711155fa8a8eef14e5e20) · block 66988508
- Client USDC approval: [0x15a9dcbc2193f284fedea45b679adddfd70e8c15e11ed13b35d783d47d3c82ae](https://testnet.monadvision.com/tx/0x15a9dcbc2193f284fedea45b679adddfd70e8c15e11ed13b35d783d47d3c82ae) · block 66988776
- Fund: [0xff67d7d24af46f1cd363f669baa0a9a865ec72322b182116ca22a9d32b50f452](https://testnet.monadvision.com/tx/0xff67d7d24af46f1cd363f669baa0a9a865ec72322b182116ca22a9d32b50f452) · block 66988820
- Worker USDC approval: [0xe2623e1d3c1b45c80852f232eb4726eeb7af679937fc0fbb3a0f8f6a7cf75168](https://testnet.monadvision.com/tx/0xe2623e1d3c1b45c80852f232eb4726eeb7af679937fc0fbb3a0f8f6a7cf75168) · block 66989121
- Accept: [0xf4c89bc572a90f14bd08d5231490b26c30b641e1d86dda969173fca32ef362e2](https://testnet.monadvision.com/tx/0xf4c89bc572a90f14bd08d5231490b26c30b641e1d86dda969173fca32ef362e2) · block 66989165
- Submit: [0xc3b9818541d823be6e86517c3feb8fda6d266bce8104669edb57d76c002af602](https://testnet.monadvision.com/tx/0xc3b9818541d823be6e86517c3feb8fda6d266bce8104669edb57d76c002af602) · block 66989283
- Approve and settle: [0xf2941ceaecb4dd443d77db48fdd2c0907bc849110181e6a5d82c3a0e6dca882a](https://testnet.monadvision.com/tx/0xf2941ceaecb4dd443d77db48fdd2c0907bc849110181e6a5d82c3a0e6dca882a) · block 66989656
- Final page: `COMPLETED`, milestone `PAID`, released 1 USDC, Client and Worker bond remaining 0.
- Worker USDC balance: 25 before → 26 after; difference +1 USDC.
- Onchain reputation: Client completed Pacts 1 → 2; Worker completed Pacts 1 → 2, settled milestones 1 → 2, gross settled volume 5 → 6 USDC.

The plain address URL `/pacts/0x3b3b08d1f90FbC1F50FeeB52ad011f4056B6aFE6` shows the onchain Pact after refresh. The full link copied on creation also carries the canonical agreement metadata, which the page verifies against its onchain hash.

## Source verification

Foundry `forge verify-contract --root . --chain 10143 --verifier sourcify --watch <address> <source:contract>` returned `exact_match` for all four contracts:

- [PactFactory verification job](https://sourcify.dev/server/verify-ui/jobs/0462d22e-26d5-4c65-bb33-1cc5e4fae539)
- [PactEscrow implementation verification job](https://sourcify.dev/server/verify-ui/jobs/7216047d-d32e-4edc-8ae2-e58c35b14da1)
- [ReputationRegistry verification job](https://sourcify.dev/server/verify-ui/jobs/51628460-147a-451e-8272-d00f75dbee97)
- [VerifierRegistry verification job](https://sourcify.dev/server/verify-ui/jobs/a065246d-0d01-4e10-b728-914f01b03214)

## Validation

- `forge fmt --check`: passed in `packages/contracts`.
- `forge test`: 12 behavior tests and 4 invariants passed (128 runs / 4096 calls).
- `pnpm typecheck`: passed across all workspaces.
- `pnpm build`: passed; Next.js reported optional wagmi connector resolution warnings for connectors unused by the injected wallet flow.
- `pnpm smoke:testnet`: PASS on the Genesis Pact above, including token and bond balance assertions and reputation updates.
- Chrome + MetaMask: real Client and Worker wallet flow completed on the Browser Pact above.
