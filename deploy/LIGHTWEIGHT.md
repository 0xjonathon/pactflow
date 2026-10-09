# PactFlow on a constrained server

The public web application runs on Vercel. The independent backend lives in `/opt/pactflow`, under Docker Compose project `pactflow`. It uses PostgreSQL, Redis, one API process with a durable single-concurrency verification worker, and Caddy. The existing `x-ui` service and its ports 443, 2053 and 2096 are retained.

## Explicit deployment mode

Set `NODE_ENV=production`, `PACTFLOW_LIGHTWEIGHT=true`, `PACTFLOW_INDEXER_MODE=rpc`, and `INDEXER_START_BLOCK` to the verified deployment block. Configure the V2 factory, reputation registry, verifier registry, settlement token and registered verifier. PostgreSQL, Redis, HTTPS web origin and a valid verifier key remain mandatory. Never enable `PACTFLOW_LOCAL_CHAIN` or `VERIFIER_ALLOW_LOCALHOST` on this server.

This mode queries real finalized Monad events in bounded 2,000-block batches, persists an overlapping cursor and deduplicates events. Indexer health exposes the source, start block and lag. The normal production mode still requires Envio; it does not silently fall back to RPC. The lightweight index covers events since the configured deployment block. Historical V1 addresses and transaction evidence remain in the repository.

AI requires a real model and key. Private file uploads require configured object storage and malware scanning; otherwise the capabilities API disables file choices and uploads return a recoverable error. URL, JSON and text evidence remain available. No fake attestations, settlements or reputation facts are generated.

## Installation

`prepare-lightweight.sh <40-character-Git-commit>` downloads the immutable public source, builds the API image, and generates a separate verifier on the server. It prints only the verifier address. Secrets live in `/opt/pactflow/shared` with restricted permissions, outside the source checkout. Runtime and Compose environment files must never be committed or logged.

Use `docker compose --env-file /opt/pactflow/shared/compose.env -f deploy/compose.lightweight.yaml ...` from the release checkout. Set `PACTFLOW_RELEASE` in the Compose environment to the image commit. The runtime environment file is `/opt/pactflow/shared/runtime.env`.

Caddy listens on 80 for ACME validation and 18443 for HTTPS. Databases and API ports are confined to the Compose network. The free DNS hostname embeds the server IP; HTTPS certificate issuance and renewal require public TCP 80. Browser access to the API requires TCP 18443. Do not modify the existing firewall rules or expose PostgreSQL/Redis.

## Checks and rollback

Check API `/health`, `/api/v1/indexer/health`, verification capabilities, wallet challenge/signature authentication, and real testnet transactions before connecting Vercel. Set both `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` to the verified HTTPS API origin; configure all public V2 addresses on Vercel and redeploy.

Check `systemctl is-active x-ui`, its existing listening ports, and `docker stats --no-stream` after each deployment. Health checks and restart policies recover the containers; PostgreSQL and Redis use persistent volumes. Verification jobs survive restarts and abandoned jobs are recovered.

Before an upgrade, back up PostgreSQL using `pg_dump` within the PostgreSQL container and protect the resulting file. Preserve `/opt/pactflow/shared`, Caddy certificate data and Redis persistence. Restore the database into an isolated Compose project and verify wallet authorization and submission history before switching back. Never use `docker compose down -v`. For a code rollback, select the previous release/image, retain the persistent volumes, and run compatible migrations before restarting the API. Restore a matching database backup when reverting an incompatible schema.

Actual deployments and smoke results must be recorded separately. This document does not establish that any external capability has passed validation.
