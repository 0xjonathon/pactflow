# PactFlow live deployment verification

Verified on 2026-10-09. These results cover the deployed manual acceptance workflow on Monad Testnet (chain ID 10143), not every optional verifier or a mainnet deployment.

## Deployed services

- Web: https://pactflow-lovat.vercel.app
- API: https://pactflow.43.108.33.213.sslip.io:18443
- API source/image: `df29bdd1a0079a65822aa2a2b7c5ffa963e36fb6`
- Compose resource configuration: `b48daab4be3d007b9f758121b77923a9e035cfb7`
- Vercel production deployment: `dpl_Bhy6ST8dyM7naX4EA2BXUzYGCgjM`
- Verified contract addresses: [Monad Testnet deployment record](../packages/chain/src/addresses/monad-testnet-v2.json)

The public HTTPS API health check returned `{"status":"ok"}` with normal certificate validation. TCP 18443 is enabled in the Aliyun firewall. PostgreSQL, Redis and the API container have no directly published service ports. The existing `x-ui` service remained active after deployment and resource adjustments; its firewall rules were retained.

The completed resource adjustment reported API usage of 388.4 MiB under a 512 MiB limit, ingress usage of 59.11 MiB under a 96 MiB limit, PostgreSQL usage of 30.28 MiB and Redis usage of 9.559 MiB. These are observations from one deployment check, not sustained load-test results.

## Real two-wallet workflow: PASS

The online smoke used prepared test wallets, the publicly deployed API, and real Monad Testnet transactions. Signing keys and session tokens were not included in this record.

1. Wallet signature authentication succeeded; replaying a used challenge was rejected.
2. A client published a brief, a second wallet applied, and the client selected that application.
3. The client created a V2 agreement, approved the exact token allowance and locked 1 test USDC. The builder accepted it.
4. The builder submitted private text evidence. The client requested a revision, and the builder submitted a second version.
5. Both submissions remained in the history. Anonymous access to private submission history returned HTTP 401.
6. Manual approval referenced submission 2 and its evidence hash. Onchain settlement completed and increased the builder's test-token balance by exactly 1 USDC.
7. Both participants authorized a public receipt. The finalized read model recorded settlement and completion from the same transaction.

Public receipt: https://pactflow-lovat.vercel.app/p/fe611fdc-2b9f-4a88-8693-2f4899ac8660

Agreement: `0xbd83dbde3e718f7d7b1b2788f7d1b9d63fe84ce1`

| Action           | Transaction                                                          |
| ---------------- | -------------------------------------------------------------------- |
| Create           | `0x3f4a0a346b13d657797a3d1d30c7917fa97bd3fe0cdaff0982c6d98cc11b2fa2` |
| Allowance        | `0x24b8b368b356c521ed4446af9330c22521d82b49b50a6b77ef75e1f1f18ab2a2` |
| Fund             | `0xd1f046480ddc07d3e5b3083126a7e6c4de18b11712f7f886e7113b1ba2b4fd0a` |
| Accept           | `0xfe605f930afb82841cb1689ed73b144ce9e22fd8b4bc690707282fcad95ef4a8` |
| Submission 1     | `0xf0e6b0c7602a30aa25339fe97fdfcdb1dbbde341f6a37fda0d9ea5e9a99f0939` |
| Request revision | `0x408bd8f1a7044c25062811b27042cdcfb632b269700e5ea26afb88b561b086af` |
| Submission 2     | `0x719975ca81238bb1ededa4e06f3f7c4d80d41de2fcd3e0954c786230d939213b` |
| Settle           | `0x9cb4d13bbb8dee8982bc72bfe61a12acc16e6f650d6b0e2c541a3bc86e9f6927` |

Settlement block: 69498139. Settlement timestamp: 2026-10-09T08:57:49Z. [View settlement transaction](https://testnet.monadvision.com/tx/0x9cb4d13bbb8dee8982bc72bfe61a12acc16e6f650d6b0e2c541a3bc86e9f6927).

## Checks and remaining scope

API, indexer and web type checks passed. API tests reported six passes and one database integration skip; four indexer tests passed. Changed-code lint, formatting and locale parity checks passed (847 keys in each locale). Vercel production builds succeeded. Public receipt browser checks covered English, Chinese, desktop and mobile views without captured error or warning logs. The online transaction smoke is separate from a full browser-driven wallet E2E run.

The global preview/deployment banner is removed. Homepage activity comes from real events. No marketplace seed data was deployed.

Google OAuth, AI model credentials, private file storage/scanning and custom verifier adapters are not configured on this server. Wallet authentication and manual acceptance were validated. GitHub verification is available in the capabilities response but was not exercised in this live smoke. The explicit lightweight read model uses finalized RPC events starting at block 69494631; historical V1 deployment records are preserved, but earlier events are outside this index window. See [operating instructions](LIGHTWEIGHT.md) for maintenance and recovery.
