# PactFlow on Vercel

Public website: https://pactflow-lovat.vercel.app

The Next.js application runs on Vercel. The Fastify API, PostgreSQL, Redis, verification worker and persistent event read model run on the independent backend described in [the lightweight deployment guide](LIGHTWEIGHT.md).

## Request routing

In production, browser requests use the website's own `/api/v1/...` paths. A Next.js `beforeFiles` rewrite forwards them to the backend configured at build time. The rewrite runs before the catch-all API route and preserves the request method, query string, body and authorization header. Browser sessions and wallet permissions remain enforced by the backend.

Set `INTERNAL_API_URL` to the backend's HTTPS origin. `NEXT_PUBLIC_API_URL` is accepted as a compatibility fallback and remains available for direct local development. Production browser code always uses same-origin paths. Server-rendered receipt metadata uses the configured backend directly.

The upstream must be an HTTP(S) origin without credentials, a path, query string or fragment. Changes require a rebuild. When neither upstream variable is configured, the API route returns JSON 503 `BACKEND_NOT_CONFIGURED`; it never invents application data or contacts a visitor's localhost.

This routing removes the requirement for a visitor's browser to reach the backend IP and port directly. It still requires Vercel to reach the backend over valid HTTPS. It does not relocate the database or keep a stopped backend running.

## Project configuration

- Project: `pactflow`; repository Root Directory: `apps/web`.
- Framework: Next.js; Node.js: `24.x`.
- `apps/web/vercel.json` contains the install and build commands.
- Retain the deployed protocol addresses and public Monad RPC configuration.
- Keep the exact production website origin in the backend's `WEB_ORIGIN` and wallet authentication configuration.
- Signing keys and database credentials belong only on the backend, never in `NEXT_PUBLIC_*` variables.
- `.vercel`, downloaded environment files, local wallets, databases and caches are excluded from Git and deployment uploads.

## Release checks

Build a preview before switching production. Verify the following through the Vercel website origin:

1. `/api/v1/stats`, `/api/v1/jobs` and `/api/v1/indexer/health` return actual backend JSON.
2. A valid public receipt still has its original public ID, settlement transaction and consented content.
3. `/api/v1/me` rejects unauthenticated access, and a signed wallet challenge authenticates only its wallet.
4. Request bodies, query parameters and authorization headers survive forwarding. Private evidence remains inaccessible to non-participants.
5. Fresh browser visits load the home, discovery and receipt pages; English/Chinese switching still works.

Keep a database backup and the previous deployment available before promotion. If any check fails, retain the previous production deployment and investigate the upstream. See [container operations](README.md) for backend recovery.

## Protocol

Current contracts run on Monad Testnet, chain ID `10143`. The [V2 deployment record](../packages/chain/src/addresses/monad-testnet-v2.json) contains addresses and deployment evidence. Retain historical V1 records. A website routing change does not deploy contracts or broadcast settlement transactions.
