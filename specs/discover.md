# Discover

Public opportunities support server-side search/filtering/pagination and labelled DEMO versus actual funding state. Signed-in workers propose delivery; client selects a partner and reviews exact collaboration terms before wallet create/approval/funding.

Budget/skills/category/verification filters operate over database results rather than only the visible page. Selection is transactional; repeated/concurrent requests cannot select two workers. Fixed parties and bonds feed the V2 agreement. No brief publication claims funds are secured before its actual funding transaction.

## Acceptance and boundaries

Both-language marketplace browser flow covers publish/search/apply/select/fund/accept/manual revision/pay. Advanced ranking, direct invitation tokens and P1 filters remain gated.

Required acceptance: actual user flow, English/Chinese, keyboard and mobile, empty/loading/failure states. Executed gates and evidence are recorded in `qa/PRODUCTION_AUDIT.md`; full source requirements are in `product/MASTER_DIRECTIVE.md`.

## Demand and agreement journey — 2026-10-09

Publish Brief is visible in the active home/header/mobile/Discover; direct creation remains a separately labelled existing-partner route. Discover defaults to OPEN briefs whose overall and first-delivery deadlines have not expired. Users may explicitly browse MATCHED or ALL historical public briefs. Draft detail is owner-only. Closed or expired briefs do not offer application/selection. A withdrawn proposal may be submitted again under the same identity; pending duplicates return a recoverable error.

Briefs use trimmed nonempty title/description limits aligned with V2, positive six-decimal amounts, exact milestone totals, ordered delivery dates and a 365-day maximum. Manual approval is the default and needs no website URL. Automated website checks are opt-in; semantic requirements use the actual `ai.available` capability flag.

Publication uses an optional UUID request identity: lost-response retries reuse the existing draft, and published/matched terms are never overwritten. My Work exposes draft resumption. A selected worker's verified address is inserted automatically into the agreement review; the requester confirms the distinct resolver, acceptance deadline, review hours and revisions before wallet creation. These terms and the created escrow are frozen across saving/linking/funding retries. Linking and closure use conditional updates; linked escrows cannot be hidden by listing closure.
