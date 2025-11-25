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
| **BSC Testnet** | ✅ Full Redeploy | 2025-11-25 | 97 |

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

**Last Updated:** 2025-11-25  
**Network:** BSC Testnet (Chain ID: 97)  
**Status:** ✅ **Deployed (Full Redeploy)**

> **Note:** All contracts are deployed on **BSC Testnet** for development and testing purposes.

---

### 📋 Deployment Summary

| Contract | Status | Address | Network |
|----------|--------|---------|---------|
| **TestUSDT** | ✅ Deployed | `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34` | **BSC Testnet** ⚠️ |
| **EnclaveToken ($E)** | ✅ Deployed | `0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F` | **BSC Testnet** ⚠️ |
| **NodeNFT** | ✅ Deployed | `0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe` | **BSC Testnet** ⚠️ |
| **NFTManager (Diamond)** | ✅ Deployed | `0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67` | **BSC Testnet** ⚠️ |
| **TokenVesting** | ✅ Deployed | `0x0b6a47631294D4DB753f7BEF56d615c268c87F78` | **BSC Testnet** ⚠️ |

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

**Address:** `0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F`  
**Network:** BSC Testnet  
**Type:** ERC20 Token  
**Symbol:** $E  
**Decimals:** 18  
**Initial Supply:** 0 $E (minted by oracle as needed)  
**Max Supply:** 100,000,000 $E  

**BSCScan:** https://testnet.bscscan.com/address/0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F

**Features:**
- Mining mechanism (first 6 years: 5M/year, after: min(burned, 2M)/year)
- Burn mechanism with history tracking
- Oracle-controlled mining and burning
- TGE time management (single source of truth)

**Deployment Notes:**
- No initial minting - tokens will be minted by oracle as needed
- Oracle address: `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- TGE time not set yet

---

#### 3. NodeNFT (ERC721)

**Address:** `0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe`  
**Network:** BSC Testnet  
**Type:** ERC721 NFT  
**Name:** Enclave Node NFT  
**Symbol:** ENFT  

**BSCScan:** https://testnet.bscscan.com/address/0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe

**Features:**
- Non-transferable by default (transfers disabled)
- Only NFTManager can mint/burn
- Metadata URI support
- **Auto-sync feature:** Automatically calls `NFTManager.onNFTTransfer` on direct transfers

**Deployment Notes:**
- NFTManager address configured: `0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67`
- Base URI: https://api.enclave.com/nft/metadata/

---

#### 4. NFTManager (Diamond Pattern)

**Address:** `0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67`  
**Network:** BSC Testnet  
**Type:** Diamond Pattern (EIP-2535)

**BSCScan:** https://testnet.bscscan.com/address/0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67

**Features:**
- Whitelist-based minting (max 5000 NFTs)
- Batch management with price and quantity control
- Two-step termination process
- O(1) global index reward distribution
- Dual reward system ($E production + multi-token rewards)
- 25-month linear unlock schedule (after 365-day lock)
- Marketplace functionality (listing, canceling, buying)
- **Config Registry:** Serves as config source for TokenVesting
- **Multisig rewards:** 20% of rewards distributed to multisig node, 80% to NFTs

**Configuration:**
- NodeNFT: `0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe`
- EnclaveToken: `0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F`
- USDT Token: `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34`
- Oracle: `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- Treasury: `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`

**Owner Information:**
- **Owner Address:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- **Owner Permissions:**
  - Add/remove whitelist addresses
  - Create and activate batches
  - Enable/disable transfers
  - Set market fee rate
  - Add/remove reward tokens
  - Set oracle/treasury address
  - Set ECLV token address (before TGE)
  - Upgrade facets via Diamond Cut

**Facets:**
- NFTManagerCutFacet: `0x8cfF1c653e0b1cfEaC1dA380e631f8120c0183c8`
- NFTManagerLoupeFacet: `0x891956161a54Ea0D56c16D2A3E37233D625dE88F`
- NFTManagerFacet: `0x2D9EDB0103433A03417AAb9576A2FD82381B8E7C`
- MarketplaceFacet: `0x3a58be944547A119DAA557d8aED6CD7F0ABB1335`
- RewardFacet: `0xc1Eea382f3E2Bb91008ce69A098C37a891Dfd691`
- AdminFacet: `0x2C130580fcd362Cd217D501BB3889e721b8f0899`

---

#### 5. TokenVesting

**Address:** `0x0b6a47631294D4DB753f7BEF56d615c268c87F78`  
**Network:** BSC Testnet  
**Type:** Token Vesting Contract

**BSCScan:** https://testnet.bscscan.com/address/0x0b6a47631294D4DB753f7BEF56d615c268c87F78

**Features:**
- Multiple vesting schedules per beneficiary
- Linear release mechanism
- TGE time-based scheduling (reads from NFTManager → EnclaveToken)
- Reads ECLV token address from NFTManager (configSource)

**Configuration:**
- ConfigSource (NFTManager): `0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67`
- Owner: `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`

**Deployment Notes:**
- Automatically reads eclvToken and tgeTime from NFTManager
- Owner can create and revoke vesting schedules

---

### 📝 Environment Variables

#### contracts/.env (env.testnet)

```bash
# Network
NETWORK=bscTestnet
CHAIN_ID=97

# Contract Addresses
ECLV_ADDRESS=0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F
NODE_NFT_ADDRESS=0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe
NFT_ADDRESS=0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe
NFT_MANAGER_ADDRESS=0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67
MANAGER_ADDRESS=0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67
VESTING_ADDRESS=0x0b6a47631294D4DB753f7BEF56d615c268c87F78
USDT_ADDRESS=0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34

# Roles
ORACLE_ADDRESS=0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E
TREASURY_ADDRESS=0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E
```

#### frontend/.env.local

```bash
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F
NEXT_PUBLIC_NODE_NFT_ADDRESS=0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67
NEXT_PUBLIC_VESTING_ADDRESS=0x0b6a47631294D4DB753f7BEF56d615c268c87F78
NEXT_PUBLIC_USDT_ADDRESS=0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

#### backend/.env

```bash
NFT_MANAGER_ADDRESS=0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67
NODE_NFT_ADDRESS=0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe
ECLV_ADDRESS=0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F
VESTING_ADDRESS=0x0b6a47631294D4DB753f7BEF56d615c268c87F78
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# IMPORTANT: ADMIN_PRIVATE_KEY must be the contract owner's private key
# Contract Owner: 0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E
ADMIN_PRIVATE_KEY=your_contract_owner_private_key_here
```

---

### ✅ Verification Status

| Contract | Verified | BSCScan Link |
|----------|----------|--------------|
| TestUSDT | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34) |
| EnclaveToken | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F) |
| NodeNFT | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe) |
| NFTManager (Diamond) | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67) |
| TokenVesting | ⚠️ Pending | [View on BSCScan](https://testnet.bscscan.com/address/0x0b6a47631294D4DB753f7BEF56d615c268c87F78) |

**Verification Commands:**

```bash
# Verify EnclaveToken
npx hardhat verify --network bscTestnet 0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F

# Verify NodeNFT
npx hardhat verify --network bscTestnet 0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe "Enclave Node NFT" "ENFT"

# Verify TokenVesting (configSource, owner)
npx hardhat verify --network bscTestnet 0x0b6a47631294D4DB753f7BEF56d615c268c87F78 0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67 0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E
```

---

### 📊 Deployment Statistics

- **Total Contracts Deployed:** 5 (EnclaveToken, NodeNFT, NFTManager Diamond + 6 Facets, TokenVesting)
- **Latest Deployment Date:** 2025-11-25
- **Deployer Address:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- **Contract Owner:** `0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`
- **Deployment Type:** Full redeploy with Diamond Pattern (EIP-2535)

---

## ⚠️ Important Notes

1. **⚠️ Network:** All contracts in the Testnet section are deployed on **BSC Testnet** (Chain ID: 97)
   - **This is NOT the mainnet deployment**
   - Test tokens have no real value
   - Transactions are on testnet for development/testing only
   - For production, deploy to BSC Mainnet (Chain ID: 56) using mainnet deployment scripts

2. **Diamond Pattern:** NFTManager uses Diamond Pattern (EIP-2535) - facets can be upgraded

3. **Config Registry:** NFTManager serves as config source for TokenVesting
   - TokenVesting reads eclvToken and tgeTime from NFTManager → EnclaveToken

4. **ECLV Token Update:** Can only change ECLV token address before TGE is set

5. **Verification:** All contracts should be verified on BSCScan for transparency

6. **Security:** Never share private keys or commit them to git

7. **Testnet vs Mainnet:**
   - **Testnet RPC:** `https://data-seed-prebsc-1-s1.binance.org:8545`
   - **Mainnet RPC:** `https://bsc-dataseed1.binance.org/`
   - **Testnet BSCScan:** `https://testnet.bscscan.com`
   - **Mainnet BSCScan:** `https://bscscan.com`

---

**Last Updated:** 2025-11-25  
**Maintained By:** Development Team

---

## 🔄 Recent Changes

### Latest Testnet Deployment (2025-11-25)
- **EnclaveToken:** `0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F` (TGE single source of truth)
- **NodeNFT:** `0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe` (with auto-sync feature)
- **NFTManager (Diamond):** `0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67` (6 facets)
- **TokenVesting:** `0x0b6a47631294D4DB753f7BEF56d615c268c87F78` (reads config from NFTManager)

### Key Features
1. **Diamond Pattern (EIP-2535):** Modular, upgradeable architecture
2. **Config Registry Pattern:** NFTManager as central config source
3. **TGE in EnclaveToken:** Single source of truth for TGE time
4. **Unified Configuration:** All contracts properly configured and interconnected
5. **Auto-sync functionality:** NodeNFT automatically syncs userNFTList
6. **Multisig rewards:** 20% of rewards to multisig, 80% to NFT holders
7. **25-month unlock schedule:** 365-day lock + 25 months linear (4%/month)
