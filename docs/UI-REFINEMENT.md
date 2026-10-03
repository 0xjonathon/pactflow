# Collaboration marketplace refinement

## Positioning
PactFlow connects commissioning partners and delivery partners around a defined outcome. Public language uses briefs, proposals, collaboration, acceptance and settlement. Existing /jobs and /talent URLs and protocol interfaces remain compatible.

## Design
The reference https://sella.to/ informed transaction-first navigation, explicit payment protection, category discovery and explanations for both parties. PactFlow uses its own mint/navy palette, outcome agreement preview, two-sided collaboration flow and original copy. No reference assets, source code, storefront claims or jury mechanics were copied.

- Landing: outcome positioning, real search and category links, clearly labeled illustrative collaboration, real testnet statistics, two-sided guidance and payment FAQ.
- Discovery: accepts search/category links, offers a reset, retains real API filtering.
- Partner cards: completed collaborations, settled volume and timeliness first; all indexed facts remain on profiles.
- Forms and workspace: quieter surfaces, readable fields, visible focus states, commissioning/delivery terminology and preserved real transaction behavior.
- Small screens: menu navigation, single-column content, readable cards and details preceding the collaboration action card.
- English and Simplified Chinese: 448 matching keys.

## Validation boundary
This refinement changes presentation and navigation, not contracts, indexer semantics or wallet signing. No new testnet transactions are necessary for the visual changes. The previous Phase 4 operational limitations in PRODUCT.md still apply.

Final checks: web typecheck PASS; web production build PASS; i18n parity PASS (448); four Playwright cases PASS, including EN/ZH proposal matching, 11 routes across three viewport sizes, search/category/reset/FAQ navigation. Chinese landing screenshots also saved. No new wallet transactions executed in this refinement.

## Form and settlement UX correction
- New marketplace briefs and direct Pacts use a zero delivery-partner deposit. The API rejects nonzero delivery deposits on new briefs. Sample listings follow this policy. Existing real agreements preserve their actual terms and remain readable.
- Frontend validates each wizard step: title and description lengths, token decimal precision and range, milestone total, ordered deadlines in local time, website URL and review scores. Errors are attached to their fields; review catches remaining invalid steps and moves to the first one.
- API validation retains structured issue paths rather than discarding them. Publication retries reuse the created draft ID, and optional invitation failure does not make a successful publication appear to fail.
- Language selection is a single globe menu in global navigation. It supports click-outside/Escape dismissal and persistent choice. Wallet/login content contains no duplicate language controls.
- Review includes milestones and explicitly states the delivery partner owes no deposit. Zero-deposit acceptance requests no token authorization.
- Validation: API lifecycle test (including rejection of nonzero delivery collateral), API/web typecheck, web production build, 483 matching translation keys and five browser cases pass. Browser regressions cover the short-description reproduction, mismatched milestone total, missing website URL, deposit policy, language persistence, and three viewport sizes.
