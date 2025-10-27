# 📜 Deployment and Testing Scripts

All scripts for deploying and testing the Enclave Node NFT system on BSC Testnet.

---

## 📋 Script Index

### 🚀 Deployment Scripts

| Script | Purpose | Prerequisites | Runtime |
|--------|---------|---------------|---------|
| `01-deploy-usdt.ts` | Deploy Test USDT token | Private key, BNB | ~1 min |
| `02-deploy-main.ts` | Deploy all main contracts | USDT address | ~3 min |

### 🧪 Testing Scripts

| Script | Purpose | Prerequisites | Runtime |
|--------|---------|---------------|---------|
| `03-setup-test-accounts.ts` | Distribute USDT to test accounts | Deployed USDT | ~2 min |
| `04-test-mint.ts` | Test NFT minting | Deployed contracts, USDT | ~2 min |
| `05-test-distribute-and-claim.ts` | Test distribution & claiming | Minted NFTs | ~3 min |

---

## 🚀 Usage

### Step 1: Setup Environment

```bash
# Copy and edit .env file
cp .env.example .env
nano .env  # Add your PRIVATE_KEY
```

### Step 2: Deploy Contracts

```bash
# Deploy Test USDT
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet

# Add USDT address to .env
# USDT_ADDRESS=0x...

# Deploy main contracts
npx hardhat run scripts/02-deploy-main.ts --network bscTestnet
```

### Step 3: Run Tests

```bash
# Optional: Setup test accounts
npx hardhat run scripts/03-setup-test-accounts.ts --network bscTestnet

# Test minting
npx hardhat run scripts/04-test-mint.ts --network bscTestnet

# Test distribution and claiming
npx hardhat run scripts/05-test-distribute-and-claim.ts --network bscTestnet
```

---

## 📝 Script Details

### 01-deploy-usdt.ts

**Purpose:** Deploy a test USDT ERC-20 token for testing purposes.

**What it does:**
- Deploys TestUSDT contract
- Mints 10,000,000 USDT to deployer
- Outputs contract address for .env configuration

**Output:**
```
✅ Test USDT deployed to: 0x...
📊 Initial supply: 10,000,000 USDT
```

**Next step:** Add `USDT_ADDRESS` to your `.env` file.

---

### 02-deploy-main.ts

**Purpose:** Deploy all main contracts (EnclaveToken, NodeNFT, NFTManager).

**What it does:**
1. Deploys EnclaveToken (100M ECLV)
2. Deploys NodeNFT (ERC-721)
3. Deploys NFTManager (Upgradeable UUPS Proxy)
4. Configures NFTManager in NodeNFT
5. Sets base URI for NFT metadata
6. Adds USDT as reward token
7. Transfers 10M ECLV to NFTManager
8. Sets oracle address (deployer for testing)

**Output:**
```
✅ EnclaveToken deployed to: 0x...
✅ NodeNFT deployed to: 0x...
✅ NFTManager deployed to: 0x...
```

Plus configuration instructions for both contracts/.env and frontend/.env.local.

**Next step:** Save all contract addresses and update environment variables.

---

### 03-setup-test-accounts.ts

**Purpose:** Distribute USDT to multiple test accounts for testing.

**What it does:**
- Mints 100,000 USDT to each configured test account
- Useful for multi-user testing scenarios

**Configuration:**
Edit the script to add your test wallet addresses:
```typescript
const testAccounts = [
  "0x1234...", // Alice
  "0x5678...", // Bob
];
```

**Output:**
```
✅ Minted 100,000 USDT to 0x...
```

---

### 04-test-mint.ts

**Purpose:** Test NFT minting functionality for both Standard and Premium types.

**What it does:**
1. Connects to deployed contracts
2. Checks USDT balance
3. Displays NFT configurations
4. Mints a Standard NFT (10,000 USDT)
5. Mints a Premium NFT (50,000 USDT)
6. Verifies NFT ownership and pool configurations

**Requirements:**
- USDT balance ≥ 60,000 USDT
- All contracts deployed

**Output:**
```
✅ Standard NFT minted! NFT ID: 1
✅ Premium NFT minted! NFT ID: 2
📊 Total NFTs minted: 2
```

**What to verify:**
- NFT ownership is correct
- Pool configurations match (shares, weight, ECLV quota)
- USDT balance decreased by mint prices

---

### 05-test-distribute-and-claim.ts

**Purpose:** Test reward distribution and claiming mechanisms.

**What it does:**
1. Verifies oracle permissions
2. Distributes 1,000 ECLV production
3. Distributes 500 USDT rewards
4. Checks pending rewards for NFT #1
5. Claims ECLV production
6. Claims USDT rewards
7. Tests batch claiming

**Requirements:**
- At least 1 NFT minted
- Deployer is oracle
- Oracle has USDT for reward distribution

**Output:**
```
✅ ECLV distributed!
✅ USDT rewards distributed!
✅ Claimed X ECLV
✅ Claimed X USDT
```

**What to verify:**
- Global accumulated index updates
- Pending rewards calculate correctly
- Claim operations work
- Token balances update correctly

---

## 🎯 Testing Scenarios

### Scenario 1: Fresh Deployment Test
```bash
# Full deployment from scratch
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet
# Add USDT_ADDRESS to .env
npx hardhat run scripts/02-deploy-main.ts --network bscTestnet
# Add all addresses to .env
npx hardhat run scripts/04-test-mint.ts --network bscTestnet
npx hardhat run scripts/05-test-distribute-and-claim.ts --network bscTestnet
```

**Expected time:** ~10 minutes  
**Expected cost:** ~0.3-0.5 BNB

### Scenario 2: Multi-User Testing
```bash
# Setup test accounts
# Edit 03-setup-test-accounts.ts first
npx hardhat run scripts/03-setup-test-accounts.ts --network bscTestnet

# Then test with different wallets
# Change PRIVATE_KEY in .env for each test
```

### Scenario 3: Gas Measurement
```bash
# Enable gas reporting
export REPORT_GAS=true

# Run tests and record gas usage
npx hardhat run scripts/04-test-mint.ts --network bscTestnet
npx hardhat run scripts/05-test-distribute-and-claim.ts --network bscTestnet
```

---

## 📊 Expected Gas Costs

Reference values (actual may vary):

| Operation | Estimated Gas | At 10 gwei | Notes |
|-----------|--------------|------------|-------|
| Deploy USDT | ~1,500k | ~0.015 BNB | One-time |
| Deploy ECLV | ~1,200k | ~0.012 BNB | One-time |
| Deploy NFT | ~2,000k | ~0.020 BNB | One-time |
| Deploy Manager | ~4,000k | ~0.040 BNB | One-time (proxy) |
| Mint Standard | ~200k | ~0.002 BNB | Per mint |
| Mint Premium | ~200k | ~0.002 BNB | Per mint |
| Distribute (O(1)) | ~50-100k | ~0.001 BNB | Fixed cost! |
| Claim | ~50-80k | ~0.001 BNB | Per claim |

**Total deployment cost:** ~0.1 BNB  
**Total test cost:** ~0.01 BNB

---

## 🐛 Troubleshooting

### Error: "insufficient funds for gas"
**Solution:** Get more testnet BNB from https://testnet.binance.org/faucet-smart

### Error: "Please set USDT_ADDRESS in .env"
**Solution:** Run `01-deploy-usdt.ts` first and add the address to `.env`

### Error: "nonce too low"
**Solution:** Reset your MetaMask account (Settings > Advanced > Reset Account)

### Error: "Insufficient USDT balance"
**Solution:** 
- Run `03-setup-test-accounts.ts` to mint more USDT, or
- Use `usdt.mint(yourAddress, amount)` in Hardhat console

### Script hangs or times out
**Solution:**
- Check your RPC URL
- Try a different RPC endpoint
- Check network connectivity

---

## 🔍 Verification

After deployment, verify contracts on BSCScan:

```bash
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS]
```

Example:
```bash
npx hardhat verify --network bscTestnet 0x123... # USDT
npx hardhat verify --network bscTestnet 0x456... # ECLV
npx hardhat verify --network bscTestnet 0x789... # NFT
```

---

## 📝 Logs and Debugging

### Enable detailed logging
```bash
# Set Hardhat to verbose mode
export DEBUG=hardhat:*

# Run script
npx hardhat run scripts/04-test-mint.ts --network bscTestnet
```

### Use Hardhat Console
```bash
npx hardhat console --network bscTestnet
```

```javascript
// Connect to contracts
const manager = await ethers.getContractAt("NFTManager", "0x...");
const nft = await ethers.getContractAt("NodeNFT", "0x...");

// Query state
const pool = await manager.nftPools(1);
console.log(pool);

// Test functions
const tx = await manager.claimProduced(1);
await tx.wait();
```

---

## 📚 Additional Resources

- **Full Guide:** [TESTNET_DEPLOYMENT_GUIDE.md](../TESTNET_DEPLOYMENT_GUIDE.md)
- **Quick Start:** [QUICK_START.md](../QUICK_START.md)
- **Test Report:** [TEST_REPORT_TEMPLATE.md](../TEST_REPORT_TEMPLATE.md)
- **Testing Overview:** [TESTING_COMPLETE.md](../TESTING_COMPLETE.md)

---

## 💡 Tips

1. **Save all transaction hashes** - Useful for debugging and verification
2. **Record all contract addresses** - Keep them organized in .env
3. **Test incrementally** - Run one script at a time and verify results
4. **Monitor BSCScan** - Watch transactions in real-time
5. **Use test accounts** - Create multiple wallets for realistic testing

---

**Ready to deploy? Start with** [QUICK_START.md](../QUICK_START.md)! 🚀


