# Frontend Dockerfile for Next.js
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

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

