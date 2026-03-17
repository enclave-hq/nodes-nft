# RewardFacet 升级检查清单

## ✅ 升级前检查

### 1. 存储布局兼容性
- [x] ✅ 新存储变量 `multisigRewardBps` 已添加在存储结构最后
- [x] ✅ 未修改原有数据结构定义
- [x] ✅ 未修改原有数据 Slot 排列
- [x] ✅ 符合 UUPS 升级安全要求

### 2. 代码实现
- [x] ✅ `distributeReward` 已优化（使用 `rewardPerNFT` 参数）
- [x] ✅ `distributeProduced` 已优化（使用 `rewardPerNFT` 参数）
- [x] ✅ 新增 `setMultisigRewardBps` 函数
- [x] ✅ 新增 `getMultisigRewardBps` 函数
- [x] ✅ 新增 `calculateRequiredAmountForDistribution` 函数

### 3. 编译检查
- [x] ✅ 合约编译通过
- [x] ✅ 无编译错误
- [x] ✅ 无 Linter 错误（存储变量已正确添加）

---

## 🚀 升级步骤

### 步骤 1: 确认网络配置

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 检查环境文件
cat env.mainnet  # 主网
# 或
cat env.testnet  # 测试网
```

确保文件中有：
- `NFT_MANAGER_ADDRESS` - NFTManager 合约地址
- `PRIVATE_KEY` - 部署者私钥（必须是合约 owner）

### 步骤 2: 编译合约

```bash
npx hardhat compile
```

### 步骤 3: 执行升级

**测试网升级：**
```bash
npx hardhat run scripts/upgrade-reward-facet.ts --network bscTestnet
```

**主网升级：**
```bash
npx hardhat run scripts/upgrade-reward-facet.ts --network bscMainnet
```

### 步骤 4: 验证升级

升级脚本会自动：
1. ✅ 部署新的 RewardFacet
2. ✅ 获取当前 Facet 地址
3. ✅ 准备 FacetCut（替换现有函数 + 添加新函数）
4. ✅ 执行升级
5. ✅ 验证升级结果
6. ✅ 测试新函数
7. ✅ 更新环境文件

### 步骤 5: 手动验证（可选）

```bash
# 在 BSCScan 上验证新合约
npx hardhat verify --network bscTestnet <NEW_REWARD_FACET_ADDRESS>
```

---

## 📋 升级后检查

### 1. 功能验证

```typescript
// 测试新函数
const rewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);

// 查询多签比例（应该返回默认值 2000 = 20%）
const bps = await rewardFacet.getMultisigRewardBps();
console.log(`Multisig BPS: ${bps} (${Number(bps) / 100}%)`);

// 计算所需金额
const rewardPerNFT = ethers.parseUnits("2", 18); // 2 USDT per NFT
const result = await rewardFacet.calculateRequiredAmountForDistribution(
    usdtAddress,
    rewardPerNFT
);
console.log(`Required Amount: ${result.requiredAmount}`);
```

### 2. 数据完整性检查

- [x] ✅ 所有历史数据保持不变
- [x] ✅ `accRewardPerNFT` 值正确
- [x] ✅ `accProducedPerNFT` 值正确
- [x] ✅ NFT 奖励数据完整

### 3. 向后兼容性

**注意**：函数签名已变更，调用方需要更新：

| 函数 | 旧签名 | 新签名 |
|------|--------|--------|
| `distributeProduced` | `(uint256 totalAmount)` | `(uint256 rewardPerNFT)` |
| `distributeReward` | `(address token, uint256 amount)` | `(address token, uint256 rewardPerNFT)` |

**迁移指南**：
```typescript
// 旧代码
await nftManager.distributeReward(usdtAddress, totalAmount);

// 新代码
const rewardPerNFT = totalAmount / 5000; // 按 MAX_SUPPLY 计算
await nftManager.distributeReward(usdtAddress, rewardPerNFT);
```

---

## ⚠️ 重要注意事项

### 1. 函数签名变更

虽然函数选择器相同（参数类型相同），但参数含义已改变：
- **旧版本**：`amount` = 总金额
- **新版本**：`rewardPerNFT` = 每个 NFT 的奖励（按 MAX_SUPPLY 计算）

### 2. 调用方需要更新

所有调用 `distributeReward` 和 `distributeProduced` 的代码都需要更新：
- 后端服务
- Oracle 脚本
- 测试代码

### 3. 多签比例配置

升级后，多签比例默认为 20%（2000 BPS）。可以通过 `setMultisigRewardBps` 调整：

```typescript
// 设置为 15%
await nftManager.setMultisigRewardBps(1500);
```

---

## 🔄 回滚计划

如果升级出现问题，可以：

1. **使用 Diamond Cut 回滚到旧 Facet**：
   ```typescript
   // 使用旧的 RewardFacet 地址替换新 Facet
   const oldFacetAddress = "0x..."; // 旧 Facet 地址
   await nftManagerCut.nftManagerCut([{
     facetAddress: oldFacetAddress,
     action: 1, // Replace
     functionSelectors: [...]
   }], ethers.ZeroAddress, "0x");
   ```

2. **检查存储数据**：
   - 所有存储数据保持不变
   - 可以安全回滚

---

## 📝 升级记录

升级完成后，记录以下信息：

- [ ] 升级时间
- [ ] 网络（主网/测试网）
- [ ] 旧 Facet 地址
- [ ] 新 Facet 地址
- [ ] 交易哈希
- [ ] Gas 使用量
- [ ] 验证状态

---

**最后更新**：2025-01-21  
**版本**：v2.0.0























