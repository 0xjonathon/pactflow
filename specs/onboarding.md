# Onboarding

Hire/Work/Both intent, profile handle/name/bio/declared skills and wallet ownership login. Fresh browser/account starts with empty real history. Existing wallet reconnects to the same identity.

Wallet challenge is single-use, origin-bound and expires; server stores hashed session tokens and logout revokes them. Object permissions are checked independently from wallet connection. Missing/rejected wallet or unavailable API has translated retry guidance.

## Acceptance and boundaries

Passkey is an optional P1 compatibility experiment; no passkey readiness claim. Browser tests create separate wallet sessions, and API tests assert replay/revocation and marketplace role authorization.

Required acceptance: actual user flow, English/Chinese, keyboard and mobile, empty/loading/failure states. Executed gates and evidence are recorded in `qa/PRODUCTION_AUDIT.md`; full source requirements are in `product/MASTER_DIRECTIVE.md`.
