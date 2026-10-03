# PactFlow Verifier (Phase 3)

## Architecture

The verifier reads the live Pact and milestone from Monad Testnet, loads the stored verification policy, checks its canonical `rulesHash` against the contract, verifies the canonical submission metadata against `deliverableHash`, then fetches the referenced artifact. A failed state or hash check stops before signing.

Rule results and a canonical report are stored in the verification database. A passing result is signed by a server-side testnet verifier key and submitted to the existing `PactEscrow.attest` method. AIOnly settles in that transaction; Hybrid waits for the client's `approve` transaction. A failed verification produces a report but no attestation or payment.

## Rule engine and evidence

Policy version 1 supports `HTTP_STATUS`, `DOM_SELECTOR`, `DOM_TEXT`, `JSON_SCHEMA`, `API_RESPONSE`, `LIGHTHOUSE`, `FILE_HASH` (SHA-256), and `LLM_RUBRIC`. Required rule failure overrides the score. Each rule records its outcome, weighted score, summary, duration, and bounded evidence. Canonical key ordering creates stable policy and report hashes.

The ordinary builder provides Website, JSON, API, and Custom presets. The Advanced view exposes the full policy JSON. `CODE_TEST` and arbitrary shell execution are disabled.

## Artifact security

The fetcher permits HTTP and HTTPS only. It resolves every hostname, rejects non-public addresses, pins the validated IP for the connection, revalidates redirects, and enforces a redirect count, response size, and timeout. Lighthouse's isolated Chrome process uses a per-audit HTTP/HTTPS proxy that applies the same URL and DNS checks to page requests and subresources, with request, byte, and time limits. Localhost is blocked by default and enabled only for the explicit local smoke fixture. A website or API is untrusted input, including text that resembles instructions.

The semantic provider sees extracted headings, actions, truncated visible text, and deterministic evidence. Its system policy labels artifact content untrusted, disables tools, and accepts only a Zod-validated structured result with criterion IDs and evidence references from the supplied set. A provider error, invalid schema, or low confidence cannot create a passing attestation. Internal model reasoning is neither persisted nor sent onchain.

## Queue and persistence

The API persists policies, jobs, rule results, reports, and verifier metadata in Drizzle PostgreSQL tables. The development environment may use persistent PGlite, which runs PostgreSQL in-process. Production requires an external PostgreSQL connection and Redis-backed BullMQ. An inline queue is available only outside production. Unique database constraints make policy and submission job creation idempotent. Report rows are insert-only.

## EIP-712 and v1 protocol limits

The deployed v1 registry verifies the actual Solidity `Attestation` tuple: `pact`, `milestoneId`, `deliverableHash`, `rulesHash`, `approved`, `nonce`, `expiry`, and `verifier`. The domain is `PactFlow Verifier`, version `1`, Monad Testnet chain 10143, and the deployed VerifierRegistry address. Nonces are random and attestations expire after 15 minutes by default. The contract and database track used nonce and digest.

The deployed v1 ABI does **not** include `reportHash`, score, or issue time in the signed struct. The report hash is saved with the transaction evidence, but it is not cryptographically bound onchain by v1. This limitation is not papered over by claiming otherwise. The v1 escrow also rejects a second `submit` for the same milestone, so a FAIL leaves the funds in escrow but the worker cannot resubmit under this deployment. Both would require a separately tested and deployed protocol v2; Phase 2 addresses and evidence remain untouched.

The policy hash commits to verification rules and thresholds. In an AI Pact, other agreement metadata, such as title, is carried in the share URI and is not committed by that onchain hash. The UI should treat those non-policy fields as descriptive metadata.

## API and failure behavior

- `POST /api/v1/verification/policies` checks the policy hash against Monad before storing it.
- `POST /api/v1/verification/jobs` reads the current submission from Monad; clients cannot supply a fake deliverable hash.
- `GET /api/v1/verification/jobs/:id` returns progress and errors.
- `GET /api/v1/verification/jobs/:id/report` returns the immutable report and proof.
- `GET /api/v1/pacts/:escrow/verifications` returns verification history.

The verifier checks agreed machine-verifiable rules and a bounded semantic rubric. It cannot guarantee artistic quality, legal compliance, human intent, or subjective satisfaction. Those questions remain with the client and arbitrator under the current protocol.

## Remaining validation and deployment work

The real Hybrid PASS, AIOnly PASS, and FAIL flows were exercised by the CLI smoke script against Monad Testnet. The report and pact pages were inspected in Chrome, including both languages, but Phase 3 MetaMask signing from the browser was not completed because the browser automation surface blocked interaction with the wallet extension. The production PostgreSQL and Redis/BullMQ deployment path has not been exercised; local evidence uses persistent PGlite and the inline queue. The API also needs authentication or rate limiting before public exposure to prevent untrusted callers from consuming verifier resources. The deployed v1 ABI limitations above require a separately versioned protocol change before report-hash binding and worker resubmission can be claimed.
