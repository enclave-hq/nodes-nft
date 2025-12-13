# 主网批量购买功能升级指南

## 📋 概述

本文档说明如何在 BSC 主网部署包含批量购买功能的新 NFTManagerFacet。

## ⚠️ 重要提示

**这是主网部署，请务必：**
1. ✅ 在测试网充分测试
2. ✅ 确认所有配置正确
3. ✅ 确保有足够的 BNB 支付 gas 费用
4. ✅ 使用正确的部署者私钥（owner 权限）
5. ✅ 部署后立即验证合约

## 🚀 部署步骤

### 1. 准备主网配置

确保 `contracts` 目录下有主网配置文件：

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
```

检查主网配置：
- `env.mainnet` - 主网环境配置
- `deployment.mainnet.json` - 主网部署记录

### 2. 配置环境变量

将主网配置复制到 `.env`：

```bash
cp env.mainnet .env
```

**重要：** 添加部署者私钥（用于签名交易）：

```bash
# 在 .env 文件中添加（或通过环境变量设置）
PRIVATE_KEY=your_mainnet_private_key_here
```

**⚠️ 安全提示：**
- 私钥应该从环境变量读取，不要提交到 Git
- 可以使用 `export PRIVATE_KEY=your_key` 临时设置
- 确保私钥对应的地址是合约 owner

### 3. 验证配置

检查关键配置：

```bash
# 检查 NFT_MANAGER_ADDRESS
grep "^NFT_MANAGER_ADDRESS=" .env

# 检查当前 Facet 地址
grep "^NFT_MANAGER_FACET=" .env

# 检查部署者地址
grep "^ORACLE_ADDRESS=" .env  # 通常是部署者地址
```

**主网地址：**
- NFT_MANAGER_ADDRESS: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
- NFT_MANAGER_FACET (当前): `0x3a1534cbE9F00a660d7bFA68C4755A37C4A1eb78`

### 4. 检查余额

确保部署者地址有足够的 BNB：

```bash
# 检查余额（建议至少 0.1 BNB）
npx hardhat run scripts/check-balance.ts --network bscMainnet
```

### 5. 运行升级脚本

```bash
npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscMainnet
```

脚本会：
1. ✅ 部署新的 NFTManagerFacet（包含批量购买功能）
2. ✅ 查询当前 Facet 的函数选择器
3. ✅ 分离已存在函数（Replace）和新函数（Add）
4. ✅ 执行 Diamond Cut 升级
5. ✅ 验证升级成功
6. ✅ 更新 `env.mainnet` 文件中的 Facet 地址

### 6. 验证部署

运行测试脚本验证批量购买功能：

```bash
npx hardhat run scripts/test-batch-mint.ts --network bscMainnet
```

### 7. 更新配置文件

升级脚本会自动更新 `env.mainnet`，但需要手动更新：

1. **更新 deployment.mainnet.json**：
   ```bash
   # 从升级输出中获取新 Facet 地址，更新 deployment.mainnet.json
   ```

2. **更新 .env**（如果使用）：
   ```bash
   # 从 env.mainnet 同步到 .env
   cp env.mainnet .env
   # 然后添加 PRIVATE_KEY（如果需要）
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

## 🔍 升级后验证

### 1. 检查交易状态

在 BSCScan 上查看升级交易：
- 访问：https://bscscan.com/tx/{transaction_hash}
- 确认状态为 "Success"

### 2. 验证新函数

在 BSCScan 上验证 `batchMintNFT` 函数：
- 访问：https://bscscan.com/address/{NFT_MANAGER_ADDRESS}#readContract
- 查找 `batchMintNFT` 函数
- 确认函数存在且可调用

### 3. 合约验证（推荐）

在 BSCScan 上验证新 Facet 合约：

```bash
# 使用 Hardhat 验证
npx hardhat verify --network bscMainnet {NEW_FACET_ADDRESS}
```

或手动在 BSCScan 上验证：
1. 访问：https://bscscan.com/address/{NEW_FACET_ADDRESS}#code
2. 点击 "Verify and Publish"
3. 选择编译器版本和设置
4. 粘贴合约代码

## 📊 升级信息记录

升级完成后，会生成 `upgrade.NFTManagerFacet.bscMainnet.json` 文件，包含：

- 旧 Facet 地址
- 新 Facet 地址
- 交易哈希
- 区块号
- Gas 使用量
- 函数选择器列表
- 新增函数列表

## ⚠️ 故障排除

### 错误：No signers found

**原因：** PRIVATE_KEY 未设置

**解决：**
```bash
export PRIVATE_KEY=your_private_key
# 或添加到 .env 文件（不要提交到 Git）
```

### 错误：Insufficient balance

**原因：** 钱包 BNB 不足

**解决：** 向主网钱包充值 BNB（建议至少 0.1 BNB）

### 错误：Contract owner mismatch

**原因：** 部署者不是合约 owner

**解决：** 使用正确的 owner 地址的私钥

### 错误：Function not found

**原因：** 升级未成功

**解决：** 
1. 检查交易是否成功
2. 验证 Facet 地址是否更新
3. 重新运行升级脚本

### 错误：Gas estimation failed

**原因：** Gas 估算失败

**解决：**
1. 检查合约状态
2. 确认所有参数正确
3. 尝试手动设置更高的 gas limit

## 🔒 安全注意事项

1. **私钥安全：**
   - ⚠️ **永远不要**将私钥提交到 Git
   - ⚠️ **永远不要**在公共渠道分享私钥
   - ✅ 使用环境变量或密钥管理服务

2. **合约验证：**
   - ✅ 部署后立即验证所有合约
   - ✅ 验证有助于用户信任和审计

3. **权限管理：**
   - ✅ 确认 Oracle 地址设置正确
   - ✅ 确认 Treasury 地址设置正确
   - ✅ 考虑使用多签钱包管理关键权限

4. **测试：**
   - ✅ 在主网部署前，先在测试网充分测试
   - ✅ 使用小金额进行首次测试（如果有测试环境）

## 📝 部署清单

部署前检查：

- [ ] 已在测试网完成测试
- [ ] 已配置 `.env` 文件（从 env.mainnet 复制）
- [ ] 已设置 PRIVATE_KEY（owner 地址的私钥）
- [ ] 钱包中有足够的 BNB（至少 0.1 BNB）
- [ ] 已确认 NFT_MANAGER_ADDRESS 正确
- [ ] 已确认当前 NFT_MANAGER_FACET 地址正确
- [ ] 已确认部署者地址是合约 owner

部署后检查：

- [ ] 升级交易已成功
- [ ] 新 Facet 地址已更新到配置文件
- [ ] 合约已在 BSCScan 上验证（可选但推荐）
- [ ] 批量购买功能测试通过
- [ ] 前端配置已更新（如果需要）

## 🔗 相关文件

- 合约：`contracts/diamond/facets/NFTManagerFacet.sol`
- 升级脚本：`scripts/upgrade-nftmanager-facet.ts`
- 测试脚本：`scripts/test-batch-mint.ts`
- 主网配置：`env.mainnet`
- 部署记录：`deployment.mainnet.json`

## 📞 支持

如有问题，请检查：
1. BSCScan 上的交易状态
2. 合约验证状态
3. 升级日志文件：`upgrade.NFTManagerFacet.bscMainnet.json`

