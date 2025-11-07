#!/bin/bash
# Multi-architecture Docker build script
# Builds images for both amd64 and arm64 platforms

set -e

echo "🔨 Building multi-architecture Docker images..."

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Docker buildx is not available. Please install Docker buildx."
    exit 1
fi

# Create and use a new builder instance for multi-arch
BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
    echo "📦 Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --use
fi

docker buildx use $BUILDER_NAME

# Build backend image for multiple platforms
echo "🏗️  Building backend image (amd64, arm64)..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ploto/backend:zkpay \
    --tag ploto/backend:latest \
    --file backend/Dockerfile \
    ./backend \
    --load  # Use --push to push to registry instead

# Build frontend image for multiple platforms
echo "🏗️  Building frontend image (amd64, arm64)..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ploto/frontend:zkpay \
    --tag ploto/frontend:latest \
    --file frontend/Dockerfile \
    ./frontend \
    --load  # Use --push to push to registry instead

echo "✅ Multi-architecture build complete!"
echo ""
echo "📝 Note: --load flag only loads ONE architecture to local Docker"
echo "   For multi-arch, you need to use --push to push to registry"
echo ""
echo "🚀 To push both architectures to registry, use:"
echo "   ./push-multiarch.sh"
echo ""
echo "   Or manually:"
echo "   docker buildx build --platform linux/amd64,linux/arm64 --push -t ploto/backend:zkpay ./backend"
echo "   docker buildx build --platform linux/amd64,linux/arm64 --push -t ploto/frontend:zkpay ./frontend"

