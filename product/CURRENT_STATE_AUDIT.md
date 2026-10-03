# Current state audit — 2026-10-04

Audited baseline: 3b207c7, containing the original repository's committed and uncommitted work. This report distinguishes traced code from external evidence recorded previously.

| Classification    | Evidence and impact                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working           | PactFactory creates immutable clones; PactEscrow funds, accepts, submits, approves/attests, cancels and resolves disputes; exact token pulls and reentrancy guards exist. Foundry baseline: 12 behavior tests and four invariants.                              |
| Working           | Wallet challenge ownership verification, hashed session tokens, transactional proposal selection and server-side job filtering in apps/api/src/product.ts. Baseline API/indexer: 3 tests.                                                                       |
| Working           | Deterministic HTTP/DOM/JSON/API/hash/Lighthouse checks and bounded SSRF-resistant fetch/proxy; semantic prompt injection tests. Baseline verifier: 7 tests.                                                                                                     |
| Partially Working | PostgreSQL adapter with max=5 pool and Drizzle migrations exist; production disallows PGlite, but no production environment or persistence smoke was verified.                                                                                                  |
| Partially Working | Envio config/handlers/GraphQL ingestion exist. API periodically calls ProtocolIndexer; GraphQL path downloads the entire event table and subsequently RPC-reads each Pact. Hosted endpoint has not been independently verified.                                 |
| Broken            | PactEscrow.submit rejects m.submitted forever; failed verification remains submitted. No real revision/resubmission path exists. Factory implementation and both registry factory bindings cannot be replaced.                                                  |
| Mocked            | Explicit /demo/verification/pass and /fail pages and demo seeds exist. They are examples, not live verification or settlement proof.                                                                                                                            |
| Hardcoded         | Playwright expects fixed Pact/report IDs, hardcoded local API port and Chrome installation path; existing browser flow stops at review before broadcasting.                                                                                                     |
| Unused            | packages/ui and packages/shared contain minimal exports; they do not establish shared domain rules or a reusable trust panel.                                                                                                                                   |
| Production Risk   | Redis queue worker is coupled to API runtime; no complete container/CI/TLS/backup deployment, readiness check or live public smoke. API /health always returns ok.                                                                                              |
| Security Risk     | Verification job/report endpoints are public and expose submission URI/report content; evidence privacy and object authorization are incomplete. Verification enqueue is unauthenticated. Session sign-out only clears localStorage, without server revocation. |
| Security Risk     | V1 attestations bind rules and deliverable but do not bind report hash, submission sequence or per-Pact configured verifier. New V2 must address these without changing V1.                                                                                     |
| UX Risk           | Product is brief/marketplace-centric; status types lack revisions, verification stages and expired outcomes. Large ProductPages component and raw wallet error paths complicate role/state UX.                                                                  |
| UX Risk           | English/Chinese key parity passes (483 keys), but parity does not prove translation quality, accessibility, business workflow or fresh-browser support.                                                                                                         |

## Recorded external evidence

Existing docs/TESTNET.md and packages/chain/src/addresses/monad-testnet.json contain V1 deployment and real smoke receipts. Preserve them. This audit did not broadcast or independently revalidate those transactions.

## Baseline validation executed

Original workspace: API/indexer 3/3; verifier 7/7 (loopback tests required sandbox permission); Foundry 12 behavior tests + 4 invariants; API/web/verifier/indexer typecheck; 483 locale keys per language. New-copy checks must be rerun after independent installation.
