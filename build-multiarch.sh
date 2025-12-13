#!/bin/bash
# Multi-architecture Docker build script
# Builds images for both amd64 and arm64 platforms
# Usage: ./build-multiarch.sh [prod|dev] [--push]
#   prod: Uses production configuration from docker-compose.yaml
#   dev:  Uses development configuration from docker-compose.dev.yaml (Default)
#   --push: Push images to registry (Default is --load to local Docker)

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the parent directory (enclave/) which should contain both node-nft/ and wallet-sdk/
ENCLAVE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Change to enclave directory for build context
cd "$ENCLAVE_DIR"

# Defaults
ENV_MODE="dev"
ACTION="load"
COMPOSE_FILE="node-nft/docker-compose.dev.yaml"

# Parse arguments
for arg in "$@"; do
    case $arg in
        prod|--prod)
            ENV_MODE="prod"
            COMPOSE_FILE="node-nft/docker-compose.yaml"
            ;;
        dev|--dev)
            ENV_MODE="dev"
            COMPOSE_FILE="node-nft/docker-compose.dev.yaml"
            ;;
        --push)
            ACTION="push"
            ;;
    esac
done

echo "📋 Mode: $ENV_MODE"
echo "📋 Action: $ACTION"
echo "📋 Using docker-compose file: $COMPOSE_FILE"

# Function to extract default value from docker-compose yaml
extract_default() {
    local var_name=$1
    local compose_file=$2
    
    local value=$(grep -A 100 "build:" "$compose_file" 2>/dev/null | \
        grep -A 20 "args:" | \
        grep "${var_name}:" | \
        sed -E "s/.*\\\$\{${var_name}:-([^}]+)\}.*/\1/" | \
        head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    if [ -z "$value" ] || [ "$value" = "${var_name}:" ]; then
        value=$(grep -A 50 "environment:" "$compose_file" 2>/dev/null | \
            grep "${var_name}:" | \
            sed -E "s/.*\\\$\{${var_name}:-([^}]+)\}.*/\1/" | \
            head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    fi
    
    if [ -z "$value" ] || [ "$value" = "${var_name}:" ]; then
        echo ""
    else
        echo "$value"
    fi
}

# Load configuration
if [ -f "$COMPOSE_FILE" ]; then
    echo "📖 Reading configuration from $COMPOSE_FILE..."
    NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS="${NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS:-$(extract_default "NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_NODE_NFT_ADDRESS="${NEXT_PUBLIC_NODE_NFT_ADDRESS:-$(extract_default "NEXT_PUBLIC_NODE_NFT_ADDRESS" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_NFT_MANAGER_ADDRESS="${NEXT_PUBLIC_NFT_MANAGER_ADDRESS:-$(extract_default "NEXT_PUBLIC_NFT_MANAGER_ADDRESS" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_USDT_ADDRESS="${NEXT_PUBLIC_USDT_ADDRESS:-$(extract_default "NEXT_PUBLIC_USDT_ADDRESS" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_CHAIN_ID="${NEXT_PUBLIC_CHAIN_ID:-$(extract_default "NEXT_PUBLIC_CHAIN_ID" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_RPC_URL="${NEXT_PUBLIC_RPC_URL:-$(extract_default "NEXT_PUBLIC_RPC_URL" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_ENABLE_TESTNET="${NEXT_PUBLIC_ENABLE_TESTNET:-$(extract_default "NEXT_PUBLIC_ENABLE_TESTNET" "$COMPOSE_FILE")}"
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-$(extract_default "NEXT_PUBLIC_API_URL" "$COMPOSE_FILE")}"
else
    echo "⚠️  Warning: $COMPOSE_FILE not found, using environment variables or empty defaults"
fi

# Validate required variables
if [ -z "$NEXT_PUBLIC_NFT_MANAGER_ADDRESS" ]; then
    echo "❌ Error: NEXT_PUBLIC_NFT_MANAGER_ADDRESS is not set"
    exit 1
fi

echo "🔧 Configuration:"
echo "   NFT Manager: $NEXT_PUBLIC_NFT_MANAGER_ADDRESS"
echo "   API URL: $NEXT_PUBLIC_API_URL"

# Docker Registry Setup
REGISTRY_PREFIX=""
if [ "$ACTION" = "push" ]; then
    if [ -n "$DOCKER_REGISTRY" ]; then
        REGISTRY_PREFIX="$DOCKER_REGISTRY/"
        echo "📦 Using registry: $DOCKER_REGISTRY"
    else
        echo "⚠️  DOCKER_REGISTRY not set. Pushing to Docker Hub (default)"
    fi
fi

# Buildx Setup
if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Docker buildx is not available."
    exit 1
fi

BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
    echo "📦 Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --use
else
    docker buildx use $BUILDER_NAME
fi

OUTPUT_FLAG="--load"
if [ "$ACTION" = "push" ]; then
    OUTPUT_FLAG="--push"
fi

echo "🔨 Building multi-architecture Docker images (Action: $ACTION)..."

# Build Backend
echo "🏗️  Building backend image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY_PREFIX}ploto/backend:zkpay \
    --tag ${REGISTRY_PREFIX}ploto/backend:latest \
    --file node-nft/backend/Dockerfile \
    node-nft/backend \
    $OUTPUT_FLAG

# Build Frontend
echo "🏗️  Building frontend image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY_PREFIX}ploto/frontend:zkpay \
    --tag ${REGISTRY_PREFIX}ploto/frontend:latest \
    --file node-nft/frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS="$NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS" \
    --build-arg NEXT_PUBLIC_NODE_NFT_ADDRESS="$NEXT_PUBLIC_NODE_NFT_ADDRESS" \
    --build-arg NEXT_PUBLIC_NFT_MANAGER_ADDRESS="$NEXT_PUBLIC_NFT_MANAGER_ADDRESS" \
    --build-arg NEXT_PUBLIC_USDT_ADDRESS="$NEXT_PUBLIC_USDT_ADDRESS" \
    --build-arg NEXT_PUBLIC_CHAIN_ID="$NEXT_PUBLIC_CHAIN_ID" \
    --build-arg NEXT_PUBLIC_RPC_URL="$NEXT_PUBLIC_RPC_URL" \
    --build-arg NEXT_PUBLIC_ENABLE_TESTNET="$NEXT_PUBLIC_ENABLE_TESTNET" \
    --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
    . \
    $OUTPUT_FLAG

echo "✅ Build complete!"
