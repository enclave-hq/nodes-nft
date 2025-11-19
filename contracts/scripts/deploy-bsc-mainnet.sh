#!/bin/bash

# BSC Mainnet Deployment Script
# This script deploys all contracts to BSC Mainnet and updates configuration files

# Don't use set -e here, we want to handle errors manually
# set -e  # Exit on error

# Cleanup function to clear private key on exit
cleanup() {
    unset PRIVATE_KEY
}
trap cleanup EXIT INT TERM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$CONTRACTS_DIR")")"

# Parse command line arguments
FORCE_DEPLOY=false
if [[ "$*" == *"--force"* ]]; then
    FORCE_DEPLOY=true
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}BSC Mainnet Deployment Script${NC}"
if [ "$FORCE_DEPLOY" = true ]; then
    echo -e "${YELLOW}⚠️  FORCE MODE: Will redeploy all contracts${NC}"
else
    echo -e "${GREEN}ℹ️  INCREMENTAL MODE: Will check existing deployments${NC}"
fi
echo -e "${BLUE}========================================${NC}\n"

# Check if we're in the right directory
if [ ! -f "$CONTRACTS_DIR/hardhat.config.ts" ]; then
    echo -e "${RED}❌ Error: hardhat.config.ts not found. Please run this script from the contracts directory.${NC}"
    exit 1
fi

# Check for .env file (for other config, not private key)
if [ ! -f "$CONTRACTS_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found in contracts directory${NC}"
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    
    cat > "$CONTRACTS_DIR/.env" << EOF
# BSC Mainnet Configuration
# NOTE: PRIVATE_KEY should NOT be stored here for security
# It will be entered interactively during deployment

BSC_MAINNET_RPC_URL=https://bsc-dataseed1.binance.org/
BSCSCAN_API_KEY=your_bscscan_api_key_here

# Contract Addresses (will be filled after deployment)
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
ORACLE_ADDRESS=
TREASURY_ADDRESS=

# Optional: Initial $E transfer to NFTManager
# INITIAL_ECLV_TRANSFER=10000000

# Optional: Base URI for NFT metadata
# BASE_URI=https://api.enclave.com/nft/metadata/
EOF
fi

# Load environment variables (excluding PRIVATE_KEY)
if [ -f "$CONTRACTS_DIR/.env" ]; then
    # Load .env but exclude PRIVATE_KEY
    set -a
    source <(grep -v '^PRIVATE_KEY=' "$CONTRACTS_DIR/.env" || true)
    set +a
fi

# Ensure BSC_MAINNET_RPC_URL is set (default if not in .env)
if [ -z "$BSC_MAINNET_RPC_URL" ]; then
    export BSC_MAINNET_RPC_URL="https://bsc-dataseed1.binance.org/"
    echo -e "${YELLOW}⚠️  BSC_MAINNET_RPC_URL 未设置，使用默认值: $BSC_MAINNET_RPC_URL${NC}"
fi

# Interactive private key input (secure, hidden input)
echo -e "${BLUE}请输入部署钱包的私钥（输入将被隐藏）:${NC}"
read -s PRIVATE_KEY
echo ""

# Validate private key format
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ Error: 私钥不能为空${NC}"
    exit 1
fi

# Remove 0x prefix if present
PRIVATE_KEY=$(echo "$PRIVATE_KEY" | sed 's/^0x//')

# Validate private key length (should be 64 hex characters)
if [ ${#PRIVATE_KEY} -ne 64 ]; then
    echo -e "${RED}❌ Error: 私钥格式不正确（应为64个十六进制字符）${NC}"
    exit 1
fi

# Validate it's hex
if ! echo "$PRIVATE_KEY" | grep -qE '^[0-9a-fA-F]{64}$'; then
    echo -e "${RED}❌ Error: 私钥必须为十六进制格式${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 私钥格式验证通过${NC}\n"

# Check BSCScan API key (optional)
if [ -z "$BSCSCAN_API_KEY" ] || [ "$BSCSCAN_API_KEY" == "your_bscscan_api_key_here" ]; then
    echo -e "${YELLOW}⚠️  警告: BSCSCAN_API_KEY 未设置。合约验证将被跳过。${NC}"
    read -p "是否现在输入 BSCScan API Key? (y/n): " input_key
    if [ "$input_key" = "y" ] || [ "$input_key" = "Y" ]; then
        echo -e "${BLUE}请输入 BSCScan API Key:${NC}"
        read BSCSCAN_API_KEY
    fi
fi

# Check BNB balance and gas price using ethers.js directly (no hardhat needed)
echo -e "${BLUE}检查部署钱包余额和 Gas Price...${NC}"
cd "$CONTRACTS_DIR"

# Create temporary script in the contracts directory so it can find node_modules
TEMP_BALANCE_SCRIPT="$CONTRACTS_DIR/.temp-check-balance.js"
cat > "$TEMP_BALANCE_SCRIPT" << 'BALANCE_SCRIPT'
const { ethers } = require("ethers");
const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org/";

async function checkBalance() {
  try {
    if (!privateKey) {
      console.error("Error: PRIVATE_KEY not set");
      process.exit(1);
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    
    // Get current gas price from chain
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
    const gasPriceGwei = Number(ethers.formatUnits(gasPrice, "gwei"));
    
    console.log("Deployer:", wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "BNB");
    console.log("GasPrice:", gasPriceGwei, "gwei");
  } catch (error) {
    console.error("Error checking balance:", error.message);
    process.exit(1);
  }
}
checkBalance();
BALANCE_SCRIPT

echo -e "${BLUE}正在连接 BSC 主网...${NC}"
echo -e "${BLUE}这可能需要几秒钟...${NC}"

# Run the balance check using node directly (no hardhat needed)
set +e  # Temporarily disable exit on error to capture the output
BALANCE_OUTPUT=$(PRIVATE_KEY="$PRIVATE_KEY" BSC_MAINNET_RPC_URL="$BSC_MAINNET_RPC_URL" node "$TEMP_BALANCE_SCRIPT" 2>&1)
BALANCE_EXIT_CODE=$?
set -e  # Re-enable exit on error

rm -f "$TEMP_BALANCE_SCRIPT"

# Check if the command failed
if [ $BALANCE_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}❌ Error: 余额检查失败 (退出码: $BALANCE_EXIT_CODE)${NC}"
    echo ""
    echo -e "${YELLOW}完整错误信息:${NC}"
    echo "$BALANCE_OUTPUT"
    echo ""
    echo -e "${YELLOW}可能的原因:${NC}"
    echo -e "  1. 网络连接问题，无法连接到 BSC 主网"
    echo -e "  2. RPC URL 配置错误或 RPC 服务不可用"
    echo -e "  3. 私钥格式不正确"
    echo -e "  4. Hardhat 配置问题"
    echo ""
    echo -e "${BLUE}调试建议:${NC}"
    echo -e "  1. 检查网络连接: curl -X POST -H \"Content-Type: application/json\" --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' $BSC_MAINNET_RPC_URL"
    echo -e "  2. 检查 hardhat 配置: cat hardhat.config.ts | grep bscMainnet"
    echo -e "  3. 手动测试连接: PRIVATE_KEY=\"$PRIVATE_KEY\" npx hardhat run --network bscMainnet <script>"
    exit 1
fi

# Extract deployer address, balance, and gas price from output
DEPLOYER_ADDRESS=$(echo "$BALANCE_OUTPUT" | grep -E 'Deployer:' | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
BALANCE=$(echo "$BALANCE_OUTPUT" | grep -E 'Balance:' | grep -oE '[0-9]+\.[0-9]+' | head -1)
GAS_PRICE_GWEI=$(echo "$BALANCE_OUTPUT" | grep -E 'GasPrice:' | grep -oE '[0-9]+\.[0-9]+' | head -1)

if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo -e "${RED}❌ Error: 无法获取部署者地址${NC}"
    echo -e "${YELLOW}脚本输出:${NC}"
    echo "$BALANCE_OUTPUT"
    exit 1
fi

if [ -z "$BALANCE" ]; then
    echo -e "${RED}❌ Error: 无法获取余额信息${NC}"
    echo -e "${YELLOW}脚本输出:${NC}"
    echo "$BALANCE_OUTPUT"
    exit 1
fi

if [ -z "$GAS_PRICE_GWEI" ]; then
    echo -e "${YELLOW}⚠️  警告: 无法从链上获取 Gas Price，使用默认值 5 gwei${NC}"
    GAS_PRICE_GWEI=5
fi

echo -e "${GREEN}部署者地址: $DEPLOYER_ADDRESS${NC}"
echo -e "${BLUE}当前余额: $BALANCE BNB${NC}"
echo -e "${BLUE}当前 Gas Price: ${GAS_PRICE_GWEI} gwei (从链上读取)${NC}"

# Calculate estimated gas cost based on actual gas price from chain
# Based on: EnclaveToken (~1.2M) + NodeNFT (~2M) + NFTManager (~4M) + setup (~0.5M) = ~7.7M gas
ESTIMATED_GAS=7700000
ESTIMATED_COST=$(awk "BEGIN {printf \"%.8f\", ($ESTIMATED_GAS * $GAS_PRICE_GWEI * 1e9) / 1e18}")
MIN_BALANCE=$(awk "BEGIN {printf \"%.8f\", $ESTIMATED_COST * 1.5}")

echo ""
echo -e "${BLUE}Gas 成本估算:${NC}"
echo -e "  预计总 Gas: ${ESTIMATED_GAS} (约 7.7M)"
echo -e "  当前 Gas Price: ${GAS_PRICE_GWEI} gwei"
echo -e "  预计成本: ~${ESTIMATED_COST} BNB"
echo -e "  建议最小余额: ${MIN_BALANCE} BNB (含 1.5x 安全余量)"

# Check if balance is sufficient
BALANCE_SUFFICIENT=$(awk "BEGIN {print ($BALANCE >= $MIN_BALANCE)}")

if [ "$BALANCE_SUFFICIENT" != "1" ]; then
    NEEDED=$(awk "BEGIN {printf \"%.8f\", $MIN_BALANCE - $BALANCE}")
    echo ""
    echo -e "${RED}❌ Error: BNB 余额不足${NC}"
    echo -e "${YELLOW}需要至少 ${MIN_BALANCE} BNB 用于部署${NC}"
    echo -e "${YELLOW}当前余额: $BALANCE BNB${NC}"
    echo -e "${YELLOW}缺少: ${NEEDED} BNB${NC}"
    echo ""
    echo -e "${BLUE}选项:${NC}"
    echo -e "  向钱包 $DEPLOYER_ADDRESS 转账至少 ${NEEDED} BNB"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ 余额检查通过: $BALANCE BNB (足够支付预计 ${ESTIMATED_COST} BNB 的部署费用)${NC}\n"

# Compile contracts
echo -e "${BLUE}Compiling contracts...${NC}"
npx hardhat compile
echo -e "${GREEN}✅ Compilation complete${NC}\n"

# Confirm deployment
echo -e "${YELLOW}⚠️  警告: 这将部署合约到 BSC 主网！${NC}"
echo -e "${YELLOW}⚠️  请确认您已准备好:${NC}"
echo -e "  - 已确认所有配置"
echo -e "  - 有足够的 BNB 支付 gas 费用"
echo -e "  - USDT 地址正确 (BSC 主网: 0x55d398326f99059fF775485246999027B3197955)"
echo -e "  - 部署者地址: $DEPLOYER_ADDRESS"
echo ""
read -p "输入 'DEPLOY' 确认部署: " confirm

if [ "$confirm" != "DEPLOY" ]; then
    echo -e "${RED}部署已取消。${NC}"
    # Clear private key from memory
    unset PRIVATE_KEY
    exit 0
fi

# Deploy contracts with private key from environment
echo -e "\n${BLUE}正在部署合约到 BSC 主网...${NC}"
echo -e "${BLUE}这可能需要几分钟时间...${NC}\n"

# Export private key as environment variable for hardhat
export PRIVATE_KEY="$PRIVATE_KEY"
export BSC_MAINNET_RPC_URL="$BSC_MAINNET_RPC_URL"

# Run deployment with error handling
set +e  # Temporarily disable exit on error
# Build deploy command with optional --force flag
DEPLOY_CMD="npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet"
if [ "$FORCE_DEPLOY" = true ]; then
    DEPLOY_CMD="$DEPLOY_CMD -- --force"
fi

DEPLOY_OUTPUT=$(PRIVATE_KEY="$PRIVATE_KEY" BSC_MAINNET_RPC_URL="$BSC_MAINNET_RPC_URL" $DEPLOY_CMD 2>&1)
DEPLOY_EXIT_CODE=$?
set -e  # Re-enable exit on error

# Check if deployment failed
if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}❌ Error: 部署失败 (退出码: $DEPLOY_EXIT_CODE)${NC}"
    echo ""
    echo -e "${YELLOW}完整错误信息:${NC}"
    echo "$DEPLOY_OUTPUT"
    echo ""
    echo -e "${YELLOW}可能的原因:${NC}"
    echo -e "  1. 网络连接问题"
    echo -e "  2. Gas 不足或 gas price 设置错误"
    echo -e "  3. 合约编译错误"
    echo -e "  4. 私钥或配置错误"
    exit 1
fi

# Extract contract addresses from output
ECLV_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'EnclaveToken \(\$E\): \K0x[a-fA-F0-9]+' || echo "")
VESTING_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'TokenVesting:\s+\K0x[a-fA-F0-9]+' || echo "")
NFT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'NodeNFT:\s+\K0x[a-fA-F0-9]+' || echo "")
MANAGER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'NFTManager \(Proxy\):\s+\K0x[a-fA-F0-9]+' || echo "")
MANAGER_IMPL_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'NFTManager \(Impl\):\s+\K0x[a-fA-F0-9]+' || echo "")

if [ -z "$ECLV_ADDRESS" ] || [ -z "$VESTING_ADDRESS" ] || [ -z "$NFT_ADDRESS" ] || [ -z "$MANAGER_ADDRESS" ]; then
    echo -e "${RED}❌ Error: 无法从部署输出中提取合约地址${NC}"
    echo -e "${YELLOW}部署输出:${NC}"
    echo "$DEPLOY_OUTPUT"
    echo ""
    echo -e "${YELLOW}请检查部署是否成功完成${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Deployment complete!${NC}\n"
echo -e "${GREEN}Contract Addresses:${NC}"
echo -e "  EnclaveToken:     $ECLV_ADDRESS"
echo -e "  TokenVesting:     $VESTING_ADDRESS"
echo -e "  NodeNFT:          $NFT_ADDRESS"
echo -e "  NFTManager:        $MANAGER_ADDRESS"
echo -e "  NFTManager Impl:   $MANAGER_IMPL_ADDRESS"

# Update contracts/.env
echo -e "\n${BLUE}Updating contracts/.env...${NC}"
if [ -f "$CONTRACTS_DIR/.env" ]; then
    # Update or add contract addresses
    grep -q "ECLV_ADDRESS=" "$CONTRACTS_DIR/.env" && \
        sed -i.bak "s/ECLV_ADDRESS=.*/ECLV_ADDRESS=$ECLV_ADDRESS/" "$CONTRACTS_DIR/.env" || \
        echo "ECLV_ADDRESS=$ECLV_ADDRESS" >> "$CONTRACTS_DIR/.env"
    
    grep -q "VESTING_ADDRESS=" "$CONTRACTS_DIR/.env" && \
        sed -i.bak "s/VESTING_ADDRESS=.*/VESTING_ADDRESS=$VESTING_ADDRESS/" "$CONTRACTS_DIR/.env" || \
        echo "VESTING_ADDRESS=$VESTING_ADDRESS" >> "$CONTRACTS_DIR/.env"
    
    grep -q "NFT_ADDRESS=" "$CONTRACTS_DIR/.env" && \
        sed -i.bak "s/NFT_ADDRESS=.*/NFT_ADDRESS=$NFT_ADDRESS/" "$CONTRACTS_DIR/.env" || \
        echo "NFT_ADDRESS=$NFT_ADDRESS" >> "$CONTRACTS_DIR/.env"
    
    grep -q "MANAGER_ADDRESS=" "$CONTRACTS_DIR/.env" && \
        sed -i.bak "s/MANAGER_ADDRESS=.*/MANAGER_ADDRESS=$MANAGER_ADDRESS/" "$CONTRACTS_DIR/.env" || \
        echo "MANAGER_ADDRESS=$MANAGER_ADDRESS" >> "$CONTRACTS_DIR/.env"
    
    grep -q "MANAGER_IMPL_ADDRESS=" "$CONTRACTS_DIR/.env" && \
        sed -i.bak "s/MANAGER_IMPL_ADDRESS=.*/MANAGER_IMPL_ADDRESS=$MANAGER_IMPL_ADDRESS/" "$CONTRACTS_DIR/.env" || \
        echo "MANAGER_IMPL_ADDRESS=$MANAGER_IMPL_ADDRESS" >> "$CONTRACTS_DIR/.env"
    
    rm -f "$CONTRACTS_DIR/.env.bak"
    echo -e "${GREEN}✅ Updated contracts/.env${NC}"
fi

# Update frontend/.env.local
echo -e "\n${BLUE}Updating frontend/.env.local...${NC}"
FRONTEND_ENV="$PROJECT_ROOT/frontend/.env.local"
if [ ! -f "$FRONTEND_ENV" ]; then
    # Create from example if it doesn't exist
    if [ -f "$PROJECT_ROOT/frontend/env.example" ]; then
        cp "$PROJECT_ROOT/frontend/env.example" "$FRONTEND_ENV"
    fi
fi

if [ -f "$FRONTEND_ENV" ]; then
    # Update contract addresses
    grep -q "NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=.*|NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS" >> "$FRONTEND_ENV"
    
    grep -q "NEXT_PUBLIC_NODE_NFT_ADDRESS=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_NODE_NFT_ADDRESS=.*|NEXT_PUBLIC_NODE_NFT_ADDRESS=$NFT_ADDRESS|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_NODE_NFT_ADDRESS=$NFT_ADDRESS" >> "$FRONTEND_ENV"
    
    grep -q "NEXT_PUBLIC_NFT_MANAGER_ADDRESS=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_NFT_MANAGER_ADDRESS=.*|NEXT_PUBLIC_NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS" >> "$FRONTEND_ENV"
    
    grep -q "NEXT_PUBLIC_USDT_ADDRESS=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_USDT_ADDRESS=.*|NEXT_PUBLIC_USDT_ADDRESS=$USDT_ADDRESS|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_USDT_ADDRESS=$USDT_ADDRESS" >> "$FRONTEND_ENV"
    
    # Update network configuration for BSC Mainnet
    grep -q "NEXT_PUBLIC_CHAIN_ID=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_CHAIN_ID=.*|NEXT_PUBLIC_CHAIN_ID=56|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_CHAIN_ID=56" >> "$FRONTEND_ENV"
    
    grep -q "NEXT_PUBLIC_RPC_URL=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_RPC_URL=.*|NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org/|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org/" >> "$FRONTEND_ENV"
    
    grep -q "NEXT_PUBLIC_ENABLE_TESTNET=" "$FRONTEND_ENV" && \
        sed -i.bak "s|NEXT_PUBLIC_ENABLE_TESTNET=.*|NEXT_PUBLIC_ENABLE_TESTNET=false|" "$FRONTEND_ENV" || \
        echo "NEXT_PUBLIC_ENABLE_TESTNET=false" >> "$FRONTEND_ENV"
    
    rm -f "$FRONTEND_ENV.bak"
    echo -e "${GREEN}✅ Updated frontend/.env.local${NC}"
fi

# Update backend/.env
echo -e "\n${BLUE}Updating backend/.env...${NC}"
BACKEND_ENV="$PROJECT_ROOT/backend/.env"
if [ ! -f "$BACKEND_ENV" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found. Creating from template...${NC}"
    cat > "$BACKEND_ENV" << EOF
# Database
DATABASE_URL=postgresql://nft_admin:nft_password@postgres:5432/nft_db

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# Contract Configuration
NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS
ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS
USDT_TOKEN_ADDRESS=$USDT_ADDRESS
RPC_URL=https://bsc-dataseed1.binance.org/

# Admin Private Key (for contract calls)
ADMIN_PRIVATE_KEY=your_admin_private_key_here

# Service Port
PORT=4000

# CORS
FRONTEND_URL=https://nodes.enclave-hq.com,http://localhost:4001
EOF
fi

if [ -f "$BACKEND_ENV" ]; then
    grep -q "NFT_MANAGER_ADDRESS=" "$BACKEND_ENV" && \
        sed -i.bak "s|NFT_MANAGER_ADDRESS=.*|NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS|" "$BACKEND_ENV" || \
        echo "NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS" >> "$BACKEND_ENV"
    
    grep -q "ENCLAVE_TOKEN_ADDRESS=" "$BACKEND_ENV" && \
        sed -i.bak "s|ENCLAVE_TOKEN_ADDRESS=.*|ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS|" "$BACKEND_ENV" || \
        echo "ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS" >> "$BACKEND_ENV"
    
    grep -q "USDT_TOKEN_ADDRESS=" "$BACKEND_ENV" && \
        sed -i.bak "s|USDT_TOKEN_ADDRESS=.*|USDT_TOKEN_ADDRESS=$USDT_ADDRESS|" "$BACKEND_ENV" || \
        echo "USDT_TOKEN_ADDRESS=$USDT_ADDRESS" >> "$BACKEND_ENV"
    
    grep -q "RPC_URL=" "$BACKEND_ENV" && \
        sed -i.bak "s|RPC_URL=.*|RPC_URL=https://bsc-dataseed1.binance.org/|" "$BACKEND_ENV" || \
        echo "RPC_URL=https://bsc-dataseed1.binance.org/" >> "$BACKEND_ENV"
    
    rm -f "$BACKEND_ENV.bak"
    echo -e "${GREEN}✅ Updated backend/.env${NC}"
fi

# Generate deployment report
echo -e "\n${BLUE}Generating deployment report...${NC}"
REPORT_FILE="$CONTRACTS_DIR/BSC_MAINNET_DEPLOYMENT_$(date +%Y%m%d_%H%M%S).md"
cat > "$REPORT_FILE" << EOF
# BSC Mainnet Deployment Report

**Deployment Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Network:** BSC Mainnet (Chain ID: 56)
**Deployer:** $(echo "$DEPLOY_OUTPUT" | grep -oP 'Deployer: \K0x[a-fA-F0-9]+' || echo "N/A")

## Contract Addresses

| Contract | Address | BSCScan |
|----------|---------|---------|
| EnclaveToken (\$E) | \`$ECLV_ADDRESS\` | [View](https://bscscan.com/address/$ECLV_ADDRESS) |
| NodeNFT | \`$NFT_ADDRESS\` | [View](https://bscscan.com/address/$NFT_ADDRESS) |
| NFTManager (Proxy) | \`$MANAGER_ADDRESS\` | [View](https://bscscan.com/address/$MANAGER_ADDRESS) |
| NFTManager (Implementation) | \`$MANAGER_IMPL_ADDRESS\` | [View](https://bscscan.com/address/$MANAGER_IMPL_ADDRESS) |
| USDT | \`$USDT_ADDRESS\` | [View](https://bscscan.com/address/$USDT_ADDRESS) |

## Configuration Files Updated

- ✅ \`contracts/.env\`
- ✅ \`frontend/.env.local\`
- ✅ \`backend/.env\`

## Next Steps

1. **Verify contracts on BSCScan:**
   \`\`\`bash
   npx hardhat verify --network bscMainnet $ECLV_ADDRESS
   npx hardhat verify --network bscMainnet $NFT_ADDRESS "Enclave Node NFT" "ENFT"
   npx hardhat verify --network bscMainnet $MANAGER_IMPL_ADDRESS
   \`\`\`

2. **Test basic functionality:**
   - Mint an NFT
   - Check contract interactions
   - Verify reward distribution

3. **Update production services:**
   - Restart backend service with new configuration
   - Rebuild and deploy frontend with new configuration
   - Update monitoring and alerts

4. **Security checklist:**
   - [ ] All contracts verified on BSCScan
   - [ ] Oracle address set correctly
   - [ ] Treasury address set correctly
   - [ ] Admin private key secured
   - [ ] Frontend and backend environment variables updated
   - [ ] Database migrations completed
   - [ ] Monitoring and alerts configured

## Environment Variables

### Frontend (.env.local)
\`\`\`
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS
NEXT_PUBLIC_NODE_NFT_ADDRESS=$NFT_ADDRESS
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS
NEXT_PUBLIC_USDT_ADDRESS=$USDT_ADDRESS
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org/
NEXT_PUBLIC_ENABLE_TESTNET=false
\`\`\`

### Backend (.env)
\`\`\`
NFT_MANAGER_ADDRESS=$MANAGER_ADDRESS
ENCLAVE_TOKEN_ADDRESS=$ECLV_ADDRESS
USDT_TOKEN_ADDRESS=$USDT_ADDRESS
RPC_URL=https://bsc-dataseed1.binance.org/
\`\`\`
EOF

echo -e "${GREEN}✅ Deployment report saved to: $REPORT_FILE${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}\n"
echo -e "Contract Addresses:"
echo -e "  EnclaveToken:     $ECLV_ADDRESS"
echo -e "  NodeNFT:          $NFT_ADDRESS"
echo -e "  NFTManager:       $MANAGER_ADDRESS"
echo -e "  Implementation:   $MANAGER_IMPL_ADDRESS"
echo -e "\nConfiguration files updated:"
echo -e "  ✅ contracts/.env"
echo -e "  ✅ frontend/.env.local"
echo -e "  ✅ backend/.env"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Verify contracts on BSCScan"
echo -e "  2. Test basic functionality"
echo -e "  3. Update production services"
echo -e "  4. Review deployment report: $REPORT_FILE"
# Clear private key from environment
unset PRIVATE_KEY

echo -e "\n${GREEN}✅ BSC 主网部署完成！${NC}\n"

