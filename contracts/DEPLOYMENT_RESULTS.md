# Contract Deployment Results

**Last Updated:** 2025-11-10  
**Network:** BSC Testnet (Chain ID: 97)  
**⚠️ IMPORTANT: This is a TESTNET deployment, NOT mainnet!**

> **Note:** All contracts are deployed on **BSC Testnet** for development and testing purposes.  
> For production deployment to BSC Mainnet, use the mainnet deployment scripts and update all addresses accordingly.

---

## 📋 Deployment Summary

| Contract | Status | Address | Network |
|----------|--------|---------|---------|
| **TestUSDT** | ✅ Deployed | `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34` | **BSC Testnet** ⚠️ |
| **EnclaveToken ($E)** | ✅ Deployed | `0xCd0Ff5Fd00BD622563011A23091af30De24E7262` | **BSC Testnet** ⚠️ |
| **NodeNFT** | ✅ Deployed | `0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0` | **BSC Testnet** ⚠️ |
| **NFTManager (Proxy)** | ✅ Deployed | `0x31C052e02281Cb04445d309bCA9eaB25dC031141` | **BSC Testnet** ⚠️ |
| **NFTManager (Implementation)** | ✅ Deployed | `0x4cd85f828de20d1caA015D583Ca5ad2FF5B34554` | **BSC Testnet** ⚠️ |
| **TokenVesting** | ❌ Not Deployed | - | - |

> ⚠️ **All contracts are on BSC Testnet (Chain ID: 97) - NOT mainnet!**

---

## 🔍 Contract Details

### 1. TestUSDT (ERC20)

**Address:** `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34`  
**Network:** BSC Testnet  
**Type:** ERC20 Token  
**Symbol:** USDT  
**Decimals:** 18  

**BSCScan:** https://testnet.bscscan.com/address/0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34

**Deployment Notes:**
- Test token for minting NFTs
- Minted 100,000,000 USDT to deployer address
- Used for testing purposes

---

### 2. EnclaveToken ($E)

**Address:** `0xCd0Ff5Fd00BD622563011A23091af30De24E7262`  
**Network:** BSC Testnet  
**Type:** ERC20 Token  
**Symbol:** $E  
**Decimals:** 18  
**Initial Supply:** 70,000,000 $E  
**Max Supply:** 100,000,000 $E  

**BSCScan:** https://testnet.bscscan.com/address/0xCd0Ff5Fd00BD622563011A23091af30De24E7262

**Features:**
- Mining mechanism (first 6 years: 5M/year, after: min(burned, 2M)/year)
- Burn mechanism with history tracking
- Oracle-controlled mining and burning

**Deployment Notes:**
- Initial supply minted to treasury address
- Oracle address set (can be updated by owner)

---

### 3. NodeNFT (ERC721)

**Address:** `0x92301C0acA7586d9F0B1968af2502616009Abf69`  
**Network:** BSC Testnet  
**Type:** ERC721 NFT  
**Name:** Enclave Node NFT  
**Symbol:** ENFT  

**BSCScan:** https://testnet.bscscan.com/address/0x92301C0acA7586d9F0B1968af2502616009Abf69

**Features:**
- Non-transferable by default (transfers disabled)
- Only NFTManager can mint/burn
- Metadata URI support
- **Auto-sync feature:** Automatically calls `NFTManager.onNFTTransfer` on direct transfers to sync `userNFTList`

**Deployment Notes:**
- NFTManager address configured: `0xF87F9296955439C323ac79769959bEe087f6D06E`
- Base URI set (can be updated)
- **Latest deployment with auto-sync functionality** (deployed 2025-11-06)
- This is a fresh deployment - no existing NFT data

---

### 4. NFTManager (Proxy)

**Address:** `0xF87F9296955439C323ac79769959bEe087f6D06E`  
**Network:** BSC Testnet  
**Type:** UUPS Upgradeable Proxy  
**Implementation:** See below  

**BSCScan:** https://testnet.bscscan.com/address/0xF87F9296955439C323ac79769959bEe087f6D06E

**Features:**
- Whitelist-based minting (max 5000 NFTs)
- Batch management with price and quantity control
- Two-step termination process
- O(1) global index reward distribution
- Dual reward system ($E production + multi-token rewards)
- 25-month linear unlock schedule
- Marketplace functionality (listing, canceling, buying)
- **Auto-sync support:** `onNFTTransfer` function for automatic `userNFTList` synchronization
- **Multisig rewards:** 20% of rewards distributed to multisig node, 80% to NFTs

**Configuration:**
- NodeNFT: `0x92301C0acA7586d9F0B1968af2502616009Abf69` (latest with auto-sync)
- EnclaveToken: `0xCd0Ff5Fd00BD622563011A23091af30De24E7262`
- USDT Token: `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34`
- Oracle: Set during deployment (can be updated)
- Treasury: Set during deployment (can be updated)
- Multisig Node: Can be set by owner (for 20% reward distribution)

**Owner Information:**
- **Owner Address:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- **Owner Role:** Contract owner (set via `__Ownable_init(msg.sender)` during `initialize`)
- **Owner Permissions:**
  - Add/remove whitelist addresses
  - Create and activate batches
  - Enable/disable transfers
  - Set market fee rate
  - Add/remove reward tokens
  - Upgrade contract (UUPS)
  - Set oracle address
  - Set treasury address
  - Set USDT token address
  - Set multisig node address

**Implementation Address:** `0x4AA58A38A0cFe3D3c51FF2903a382922c1B284fF`  
**BSCScan:** https://testnet.bscscan.com/address/0x22EEe5094712a9EF828F3F840FA0dA05c04725b1

**Deployment Details:**
- Deployed using `upgrades.deployProxy()` with UUPS pattern
- `initialize` function called during deployment with deployer address as `msg.sender`
- Owner is set to the address that called `initialize` (deployer address at deployment time)
- Oracle and treasury were set to deployer address during initialization
- **Latest deployment:** 2025-11-06 (fresh deployment with auto-sync support)
- **Key Functions:**
  - `onNFTTransfer(address from, address to, uint256 nftId)`: Called by NodeNFT to sync userNFTList
  - `setNodeNFT(address nodeNFT_)`: Update NodeNFT address (only owner)
  - `getRewardWithdrawn(uint256 nftId, address token)`: Get withdrawn reward amount
  - `getAccRewardPerNFT(address token)`: Get accumulated reward per NFT
  - `getMultisigRewardInfo(address token)`: Get multisig reward information
  - `claimMultisigReward(address token)`: Claim multisig rewards

---

### 5. TokenVesting

**Status:** ❌ Not Deployed  
**Reason:** TokenVesting.sol is excluded from compilation (see hardhat.config.ts)

**Note:** TokenVesting is not required for NFTManager functionality. It's a separate contract for team token vesting schedules.

---

## 📝 Environment Variables

### contracts/.env

```bash
# Network
NETWORK=bscTestnet

# Contract Addresses
USDT_ADDRESS=0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34
ECLV_ADDRESS=0xCd0Ff5Fd00BD622563011A23091af30De24E7262
NODE_NFT_ADDRESS=0x92301C0acA7586d9F0B1968af2502616009Abf69
NFT_MANAGER_ADDRESS=0xF87F9296955439C323ac79769959bEe087f6D06E
MANAGER_ADDRESS=0xF87F9296955439C323ac79769959bEe087f6D06E
```

### frontend/.env.local

```bash
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0xCd0Ff5Fd00BD622563011A23091af30De24E7262
NEXT_PUBLIC_NODE_NFT_ADDRESS=0x92301C0acA7586d9F0B1968af2502616009Abf69
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0xF87F9296955439C323ac79769959bEe087f6D06E
NEXT_PUBLIC_USDT_ADDRESS=0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

### backend/.env

```bash
NFT_MANAGER_ADDRESS=0xF87F9296955439C323ac79769959bEe087f6D06E
NODE_NFT_ADDRESS=0x92301C0acA7586d9F0B1968af2502616009Abf69
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# IMPORTANT: ADMIN_PRIVATE_KEY must be the contract owner's private key
# Contract Owner: 0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E
# This is the same address that deployed the contracts and called initialize
ADMIN_PRIVATE_KEY=your_contract_owner_private_key_here

# Optional: DEPLOYER_PRIVATE_KEY for funding operations (if different from owner)
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
```

---

## ✅ Verification Status

| Contract | Verified | BSCScan Link |
|----------|----------|--------------|
| TestUSDT | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34) |
| EnclaveToken | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0xCd0Ff5Fd00BD622563011A23091af30De24E7262) |
| NodeNFT | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x92301C0acA7586d9F0B1968af2502616009Abf69) |
| NFTManager (Proxy) | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0xF87F9296955439C323ac79769959bEe087f6D06E) |
| NFTManager (Implementation) | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x22EEe5094712a9EF828F3F840FA0dA05c04725b1) |

**Verification Commands:**

```bash
# Verify TestUSDT
npx hardhat verify --network bscTestnet 0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34

# Verify EnclaveToken
npx hardhat verify --network bscTestnet 0xCd0Ff5Fd00BD622563011A23091af30De24E7262

# Verify NodeNFT
npx hardhat verify --network bscTestnet 0x92301C0acA7586d9F0B1968af2502616009Abf69 "Enclave Node NFT" "ENFT"

# Verify NFTManager Implementation
npx hardhat verify --network bscTestnet 0x22EEe5094712a9EF828F3F840FA0dA05c04725b1
```

---

## 🔧 Post-Deployment Configuration

### 1. Get NFTManager Implementation Address

```bash
npx hardhat console --network bscTestnet
```

```javascript
const { upgrades } = require("hardhat");
const proxyAddress = "0xF87F9296955439C323ac79769959bEe087f6D06E";
const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
console.log("Implementation:", implAddress);
```

### 2. Initial Setup Steps

1. **Create first batch** (via admin backend or directly):
   ```bash
   # Using Hardhat console
   const manager = await ethers.getContractAt("NFTManager", "0xF87F9296955439C323ac79769959bEe087f6D06E");
   await manager.createBatch(1000, ethers.parseUnits("10", 18)); // 1000 max, 10 USDT price
   ```

2. **Activate batch**:
   ```bash
   await manager.activateBatch(1);
   ```

3. **Add whitelist addresses**:
   ```bash
   await manager.addToWhitelist(["0x...", "0x..."]);
   ```

---

## 📊 Deployment Statistics

- **Total Contracts Deployed:** 4 (TestUSDT, EnclaveToken, NodeNFT, NFTManager)
- **Total Gas Used:** (To be calculated)
- **Latest Deployment Date:** 2025-11-06
- **Deployer Address:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- **Contract Owner:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E` (same as deployer)
- **Deployment Type:** Fresh deployment with auto-sync functionality

---

## 🚀 Next Steps

1. ✅ Verify all contracts on BSCScan
2. ✅ Get NFTManager implementation address
3. ⚠️ Update frontend .env.local
4. ⚠️ Update backend .env
5. ⚠️ Test basic functionality (minting, claiming, etc.)
6. ⚠️ Create first batch
7. ⚠️ Activate batch
8. ⚠️ Add test whitelist addresses

---

## ⚠️ Important Notes

1. **⚠️ Network:** All contracts are deployed on **BSC Testnet** (Chain ID: 97)
   - **This is NOT the mainnet deployment**
   - Test tokens have no real value
   - Transactions are on testnet for development/testing only
   - For production, deploy to BSC Mainnet (Chain ID: 56) using mainnet deployment scripts

2. **Proxy Upgrade:** NFTManager uses UUPS proxy pattern - implementation can be upgraded

3. **TokenVesting:** Not deployed - not required for NFTManager functionality

4. **Verification:** All contracts should be verified on BSCScan for transparency

5. **Security:** Never share private keys or commit them to git

6. **Testnet vs Mainnet:**
   - **Testnet RPC:** `https://data-seed-prebsc-1-s1.binance.org:8545`
   - **Mainnet RPC:** `https://bsc-dataseed1.binance.org/`
   - **Testnet BSCScan:** `https://testnet.bscscan.com`
   - **Mainnet BSCScan:** `https://bscscan.com`

---

**Last Updated:** 2025-11-10  
**Maintained By:** Development Team

---

## 🔄 Recent Changes (2025-11-06)

### Latest Deployment
- **NodeNFT:** `0x92301C0acA7586d9F0B1968af2502616009Abf69` (with auto-sync feature)
- **NFTManager Proxy:** `0xF87F9296955439C323ac79769959bEe087f6D06E` (fresh deployment)
- **NFTManager Implementation:** `0x22EEe5094712a9EF828F3F840FA0dA05c04725b1`

### Key Features Added
1. **Auto-sync functionality:** NodeNFT automatically calls `NFTManager.onNFTTransfer` on direct transfers
2. **Removed deprecated functions:** `fixUserNFTList` and `fixUserNFTListBatch` removed (no longer needed)
3. **Multisig rewards:** 20% of rewards distributed to multisig node, 80% to NFTs
4. **Reward tracking:** Changed from "debt" mechanism to "withdrawn" (accumulated) mechanism

### Important Notes
- This is a **fresh deployment** - all previous NFT data is in old contracts
- Old contracts remain unchanged:
  - Old NodeNFT: `0xdF819A8153500eABCB0157ec2aE031b7f150D83a`
  - Old NFTManager Proxy: `0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68`
- New contracts start with empty state - all new NFTs will have auto-sync enabled

