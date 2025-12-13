# RewardFacet 升级指南

## 📋 升级概述

本次升级优化了奖励分发机制：
- ✅ Oracle 只需打入 Active NFT 对应的资金（不再需要为 5000 个 NFT 预留资金）
- ✅ 支持可配置的多签比例（默认 20%，可通过 `setMultisigRewardBps` 调整）
- ✅ 数据完全兼容（所有历史数据保持不变）

## ⚠️ 重要变更

### 函数签名变更

| 函数 | 旧签名 | 新签名 |
|------|--------|--------|
| `distributeProduced` | `(uint256 totalAmount)` | `(uint256 rewardPerNFT)` |
| `distributeReward` | `(address token, uint256 amount)` | `(address token, uint256 rewardPerNFT)` |

### 新增函数

- `setMultisigRewardBps(uint256 bps)` - 设置多签比例（基点，10000 = 100%）
- `getMultisigRewardBps()` - 查询多签比例
- `calculateRequiredAmountForDistribution(address token, uint256 rewardPerNFT)` - 查询 Oracle 需要打入的金额

## 🚀 升级步骤

### 1. 准备环境

确保已配置正确的网络和私钥：

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 测试网
cp env.testnet .env
# 或主网
cp env.mainnet .env

# 确保 .env 中有：
# - PRIVATE_KEY (部署者私钥，必须是合约 owner)
# - NFT_MANAGER_ADDRESS (NFTManager 合约地址)
```

### 2. 编译合约

```bash
npx hardhat compile
```

### 3. 执行升级

#### 测试网升级

```bash
npx hardhat run scripts/upgrade-reward-facet.ts --network bscTestnet
```

#### 主网升级

```bash
npx hardhat run scripts/upgrade-reward-facet.ts --network bscMainnet
```

### 4. 验证升级

升级脚本会自动验证，也可以手动验证：

```bash
# 查询 RewardFacet 地址
npx hardhat run scripts/verify-upgrade.ts --network bscTestnet
```

### 5. 在 BSCScan 验证合约

```bash
# 获取新部署的 RewardFacet 地址（从升级脚本输出）
npx hardhat verify --network bscTestnet <REWARD_FACET_ADDRESS>
```

## 📝 升级后需要做的事情

### 1. 更新后端代码

需要修改调用 `distributeProduced` 和 `distributeReward` 的代码：

**旧代码：**
```typescript
// 旧方式：传入总金额
await nftManager.distributeReward(usdtToken, ethers.parseUnits("10000", 18));
```

**新代码：**
```typescript
// 新方式：传入 rewardPerNFT（按 5000 计算的值）
// 例如：想给每个 NFT 分配 1 USDT（按 5000 计算）
const rewardPerNFT = ethers.parseUnits("1", 18);

// 先查询需要打入的金额
const [requiredAmount] = await nftManager.calculateRequiredAmountForDistribution(
  usdtToken,
  rewardPerNFT
);

// 准备资金并 approve
await usdt.approve(nftManagerAddress, requiredAmount);

// 调用分发
await nftManager.distributeReward(usdtToken, rewardPerNFT);
```

### 2. 设置多签比例（可选）

如果需要调整多签比例（默认 20%）：

```typescript
// 设置为 15%
await nftManager.setMultisigRewardBps(1500);

// 查询当前比例
const bps = await nftManager.getMultisigRewardBps();
console.log(`Multisig ratio: ${Number(bps) / 100}%`);
```

### 3. 更新 ABI

```bash
cd ../backend
npm run generate-abi
```

## 🔍 升级验证清单

- [ ] 合约编译成功
- [ ] 升级脚本执行成功
- [ ] 新 RewardFacet 地址已更新到环境文件
- [ ] 在 BSCScan 验证了新合约
- [ ] 测试了新函数（`getMultisigRewardBps`）
- [ ] 更新了后端代码
- [ ] 测试了新的分发函数
- [ ] 更新了 ABI

## 📊 升级效果对比

### 示例：1000 个 Active NFT，每个 NFT 分配 1 USDT

| 项目 | 升级前 | 升级后 |
|------|--------|--------|
| Oracle 需要打入 | 6,000 USDT | 1,200 USDT ✅ |
| Vault 闲置资金 | 4,000 USDT | 0 USDT ✅ |
| 公平性 | 按 5000 计算 | 按 5000 计算 ✅ |
| 多签比例 | 固定 20% | 可配置 ✅ |

## ⚠️ 注意事项

1. **数据兼容性**：所有历史数据保持不变，用户可以正常领取历史累积的奖励
2. **函数签名变更**：必须更新所有调用 `distributeProduced` 和 `distributeReward` 的代码
3. **测试建议**：先在测试网充分测试，确认无误后再升级主网
4. **权限要求**：升级需要合约 owner 权限

## 🆘 故障排查

### 问题：升级脚本找不到 RewardFacet

**解决**：确保 NFT_MANAGER_ADDRESS 正确，并且合约已部署

### 问题：升级后函数调用失败

**解决**：
1. 检查是否更新了后端代码使用新的函数签名
2. 检查 ABI 是否已更新
3. 验证新合约是否在 BSCScan 上验证成功

### 问题：Gas 不足

**解决**：确保部署者地址有足够的 BNB/ETH

## 📞 支持

如有问题，请检查：
- 升级脚本输出日志
- BSCScan 上的交易记录
- 合约验证状态

