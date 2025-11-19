# Contract Deployment Results

**Last Updated:** 2025-11-14  
**Documentation:** This file tracks deployments across different networks

> **Note:** This document contains deployment information for multiple networks.  
> Each network has its own section below.

---

## 📋 Quick Reference

| Network | Status | Last Updated | Chain ID |
|---------|--------|--------------|----------|
| **BSC Mainnet** | ✅ Deployed | 2025-11-14 | 56 |
| **BSC Testnet** | See below | 2025-11-14 | 97 |

---

## 🌐 BSC Mainnet Deployment

**Last Updated:** 2025-11-14  
**Network:** BSC Mainnet (Chain ID: 56)  
**Status:** ✅ **Deployed**

> **Note:** All contracts are deployed on **BSC Mainnet** for production use.

---

### 📋 Deployment Summary

| Contract | Status | Address | Network |
|----------|--------|---------|---------|
| **EnclaveToken ($E)** | ✅ Deployed | `0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc` | **BSC Mainnet** ✅ |
| **TokenVesting** | ✅ Deployed | `0x50FA7D13725302954Ad41Cb25C2F52198c7521b2` | **BSC Mainnet** ✅ |
| **NodeNFT** | ✅ Deployed | `0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860` | **BSC Mainnet** ✅ |
| **NFTManager (Proxy)** | ✅ Deployed | `0xa5020E751277BbC90b7c8CdeAb4434b47F543d91` | **BSC Mainnet** ✅ |
| **NFTManager (Implementation)** | ✅ Deployed | `0x1D556d15d71026D2615F7332A2aA3b5027D00D8E` | **BSC Mainnet** ✅ |
| **USDT** | ✅ Using | `0x55d398326f99059fF775485246999027B3197955` | **BSC Mainnet** ✅ |

---

### 🔍 Contract Details

#### EnclaveToken ($E)

**Address:** `0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc`  
**Network:** BSC Mainnet  
**Type:** ERC20 Token  
**Symbol:** $E  
**Decimals:** 18  
**Initial Supply:** 0 $E (minted by oracle as needed)  
**Max Supply:** 100,000,000 $E  

**BSCScan:** https://bscscan.com/address/0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc

**Features:**
- Mining mechanism (first 6 years: 5M/year, after: min(burned, 2M)/year)
- Burn mechanism with history tracking
- Oracle-controlled mining and burning

**Deployment Notes:**
- No initial minting - tokens will be minted by oracle as needed
- Oracle address: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`
- Initial 70M supply can be minted before TGE
- Mining rewards (30M) will be minted gradually over 6 years after TGE

---

#### TokenVesting

**Address:** `0x50FA7D13725302954Ad41Cb25C2F52198c7521b2`  
**Network:** BSC Mainnet  
**Type:** Token Vesting Contract  
**Owner:** `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`  

**BSCScan:** https://bscscan.com/address/0x50FA7D13725302954Ad41Cb25C2F52198c7521b2

**Features:**
- Multiple vesting schedules per beneficiary
- Linear release mechanism
- TGE time-based scheduling

**Deployment Notes:**
- Owner set to multisig address: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`
- TGE time: Not set yet (can be set later)
- Vesting schedules: Not created (can be created later)

**Note:** TokenVesting is used for Team/SAFT token lockup schedules

---

#### NodeNFT (ERC721)

**Address:** `0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860`  
**Network:** BSC Mainnet  
**Type:** ERC721 NFT  
**Name:** Enclave Node NFT  
**Symbol:** ENFT  

**BSCScan:** https://bscscan.com/address/0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860

**Features:**
- Non-transferable by default (transfers disabled)
- Only NFTManager can mint/burn
- Metadata URI support
- Auto-sync feature: Automatically calls `NFTManager.onNFTTransfer` on direct transfers

**Deployment Notes:**
- NFTManager address configured: `0xa5020E751277BbC90b7c8CdeAb4434b47F543d91`
- Base URI: https://api.enclave.com/nft/metadata/

---

#### NFTManager (Proxy)

**Address:** `0xa5020E751277BbC90b7c8CdeAb4434b47F543d91`  
**Network:** BSC Mainnet  
**Type:** UUPS Upgradeable Proxy  
**Implementation:** `0x1D556d15d71026D2615F7332A2aA3b5027D00D8E`

**BSCScan:** https://bscscan.com/address/0xa5020E751277BbC90b7c8CdeAb4434b47F543d91

**Features:**
- Whitelist-based minting
- Batch management with price and quantity control
- O(1) global index reward distribution
- Dual reward system ($E production + multi-token rewards)
- Marketplace functionality
- Multisig rewards: 20% of rewards distributed to multisig node, 80% to NFTs

**Configuration:**
- NodeNFT: `0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860`
- EnclaveToken: `0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc`
- USDT Token: `0x55d398326f99059fF775485246999027B3197955`
- Oracle: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`
- Treasury: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`

**Owner:** `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`

**Implementation Address:** `0x1D556d15d71026D2615F7332A2aA3b5027D00D8E`  
**BSCScan:** https://bscscan.com/address/0x1D556d15d71026D2615F7332A2aA3b5027D00D8E

---

### 📝 Environment Variables

#### contracts/.env

```bash
# Network
NETWORK=bscMainnet

# Contract Addresses
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
ECLV_ADDRESS=0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc
VESTING_ADDRESS=0x50FA7D13725302954Ad41Cb25C2F52198c7521b2
NFT_ADDRESS=0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860
NODE_NFT_ADDRESS=0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860
NFT_MANAGER_ADDRESS=0xa5020E751277BbC90b7c8CdeAb4434b47F543d91
MANAGER_ADDRESS=0xa5020E751277BbC90b7c8CdeAb4434b47F543d91
MANAGER_IMPL_ADDRESS=0x1D556d15d71026D2615F7332A2aA3b5027D00D8E
```

#### frontend/.env.local

```bash
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc
NEXT_PUBLIC_NODE_NFT_ADDRESS=0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0xa5020E751277BbC90b7c8CdeAb4434b47F543d91
NEXT_PUBLIC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org
```

#### backend/.env

```bash
NFT_MANAGER_ADDRESS=0xa5020E751277BbC90b7c8CdeAb4434b47F543d91
NODE_NFT_ADDRESS=0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860
RPC_URL=https://bsc-dataseed1.binance.org
```

---

### ✅ Verification Commands

```bash
# Verify EnclaveToken
npx hardhat verify --network bscMainnet 0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc

# Verify TokenVesting
npx hardhat verify --network bscMainnet 0x50FA7D13725302954Ad41Cb25C2F52198c7521b2 0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc 0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6

# Verify NodeNFT
npx hardhat verify --network bscMainnet 0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860 "Enclave Node NFT" "ENFT"

# Verify NFTManager Implementation
npx hardhat verify --network bscMainnet 0x1D556d15d71026D2615F7332A2aA3b5027D00D8E

# Verify NFTManager Proxy (if needed)
npx hardhat verify --network bscMainnet 0xa5020E751277BbC90b7c8CdeAb4434b47F543d91
```

---

### 📊 Deployment Statistics

- **Deployer Address:** `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`
- **Deployment Date:** 2025-11-14
- **Network:** BSC Mainnet (Chain ID: 56)
- **Total Contracts Deployed:** 5 (EnclaveToken, TokenVesting, NodeNFT, NFTManager Proxy, NFTManager Implementation)

---

## 🌐 BSC Testnet Deployment

**Last Updated:** 2025-11-14  
**Network:** BSC Testnet (Chain ID: 97)  
**Status:** ✅ **Deployed**

> **Note:** All contracts are deployed on **BSC Testnet** for development and testing purposes.

---

### 📋 Deployment Summary

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

### 🔍 Contract Details

#### 1. TestUSDT (ERC20)

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

#### 2. EnclaveToken ($E)

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

#### 3. NodeNFT (ERC721)

**Address:** `0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0`  
**Network:** BSC Testnet  
**Type:** ERC721 NFT  
**Name:** Enclave Node NFT  
**Symbol:** ENFT  

**BSCScan:** https://testnet.bscscan.com/address/0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0

**Features:**
- Non-transferable by default (transfers disabled)
- Only NFTManager can mint/burn
- Metadata URI support
- **Auto-sync feature:** Automatically calls `NFTManager.onNFTTransfer` on direct transfers to sync `userNFTList`

**Deployment Notes:**
- NFTManager address configured: `0x31C052e02281Cb04445d309bCA9eaB25dC031141`
- Base URI set (can be updated)

---

#### 4. NFTManager (Proxy)

**Address:** `0x31C052e02281Cb04445d309bCA9eaB25dC031141`  
**Network:** BSC Testnet  
**Type:** UUPS Upgradeable Proxy  
**Implementation:** See below  

**BSCScan:** https://testnet.bscscan.com/address/0x31C052e02281Cb04445d309bCA9eaB25dC031141

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
- NodeNFT: `0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0`
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

**Implementation Address:** `0x4cd85f828de20d1caA015D583Ca5ad2FF5B34554`  
**BSCScan:** https://testnet.bscscan.com/address/0x4cd85f828de20d1caA015D583Ca5ad2FF5B34554

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

#### 5. TokenVesting

**Status:** ❌ Not Deployed  
**Reason:** TokenVesting.sol was excluded from compilation (now included)

**Note:** TokenVesting is not required for NFTManager functionality. It's a separate contract for team token vesting schedules.

---

### 📝 Environment Variables

#### contracts/.env

```bash
# Network
NETWORK=bscTestnet

# Contract Addresses
USDT_ADDRESS=0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34
ECLV_ADDRESS=0xCd0Ff5Fd00BD622563011A23091af30De24E7262
NODE_NFT_ADDRESS=0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0
NFT_MANAGER_ADDRESS=0x31C052e02281Cb04445d309bCA9eaB25dC031141
MANAGER_ADDRESS=0x31C052e02281Cb04445d309bCA9eaB25dC031141
```

#### frontend/.env.local

```bash
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0xCd0Ff5Fd00BD622563011A23091af30De24E7262
NEXT_PUBLIC_NODE_NFT_ADDRESS=0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x31C052e02281Cb04445d309bCA9eaB25dC031141
NEXT_PUBLIC_USDT_ADDRESS=0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

#### backend/.env

```bash
NFT_MANAGER_ADDRESS=0x31C052e02281Cb04445d309bCA9eaB25dC031141
NODE_NFT_ADDRESS=0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# IMPORTANT: ADMIN_PRIVATE_KEY must be the contract owner's private key
# Contract Owner: 0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E
# This is the same address that deployed the contracts and called initialize
ADMIN_PRIVATE_KEY=your_contract_owner_private_key_here

# Optional: DEPLOYER_PRIVATE_KEY for funding operations (if different from owner)
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
```

---

### ✅ Verification Status

| Contract | Verified | BSCScan Link |
|----------|----------|--------------|
| TestUSDT | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34) |
| EnclaveToken | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0xCd0Ff5Fd00BD622563011A23091af30De24E7262) |
| NodeNFT | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0) |
| NFTManager (Proxy) | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x31C052e02281Cb04445d309bCA9eaB25dC031141) |
| NFTManager (Implementation) | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x4cd85f828de20d1caA015D583Ca5ad2FF5B34554) |

**Verification Commands:**

```bash
# Verify TestUSDT
npx hardhat verify --network bscTestnet 0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34

# Verify EnclaveToken
npx hardhat verify --network bscTestnet 0xCd0Ff5Fd00BD622563011A23091af30De24E7262

# Verify NodeNFT
npx hardhat verify --network bscTestnet 0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0 "Enclave Node NFT" "ENFT"

# Verify NFTManager Implementation
npx hardhat verify --network bscTestnet 0x4cd85f828de20d1caA015D583Ca5ad2FF5B34554
```

---

### 📊 Deployment Statistics

- **Total Contracts Deployed:** 4 (TestUSDT, EnclaveToken, NodeNFT, NFTManager)
- **Total Gas Used:** (To be calculated)
- **Latest Deployment Date:** 2025-11-06
- **Deployer Address:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- **Contract Owner:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E` (same as deployer)
- **Deployment Type:** Fresh deployment with auto-sync functionality

---

## ⚠️ Important Notes

1. **⚠️ Network:** All contracts in the Testnet section are deployed on **BSC Testnet** (Chain ID: 97)
   - **This is NOT the mainnet deployment**
   - Test tokens have no real value
   - Transactions are on testnet for development/testing only
   - For production, deploy to BSC Mainnet (Chain ID: 56) using mainnet deployment scripts

2. **Proxy Upgrade:** NFTManager uses UUPS proxy pattern - implementation can be upgraded

3. **TokenVesting:** Not deployed on testnet - not required for NFTManager functionality

4. **Verification:** All contracts should be verified on BSCScan for transparency

5. **Security:** Never share private keys or commit them to git

6. **Testnet vs Mainnet:**
   - **Testnet RPC:** `https://data-seed-prebsc-1-s1.binance.org:8545`
   - **Mainnet RPC:** `https://bsc-dataseed1.binance.org/`
   - **Testnet BSCScan:** `https://testnet.bscscan.com`
   - **Mainnet BSCScan:** `https://bscscan.com`

---

**Last Updated:** 2025-11-14  
**Maintained By:** Development Team

---

## 🔄 Recent Changes

### Latest Testnet Deployment (2025-11-06)
- **NodeNFT:** `0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0` (with auto-sync feature)
- **NFTManager Proxy:** `0x31C052e02281Cb04445d309bCA9eaB25dC031141` (fresh deployment)
- **NFTManager Implementation:** `0x4cd85f828de20d1caA015D583Ca5ad2FF5B34554`

### Key Features Added
1. **Auto-sync functionality:** NodeNFT automatically calls `NFTManager.onNFTTransfer` on direct transfers
2. **Removed deprecated functions:** `fixUserNFTList` and `fixUserNFTListBatch` removed (no longer needed)
3. **Multisig rewards:** 20% of rewards distributed to multisig node, 80% to NFTs
4. **Reward tracking:** Changed from "debt" mechanism to "withdrawn" (accumulated) mechanism
