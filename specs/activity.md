# Work Activity

Finalized indexed chain events drive funding, acceptance, submissions, revisions, verification, settlement, completion and disputes. Event identity includes transaction/log index, preventing duplicate counts. Same-transaction verification and settlement are displayed as real separate events.

Server pagination returns 50 records plus freshness/source; optional escrow filter drives Room. Each item links its actual Pact and transaction. Local transaction links are clearly identified by Proof rather than a false public explorer link. Empty/loading/error states do not manufacture activity.

## Acceptance and boundaries

Envio GraphQL is mandatory in production. Development RPC is explicit. Reorg projection and replay have tests; live Envio runtime/finality interruption acceptance remains blocked.

Required acceptance: actual user flow, English/Chinese, keyboard and mobile, empty/loading/failure states. Executed gates and evidence are recorded in `qa/PRODUCTION_AUDIT.md`; full source requirements are in `product/MASTER_DIRECTIVE.md`.
