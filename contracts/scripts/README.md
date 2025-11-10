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
| `upgrade-nftmanager.ts` | Upgrade NFTManager contract | MANAGER_ADDRESS in .env | ~2 min |
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

After upgrading the NFTManager contract to include the `minter` field, you need to migrate minter addresses for existing NFTs:

```bash
# 1. Upgrade the contract first
npx hardhat run scripts/upgrade-nftmanager.ts --network bscTestnet

# 2. Migrate minter addresses for existing NFTs
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

### upgrade-nftmanager.ts

**Purpose:** Upgrade the NFTManager proxy contract to a new implementation.

**What it does:**
1. Reads MANAGER_ADDRESS from .env
2. Deploys new NFTManager implementation
3. Upgrades the proxy to new implementation
4. Verifies upgrade and tests basic functions

**Requirements:**
- `MANAGER_ADDRESS` set in .env
- Deployer must be proxy owner
- Sufficient gas balance

**Usage:**
```bash
npx hardhat run scripts/upgrade-nftmanager.ts --network bscTestnet
```

**Output:**
```
✅ New implementation deployed: 0x...
✅ Proxy upgraded successfully!
✅ Upgrade verified successfully!
```

**Next step:** Verify new implementation on BSCScan.

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

---

**Ready to deploy? Start with the deployment scripts! 🚀**
