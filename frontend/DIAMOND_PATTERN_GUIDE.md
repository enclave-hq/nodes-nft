# 前端使用 Diamond Pattern 指南

## 📋 概述

NFTManager 已迁移到 **Diamond Pattern (EIP-2535)**，所有功能（NFTManager、Marketplace、RewardDistributor）现在都整合在一个 NFTManager 合约中。

## ✅ 已完成的更新

### 1. ABI 文件更新

- ✅ 已更新 `lib/contracts/nft-manager-abi.json` 为新的 Diamond Pattern ABI
- ✅ ABI 包含所有 Facets 的函数（126 个项：83 个函数，38 个事件）

### 2. 配置更新

- ✅ 已更新 `lib/contracts/networkConfig.ts` 中的测试网配置
- ✅ 已创建 `env.testnet` 环境配置文件
- ✅ 已更新 `env.example` 添加 Diamond Pattern 说明

## 🚀 使用步骤

### 1. 更新环境变量

```bash
# 复制测试网配置
cp env.testnet .env.local

# 或手动设置
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x101686d757e5841fD43f358C9bD44eb2bf965325
```

### 2. 验证配置

启动前端后，检查浏览器控制台：

```
🔧 Initializing Web3 config: {...}
🌐 Active Network: BSC Testnet (Chain ID: 97)
📝 NFTManager Address: 0x101686d757e5841fD43f358C9bD44eb2bf965325
```

### 3. 重启开发服务器

```bash
npm run dev
```

## 📝 配置说明

### 环境变量

前端使用以下环境变量（在 `.env.local` 中设置）：

| 变量 | 说明 | 必需 | 默认值 |
|------|------|------|--------|
| `NEXT_PUBLIC_NETWORK` | 网络类型 (`testnet`/`mainnet`) | ❌ | `testnet` |
| `NEXT_PUBLIC_NFT_MANAGER_ADDRESS` | NFTManager (Diamond) 地址 | ❌ | 从 networkConfig 读取 |
| `NEXT_PUBLIC_NODE_NFT_ADDRESS` | NodeNFT 地址 | ❌ | 从 networkConfig 读取 |
| `NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS` | EnclaveToken 地址 | ❌ | 从 networkConfig 读取 |
| `NEXT_PUBLIC_USDT_ADDRESS` | USDT 地址 | ❌ | 从 networkConfig 读取 |
| `NEXT_PUBLIC_RPC_URL` | RPC 节点 URL | ❌ | 从 networkConfig 读取 |
| `NEXT_PUBLIC_API_URL` | 后端 API URL | ✅ | `http://localhost:4000/api` |

### 网络配置

网络配置定义在 `lib/contracts/networkConfig.ts` 中：

**测试网配置（已更新）：**
- NFTManager: `0x101686d757e5841fD43f358C9bD44eb2bf965325` (Diamond Pattern)
- NodeNFT: `0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0`
- EnclaveToken: `0xCd0Ff5Fd00BD622563011A23091af30De24E7262`
- USDT: `0x55d398326f99059fF775485246999027B3197955`

## 🔍 代码使用方式

### 合约调用

前端代码**无需修改**，所有函数调用方式保持不变：

```typescript
// 使用 NFT_MANAGER_ABI 和 CONTRACT_ADDRESSES.nftManager
await walletManager.readContract(
  CONTRACT_ADDRESSES.nftManager,
  NFT_MANAGER_ABI,
  'getActiveBatch',
  []
);

await walletManager.writeContract(
  CONTRACT_ADDRESSES.nftManager,
  NFT_MANAGER_ABI,
  'mintNFT',
  [batchId],
  { gas: GAS_CONFIG.gasLimits.mintNFT }
);
```

### 为什么不需要修改？

1. **统一接口** - Diamond Pattern 通过 fallback 函数将所有 Facet 的函数暴露在同一个地址上
2. **ABI 合并** - 新的 ABI 包含了所有 Facet 的函数
3. **透明调用** - 前端调用时，Diamond 会自动路由到正确的 Facet

## 📊 函数映射

所有原有函数都可以正常调用，它们现在由不同的 Facets 实现：

### NFTManager 功能（NFTManagerFacet）
- ✅ `mintNFT()`
- ✅ `createBatch()`
- ✅ `activateBatch()`
- ✅ `getBatch()`
- ✅ `getActiveBatch()`
- ✅ `isWhitelisted()`
- ✅ `getMinter()`
- ✅ `totalMinted()`

### Marketplace 功能（MarketplaceFacet）
- ✅ `createSellOrder()`
- ✅ `cancelSellOrder()`
- ✅ `buyNFT()`
- ✅ `getOrder()`
- ✅ `getActiveOrderByNFT()`

### Reward 功能（RewardFacet）
- ✅ `claimProduced()`
- ✅ `claimReward()`
- ✅ `claimAllRewards()`
- ✅ `getPendingProduced()`
- ✅ `getPendingReward()`

## ⚠️ 注意事项

### 1. 事件监听

事件仍然正常发出，但需要从 NFTManager 地址监听：

```typescript
// 事件名称和参数保持不变
contract.on("NFTMinted", (nftId, minter, batchId, price, timestamp) => {
  console.log("NFT Minted:", nftId);
});
```

### 2. ABI 文件格式

新的 ABI 文件可能包含 metadata：

```typescript
// abis.ts 中的 normalizeABI 函数已处理这种情况
// 支持 { abi: [...] } 和直接数组两种格式
```

### 3. 环境变量优先级

环境变量会覆盖 `networkConfig.ts` 中的默认值：

```typescript
// config.ts 中的逻辑：
nftManager: (
  process.env.NEXT_PUBLIC_NFT_MANAGER_ADDRESS || 
  activeNetworkConfig.contracts.nftManager
)
```

## 🔧 故障排除

### 问题：函数调用失败 - "function not found"

**可能原因：**
1. ABI 文件未更新
2. 合约地址错误

**解决：**
```bash
# 1. 确认 ABI 文件已更新
ls -lh lib/contracts/nft-manager-abi.json

# 2. 检查环境变量
echo $NEXT_PUBLIC_NFT_MANAGER_ADDRESS

# 3. 重启开发服务器
npm run dev
```

### 问题：合约地址错误

**解决：**
```bash
# 使用 env.testnet 中的配置
cp env.testnet .env.local

# 或手动设置
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x101686d757e5841fD43f358C9bD44eb2bf965325
```

### 问题：网络配置未生效

**解决：**
1. 确保 `.env.local` 文件在项目根目录
2. 重启开发服务器
3. 检查控制台日志确认使用的配置

## 📚 相关文档

- [NETWORK_CONFIG.md](./NETWORK_CONFIG.md) - 网络配置指南
- [../../contracts/docs/DIAMOND_DEPLOYMENT.md](../../contracts/docs/DIAMOND_DEPLOYMENT.md) - 合约部署文档
- [../../backend/DIAMOND_PATTERN_GUIDE.md](../../backend/DIAMOND_PATTERN_GUIDE.md) - 后端使用指南

## 🎯 迁移检查清单

- [x] ABI 文件已更新（`lib/contracts/nft-manager-abi.json`）
- [x] 网络配置已更新（`lib/contracts/networkConfig.ts`）
- [x] 环境配置文件已创建（`env.testnet`）
- [ ] 环境变量已设置（`.env.local`）
- [ ] 前端服务已重启
- [ ] 基本功能测试通过（mint, marketplace, rewards）

## 💡 最佳实践

1. **使用环境文件** - 使用 `env.testnet` 作为模板，避免手动配置错误
2. **验证配置** - 启动时检查控制台日志确认配置正确
3. **测试功能** - 测试 mint、marketplace、rewards 等核心功能
4. **备份 ABI** - 保留旧 ABI 文件作为备份（如果需要）

