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

## Phase 3 verifier registration

The existing Deployer test wallet is the AI verifier signer for this testnet iteration, as requested by the project owner. It is a test-only wallet previously exposed during development. No verifier key is committed or exposed to the browser. A scan of local Git history found no committed key assignment, but the wallet must still be treated as exposed.

- Verifier: [0xdf7890548Fe3DaE6a57ef3464f27bee39f0c3188](https://testnet.monadvision.com/address/0xdf7890548Fe3DaE6a57ef3464f27bee39f0c3188)
- Registration TX: [0x2602ff1c9023c24ad09e7f8b442604e7a5134a5465254b236f0eda3a769b1675](https://testnet.monadvision.com/tx/0x2602ff1c9023c24ad09e7f8b442604e7a5134a5465254b236f0eda3a769b1675)
- Block: 67013423
- Metadata hash: `0xfc54fab6074b8ea0366cb89b0dbc7b3e70e98921366db151cdef1cf9dc34736e`

Phase 3 Hybrid, AIOnly, and FAIL smoke transactions are recorded below. Registration alone did not establish Phase 3 completion.

## Phase 3 real verifier smoke

Fixtures were served by a local HTTP server with an explicit test-only localhost allowance. Protocol transactions, attestations, settlement, balances, and reputation were read from Monad Testnet.

### HYBRID PASS

- Pact / Escrow: [0x30b4923d8b9D5CB41F83F41c8087D103D3AB9Bc2](https://testnet.monadvision.com/address/0x30b4923d8b9D5CB41F83F41c8087D103D3AB9Bc2)
- Create: [0xa3a8433ccec6986088f65ba5b8db00e1623727e5a9f417b6ef7996ca07e2d816](https://testnet.monadvision.com/tx/0xa3a8433ccec6986088f65ba5b8db00e1623727e5a9f417b6ef7996ca07e2d816)
- Fund: [0xc90da79ce89d24dc7fd0167341a88f03a0dab5b083efb37a0e00f8fca67180f2](https://testnet.monadvision.com/tx/0xc90da79ce89d24dc7fd0167341a88f03a0dab5b083efb37a0e00f8fca67180f2)
- Accept: [0xcafc1150c3e6bb7a87df13d62ec926ee2f910b913aa0258b2e4535d6898aa833](https://testnet.monadvision.com/tx/0xcafc1150c3e6bb7a87df13d62ec926ee2f910b913aa0258b2e4535d6898aa833)
- Submit: [0xc2f6cc38ed47e1eacaa434b54ad2dfb3b107242903cc09f315115dd7ce2e9cea](https://testnet.monadvision.com/tx/0xc2f6cc38ed47e1eacaa434b54ad2dfb3b107242903cc09f315115dd7ce2e9cea)
- Score: 100
- Report hash: 0xfd49e5ef6fb1a65803626f2907d9b98d8091d3a3e2d622b48952df21cb0c2495
- Verification TX: [0x870b807e4b7cef65448f6c413eb557ead250b760c6d8d7ec42866edfae7f210e](https://testnet.monadvision.com/tx/0x870b807e4b7cef65448f6c413eb557ead250b760c6d8d7ec42866edfae7f210e)
- Settlement TX: [0xaf4f5b7a9526378fd8945e97cfdbf8904b49d82de02c3cc7a0e98473ce27ec24](https://testnet.monadvision.com/tx/0xaf4f5b7a9526378fd8945e97cfdbf8904b49d82de02c3cc7a0e98473ce27ec24)
- Worker USDC: 26 → 27
- Released budget: 0 → 1
- Worker completed Pacts: 2 → 3

### AI ONLY PASS

- Pact / Escrow: [0x58849f2aB620e170464c9e84D3Aa258714DDA45e](https://testnet.monadvision.com/address/0x58849f2aB620e170464c9e84D3Aa258714DDA45e)
- Create: [0x4bd2de628c71823f07e38f170341c5caeedf1eb8fe31f8782daa0007249dac25](https://testnet.monadvision.com/tx/0x4bd2de628c71823f07e38f170341c5caeedf1eb8fe31f8782daa0007249dac25)
- Fund: [0xf174b42cc5b168c6b04a4721c5551f47c4f29deaed8884de7746ad683261879e](https://testnet.monadvision.com/tx/0xf174b42cc5b168c6b04a4721c5551f47c4f29deaed8884de7746ad683261879e)
- Accept: [0x621575011c0d2bcef80dc08af2a5205855b04acfce2bac913e0b94b0d0bbf6bf](https://testnet.monadvision.com/tx/0x621575011c0d2bcef80dc08af2a5205855b04acfce2bac913e0b94b0d0bbf6bf)
- Submit: [0x000b8859195f1e9448a4a84e6a045650ad9d9858a1cba76affbd9bc6296fc3ab](https://testnet.monadvision.com/tx/0x000b8859195f1e9448a4a84e6a045650ad9d9858a1cba76affbd9bc6296fc3ab)
- Score: 100
- Report hash: 0x3b6425a86e0dc3d6d349d03813a0170801fca9c9c7677ea2c872fe5cb7a7cdc4
- Verification TX: [0xae76b2bbb11799528ec6ee3d9f09672f7a39f08605cb9f78f5aab9e3869ebf66](https://testnet.monadvision.com/tx/0xae76b2bbb11799528ec6ee3d9f09672f7a39f08605cb9f78f5aab9e3869ebf66)
- Settlement TX: [0xae76b2bbb11799528ec6ee3d9f09672f7a39f08605cb9f78f5aab9e3869ebf66](https://testnet.monadvision.com/tx/0xae76b2bbb11799528ec6ee3d9f09672f7a39f08605cb9f78f5aab9e3869ebf66)
- Worker USDC: 27 → 28
- Released budget: 0 → 1
- Worker completed Pacts: 3 → 4

### FAIL CASE

- Pact / Escrow: [0x9A8E4E1f67594096D1001759cd759f7699E66A5F](https://testnet.monadvision.com/address/0x9A8E4E1f67594096D1001759cd759f7699E66A5F)
- Create: [0xcf0a190a3a367ec862624d83a90e6baa775abbf6bb9b128746c66a757b76c887](https://testnet.monadvision.com/tx/0xcf0a190a3a367ec862624d83a90e6baa775abbf6bb9b128746c66a757b76c887)
- Fund: [0x193a44deaf32271621065a62c25e99a9d78985c15eb119901759ab3bca556fd9](https://testnet.monadvision.com/tx/0x193a44deaf32271621065a62c25e99a9d78985c15eb119901759ab3bca556fd9)
- Accept: [0x9e3ff6cb0b3109346e4e1a2a61fa4cef174fb044ade7d30b49602f52a11b4ef3](https://testnet.monadvision.com/tx/0x9e3ff6cb0b3109346e4e1a2a61fa4cef174fb044ade7d30b49602f52a11b4ef3)
- Submit: [0x40bef5c75948e578d0e914c312c93b2e5bff45380bef4598480cd099e510926f](https://testnet.monadvision.com/tx/0x40bef5c75948e578d0e914c312c93b2e5bff45380bef4598480cd099e510926f)
- Score: 25
- Report hash: 0x4572e04b4e02147f400f2c60d82e16d696fb1dffc7fe956343c49b79f1edf11c
- Worker USDC: 28 → 27.8
- Released budget: 0 → 0
- Worker completed Pacts: 4 → 4
- Worker balance immediately before and after verification: 27.8 → 27.8 USDC. The earlier 0.2 decrease is the Worker bond locked at acceptance, not a payout.
- Escrow remains funded with 1.4 USDC (1 budget + 0.2 Client bond + 0.2 Worker bond). No attestation or settlement transaction was sent.

## Real smoke test

- Pact ID: 0xFF80eD0c61506478F5b979cB118053b25A215404
- Escrow: [0xFF80eD0c61506478F5b979cB118053b25A215404](https://testnet.monadvision.com/address/0xFF80eD0c61506478F5b979cB118053b25A215404)
- Create TX: [0xebd8f6180a5a9ffa24d8ce9416e976b996aded19b3f69658d3d386de72a6b5ba](https://testnet.monadvision.com/tx/0xebd8f6180a5a9ffa24d8ce9416e976b996aded19b3f69658d3d386de72a6b5ba)
- Client token approval TX: [0x33b12853ea0161ce23f9930b022229239c0c8420bb13a412f262572042008cda](https://testnet.monadvision.com/tx/0x33b12853ea0161ce23f9930b022229239c0c8420bb13a412f262572042008cda)
- Fund TX: [0xe34697fffb32d62464cb13ee5800ef44eb0f4eed427df187238f3fedaa5a9e62](https://testnet.monadvision.com/tx/0xe34697fffb32d62464cb13ee5800ef44eb0f4eed427df187238f3fedaa5a9e62)
- Worker token approval TX: [0x61fea0cf8c1d73bba71e88fcbc0f339243680ae100a412f51f84f8fd640eb010](https://testnet.monadvision.com/tx/0x61fea0cf8c1d73bba71e88fcbc0f339243680ae100a412f51f84f8fd640eb010)
- Accept TX: [0x0e00ce893f2577c06612d483d15391280ce73702f53a5a47596ce17124b3e8b9](https://testnet.monadvision.com/tx/0x0e00ce893f2577c06612d483d15391280ce73702f53a5a47596ce17124b3e8b9)
- Submit TX: [0x997261968a9a021436b4c1a9bac44e357f393e88b015ba0a99f86177dfea0f4d](https://testnet.monadvision.com/tx/0x997261968a9a021436b4c1a9bac44e357f393e88b015ba0a99f86177dfea0f4d)
- Settlement TX: [0x510288d75c08bc1c480c846ceffdb77edee0750ed8f3232d84998e2d4d48374a](https://testnet.monadvision.com/tx/0x510288d75c08bc1c480c846ceffdb77edee0750ed8f3232d84998e2d4d48374a)
- Agreement hash: 0x3949a7a88f0eea568e48f5291fe00a5e87539995d108ee988bbde3a0e32fd5b0
- Worker USDC before: 27.8
- Before settlement — Client: 24.8, Worker: 26.8, Escrow: 7
- Worker USDC after: 32.8
- After settlement — Client: 25.8, Worker: 32.8, Escrow: 0
- Worker difference: 5
- Fee basis points at Pact creation: 0
- Final Pact status: Completed; milestone: Paid; funded: 5; released: 5
- Worker completed pacts: 4 → 5
- Worker settled milestones: 4 → 5
- Worker earned (gross raw units): 8000000 → 13000000
- Client completed pacts: 4 → 5

## Phase 4 Marketplace real E2E

- Job: 9b0ec89d-020d-490e-8755-dbb2d15d949c
- Proposal: ad869f2f-9230-421b-b0b6-2ec5cbbe600f
- Pact / Escrow: 0x23f57CFa05Cec861d934ee75f16F92A0E419ea9c
- Create: [0x82279ac5ad4db77167625cc6ee287b37e11bdfbe1a2b2f221321303c2d11ab42](https://testnet.monadvision.com/tx/0x82279ac5ad4db77167625cc6ee287b37e11bdfbe1a2b2f221321303c2d11ab42)
- Fund: [0xa1d739f24e9e33de044264ec5fe8341bc65881f40bf7991756702827759aa487](https://testnet.monadvision.com/tx/0xa1d739f24e9e33de044264ec5fe8341bc65881f40bf7991756702827759aa487)
- Accept: [0xe096df83d7f8ac92abb54c1b9963e90ff10cc40cb604480260e22df41216a3ab](https://testnet.monadvision.com/tx/0xe096df83d7f8ac92abb54c1b9963e90ff10cc40cb604480260e22df41216a3ab)
- Submit: [0x03464ba81d5112a90fd014c2f05b516eef2e99e176dfea5444beaf80af1943ea](https://testnet.monadvision.com/tx/0x03464ba81d5112a90fd014c2f05b516eef2e99e176dfea5444beaf80af1943ea)
- Settlement: [0xaa914588db9932c2d4a2de70218eced06e2f58e92e977b7226328670265753ed](https://testnet.monadvision.com/tx/0xaa914588db9932c2d4a2de70218eced06e2f58e92e977b7226328670265753ed)
- Final status: Completed; budget released: 1 USDC; both deposits returned.

## Real smoke test

- Pact ID: 0xf7Ec5B53A8f3C0af0C6bD9854de4aF5762722a83
- Escrow: [0xf7Ec5B53A8f3C0af0C6bD9854de4aF5762722a83](https://testnet.monadvision.com/address/0xf7Ec5B53A8f3C0af0C6bD9854de4aF5762722a83)
- Create TX: [0x6f2da95fc77c27fc5d7a253d20c38a32c8f7def762d3507150c28e07b0e7c2d7](https://testnet.monadvision.com/tx/0x6f2da95fc77c27fc5d7a253d20c38a32c8f7def762d3507150c28e07b0e7c2d7)
- Client token approval TX: [0x53770480d8dd5dbaa2c82223f656412b7dfe625dc2c10a75272133c78e0cdcc5](https://testnet.monadvision.com/tx/0x53770480d8dd5dbaa2c82223f656412b7dfe625dc2c10a75272133c78e0cdcc5)
- Fund TX: [0x47be43a232e87c40d070077ae8edb4522edf222ae1decbd6ab7cec3e973458c4](https://testnet.monadvision.com/tx/0x47be43a232e87c40d070077ae8edb4522edf222ae1decbd6ab7cec3e973458c4)
- Worker token approval TX: [0xb969f3d7eaca820fea2c05083c5d4038697f64f55891eb16f0f38f884519aea2](https://testnet.monadvision.com/tx/0xb969f3d7eaca820fea2c05083c5d4038697f64f55891eb16f0f38f884519aea2)
- Accept TX: [0x5a35e8b83203bc90087af3ae5c65b857dd1d1927a09d8f3df53d96a7a92f447f](https://testnet.monadvision.com/tx/0x5a35e8b83203bc90087af3ae5c65b857dd1d1927a09d8f3df53d96a7a92f447f)
- Submit TX: [0xbb82712f19fb3602e01e8c002c491b2e4a73c86f3a08574e2d4eee9919c2824a](https://testnet.monadvision.com/tx/0xbb82712f19fb3602e01e8c002c491b2e4a73c86f3a08574e2d4eee9919c2824a)
- Settlement TX: [0xe5c1f26a27aa566f47c43bd16c8fef167b474327f3029fe133cc926ff831d8ea](https://testnet.monadvision.com/tx/0xe5c1f26a27aa566f47c43bd16c8fef167b474327f3029fe133cc926ff831d8ea)
- Agreement hash: 0x3949a7a88f0eea568e48f5291fe00a5e87539995d108ee988bbde3a0e32fd5b0
- Worker USDC before: 33.8
- Before settlement — Client: 18.8, Worker: 32.8, Escrow: 7
- Worker USDC after: 38.8
- After settlement — Client: 19.8, Worker: 38.8, Escrow: 0
- Worker difference: 5
- Fee basis points at Pact creation: 0
- Final Pact status: Completed; milestone: Paid; funded: 5; released: 5
- Worker completed pacts: 6 → 7
- Worker settled milestones: 6 → 7
- Worker earned (gross raw units): 14000000 → 19000000
- Client completed pacts: 6 → 7

## Phase 3 real verifier smoke

Fixtures were served by a local HTTP server with an explicit test-only localhost allowance. Protocol transactions, attestations, settlement, balances, and reputation were read from Monad Testnet.

### HYBRID PASS

- Pact / Escrow: [0xBCB96DeDC2255AcFC58f665a4c7104AB79237e31](https://testnet.monadvision.com/address/0xBCB96DeDC2255AcFC58f665a4c7104AB79237e31)
- Create: [0xc3df6485bb67867a4f6814cbb58e20f37ca81af4c808d1fe8a3ecd044b8f3d4b](https://testnet.monadvision.com/tx/0xc3df6485bb67867a4f6814cbb58e20f37ca81af4c808d1fe8a3ecd044b8f3d4b)
- Fund: [0x4fceb3619a5a39cf4b0146ddeaaa4cb80e5dd050b9523b84f543a551e45836eb](https://testnet.monadvision.com/tx/0x4fceb3619a5a39cf4b0146ddeaaa4cb80e5dd050b9523b84f543a551e45836eb)
- Accept: [0x52f8192929e7b280b6628198f6d62b1fe3623368b2545b55f005fd3599da0e09](https://testnet.monadvision.com/tx/0x52f8192929e7b280b6628198f6d62b1fe3623368b2545b55f005fd3599da0e09)
- Submit: [0x5338b15f7d80712f7c63f38f144cf80144cc2f2a5d824044e90cac7dc6d791a6](https://testnet.monadvision.com/tx/0x5338b15f7d80712f7c63f38f144cf80144cc2f2a5d824044e90cac7dc6d791a6)
- Score: 100
- Report hash: 0x8503408459aa20f3ac99cd3a0c36fe0de636b55add28e2a160e310b1e3e4153e
- Verification TX: [0xe8755c68940f58a3f03183bc728b96d9b3563490a11201ec924ba0996a112bde](https://testnet.monadvision.com/tx/0xe8755c68940f58a3f03183bc728b96d9b3563490a11201ec924ba0996a112bde)
- Settlement TX: [0x1bdb0190fa8a55b8202350700e26107575384073a0cbf37ef42b2f881d77bda9](https://testnet.monadvision.com/tx/0x1bdb0190fa8a55b8202350700e26107575384073a0cbf37ef42b2f881d77bda9)
- Worker USDC before Pact: 38.8
- Worker USDC before / after verification: 38.6 → 39.8
- Released budget: 0 → 1
- Worker completed Pacts: 7 → 8

### AI ONLY PASS

- Pact / Escrow: [0xc5f6A110B8acccfD332D11Db88800eA762673c59](https://testnet.monadvision.com/address/0xc5f6A110B8acccfD332D11Db88800eA762673c59)
- Create: [0x8475ad7ea877a7009db3486dacf88fd4316f13d7fbd1d9cddae8e0f08ea59456](https://testnet.monadvision.com/tx/0x8475ad7ea877a7009db3486dacf88fd4316f13d7fbd1d9cddae8e0f08ea59456)
- Fund: [0x89264c0dc51eeb84352f05ab3296faa5c4652241ed0d64e04b2cea8babade266](https://testnet.monadvision.com/tx/0x89264c0dc51eeb84352f05ab3296faa5c4652241ed0d64e04b2cea8babade266)
- Accept: [0xa547e83b6faaca89b6139a7efebab6e0f5e8d71f852777b6df30e5c540b61dd2](https://testnet.monadvision.com/tx/0xa547e83b6faaca89b6139a7efebab6e0f5e8d71f852777b6df30e5c540b61dd2)
- Submit: [0x9f8b5dba06e4861ca0f51abc89cbb4600c53aab38d79a6eecf02d8f6cf3638b6](https://testnet.monadvision.com/tx/0x9f8b5dba06e4861ca0f51abc89cbb4600c53aab38d79a6eecf02d8f6cf3638b6)
- Score: 100
- Report hash: 0x4228638eada85398b30ee5ce7638ee53d102c1bd8c9d338f580c9a4a612b0b02
- Verification TX: [0x57b5fe1f1b1c7770563b2cba3c800f2fc90751a95de478282c807161eaf9206e](https://testnet.monadvision.com/tx/0x57b5fe1f1b1c7770563b2cba3c800f2fc90751a95de478282c807161eaf9206e)
- Settlement TX: [0x57b5fe1f1b1c7770563b2cba3c800f2fc90751a95de478282c807161eaf9206e](https://testnet.monadvision.com/tx/0x57b5fe1f1b1c7770563b2cba3c800f2fc90751a95de478282c807161eaf9206e)
- Worker USDC before Pact: 39.8
- Worker USDC before / after verification: 39.6 → 40.8
- Released budget: 0 → 1
- Worker completed Pacts: 8 → 9

### FAIL CASE

- Pact / Escrow: [0xD061a920749D199b88E27C54E0b78038192a44d1](https://testnet.monadvision.com/address/0xD061a920749D199b88E27C54E0b78038192a44d1)
- Create: [0xd2aa50cd85f644676dfd5a03e22fa931caa17673ba4a6eb682da38aa96436f97](https://testnet.monadvision.com/tx/0xd2aa50cd85f644676dfd5a03e22fa931caa17673ba4a6eb682da38aa96436f97)
- Fund: [0x7eb871cc5a42681f2c3402950fbd0f504560a133c7e5de92042ba5828758a702](https://testnet.monadvision.com/tx/0x7eb871cc5a42681f2c3402950fbd0f504560a133c7e5de92042ba5828758a702)
- Accept: [0xfdf54868cf370178a7cdae875da0225b2d2e1fe21ebc3217e3c4a3c5c6849684](https://testnet.monadvision.com/tx/0xfdf54868cf370178a7cdae875da0225b2d2e1fe21ebc3217e3c4a3c5c6849684)
- Submit: [0xf7e5de6d293b89d61d679a53c51578fa2c7358ddde4e65c1f0deb2fc5d1e68ef](https://testnet.monadvision.com/tx/0xf7e5de6d293b89d61d679a53c51578fa2c7358ddde4e65c1f0deb2fc5d1e68ef)
- Score: 25
- Report hash: 0x7212ca55de92ee67e61dce7cb850e2db503de4f244d324363d82bf43e030d412
- Worker USDC before Pact: 40.8
- Worker USDC before / after verification: 40.6 → 40.6
- Released budget: 0 → 0
- Worker completed Pacts: 9 → 9

## Phase 4 indexed product evidence

Local finalized RPC indexing on 2026-10-01 processed 11 factory-created Pacts and 72 events through block 67129117. Homepage statistics from persisted events: 9 completed Pacts, 21 USDC gross settled volume, 4 consumed AI attestations. Worker indexed history: 9 successful milestones, 4 AI-verified and 7 human-verified milestones (Hybrid counts in both), 0 disputes, and 9 completed collaborations with the same client. This is testnet activity by test participants, not production adoption.

The event source key is chainId + transaction hash + log index. Duplicate persistence and aggregation tests pass. Envio code generation succeeds; hosted/local HyperIndex runtime and its GraphQL bridge remain pending environment setup. Current real product data is populated using the finalized RPC fallback.
