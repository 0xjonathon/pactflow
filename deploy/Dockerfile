FROM node:24-bookworm-slim AS source
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile

FROM source AS runtime
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]

FROM source AS worker
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production CHROME_PATH=/usr/bin/chromium
USER node
CMD ["node", "--import", "tsx", "apps/verifier/src/worker.ts"]

FROM source AS web-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MONAD_RPC_URL
ARG NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS
ARG NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS
ARG NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS
ARG NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS
ARG NEXT_PUBLIC_ARBITRATOR_ADDRESS
ARG NEXT_PUBLIC_VERIFIER_ADDRESS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_MONAD_RPC_URL=$NEXT_PUBLIC_MONAD_RPC_URL NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS=$NEXT_PUBLIC_PACT_FACTORY_V2_ADDRESS NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS=$NEXT_PUBLIC_REPUTATION_REGISTRY_V2_ADDRESS NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS=$NEXT_PUBLIC_VERIFIER_REGISTRY_V2_ADDRESS NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS=$NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS NEXT_PUBLIC_ARBITRATOR_ADDRESS=$NEXT_PUBLIC_ARBITRATOR_ADDRESS NEXT_PUBLIC_VERIFIER_ADDRESS=$NEXT_PUBLIC_VERIFIER_ADDRESS
RUN pnpm --filter @pactflow/web build
USER node
ENV NODE_ENV=production
WORKDIR /app/apps/web
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3000"]

FROM source AS envio
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates && rm -rf /var/lib/apt/lists/*
RUN chown -R node:node /app/indexer
USER node
WORKDIR /app/indexer
ENV NODE_ENV=production TUI_OFF=true
CMD ["sh", "-c", "node --import tsx src/generate-config.ts && node_modules/.bin/envio start"]
