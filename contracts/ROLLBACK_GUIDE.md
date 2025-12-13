# RewardFacet 回滚指南

## ✅ 可以回滚

**是的，可以回滚到旧的 Facet 地址！**

Diamond Pattern 支持通过 `nftManagerCut` 替换 Facet，可以安全地回滚到之前的版本。

---

## 🔒 存储布局兼容性

### 当前实现（安全）

```solidity
struct NFTManagerStorage {
    // ... 原有存储变量（保持不变）...
    uint256 marketFeeRate;
    
    // ✅ 新变量添加在最后
    uint256 multisigRewardBps;  // 新添加
}
```

**兼容性分析**：

1. ✅ **旧版本 Facet**：
   - 不会访问 `multisigRewardBps`（因为代码中没有这个变量）
   - 只访问原有的存储变量
   - **完全安全**

2. ✅ **新版本 Facet**：
   - 可以访问所有变量（包括新添加的）
   - 如果回滚，新变量会被忽略（旧代码不访问）

3. ✅ **数据完整性**：
   - 所有原有数据保持不变
   - 新添加的数据也会保留（只是不被旧代码访问）
   - 如果再次升级，新数据仍然存在

---

## 🚀 回滚步骤

### 方法 1: 使用回滚脚本（推荐）

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 1. 设置旧 Facet 地址
# 在 .env 或 env.mainnet/env.testnet 中添加：
OLD_REWARD_FACET_ADDRESS=0x...  # 旧的 RewardFacet 地址

# 2. 执行回滚
npx hardhat run scripts/rollback-reward-facet.ts --network bscTestnet
```

### 方法 2: 手动回滚

```typescript
import { ethers } from "hardhat";
import { INFTManagerCut } from "./typechain-types";

async function rollback() {
  const NFT_MANAGER_ADDRESS = "0x...";
  const OLD_REWARD_FACET_ADDRESS = "0x..."; // 旧的 Facet 地址
  
  const nftManagerCut = await ethers.getContractAt("INFTManagerCut", NFT_MANAGER_ADDRESS);
  
  // 获取当前 Facet 的所有函数选择器
  const nftManagerLoupe = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER_ADDRESS);
  const currentFacetAddress = await nftManagerLoupe.facetAddress("0x..."); // distributeReward selector
  const selectors = await nftManagerLoupe.facetFunctionSelectors(currentFacetAddress);
  
  // 替换为旧 Facet
  const cuts = [{
    facetAddress: OLD_REWARD_FACET_ADDRESS,
    action: 1, // Replace
    functionSelectors: selectors,
  }];
  
  const tx = await nftManagerCut.nftManagerCut(cuts, ethers.ZeroAddress, "0x");
  await tx.wait();
  
  console.log("Rollback completed!");
}
```

---

## ⚠️ 重要注意事项

### 1. 存储布局兼容性

**✅ 安全的情况**（当前实现）：
- 新变量添加在存储结构最后
- 旧版本代码不访问新变量
- **可以安全回滚**

**❌ 不安全的情况**：
- 修改了原有变量的位置
- 删除了原有变量
- 改变了变量类型
- **回滚可能导致数据损坏**

### 2. 函数签名兼容性

**当前情况**：
- 新版本：`distributeReward(address token, uint256 rewardPerNFT)`
- 旧版本：`distributeReward(address token, uint256 amount)`
- 函数选择器**相同**（参数类型相同）
- **可以安全回滚**

**但需要注意**：
- 参数含义不同（`rewardPerNFT` vs `amount`）
- 调用方需要更新代码以匹配旧版本

### 3. 数据状态

**回滚后的数据状态**：

| 数据项 | 状态 |
|--------|------|
| 原有存储变量 | ✅ 保持不变，正常访问 |
| 新添加的变量 | ✅ 数据保留，但旧代码不访问 |
| `accRewardPerNFT` | ✅ 保持不变 |
| `accProducedPerNFT` | ✅ 保持不变 |
| `multisigRewardBps` | ⚠️ 数据保留，但旧代码不使用（默认值逻辑） |

### 4. 功能影响

**回滚后**：
- ✅ 所有原有功能恢复正常
- ✅ 使用旧版本的函数签名
- ❌ 新功能不可用（`setMultisigRewardBps` 等）
- ⚠️ 调用方需要更新代码

---

## 📋 回滚检查清单

### 回滚前

- [ ] 确认旧 Facet 地址正确
- [ ] 确认存储布局兼容（新变量在最后）
- [ ] 备份当前状态
- [ ] 通知团队回滚计划
- [ ] 准备回滚后的代码更新

### 回滚后

- [ ] 验证 Facet 地址已更新
- [ ] 测试核心功能（分发、领取）
- [ ] 检查数据完整性
- [ ] 更新后端/前端代码
- [ ] 更新 Oracle 脚本
- [ ] 记录回滚原因和结果

---

## 🔄 回滚后再次升级

如果回滚后修复了问题，可以再次升级：

```bash
# 1. 修复代码问题
# 2. 重新编译
npx hardhat compile

# 3. 再次执行升级
npx hardhat run scripts/upgrade-reward-facet.ts --network bscTestnet
```

**注意**：
- 新添加的存储变量（`multisigRewardBps`）数据会保留
- 如果回滚期间有数据更新，需要确认兼容性

---

## 📊 回滚示例

### 场景：升级后发现问题

```typescript
// 1. 升级后发现问题
// 2. 记录旧 Facet 地址（从升级历史文件）
const oldFacetAddress = "0xEB6aFa9855D2c717e7667599568c22c991Bbe19c";

// 3. 执行回滚
await rollbackRewardFacet(oldFacetAddress);

// 4. 验证回滚
const currentFacet = await nftManagerLoupe.facetAddress(distributeRewardSelector);
console.log("Current Facet:", currentFacet); // 应该是旧地址

// 5. 测试功能（使用旧函数签名）
await nftManager.distributeReward(usdtAddress, totalAmount); // 旧签名
```

---

## ✅ 总结

1. **可以回滚**：Diamond Pattern 支持回滚到旧 Facet
2. **存储安全**：新变量添加在最后，旧代码不访问，完全安全
3. **数据保留**：所有数据保持不变
4. **功能恢复**：回滚后所有原有功能恢复正常
5. **需要更新**：调用方代码需要更新以匹配旧版本

**当前实现完全支持安全回滚！** ✅

---

**最后更新**：2025-01-21  
**版本**：v1.0.0

