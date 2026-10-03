# Domain model

PactSpec is versioned and immutable after funding, includes parties, outcome, deliverables, acceptance criteria, verifier policy, payment, final submission deadlines, revision and dispute policies. Chain is authoritative for funds, authorization and settlement; database for private metadata, evidence and processing; Envio for canonical event/read models.
Submission is append-only and identified by (chain, escrow, milestone, sequence), with evidence manifest hash. Evidence has kind, source, label, submitter, time, contentHash, metadata and visibility. VerificationRun records submission, policy/spec/verifier version, checks, model, result, reason, timestamp and attestation/report hashes.
Processing stages QUEUED/FETCHING/DETERMINISTIC/SEMANTIC/AGGREGATING/SIGNING/SUBMITTING are not settlement states. Provider errors preserve the submission for retry. Public projections remove private evidence and require explicit disclosure permissions.
