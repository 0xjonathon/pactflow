# Account access and mandatory wallet connection

Updated: 2026-10-09.

The top-right account entry opens a two-step native dialog. Step 1 explicitly offers Google registration/login or guest access. Guests receive a persistent `Guest-XXXXXX` nickname and never receive a logout action. Step 2 connects an injected wallet, switches to the required chain if necessary, and signs a one-use ownership message. Until wallet authentication succeeds, private operations remain unavailable. Cancellation is recoverable and does not create wallet authority.

Direct visits to `/pacts/new`, `/jobs/new`, `/jobs/:id/collaborate`, `/onboarding`, `/app` and `/notifications` open the same dialog when the wallet session is absent. Public browsing stays available. Private action cards elsewhere invoke the same dialog. The dialog traps keyboard focus natively, supports Escape outside in-progress signing, and returns focus to its opener.

The header displays an avatar, one nickname/name, and a compact wallet status indicator. Its popover separates identity, wallet/network details, public profile links, and account actions. Guest users see `Disconnect wallet` and optional Google login; Google users additionally see `Log out of Google`. Google logout leaves the wallet session intact. Wallet disconnection revokes the wallet token and clears private query caches while retaining the optional Google account.

Google account authority is independent of wallet authority: `/auth/google/{config,challenge,verify,me,logout}` uses distinct hashed account sessions and standard Google Identity Services ID tokens. The API checks RS256 signature, Google issuer, configured client audience, expiry, subject, name and a five-minute one-use nonce, and restricts browser writes to WEB_ORIGIN. Google subject/name are never emitted in public wallet profile APIs. Existing `/auth/{challenge,verify,logout}` and `/me` wallet consumers remain compatible.

Migration `0004_glossy_adam_destine` adds account sessions and Google challenges without changing existing wallet history. New wallet profiles receive a random nickname; untouched legacy “New member” placeholders become stable guest nicknames, while custom existing profile names are preserved. Wallet changes clear the previous wallet session and require fresh verification.

Local acceptance covers real wallet signing, guest entry, cancellation, rejected-signature recovery, refresh, missing installed wallet, wallet switching, disconnection, protected pages, menu accessibility and network spacing in English/Chinese at 1440/390px. Google UI integration uses an explicitly mocked provider; real Google OAuth acceptance remains dependent on a configured OAuth client and authorized origin. Cryptographic token checks use signed local test keys and exercise issuer/audience/nonce/expiry/forgery and replay rejection. No mocked Google account is presented as a real external login.
