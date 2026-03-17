# 📜 Deployment Scripts

All scripts for deploying and upgrading the Enclave Node NFT system.

---

## 📋 Script Index

### 🚀 Deployment Scripts

| Script | Purpose | Prerequisites | Runtime |
|--------|---------|---------------|---------|
| `01-deploy-usdt.ts` | Deploy Test USDT token (Testnet) | Private key, BNB | ~1 min |
| `02-deploy-main.ts` | Deploy all main contracts (Testnet) | USDT address | ~3 min |
| `deploy-mainnet.ts` | Deploy all main contracts (Mainnet) | USDT address, Mainnet config | ~5 min |
| `deploy-vesting.ts` | Deploy TokenVesting contract | Token address | ~2 min |

### 🔄 Upgrade Scripts

| Script | Purpose | Prerequisites | Runtime |
|--------|---------|---------------|---------|
| `upgrade-nftmanager-facet.ts` | Upgrade NFTManagerFacet (Diamond) | NFT_MANAGER_ADDRESS in .env | ~2 min |
| `upgrade-reward-facet.ts` | Upgrade RewardFacet with optimized distribution | NFT_MANAGER_ADDRESS in .env | ~2 min |
| `rollback-reward-facet.ts` | Rollback RewardFacet to previous version | OLD_REWARD_FACET_ADDRESS | ~2 min |
| `migrate-minter-addresses.ts` | Set minter addresses for existing NFTs | Upgraded contract, Owner key | ~5-10 min |

---

## 🚀 Usage

### Step 1: Setup Environment

```bash
# Copy and edit .env file
cp .env.example .env
nano .env  # Add your PRIVATE_KEY
```

### Step 2: Deploy Contracts (Testnet)

```bash
# Deploy Test USDT
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet

# Add USDT address to .env
# USDT_ADDRESS=0x...

# Deploy main contracts
npx hardhat run scripts/02-deploy-main.ts --network bscTestnet
```

### Step 3: Deploy Contracts (Mainnet)

```bash
# Set USDT_ADDRESS to BSC mainnet USDT (0x55d398326f99059fF775485246999027B3197955)
# Deploy all main contracts
npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet
```

### Step 4: Upgrade Contract

#### Upgrade NFTManagerFacet

```bash
npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscTestnet
```

#### Upgrade RewardFacet (Optimized Distribution)

This upgrade optimizes reward distribution so Oracle only needs to deposit funds for active NFTs:

```bash
# Testnet
npx hardhat run scripts/upgrade-reward-facet.ts --network bscTestnet

# Mainnet
npx hardhat run scripts/upgrade-reward-facet.ts --network bscMainnet
```

**Key improvements:**
- Oracle only deposits for active NFTs (not all 5000)
- Configurable multisig reward ratio (default 20%)
- Maintains fairness: rewardPerNFT still calculated based on MAX_SUPPLY (5000)

**After upgrade:**
- Function signatures changed: `distributeReward(token, rewardPerNFT)` instead of `(token, amount)`
- Update backend/Oracle code to use new signatures
- See `REWARD_FACET_UPGRADE_GUIDE.md` for details

#### Rollback RewardFacet (if needed)

If the upgrade causes issues, you can rollback to the previous version:

```bash
# 1. Set OLD_REWARD_FACET_ADDRESS in .env or env file
# 2. Run rollback script
npx hardhat run scripts/rollback-reward-facet.ts --network bscTestnet
```

**Note:** Rollback is safe because storage layout is compatible (new variables added at the end).

#### Migrate Minter Addresses

After upgrading the NFTManager contract to include the `minter` field:

```bash
npx hardhat run scripts/migrate-minter-addresses.ts --network bscTestnet
```

The migration script will:
- Check which NFTs don't have minter set yet
- Batch set minter addresses using `batchSetMinters` (50 NFTs per batch)

**Note:** New NFTs minted after the upgrade will automatically have their minter set in the `mintNFT` function.

---

## 📝 Script Details

### 01-deploy-usdt.ts

**Purpose:** Deploy a test USDT ERC-20 token for testing purposes.

**What it does:**
- Deploys TestUSDT contract
- Mints 100,000,000 USDT to deployer
- Outputs contract address for .env configuration

**Output:**
```
✅ Test USDT deployed to: 0x...
📊 Initial supply: 100,000,000 USDT
```

**Next step:** Add `USDT_ADDRESS` to your `.env` file.

---

### 02-deploy-main.ts

**Purpose:** Deploy all main contracts (EnclaveToken, NodeNFT, NFTManager) on Testnet.

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

### deploy-mainnet.ts

**Purpose:** Deploy all main contracts (EnclaveToken, NodeNFT, NFTManager) on BSC Mainnet.

**What it does:**
1. Deploys EnclaveToken ($E)
2. Deploys NodeNFT (ERC-721)
3. Deploys NFTManager (Upgradeable UUPS Proxy)
4. Configures all contracts
5. Sets up reward tokens and initial balances

**Prerequisites:**
- Set `USDT_ADDRESS` in .env (BSC mainnet USDT: `0x55d398326f99059fF775485246999027B3197955`)
- Set `PRIVATE_KEY` in .env (deployer wallet with BNB for gas)
- Set `BSC_MAINNET_RPC_URL` in .env
- Set `BSCSCAN_API_KEY` in .env (for verification)

**Usage:**
```bash
npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet
```

**⚠️ WARNING:** This is a MAINNET deployment! Make sure you have verified all configurations!

---

### deploy-vesting.ts

**Purpose:** Deploy TokenVesting contract and set up vesting schedules.

**What it does:**
1. Deploys TokenVesting contract
2. Sets TGE time
3. Creates vesting schedules for Team, SAFT1, and SAFT2
4. Optionally transfers tokens to vesting contract

**Prerequisites:**
- Set `TOKEN_ADDRESS` or `ENCLAVE_TOKEN_ADDRESS` in .env
- Optionally set `MULTISIG_ADDRESS`, `TGE_TIME`, beneficiary addresses, etc.

**Usage:**
```bash
npx hardhat run scripts/deploy-vesting.ts --network <network>
```

---

### upgrade-nftmanager-facet.ts

**Purpose:** Upgrade the NFTManagerFacet in Diamond Pattern.

**What it does:**
1. Reads NFT_MANAGER_ADDRESS from env file or .env
2. Deploys new NFTManagerFacet implementation
3. Uses Diamond Cut to replace existing functions
4. Verifies upgrade and tests new functions

**Requirements:**
- `NFT_MANAGER_ADDRESS` set in env file or .env
- Deployer must be contract owner
- Sufficient gas balance

**Usage:**
```bash
npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscTestnet
```

**Output:**
```
✅ New NFTManagerFacet deployed to: 0x...
✅ Facet upgrade completed
✅ Upgrade verified: Facet address updated
```

**Next step:** Verify new Facet on BSCScan.

---

### upgrade-reward-facet.ts

**Purpose:** Upgrade RewardFacet with optimized reward distribution.

**What it does:**
1. Deploys new RewardFacet with optimized distribution logic
2. Replaces existing functions and adds new ones
3. Oracle only needs to deposit for active NFTs (not all 5000)
4. Adds configurable multisig reward ratio

**Key changes:**
- `distributeReward(token, rewardPerNFT)` - new signature
- `distributeProduced(rewardPerNFT)` - new signature
- `setMultisigRewardBps(bps)` - new function
- `getMultisigRewardBps()` - new function
- `calculateRequiredAmountForDistribution(token, rewardPerNFT)` - new function

**Requirements:**
- `NFT_MANAGER_ADDRESS` set in env file or .env
- Deployer must be contract owner
- Sufficient gas balance

**Usage:**
```bash
# Testnet
npx hardhat run scripts/upgrade-reward-facet.ts --network bscTestnet

# Mainnet
npx hardhat run scripts/upgrade-reward-facet.ts --network bscMainnet
```

**Output:**
```
✅ New RewardFacet deployed to: 0x...
✅ Prepared to replace X existing functions
✅ Prepared to add Y new functions
✅ RewardFacet upgrade completed
```

**After upgrade:**
- Update backend/Oracle code to use new function signatures
- See `REWARD_FACET_UPGRADE_GUIDE.md` for migration guide
- See `UPGRADE_CHECKLIST.md` for upgrade checklist

---

### rollback-reward-facet.ts

**Purpose:** Rollback RewardFacet to previous version if upgrade causes issues.

**What it does:**
1. Reads OLD_REWARD_FACET_ADDRESS from upgrade history or .env
2. Uses Diamond Cut to replace current Facet with old version
3. Verifies rollback and tests functions

**Requirements:**
- `OLD_REWARD_FACET_ADDRESS` set (from upgrade history or .env)
- `NFT_MANAGER_ADDRESS` set in env file or .env
- Deployer must be contract owner
- Sufficient gas balance

**Usage:**
```bash
# Set OLD_REWARD_FACET_ADDRESS in .env or env file
# Then run:
npx hardhat run scripts/rollback-reward-facet.ts --network bscTestnet
```

**Output:**
```
✅ Current RewardFacet address: 0x...
✅ Old Facet address has code
✅ Rollback completed
✅ Rollback verified: RewardFacet address updated to old version
```

**Safety:**
- Storage layout is compatible (new variables added at the end)
- All data is preserved
- Old Facet will ignore new storage variables (safe)

**See:** `ROLLBACK_GUIDE.md` for detailed rollback guide.

---

### migrate-minter-addresses.ts

**Purpose:** Set minter addresses for existing NFTs after contract upgrade.

**What it does:**
1. Checks which NFTs don't have minter set yet
2. Uses contract owner as minter for all NFTs that need it
3. Batch sets minter addresses using `batchSetMinters` (50 NFTs per batch)

**Requirements:**
- Upgraded NFTManager contract with `setMinter` function
- Deployer must be contract owner
- Sufficient gas balance

**Usage:**
```bash
npx hardhat run scripts/migrate-minter-addresses.ts --network bscTestnet
```

**Note:** This script should be run after upgrading the contract to include the `minter` field.

---

## 📊 Reward Distribution Scripts

### 发放 NFT 奖励命令

**详细指南**：请查看 [DISTRIBUTE_REWARD_GUIDE.md](./DISTRIBUTE_REWARD_GUIDE.md)

#### 快速命令（使用 Hardhat Console）

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
npx hardhat console --network bscTestnet
```

在 Console 中：

```javascript
// 1. 获取合约实例
const NFTManager = await ethers.getContractAt("RewardFacet", "NFT_MANAGER_ADDRESS");
const USDT = await ethers.getContractAt("IERC20", "USDT_ADDRESS");

// 2. 计算 rewardPerNFT（按 5000 计算）
const rewardPerNFT = ethers.parseUnits("2", 18); // 2 USDT per NFT

// 3. 查询需要打入的金额
const [requiredAmount] = await NFTManager.calculateRequiredAmountForDistribution(
  USDT.address, 
  rewardPerNFT
);

// 4. Oracle approve 和分发
const oracle = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, ethers.provider);
await USDT.connect(oracle).approve(NFTManager.target, requiredAmount);
await NFTManager.connect(oracle).distributeReward(USDT.address, rewardPerNFT);
```

#### 分发 ECLV 代币

```javascript
const rewardPerNFT = ethers.parseUnits("100", 18); // 100 ECLV per NFT
await NFTManager.connect(oracle).distributeProduced(rewardPerNFT);
```

**函数签名（升级后）：**
- `distributeReward(address token, uint256 rewardPerNFT)` - 分发代币奖励
- `distributeProduced(uint256 rewardPerNFT)` - 分发 ECLV 奖励

**重要：**
- `rewardPerNFT` 是按 MAX_SUPPLY (5000) 计算的每个 NFT 奖励
- Oracle 只需要打入 Active NFT 对应的资金
- 使用 `calculateRequiredAmountForDistribution` 查询需要打入的金额

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

## 🐛 Troubleshooting

### Error: "insufficient funds for gas"
**Solution:** Get more testnet BNB from https://testnet.binance.org/faucet-smart

### Error: "Please set USDT_ADDRESS in .env"
**Solution:** Run `01-deploy-usdt.ts` first and add the address to `.env`

### Error: "nonce too low"
**Solution:** Reset your MetaMask account (Settings > Advanced > Reset Account)

### Script hangs or times out
**Solution:**
- Check your RPC URL
- Try a different RPC endpoint
- Check network connectivity

---

## 📊 Expected Gas Costs

Reference values (actual may vary):

| Operation | Estimated Gas | At 10 gwei | Notes |
|-----------|--------------|------------|-------|
| Deploy USDT | ~1,500k | ~0.015 BNB | One-time |
| Deploy ECLV | ~1,200k | ~0.012 BNB | One-time |
| Deploy NFT | ~2,000k | ~0.020 BNB | One-time |
| Deploy Manager | ~4,000k | ~0.040 BNB | One-time (proxy) |
| Upgrade Manager | ~500k | ~0.005 BNB | Per upgrade |

**Total deployment cost:** ~0.1 BNB (testnet)

---

## 💡 Tips

1. **Save all transaction hashes** - Useful for debugging and verification
2. **Record all contract addresses** - Keep them organized in .env
3. **Test incrementally** - Run one script at a time and verify results
4. **Monitor BSCScan** - Watch transactions in real-time
5. **Verify contracts** - Always verify contracts on BSCScan after deployment
6. **Backup before upgrade** - Always record old Facet addresses before upgrading
7. **Test on testnet first** - Always test upgrades on testnet before mainnet

---

## 📚 Related Documentation

- [RewardFacet Upgrade Guide](../REWARD_FACET_UPGRADE_GUIDE.md) - Detailed upgrade guide
- [Upgrade Checklist](../UPGRADE_CHECKLIST.md) - Pre-upgrade checklist
- [Rollback Guide](../ROLLBACK_GUIDE.md) - How to rollback if needed
- [Reward Distribution Optimization](../REWARD_DISTRIBUTION_OPTIMIZATION.md) - Optimization details

---

**Ready to deploy? Start with the deployment scripts! 🚀**
