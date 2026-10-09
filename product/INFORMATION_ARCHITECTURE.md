# Information architecture

Public navigation: Discover briefs, My Work, Network, Reputation, Activity, How it works, Language and Account. Publish Brief is the primary requester action on the active home, desktop header, mobile action bar and Discover. CreationPaths exposes two distinct entries: `/jobs/new` for an unknown partner and `/pacts/new` for an already agreed partner. `/how-it-works` explains the distinction, roles and six stages without requiring login.

Browse without authentication. Protected publication, application, agreement and My Work actions open the standard Google-or-guest dialog followed by mandatory wallet verification. Google identity is optional and cannot authorize funds.

My Work (`/app`) separates requester briefs from worker applications, each with proposal/business status and a role-dependent next action. Saved drafts return to `/jobs/new?draft=[id]`. Matched requester briefs lead to `/jobs/[id]/collaborate`; partners await requester confirmation, then accept the funded Pact. Direct agreements are listed separately within each role when not linked to a brief.

Existing `/jobs`, `/talent` and `/pacts/new` links remain compatible. Pact Room `/pacts/[escrowAddress]` is the agreement center. Reports `/verifications/[id]`, passport `/u/[handle]`, receipt `/p/[publicId]`, deployment evidence `/proof`, Inbox `/notifications`, editable profile `/onboarding`. P1 invitations `/join/[token]` remain gated.
