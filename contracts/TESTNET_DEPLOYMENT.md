# BSC Testnet Deployment Guide

**Date:** October 27, 2025  
**Network:** BSC Testnet (Chain ID: 97)  
**Status:** 🚀 **Ready to Deploy**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Contract Compilation](#contract-compilation)
4. [Deployment Process](#deployment-process)
5. [Testing Plan](#testing-plan)
6. [Contract Verification](#contract-verification)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### 1. Required Resources

- ✅ **Testnet BNB** - For deployment and transaction gas fees
  - Get from: https://testnet.binance.org/faucet-smart
  - Recommended: At least 0.5 BNB

- ✅ **Test USDT** - For minting NFTs
  - We need to deploy a test USDT token

- ✅ **BSCScan API Key** - For contract verification
  - Get from: https://bscscan.com/myapikey

### 2. Wallet Preparation

```bash
# Record the following information:
DEPLOYER_ADDRESS=0x...
PRIVATE_KEY=0x... (without 0x prefix)
```

---

## ⚙️ Environment Setup

### 1. Create `.env` File

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
cp .env.example .env
```

### 2. Edit `.env` File

```bash
# BSC Testnet Configuration
PRIVATE_KEY=your_private_key_without_0x
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_bscscan_api_key

# Optional: Gas Reporter
REPORT_GAS=false

# Network Selection
NETWORK=bscTestnet
```

### 3. Install Dependencies

```bash
npm install
```

---

## 🔨 Contract Compilation

```bash
npx hardhat compile
```

**Expected Output:**
```
Compiled 5 Solidity files successfully
✓ EnclaveToken ($E)
✓ NodeNFT
✓ NFTManager
✓ TestUSDT
```

---

## 🚀 Deployment Process

### Phase 1: Deploy Test USDT

```bash
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet
```

**Expected Output:**
```
✅ Test USDT deployed to: 0x...
✅ Minted 1,000,000 USDT to deployer
```

**Save this address to `.env`:**
```bash
USDT_ADDRESS=0x...
```

### Phase 2: Deploy Main Contracts

```bash
npx hardhat run scripts/02-deploy-main.ts --network bscTestnet
```

**Expected Output:**
```
✅ EnclaveToken ($E) deployed to: 0x...
✅ NodeNFT deployed to: 0x...
✅ NFTManager deployed to: 0x...
```

**Save all addresses to `.env`**

### Phase 3: Setup Test Accounts (Optional)

```bash
npx hardhat run scripts/03-setup-test-accounts.ts --network bscTestnet
```

This distributes USDT to test accounts for minting.

---

## 🧪 Testing Plan

### Test 1: Mint NFTs

```bash
npx hardhat run scripts/04-test-mint.ts --network bscTestnet
```

**Tests:**
- Mint Standard NFT (10,000 USDT)
- Mint Premium NFT (50,000 USDT)
- Verify ownership and configuration

### Test 2: Distribution & Claiming

```bash
npx hardhat run scripts/05-test-distribute-and-claim.ts --network bscTestnet
```

**Tests:**
- Distribute $E production
- Distribute USDT rewards
- Query pending rewards
- Claim rewards
- Verify O(1) gas optimization

---

## ✅ Contract Verification

```bash
# Verify USDT
npx hardhat verify --network bscTestnet <USDT_ADDRESS>

# Verify EnclaveToken
npx hardhat verify --network bscTestnet <TOKEN_ADDRESS>

# Verify NodeNFT
npx hardhat verify --network bscTestnet <NFT_ADDRESS> "Enclave Node NFT" "ENFT"

# Verify NFTManager (proxy)
npx hardhat verify --network bscTestnet <MANAGER_ADDRESS>
```

---

## 📊 Monitoring

### Using BSCScan Testnet

Visit: https://testnet.bscscan.com

**Monitor:**
1. Contract deployment transactions
2. Mint transactions
3. Claim transactions
4. Event logs

### Using Hardhat Console

```bash
npx hardhat console --network bscTestnet
```

```javascript
// Connect to contracts
const manager = await ethers.getContractAt("NFTManager", "0x...");

// Query information
const config = await manager.nftConfigs(0); // Standard NFT
const pool = await manager.nftPools(1); // NFT #1
const globalState = await manager.globalState();
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Insufficient Gas**
```
Error: insufficient funds for gas
```
**Solution:** Get more test BNB from faucet

**2. Insufficient USDT**
```
Error: Insufficient USDT balance
```
**Solution:** Run `03-setup-test-accounts.ts` to mint more USDT

**3. Authorization Failed**
```
Error: ERC20: insufficient allowance
```
**Solution:** Approve USDT first before operation

**4. Nonce Too Low**
```
Error: nonce too low
```
**Solution:** Reset MetaMask account (Settings > Advanced > Reset Account)

---

## 📝 Deployment Checklist

### Deployment Phase
- [ ] Get testnet BNB
- [ ] Configure .env file
- [ ] Deploy TestUSDT
- [ ] Deploy main contracts
- [ ] Verify contracts

### Testing Phase
- [ ] Test minting
- [ ] Test distribution and claiming
- [ ] Record gas costs
- [ ] Document results

---

## 🚀 Next Steps

After deployment and testing:

1. **Record all contract addresses** - Save to secure location
2. **Create test report** - Document all test results
3. **Performance analysis** - Record gas consumption
4. **Security audit** - Check for potential issues
5. **Prepare mainnet deployment** - Final deployment plan

---

**Ready to deploy!** 🚀
