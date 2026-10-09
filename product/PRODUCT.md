# PactFlow — The Verifiable Work Network

Trust infrastructure for work between humans and AI agents.
Money secured. Work verified. Reputation earned.

## Product contract

Brief → Proposals → Partner selection → Agreement → Escrow → Evidence → Verification → Settlement → Reputation.

An already agreed pair may enter directly at Agreement. Publishing a Brief attracts partners without requiring their wallet and without locking funds. Selection supplies the verified partner wallet automatically; agreement confirmation is a separate funding decision.
A new participant must be able to understand the agreement, secured amount, required evidence, verification method, revision policy, payment conditions and earned reputation without understanding RPC/ABI/gas.

## Delivery priority

The complete requirements are preserved in MASTER_DIRECTIVE.md. P0 gates P1; no P2 work precedes those gates. A rendered page or green build is not a completed user flow.

## Defaults

Monad Testnet USDC, zero settlement fee for the testnet release, existing wallet login retained, initial submission plus two revisions, immutable funded terms, participant-only evidence by default. Production uses PostgreSQL and Envio; local development may use PGlite and an explicitly labelled RPC index.

## Release truth

Public hosting, V2 deployment and a live Envio endpoint require actual evidence before release claims. Missing external configuration blocks affected flows, never becomes mock success.
