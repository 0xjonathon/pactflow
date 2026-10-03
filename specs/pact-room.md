# Pact Room

Overview, Milestones, Evidence, Verification and Activity use the same indexed business state. TrustPanel displays participants, actual funds/metrics, verifier, version and latest transaction. Tabs support arrow/Home/End keys and one selected tab.

Only eligible roles see funding, accept, submit, approve, revision, dispute, expiry and resolution actions. Failed criteria produce revision feedback and a new submission. Infrastructure errors permit verification retry on the existing submission. Transaction inclusion/finality and indexing delay are separate. API confirmation recovery uses the original transaction hash and survives reload under the wallet+escrow key.

## Acceptance and boundaries

V1 routes dispatch to the preserved legacy detail and V1 ABI. Public visibility of reports/receipts requires both parties; private spec/evidence needs a participant session.

Required acceptance: actual user flow, English/Chinese, keyboard and mobile, empty/loading/failure states. Executed gates and evidence are recorded in `qa/PRODUCTION_AUDIT.md`; full source requirements are in `product/MASTER_DIRECTIVE.md`.
