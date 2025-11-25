# 统一 NFTManager 设计方案

## 概述

将所有功能（NFTManager、NFTMarketplace、RewardDistributor）整合到同一个 NFTManager 合约中（使用 Diamond Pattern 实现），实现统一管理和一致的接口。

## 架构设计

### 统一的 NFTManager 合约（Diamond Pattern）

```
NFTManager (主合约，使用 Diamond Pattern)
├── NFTManagerCutFacet (管理 Facets)
├── NFTManagerLoupeFacet (查询 Facets)
│
├── NFTManagerFacet (NFT 核心功能)
│   ├── 铸造 (mintNFT)
│   ├── 批次管理 (createBatch, activateBatch, deactivateBatch)
│   ├── 终止流程 (initiateTermination, confirmTermination, cancelTermination)
│   ├── 解锁机制 (withdrawUnlocked, calculateUnlockedAmount)
│   ├── Vault 管理 (getVaultBalance, extractVaultRewards)
│   ├── 白名单 (addToWhitelist, removeFromWhitelist)
│   ├── 转移同步 (onNFTTransfer)
│   └── Minter 管理 (getMinter, setMinter, batchSetMinters)
│
├── MarketplaceFacet (市场功能)
│   ├── 订单管理 (createSellOrder, cancelSellOrder)
│   ├── 交易 (buyNFT)
│   ├── 查询 (getOrder, getActiveOrderByNFT, getActiveOrders)
│   └── 配置 (setMarketFeeRate, setTreasury)
│
├── RewardFacet (奖励功能)
│   ├── 奖励领取 (claimProduced, claimReward, claimAllRewards)
│   ├── 奖励分发 (distributeProduced, distributeReward)
│   ├── 多签奖励 (claimMultisigReward, claimAllMultisigRewards)
│   ├── 代币燃烧 (burnTokensFromSwap)
│   └── 配置 (setMultisigNode, setOracle, addRewardToken)
│
└── AdminFacet (管理功能)
    ├── 角色管理 (setMaster, setOracle, setTreasury, setOperator)
    ├── 配置管理 (setTransfersEnabled, setTgeTime, setNodeNFT)
    └── 查询功能 (getUserNFTs, getNFTPool, getPendingReward)
```

## 优势

### 1. 统一管理
- **单一入口**: 所有功能通过同一个 NFTManager 地址访问
- **统一升级**: 可以统一管理所有功能的升级
- **一致接口**: 所有功能使用相同的调用方式

### 2. 共享存储
- **状态共享**: Marketplace 和 RewardDistributor 可以直接访问 NFTManager 的状态
- **减少冗余**: 不需要通过接口调用，可以直接访问存储
- **数据一致性**: 所有数据在同一个存储空间中，保证一致性

### 3. 简化交互
- **内部调用**: Facets 之间可以直接调用，不需要外部合约调用
- **Gas 优化**: 减少外部调用的 gas 开销
- **原子操作**: 可以在一个交易中完成跨功能操作

### 4. 更好的模块化
- **清晰分离**: 每个功能模块仍然是独立的 Facet
- **独立升级**: 可以单独升级某个功能模块
- **易于测试**: 每个 Facet 可以独立测试

## 存储布局

### 共享存储结构

所有 Facets 共享 `LibNFTManagerStorage.NFTManagerStorage`，包含：

1. **NFTManager 存储** (原有)
   - NFT 池、批次、白名单等

2. **Marketplace 存储** (新增)
   - 订单映射、活跃订单列表、费率等

3. **RewardDistributor 存储** (新增)
   - 奖励代币列表、multisig 奖励等

## Facet 设计

### Marketplace Facets

#### OrderFacet
```solidity
function createSellOrder(uint256 nftId, uint256 price) external returns (uint256)
function cancelSellOrder(uint256 orderId) external
```

#### TradeFacet
```solidity
function buyNFT(uint256 orderId) external
```

#### MarketplaceQueryFacet
```solidity
function getOrder(uint256 orderId) external view returns (SellOrder memory)
function getActiveOrderByNFT(uint256 nftId) external view returns (uint256)
function getActiveOrderIds() external view returns (uint256[] memory)
function getActiveOrderCount() external view returns (uint256)
function getActiveOrders(uint256 offset, uint256 limit) external view returns (...)
function getAllActiveOrders() external view returns (SellOrder[] memory)
```

#### MarketplaceConfigFacet
```solidity
function setMarketFeeRate(uint256 feeRate) external
function setTreasury(address treasury_) external
```

### RewardDistributor Facets

#### DistributionFacet
```solidity
function distributeProduced(uint256 totalAmount) external
function distributeReward(address token, uint256 amount) external
```

#### BurnFacet
```solidity
function burnTokensFromSwap(uint256 amount, string memory reason) external
```

#### RewardConfigFacet
```solidity
function setMultisigNode(address multisigNode_) external
function setOracle(address oracle_) external
function setOracleMultisig(address oracleMultisig_) external
function addRewardToken(address token) external
function removeRewardToken(address token) external
function getRewardTokens() external view returns (address[] memory)
```

## 内部调用优化

### 之前（独立合约）
```solidity
// NFTManager 调用 RewardDistributor
rewardDistributor.distributeProduced(amount); // 外部调用，需要接口

// Marketplace 调用 NFTManager
INFTManagerMarketplace(nftManager).transfersEnabled(); // 外部调用，需要接口
```

### 现在（统一 NFTManager）
```solidity
// Facet 之间直接访问存储
LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
bool enabled = s.transfersEnabled; // 直接访问，无 gas 开销

// 或者通过内部函数调用（如果需要逻辑）
// 可以直接调用其他 Facet 的函数（通过 this.functionName()）
```

## 迁移步骤

### 1. 扩展存储库
- ✅ 已更新 `LibNFTManagerStorage` 包含 Marketplace 和 RewardDistributor 存储

### 2. 创建 Marketplace Facets
- OrderFacet
- TradeFacet
- MarketplaceQueryFacet
- MarketplaceConfigFacet

### 3. 创建 RewardDistributor Facets
- DistributionFacet
- BurnFacet
- RewardConfigFacet

### 4. 更新 NFTManager Facets
- 移除对 `rewardDistributor` 合约的引用
- 直接使用存储中的状态

### 5. 更新初始化
- NFTManagerInit 需要初始化所有模块的状态

## 注意事项

### 1. 函数选择器冲突
- 确保不同 Facets 中的函数选择器不冲突
- 使用命名空间或前缀（如 `marketplace_`, `reward_`）如果可能冲突

### 2. 存储布局兼容性
- 所有 Facets 必须使用相同的存储布局
- 新增存储变量时，只能追加，不能修改现有变量

### 3. 权限管理
- 统一使用 NFTManager 的 owner 或 master 权限
- 各 Facet 的权限检查保持一致

### 4. 事件定义
- 所有事件在各自的 Facet 中定义
- 确保事件名称不冲突

## 部署流程

1. 部署所有 Facets
2. 部署 NFTManagerCutFacet 和 NFTManagerLoupeFacet
3. 部署 NFTManager 合约
4. 使用 `nftManagerCut` 添加所有 Facets
5. 部署并调用 NFTManagerInit 进行初始化

## 接口兼容性

### 保持向后兼容

为了保持与现有代码的兼容性，可以：

1. **保留接口合约**: 创建接口合约，指向 NFTManager 地址
2. **代理模式**: 使用简单的代理合约转发调用到 NFTManager
3. **直接迁移**: 更新所有调用方使用 NFTManager 地址

## 优势总结

✅ **统一管理**: 所有功能在一个 NFTManager 下  
✅ **共享存储**: 减少冗余，提高效率  
✅ **内部调用**: 减少 gas 开销  
✅ **模块化**: 保持清晰的模块分离  
✅ **可升级**: 可以单独升级某个模块  
✅ **一致性**: 统一的接口和调用方式  

## 下一步

1. ✅ 创建 Marketplace Facets（已完成，合并为 MarketplaceFacet）
2. ✅ 创建 RewardDistributor Facets（已完成，合并为 RewardFacet）
3. ✅ 更新存储库（已完成）
4. ✅ 创建 NFTManagerInit（已完成）
5. ⏳ 更新测试（待完成）

