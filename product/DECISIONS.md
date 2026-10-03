# Decisions

- 2026-10-04: New independent repository nested at Metropolis/PactFlow-2.0; preserve original working files and Git history. Baseline commit captures pre-existing uncommitted changes. Dependencies/secrets/runtime databases excluded.
- Retain the existing framework and working V1 protocol. V2 is necessary because V1 submission is single-use and registries only bind one immutable factory. Both versions remain readable and operable.
- Versioned per-milestone submission identity binds reports and attestations. Revision defaults: maxRevisions=2; final deadline configured before funding. Infrastructure errors are not verdicts.
- PostgreSQL, Redis, private S3-compatible storage and Envio in Linux containers. No production RPC fallback or local database fallback.
- P0 dependency graph: shared domain → V2 protocol → submission persistence/privacy → verifier → Envio/read model → reputation → Pact Room → activity/public proof → homepage/onboarding → i18n/a11y/mobile → E2E → release audit. Each dependency requires functional evidence.
- No opaque trust score. Display source-backed metrics and unavailable values explicitly.
