# Release checklist

The local implementation is reviewable and reproducible. Public release is blocked until all required gates below have actual evidence. See `PRODUCTION_AUDIT.md` for executed results.

- [x] Independent copy/history and domain/state specifications.
- [x] V1 + V2 contract behavior, fuzz and funding invariants.
- [x] Local privacy/replay/concurrency/verifier/index projection tests.
- [x] Optimized Web build, ten-package/script types, lint, formatting, bilingual keys and Envio codegen.
- [x] Sixteen fixed-build local browser tests (including eight account cases): automatic/manual two-user flow, wallet refusal/API confirmation recovery, all specified viewport widths, public authorization/OG and automated WCAG.
- [ ] Real PostgreSQL/Redis integration tests execute without skips.
- [ ] Actual private object/scanner upload/download/ownership/restore acceptance.
- [ ] Real isolated Worker retry/restart, transaction expiry/nonce and failure recovery acceptance.
- [ ] Live Envio GraphQL paging/reorg/finality/latency/outage acceptance.
- [ ] Configured real semantic/GitHub/CI/certified-adapter smoke; outage never signs pass.
- [ ] Linux Compose config/build/start/health/TLS/persistence and backup restore rehearsal.
- [ ] New V2 deployment verified on Monad with preserved V1 records; funded two-user smoke records transactions, balances and index proof.
- [ ] Public deployment with new browser, empty cache/new identity; console, links, network failures, privacy and manual accessibility/editorial review.
- [ ] No unresolved FAIL/BLOCKED P0 gate; only then enter P1 and announce release readiness.

- [x] Optional Google/guest choice, mandatory wallet verification, guest nickname, separate logout/disconnect, protected-page modal, missing-wallet handling and wallet-switch invalidation.
- [ ] Actual Google provider login with project Web OAuth client ID and authorized origin (browser provider mocks are not external acceptance).
