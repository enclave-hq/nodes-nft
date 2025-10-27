# Local Testing Guide (Hardhat Network)

**Recommended: Test locally first, then deploy to testnet!**

---

## 🎯 Why Test Locally First?

### ✅ Advantages
1. **Zero Cost** - No real BNB required
2. **Fast Iteration** - Instant confirmation, no waiting for blocks
3. **Full Control** - Manipulate time, snapshots, rollbacks
4. **Easy Debugging** - Detailed error messages and stack traces
5. **Unlimited Resets** - Start over anytime

### ⚠️ Limitations
1. Frontend cannot directly connect (requires localhost RPC configuration)
2. No block explorer visibility
3. Not a real network environment

---

## 🚀 Quick Start

### 1. Start Local Node

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# Terminal 1: Start Hardhat node
npx hardhat node
```

**Expected Output:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

**Keep this terminal running!**

### 2. Run Tests in New Terminal

```bash
# Terminal 2: Run test scripts
cd /Users/qizhongzhu/enclave/node-nft/contracts

# Deploy all contracts
npx hardhat run scripts/local-01-deploy-all.ts --network localhost

# Test minting
npx hardhat run scripts/local-02-test-mint.ts --network localhost

# Test distribution and claiming
npx hardhat run scripts/local-03-test-distribution.ts --network localhost

# Test marketplace
npx hardhat run scripts/local-04-test-marketplace.ts --network localhost

# Test unlock mechanism
npx hardhat run scripts/local-05-test-unlock.ts --network localhost
```

**Or run all tests at once:**
```bash
./scripts/run-all-local-tests.sh
```

---

## 📜 Local Test Scripts

### Script List
1. `local-01-deploy-all.ts` - Deploy all contracts
2. `local-02-test-mint.ts` - Test minting
3. `local-03-test-distribution.ts` - Test distribution and claiming
4. `local-04-test-marketplace.ts` - Test share trading and marketplace
5. `local-05-test-unlock.ts` - Test unlock mechanism (includes time manipulation)

---

## 🧪 Advanced Testing Features

### 1. Time Manipulation (Test Unlock Mechanism)

```typescript
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Fast forward 1 year
await time.increase(365 * 24 * 60 * 60);

// Fast forward to specific timestamp
await time.increaseTo(futureTimestamp);

// Get current block time
const currentTime = await time.latest();
```

### 2. Account Switching

```typescript
const [deployer, alice, bob, charlie] = await ethers.getSigners();

// Execute as Alice
const tx = await manager.connect(alice).mintNFT(0);
```

### 3. Snapshots and Rollbacks

```typescript
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Create snapshot
const snapshotId = await ethers.provider.send("evm_snapshot", []);

// ... perform some tests ...

// Rollback to snapshot
await ethers.provider.send("evm_revert", [snapshotId]);
```

### 4. Manual Mining Control

```typescript
// Disable auto-mining
await network.provider.send("evm_setAutomine", [false]);

// Manually mine a block
await network.provider.send("evm_mine");

// Enable auto-mining
await network.provider.send("evm_setAutomine", [true]);
```

---

## 📊 Test Scenarios

### Scenario 1: Basic Functionality (15 minutes)

```bash
# 1. Start node
npx hardhat node

# 2. Deploy contracts
npx hardhat run scripts/local-01-deploy-all.ts --network localhost

# 3. Test minting
npx hardhat run scripts/local-02-test-mint.ts --network localhost

# 4. Test distribution
npx hardhat run scripts/local-03-test-distribution.ts --network localhost
```

**Verification:**
- ✅ Contracts deployed successfully
- ✅ NFT minting works
- ✅ Reward distribution and claiming correct
- ✅ Gas consumption reasonable

### Scenario 2: Multi-User Interaction (20 minutes)

```bash
# Test share transfers
npx hardhat run scripts/local-04-test-marketplace.ts --network localhost
```

**Verification:**
- ✅ Share transfers settle rewards correctly
- ✅ Order creation and purchase work
- ✅ USDT transfers correct

### Scenario 3: Time-Related Tests (15 minutes)

```bash
# Test unlock mechanism
npx hardhat run scripts/local-05-test-unlock.ts --network localhost
```

**Verification:**
- ✅ Unlock time calculation correct
- ✅ Unlock percentage accurate
- ✅ Dissolved state works correctly

---

## 🎮 Interactive Testing (Hardhat Console)

### Start Console

```bash
# Ensure node is running, then:
npx hardhat console --network localhost
```

### Common Commands

```javascript
// 1. Get accounts
const [deployer, alice, bob] = await ethers.getSigners();
console.log("Deployer:", deployer.address);

// 2. Connect to deployed contracts (deploy first)
const manager = await ethers.getContractAt("NFTManager", "0x...");
const nft = await ethers.getContractAt("NodeNFT", "0x...");
const usdt = await ethers.getContractAt("TestUSDT", "0x...");

// 3. Query state
const config = await manager.nftConfigs(0);
console.log("Standard NFT config:", config);

// 4. Mint NFT (as Alice)
const mintPrice = ethers.parseUnits("10000", 18);
await usdt.connect(alice).approve(manager.target, mintPrice);
const tx = await manager.connect(alice).mintNFT(0);
await tx.wait();
console.log("Minted!");

// 5. Fast forward time
await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
await ethers.provider.send("evm_mine");
console.log("Fast-forwarded 1 year!");

// 6. Query pending rewards
const pending = await manager.getPendingProduced(1, alice.address);
console.log("Pending $E:", ethers.formatEther(pending));
```

---

## 🔄 Local vs Testnet Comparison

| Feature | Local Hardhat | BSC Testnet |
|---------|---------------|-------------|
| **Cost** | Free | Test BNB required |
| **Speed** | Instant | 3 seconds/block |
| **Reset** | Anytime | Irreversible |
| **Time Control** | Full control | Real time only |
| **Frontend** | Requires config | Direct connection |
| **Block Explorer** | None | BSCScan |
| **Multi-User** | Easy | Multiple wallets |
| **Debug Info** | Detailed | Limited |
| **Realism** | Low | High |

---

## 🎯 Recommended Testing Flow

### Stage 1: Local Quick Validation (1-2 hours)
```
Local node → Deploy → Basic tests → Find issues → Fix → Repeat
```

**Goal:**
- Verify contract logic
- Find obvious bugs
- Optimize gas costs
- Test edge cases

### Stage 2: Local Complete Testing (2-3 hours)
```
All scenarios → Multi-user interactions → Time-based tests → Exception handling
```

**Goal:**
- Cover all features
- Test various combinations
- Stress testing
- Performance testing

### Stage 3: Testnet Deployment (2-4 hours)
```
BSC Testnet deploy → Frontend integration → Real environment → Record results
```

**Goal:**
- Validate real network behavior
- Full frontend integration
- User experience testing
- Prepare for mainnet

---

## 💡 Best Practices

### 1. Local First, Testnet Second
```
✅ Pass local tests → Deploy to testnet
❌ Skip to testnet → Waste time and gas
```

### 2. Use Fixtures
```typescript
// Create reusable test environment
async function deployFixture() {
  const contracts = await deployAllContracts();
  const users = await setupTestUsers();
  return { ...contracts, ...users };
}

// Use in tests
const { manager, nft, usdt, alice, bob } = await loadFixture(deployFixture);
```

### 3. Test-Driven Development
```
Write tests → Run tests (fail) → Implement feature → Tests pass → Refactor
```

### 4. Save Test Snapshots
```bash
# Save successful deployment state
npx hardhat node --hostname 127.0.0.1 --port 8545 > node.log &

# Create snapshots periodically
curl -X POST --data '{"jsonrpc":"2.0","method":"evm_snapshot","params":[],"id":1}' http://127.0.0.1:8545
```

---

## 🐛 Common Issues

### Q1: Contract addresses change after node restart?
**A:** Yes, every restart redeploys. Solution:
- Use scripts to save addresses to file
- Or use `--fork` mode to connect to testnet

### Q2: How to connect frontend to local node?
**A:** Update frontend config:
```typescript
// frontend/.env.local
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
```

Then add in MetaMask:
- Network Name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency: ETH

### Q3: How to verify time fast-forward worked?
**A:** Use contract's time-related functions:
```typescript
const blockTime = await time.latest();
const nftPool = await manager.nftPools(1);
const elapsed = blockTime - nftPool.createdAt;
console.log("Days elapsed:", elapsed / (24 * 60 * 60));
```

### Q4: Are local gas costs accurate?
**A:** Mostly accurate, but:
- Local network gas price is fixed
- Network congestion effects not simulated
- Recommend verifying on testnet

---

## 📚 Resources

- **Hardhat Network Docs:** https://hardhat.org/hardhat-network/docs
- **Hardhat Network Helpers:** https://hardhat.org/hardhat-network-helpers/docs
- **Testing Best Practices:** https://hardhat.org/tutorial/testing-contracts

---

## 🚀 Next Steps

After completing local tests:
- **[TESTNET_DEPLOYMENT.md](./TESTNET_DEPLOYMENT.md)** - Deploy to BSC Testnet
- **[TEST_RESULTS.md](./TEST_RESULTS.md)** - Review detailed test results

---

**Ready to start local testing? Run:**
```bash
npx hardhat node
```

**Then in another terminal:**
```bash
npx hardhat run scripts/local-01-deploy-all.ts --network localhost
```

🎉 **Enjoy fast, free local testing!**

