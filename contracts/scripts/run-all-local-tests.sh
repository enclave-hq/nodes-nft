#!/bin/bash

echo "🧪 Running All Local Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Deploy
echo "📦 Test 1: Deploying All Contracts..."
npx hardhat run scripts/local-01-deploy-all.ts --network localhost
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment SUCCESS${NC}"
else
    echo -e "${RED}❌ Deployment FAILED${NC}"
    exit 1
fi
echo ""

# Test 2: Mint
echo "🎨 Test 2: Testing NFT Minting..."
npx hardhat run scripts/local-02-test-mint.ts --network localhost
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Minting SUCCESS${NC}"
else
    echo -e "${RED}❌ Minting FAILED${NC}"
    exit 1
fi
echo ""

# Test 3: Distribution
echo "💰 Test 3: Testing Distribution & Claiming..."
npx hardhat run scripts/local-03-test-distribution.ts --network localhost
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Distribution SUCCESS${NC}"
else
    echo -e "${RED}❌ Distribution FAILED${NC}"
    exit 1
fi
echo ""

# Test 4: Marketplace
echo "🛒 Test 4: Testing Marketplace..."
npx hardhat run scripts/local-04-test-marketplace.ts --network localhost
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Marketplace SUCCESS${NC}"
else
    echo -e "${RED}❌ Marketplace FAILED${NC}"
    exit 1
fi
echo ""

# Test 5: Unlock
echo "🔓 Test 5: Testing Unlock Mechanism..."
npx hardhat run scripts/local-05-test-unlock.ts --network localhost
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Unlock SUCCESS${NC}"
else
    echo -e "${RED}❌ Unlock FAILED${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
echo "=========================================="



