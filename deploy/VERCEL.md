# PactFlow website on Vercel

Public website: https://pactflow-lovat.vercel.app

This is a frontend-only browsing preview, authorized on 2026-10-09. It does not claim that the current revision-capable agreement workflow is live. No API, PostgreSQL, Redis, verification worker, object storage/scanner or Envio service was provisioned by this deployment. Google identity and protected collaboration actions remain unavailable.

## Project configuration

- Vercel team: `thress`; project: `pactflow`.
- Repository root: the PactFlow monorepo; project Root Directory: `apps/web`.
- Framework: Next.js; Node: `24.x`.
- `apps/web/vercel.json` configures `corepack enable && corepack pnpm install --frozen-lockfile` and `pnpm build`.
- Production environment: `NEXT_PUBLIC_DEPLOYMENT_MODE=frontend`. This is a public display flag, not a credential.
- `.vercelignore` excludes local env files, wallets, databases, dependencies and build caches. `.vercel` and `.env.local` are ignored by Git. Never copy the local acceptance environment into Vercel settings.

Link with the official Vercel CLI from the repository root:

```sh
vercel link --yes --scope thress --project pactflow
vercel deploy --prod --yes --scope thress
```

The project environment retains the preview flag. Metadata uses the configured site URL or Vercel's production domain. Unconfigured browser API requests stay on the public origin and receive a JSON 503 `BACKEND_NOT_CONFIGURED`; they do not contact the visitor's localhost. Unknown/unavailable public receipts do not expose evidence.

## Completing the working product

Deploy and validate the backend services described in [the container guide](README.md). Deploy the revision-capable contracts separately, retain existing V1 records and complete actual Monad smoke tests. Configure `NEXT_PUBLIC_API_URL` to the real HTTPS API, `INTERNAL_API_URL` where required, fresh contract addresses, and the public site's exact origin on the API. No signing keys belong in browser environment variables.

Remove the frontend-only flag only after these services and the signed two-user flow pass. Rebuild and check a new unauthenticated browser, mobile/English/Chinese, API interruptions, privacy and public receipt consent before claiming a working public product.

## Testnet status

Read-only Monad RPC validation on 2026-10-09 returned chain ID 10143, nonempty code at the retained factory `0xb9d75193df4ab985e5c2a5a1b0e332946d405d1a`, and success (`0x1`) for the recorded settlement `0xe5c1f26a27aa566f47c43bd16c8fef167b474327f3029fe133cc926ff831d8ea` (block `0x4004ca5`). These are legacy protocol records; no new contract deployment or funds transfer was broadcast during the website deployment.

The current protocol still has no public V2 deployment record. Frontend hosting and historical testnet settlement do not establish acceptance of its new revision workflow.
