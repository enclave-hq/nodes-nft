#!/bin/bash
# Multi-architecture Docker push script
# Builds and pushes images for both amd64 and arm64 platforms
# Usage: ./push-multiarch.sh [prod|dev]
#   prod: Uses production API URL (https://nodes-back.enclave-hq.com/api)
#   dev:  Uses default API URL from environment or docker-compose defaults

set -e

# Parse environment argument
ENV_MODE="${1:-dev}"

# Set API URL based on environment
if [ "$ENV_MODE" = "prod" ]; then
    NEXT_PUBLIC_API_URL="https://nodes-back.enclave-hq.com/api"
    echo "🏭 Production mode: Using API URL: $NEXT_PUBLIC_API_URL"
else
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000/api}"
    echo "🔧 Development mode: Using API URL: $NEXT_PUBLIC_API_URL"
fi

echo "🔨 Building and pushing multi-architecture Docker images..."

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Docker buildx is not available. Please install Docker buildx."
    exit 1
fi

# Check if user is logged in to registry
if [ -z "$DOCKER_REGISTRY" ]; then
    echo "⚠️  DOCKER_REGISTRY not set. Using default (Docker Hub)"
    echo "   To use a custom registry, set: export DOCKER_REGISTRY=your-registry.com"
    REGISTRY_PREFIX=""
else
    REGISTRY_PREFIX="$DOCKER_REGISTRY/"
    echo "📦 Using registry: $DOCKER_REGISTRY"
fi

# Create and use a new builder instance for multi-arch
BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
    echo "📦 Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --use
else
    docker buildx use $BUILDER_NAME
fi

# Build and push backend image for multiple platforms
echo ""
echo "🏗️  Building and pushing backend image (amd64 + arm64)..."
echo "   This will push BOTH architectures to the registry"
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY_PREFIX}ploto/backend:zkpay \
    --tag ${REGISTRY_PREFIX}ploto/backend:latest \
    --file backend/Dockerfile \
    ./backend \
    --push

# Build and push frontend image for multiple platforms
echo ""
echo "🏗️  Building and pushing frontend image (amd64 + arm64)..."
echo "   This will push BOTH architectures to the registry"
echo "   API URL: $NEXT_PUBLIC_API_URL"

# Get other environment variables from docker-compose or use defaults
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS="${NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS:-0xCd0Ff5Fd00BD622563011A23091af30De24E7262}"
NEXT_PUBLIC_NODE_NFT_ADDRESS="${NEXT_PUBLIC_NODE_NFT_ADDRESS:-0x92301C0acA7586d9F0B1968af2502616009Abf69}"
NEXT_PUBLIC_NFT_MANAGER_ADDRESS="${NEXT_PUBLIC_NFT_MANAGER_ADDRESS:-0xF87F9296955439C323ac79769959bEe087f6D06E}"
NEXT_PUBLIC_USDT_ADDRESS="${NEXT_PUBLIC_USDT_ADDRESS:-0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34}"
NEXT_PUBLIC_CHAIN_ID="${NEXT_PUBLIC_CHAIN_ID:-97}"
NEXT_PUBLIC_RPC_URL="${NEXT_PUBLIC_RPC_URL:-https://data-seed-prebsc-1-s1.binance.org:8545}"
NEXT_PUBLIC_ENABLE_TESTNET="${NEXT_PUBLIC_ENABLE_TESTNET:-true}"

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY_PREFIX}ploto/frontend:zkpay \
    --tag ${REGISTRY_PREFIX}ploto/frontend:latest \
    --file frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS="$NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS" \
    --build-arg NEXT_PUBLIC_NODE_NFT_ADDRESS="$NEXT_PUBLIC_NODE_NFT_ADDRESS" \
    --build-arg NEXT_PUBLIC_NFT_MANAGER_ADDRESS="$NEXT_PUBLIC_NFT_MANAGER_ADDRESS" \
    --build-arg NEXT_PUBLIC_USDT_ADDRESS="$NEXT_PUBLIC_USDT_ADDRESS" \
    --build-arg NEXT_PUBLIC_CHAIN_ID="$NEXT_PUBLIC_CHAIN_ID" \
    --build-arg NEXT_PUBLIC_RPC_URL="$NEXT_PUBLIC_RPC_URL" \
    --build-arg NEXT_PUBLIC_ENABLE_TESTNET="$NEXT_PUBLIC_ENABLE_TESTNET" \
    --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
    ./frontend \
    --push

echo ""
echo "✅ Multi-architecture build and push complete!"
echo ""
echo "📋 What was pushed:"
echo "   - ploto/backend:zkpay (amd64 + arm64)"
echo "   - ploto/backend:latest (amd64 + arm64)"
echo "   - ploto/frontend:zkpay (amd64 + arm64)"
echo "   - ploto/frontend:latest (amd64 + arm64)"
echo ""
echo "🔍 To verify, check the manifest:"
echo "   docker manifest inspect ${REGISTRY_PREFIX}ploto/backend:zkpay"
echo ""
echo "💡 When someone pulls the image, Docker will automatically:"
echo "   - Detect their platform (amd64 or arm64)"
echo "   - Download the matching architecture"
echo "   - No manual selection needed!"

