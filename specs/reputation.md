# Source-backed reputation

Display completed Pacts, actual net settled volume, unique verification pass rate, milestone revision rate, on-time rate, disputes and repeated counterparties. Gross settled obligations and net worker receipts have distinct meanings. No opaque total score.

Rebuild from canonical deduplicated events. Hybrid manual and AI approvals for one submission count once. Latest successful submission governs on-time work. Reorg replacement removes orphan facts. Missing denominators produce null/unavailable, not artificial percentages. DEMO fixtures never become chain reputation.

## Acceptance and boundaries

Projection tests and local settlement flow verify these facts. Skill-specific reputation and graph visualization are gated P1; production Envio ingestion is still an external gate.

Required acceptance: actual user flow, English/Chinese, keyboard and mobile, empty/loading/failure states. Executed gates and evidence are recorded in `qa/PRODUCTION_AUDIT.md`; full source requirements are in `product/MASTER_DIRECTIVE.md`.
