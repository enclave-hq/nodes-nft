# 后端使用 Diamond Pattern 指南

## 📋 概述

NFTManager 已迁移到 **Diamond Pattern (EIP-2535)**，所有功能（NFTManager、Marketplace、RewardDistributor）现在都整合在一个 NFTManager 合约中。

## ✅ 好消息：后端代码无需修改！

由于 Diamond Pattern 的设计，**后端代码几乎不需要修改**：

1. **合约地址不变** - 仍然使用 `NFT_MANAGER_ADDRESS` 环境变量
2. **函数调用不变** - 所有函数调用方式完全相同
3. **ABI 已更新** - 已自动生成合并的 ABI 文件

## 🔄 需要做的更新

### 1. 更新 ABI 文件

已自动生成合并的 ABI 文件：`abis/NFTManager.json`

这个文件包含了所有 Facets 的函数，可以直接使用。

**如何重新生成（如果需要）：**
```bash
cd backend
npx ts-node scripts/generate-combined-abi.ts
```

### 2. 更新环境变量

确保 `.env` 文件中设置了正确的 NFTManager 地址：

```env
# NFTManager 地址（Diamond Pattern）
NFT_MANAGER_ADDRESS=0x...

# 其他配置保持不变
RPC_URL=...
ADMIN_PRIVATE_KEY=...
```

### 3. 验证部署

部署脚本会自动生成环境文件，可以直接使用：

```bash
# 从部署结果复制环境变量
cp ../contracts/env.testnet .env
# 或
cp ../contracts/env.mainnet .env
# 或
cp ../contracts/env.localnode .env
```

## 📝 后端代码说明

### ContractService 使用方式

后端的 `ContractService` 已经设计得很好，**无需修改**：

```typescript
// 所有函数调用方式保持不变
await contractService.readContract('totalMinted', []);
await contractService.readContract('getBatch', [batchId]);
await contractService.writeContract('createBatch', [maxMintable, price]);
await contractService.isWhitelisted(address);
await contractService.addToWhitelist([addresses]);
```

### 为什么不需要修改？

1. **统一接口** - Diamond Pattern 通过 fallback 函数将所有 Facet 的函数暴露在同一个地址上
2. **ABI 合并** - 合并的 ABI 包含了所有 Facet 的函数
3. **透明调用** - 后端调用时，Diamond 会自动路由到正确的 Facet

## 🔍 验证连接

### 检查合约是否正常工作

```typescript
// 在 ContractService 初始化后，可以测试：
const totalMinted = await contractService.getTotalMinted();
console.log('Total minted:', totalMinted);

const activeBatch = await contractService.getActiveBatch();
console.log('Active batch:', activeBatch);
```

### 检查 Facets 是否已安装

如果需要验证 Facets 是否正确安装，可以使用 `NFTManagerLoupeFacet`：

```typescript
// 注意：这需要添加到 ContractService 中
async getFacets(): Promise<any[]> {
  const loupeABI = [
    "function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)"
  ];
  const loupeContract = new ethers.Contract(
    this.nftManagerAddress,
    loupeABI,
    this.provider
  );
  return await loupeContract.facets();
}
```

## 📊 函数映射

所有原有函数都可以正常调用，它们现在由不同的 Facets 实现：

### NFTManager 功能（NFTManagerFacet）
- ✅ `mintNFT()`
- ✅ `createBatch()`
- ✅ `activateBatch()`
- ✅ `getBatch()`
- ✅ `getActiveBatch()`
- ✅ `isWhitelisted()`
- ✅ `addToWhitelist()`
- ✅ `removeFromWhitelist()`
- ✅ `getMinter()`
- ✅ `setMinter()`
- ✅ `batchSetMinters()`
- ✅ `totalMinted()`
- ✅ `batches()`
- ✅ `nftPools()`

### Marketplace 功能（MarketplaceFacet）
- ✅ `createSellOrder()`
- ✅ `cancelSellOrder()`
- ✅ `buyNFT()`
- ✅ `getOrder()`
- ✅ `getActiveOrderByNFT()`
- ✅ `getActiveOrders()`
- ✅ `setMarketFeeRate()`

### Reward 功能（RewardFacet）
- ✅ `distributeProduced()`
- ✅ `distributeReward()`
- ✅ `claimProduced()`
- ✅ `claimReward()`
- ✅ `claimAllRewards()`
- ✅ `getPendingProduced()`
- ✅ `getPendingReward()`

### Admin 功能（AdminFacet）
- ✅ `setMaster()`
- ✅ `setOracle()`
- ✅ `setTreasury()`
- ✅ `setTransfersEnabled()`
- ✅ `getUserNFTs()`
- ✅ `getNFTPool()`
- ✅ `getPendingProduced()`
- ✅ `getAccRewardPerNFT()`
- ✅ `nodeNFT()`
- ✅ `eclvToken()`
- ✅ `usdtToken()`
- ✅ `treasury()`

## ⚠️ 注意事项

### 1. 事件监听

事件仍然正常发出，但需要从 NFTManager 地址监听：

```typescript
// 事件名称和参数保持不变
nftManagerContract.on("NFTMinted", (nftId, minter, batchId, price, timestamp) => {
  console.log("NFT Minted:", nftId);
});
```

### 2. 错误处理

如果函数调用失败，可能的原因：
- Facet 未正确安装（检查部署日志）
- 函数选择器冲突（应该不会发生）
- 网络问题

### 3. Gas 估算

Diamond Pattern 的 delegatecall 会有少量额外 gas 开销，但通常可以忽略。

## 🔧 故障排除

### 问题：函数调用失败 - "function not found"

**可能原因：**
1. ABI 文件未更新
2. Facet 未正确安装

**解决：**
```bash
# 1. 重新生成 ABI
cd backend
npx ts-node scripts/generate-combined-abi.ts

# 2. 重启后端服务
npm run start:dev
```

### 问题：合约地址错误

**解决：**
```bash
# 检查环境变量
echo $NFT_MANAGER_ADDRESS

# 使用部署脚本生成的环境文件
cp ../contracts/env.testnet .env
```

### 问题：交易失败

**检查：**
1. 签名者地址是否有足够的 gas
2. 签名者是否有权限（master/owner）
3. 合约状态是否正确

## 📚 相关文档

- [合约部署文档](../../contracts/docs/DIAMOND_DEPLOYMENT.md)
- [部署脚本说明](../../contracts/scripts/README_DEPLOY.md)

## 🎯 迁移检查清单

- [x] ABI 文件已更新（`abis/NFTManager.json`）
- [ ] 环境变量已更新（`NFT_MANAGER_ADDRESS`）
- [ ] 后端服务已重启
- [ ] 测试基本功能（读取合约状态）
- [ ] 测试写入功能（创建批次、白名单等）

## 💡 最佳实践

1. **使用环境文件** - 使用部署脚本生成的环境文件，避免手动配置错误
2. **验证连接** - 启动时验证合约连接是否正常
3. **监控日志** - 关注合约调用的错误日志
4. **备份 ABI** - 保留旧 ABI 文件作为备份（如果需要）

