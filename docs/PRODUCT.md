# Phase 4 product surface

Jobs and proposals are offchain PostgreSQL records. Job states are DRAFT, OPEN, MATCHED, CLOSED, CANCELLED. Proposal states are PENDING, ACCEPTED, REJECTED, WITHDRAWN. Publishing a job does not create an escrow or lock funds. Selection generates a draft; the client reviews it and confirms real creation, token allowance, and funding. The worker accepts onchain separately. A locked badge requires a real indexed funded Pact that is not completed or cancelled.

Public routes: /, /discover, /jobs/new, /jobs/:id, /jobs/:id/collaborate, /talent, /u/:handle, /reputation, /app, /onboarding, /notifications, /pacts/:escrow, /verifications/:id. Technical fields are in collapsed Advanced / Onchain Details. The landing animation is clearly labelled illustrative. Eight demo jobs and three demo profiles are seeded without fabricated history or balances. Actual test actor profiles show indexed real history and are marked as test participants.

API write operations use expiring wallet-signed challenges, atomic challenge consumption, and hashed server session tokens. Selecting a proposal updates job and proposals in one transaction. Accepted workers cannot be replaced by a racing acceptance request. Job linkage validates the factory-created Pact, actors, settlement token, amount, deposits, verification mode, milestone amounts and deadlines, and AI policy hash. ClientOnly descriptive metadata is carried separately; v1 has no onchain agreement URI.

## Indexing and metric definitions

Envio configuration is generated from current ABIs and the deployment record. `PactCreated` dynamically registers escrow clones. Envio handlers store canonical raw events under chainId + transactionHash + logIndex; HyperIndex provides its own PostgreSQL event database. The application importer (`ENVIO_GRAPHQL_URL`) mirrors those events into Drizzle, then rebuilds snapshots and counterparty facts. Envio endpoint and APIs follow [official documentation](https://docs.envio.dev/docs/HyperIndex/event-handlers) and [Monad Testnet support](https://envio.dev/chains/monad-testnet).

The local development API has a rate-limited RPC fallback using finalized blocks, 100-block ranges, duplicate-safe IDs and a 32-block canonical overlap. It uses the same PGlite connection as API writes. Standalone indexer sync or smoke must not run concurrently with the local API against the same PGlite directory. External PostgreSQL is required for a multiprocess deployment.

Metrics are derived from escrow events and actual milestone state, avoiding double counting the reputation registry callback:

- Completed collaborations: one escrow Completed event.
- Settled volume: gross workerAward in MilestoneSettled, in raw USDC units, for each participant. It is not total deposited funds.
- Successful milestones: workerAward greater than zero.
- On-time delivery: submission block timestamp at or before milestone due time, divided by observed submissions. No submissions means unavailable; v1 prevents late submission.
- AI verified: paid milestone with an actual aiAttested flag; AI FAIL reports do not count.
- Human verified: settled ClientOnly, Hybrid, or Arbitrator milestone.
- Disputes: DisputeOpened per participant. Reduced worker award after dispute counts as a worker adverse outcome; full award counts as a client adverse outcome. A partial award does not imply a legal determination.
- Repeat collaboration rate: proportion of completed counterparty relationships with more than one completed Pact. No completed relationships means unavailable.

Every profile links to underlying Pact workspaces and event transaction hashes. The v1 registry has no standalone resolution event; a disputed MilestoneSettled is the resolution evidence. AttestationConsumed does not expose reportHash or score. v1 does not support resubmission. These restrictions are preserved in the product.

## Validation and remaining work

See TESTNET.md for real transactions and USABILITY.md for the pending human study. Production Envio hosting, external PostgreSQL and Redis require separate operational validation. No production deployment or protocol redeployment is performed in this phase.

## Local validation record (2026-10-01)

- Foundry formatting passed; 12 behavioral tests and 4 invariant properties passed with 128 runs / 4096 calls.
- API tests cover authenticated writes, replay prevention, job validation, search, funding filters, proposal withdrawal, and concurrent selection.
- Indexer tests cover duplicate-safe persistent ingestion, reputation aggregation, partial dispute outcomes, and counterparty facts.
- Verifier security/rule regression: seven tests passed, including private-network rejection, redirect checks, response limits, timeouts, and structured semantic output.
- Phase 2 real smoke passed with 5 USDC settlement and returned deposits.
- Phase 3 real smoke passed: Hybrid PASS, AIOnly automatic settlement, and FAIL with no payment. Real evidence is appended to TESTNET.md.
- Marketplace real smoke passed through job, proposal, selection, onchain creation, funding, acceptance, submission, and 1 USDC settlement.
- English and Chinese Playwright flows reach the matched collaboration draft. Headless browser tests do not claim extension wallet signing; real signing and settlement are separately verified by testnet scripts.
- Envio code generation passed. Envio runtime/GraphQL importing and production PostgreSQL/Redis deployment remain pending; this machine has no Docker runtime or configured Envio API token.
- Human usability testing is pending, as documented in USABILITY.md.

Final UI validation: English and Simplified Chinese flows passed; all 11 product surface checks passed at desktop (1440px), tablet (768px), and mobile (390px), including waiting for real workspace amounts and reputation reads. 417 translation keys match across languages. Screenshots are in docs/screenshots. A targeted check also rejects uncaught page errors and horizontal overflow.

Phase 4 is not declared complete: Envio full runtime/GraphQL importing and external Postgres/Redis operation are not verified here. Human usability feedback remains pending. The v1 no-resubmission constraint remains explicit. No Solidity source was changed or redeployed for Phase 4, and no Phase 5 work was started.

Final production build passed. Playwright against `next start` passed all three tests in 24.9 seconds; screenshots were regenerated from that build. Current Git-visible secret scan and `git diff --check` passed.

Dispute rate uses unique indexed Pacts with at least one DisputeOpened divided by indexed Pacts involving that actor. Several disputed milestones in one Pact count once in the rate. Repeat collaborator count is the number of completed counterparty relations with at least two completed Pacts.
