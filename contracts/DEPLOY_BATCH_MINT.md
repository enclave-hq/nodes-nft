# 批量购买功能部署指南

## 📋 概述

本文档说明如何在测试网部署包含批量购买功能的新 NFTManagerFacet。

## ✅ 已完成的工作

1. ✅ 在合约中添加了 `batchMintNFT(uint256 quantity)` 函数
2. ✅ 合约已编译成功
3. ✅ 升级脚本已更新，包含批量购买功能

## 🚀 部署步骤

### 1. 配置环境变量

在 `contracts` 目录下，确保 `.env` 文件包含以下内容：

```bash
# 从 env.testnet 复制配置
cp env.testnet .env

# 添加部署者私钥（用于签名交易）
PRIVATE_KEY=your_private_key_here

# 确保以下地址已配置
NFT_MANAGER_ADDRESS=0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67
NFT_MANAGER_FACET=0x2D9EDB0103433A03417AAb9576A2FD82381B8E7C
```

**⚠️ 安全提示：**
- 私钥应该从环境变量读取，不要提交到 Git
- 可以使用 `export PRIVATE_KEY=your_key` 临时设置

### 2. 运行升级脚本

```bash
cd contracts
npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscTestnet
```

脚本会：
1. 部署新的 NFTManagerFacet（包含批量购买功能）
2. 获取所有函数选择器
3. 执行 Diamond Cut 升级
4. 验证升级成功
5. 更新 `env.testnet` 文件中的 Facet 地址

### 3. 验证部署

运行测试脚本验证批量购买功能：

```bash
npx hardhat run scripts/test-batch-mint.ts --network bscTestnet
```

## 📝 新功能说明

### batchMintNFT 函数

```solidity
function batchMintNFT(uint256 quantity) external nonReentrant returns (uint256[] memory)
```

**参数：**
- `quantity`: 要铸造的 NFT 数量（1-50）

**返回值：**
- `uint256[]`: 铸造的 NFT ID 数组

**功能：**
- 一次交易铸造多个 NFT
- 自动处理 USDT 转账（总价 = 单价 × 数量）
- 批量初始化 NFT Pool
- 发出多个 NFTMinted 事件

**限制：**
- 最大批量数量：50（防止 gas 限制）
- 需要白名单权限
- 需要活跃的批次
- 需要足够的 USDT 余额和授权

## 🧪 测试步骤

### 1. 检查函数是否可用

```bash
npx hardhat run scripts/test-batch-mint.ts --network bscTestnet
```

### 2. 前端测试

1. 打开前端应用
2. 连接钱包
3. 在首页找到批量购买输入框
4. 输入购买数量（1-50）
5. 点击"批量购买"按钮
6. 确认交易

### 3. 验证结果

- 检查交易是否成功
- 验证 NFT 是否已铸造
- 检查 NFT ID 是否正确
- 验证邀请码是否自动生成

## 📊 升级信息

升级完成后，会生成 `upgrade.NFTManagerFacet.bscTestnet.json` 文件，包含：

- 旧 Facet 地址
- 新 Facet 地址
- 交易哈希
- 函数选择器列表
- 新增函数列表

## 🔍 故障排除

### 错误：No signers found

**原因：** PRIVATE_KEY 未设置

**解决：**
```bash
export PRIVATE_KEY=your_private_key
# 或添加到 .env 文件（不要提交到 Git）
```

### 错误：Insufficient balance

**原因：** 钱包 BNB 不足

**解决：** 向测试网钱包充值 BNB

### 错误：Contract owner mismatch

**原因：** 部署者不是合约 owner

**解决：** 使用正确的 owner 地址的私钥

### 错误：Function not found

**原因：** 升级未成功

**解决：** 
1. 检查交易是否成功
2. 验证 Facet 地址是否更新
3. 重新运行升级脚本

## 📝 后续步骤

1. ✅ 部署新 Facet
2. ⏳ 验证合约（可选）
3. ⏳ 更新前端 ABI（如果需要）
4. ⏳ 测试批量购买功能
5. ⏳ 测试自动生成邀请码功能

## 🔗 相关文件

- 合约：`contracts/diamond/facets/NFTManagerFacet.sol`
- 升级脚本：`scripts/upgrade-nftmanager-facet.ts`
- 测试脚本：`scripts/test-batch-mint.ts`
- 前端 Hook：`frontend/lib/hooks/useNFTManager.ts`
- 前端页面：`frontend/app/page.tsx`


