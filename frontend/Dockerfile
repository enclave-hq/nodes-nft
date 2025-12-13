# Frontend Dockerfile for Next.js
# Build context should be the enclave/ directory to access both node-nft/ and wallet-sdk/
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
# Copy frontend package files
COPY node-nft/frontend/package.json ./
# Copy wallet-sdk to make it available for local file dependency
COPY wallet-sdk ../wallet-sdk/
# Install dependencies and regenerate package-lock.json if needed
# This ensures compatibility across different npm versions and architectures
RUN npm install --no-audit

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy frontend source code
COPY node-nft/frontend/ .
# Copy wallet-sdk again for build time
COPY wallet-sdk ../wallet-sdk/

# Build arguments for Next.js public environment variables
# These are embedded into the build at build time
ARG NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS
ARG NEXT_PUBLIC_NODE_NFT_ADDRESS
ARG NEXT_PUBLIC_NFT_MANAGER_ADDRESS
ARG NEXT_PUBLIC_USDT_ADDRESS
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_ENABLE_TESTNET
ARG NEXT_PUBLIC_API_URL

# Set environment variables for build
ENV NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS}
ENV NEXT_PUBLIC_NODE_NFT_ADDRESS=${NEXT_PUBLIC_NODE_NFT_ADDRESS}
ENV NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${NEXT_PUBLIC_NFT_MANAGER_ADDRESS}
ENV NEXT_PUBLIC_USDT_ADDRESS=${NEXT_PUBLIC_USDT_ADDRESS}
ENV NEXT_PUBLIC_CHAIN_ID=${NEXT_PUBLIC_CHAIN_ID}
ENV NEXT_PUBLIC_RPC_URL=${NEXT_PUBLIC_RPC_URL}
ENV NEXT_PUBLIC_ENABLE_TESTNET=${NEXT_PUBLIC_ENABLE_TESTNET}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4001

ENV PORT=4001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

