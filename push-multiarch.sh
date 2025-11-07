#!/bin/bash
# Multi-architecture Docker push script
# Builds and pushes images for both amd64 and arm64 platforms

set -e

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
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY_PREFIX}ploto/frontend:zkpay \
    --tag ${REGISTRY_PREFIX}ploto/frontend:latest \
    --file frontend/Dockerfile \
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

