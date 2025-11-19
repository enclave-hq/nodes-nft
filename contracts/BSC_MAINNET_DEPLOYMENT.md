# BSC 主网部署指南

本指南将帮助您在 BSC (Binance Smart Chain) 正式网上部署 Node NFT 项目。

## 📋 前置要求

### 1. 环境准备

- Node.js 18+ 和 npm
- 足够的 BNB 用于 gas 费用（建议至少 0.1 BNB）
- BSCScan API Key（用于合约验证）

### 2. 钱包准备

- 部署钱包的私钥（**请妥善保管，不要泄露**）
- 确保钱包中有足够的 BNB

### 3. 获取 BSCScan API Key

1. 访问 https://bscscan.com/myapikey
2. 注册/登录账户
3. 创建新的 API Key

## 🚀 快速部署

### 方法一：使用自动化脚本（推荐）

```bash
cd node-nft/contracts
./scripts/deploy-bsc-mainnet.sh
```

脚本会自动：
- ✅ **交互式输入私钥**（输入会被隐藏，不会保存到文件）
- ✅ 验证私钥格式
- ✅ 检查钱包余额
- ✅ 编译合约
- ✅ 部署所有合约到 BSC 主网
- ✅ 更新前端和后端配置文件
- ✅ 生成部署报告
- ✅ 部署完成后自动清除内存中的私钥

**使用流程：**
1. 运行脚本后，会提示您输入私钥（输入时不会显示）
2. 脚本会验证私钥格式并检查余额
3. 确认部署信息后，输入 `DEPLOY` 开始部署
4. 部署完成后，私钥会从内存中清除

### 方法二：手动部署

#### 步骤 1: 配置环境变量

在 `contracts` 目录下创建 `.env` 文件（**注意：私钥不会保存在文件中，将在部署时交互式输入**）：

```bash
cd node-nft/contracts
```

脚本会自动创建 `.env` 文件模板。您只需要配置以下变量（私钥除外）：

```env
# BSC 主网配置
# 注意：PRIVATE_KEY 不应存储在此文件中，将在部署时交互式输入

BSC_MAINNET_RPC_URL=https://bsc-dataseed1.binance.org/
BSCSCAN_API_KEY=your_bscscan_api_key  # 可选，也可以在部署时输入

# BSC 主网 USDT 地址（固定）
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# Oracle 和 Treasury 地址（可选，默认使用部署者地址）
ORACLE_ADDRESS=0x...
TREASURY_ADDRESS=0x...

# 可选：初始 $E 转账到 NFTManager
# INITIAL_ECLV_TRANSFER=10000000

# 可选：NFT 元数据 Base URI
# BASE_URI=https://api.enclave.com/nft/metadata/
```

**安全提示：** 私钥将在部署脚本运行时通过交互式输入（输入会被隐藏），不会保存到任何文件中。

#### 步骤 2: 编译合约

```bash
npx hardhat compile
```

#### 步骤 3: 部署合约

```bash
npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet
```

或者使用 npm 脚本：

```bash
npm run deploy:mainnet
```

#### 步骤 4: 记录合约地址

部署完成后，脚本会输出所有合约地址。**请务必保存这些地址！**

#### 步骤 5: 更新配置文件

**更新前端配置 (`frontend/.env.local`):**

```env
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=<部署的 EnclaveToken 地址>
NEXT_PUBLIC_NODE_NFT_ADDRESS=<部署的 NodeNFT 地址>
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=<部署的 NFTManager 地址>
NEXT_PUBLIC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org/
NEXT_PUBLIC_ENABLE_TESTNET=false
NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
```

**更新后端配置 (`backend/.env`):**

```env
NFT_MANAGER_ADDRESS=<部署的 NFTManager 地址>
ENCLAVE_TOKEN_ADDRESS=<部署的 EnclaveToken 地址>
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
RPC_URL=https://bsc-dataseed1.binance.org/
ADMIN_PRIVATE_KEY=<管理员私钥>
```

## ✅ 部署后验证

### 1. 验证合约（可选但推荐）

```bash
# 验证 EnclaveToken
npx hardhat verify --network bscMainnet <ECLV_ADDRESS>

# 验证 NodeNFT
npx hardhat verify --network bscMainnet <NFT_ADDRESS> "Enclave Node NFT" "ENFT"

# 验证 NFTManager Implementation
npx hardhat verify --network bscMainnet <MANAGER_IMPL_ADDRESS>
```

### 2. 在 BSCScan 上检查

访问 https://bscscan.com 并搜索您的合约地址，确认：
- ✅ 合约已成功部署
- ✅ 交易状态为成功
- ✅ Gas 费用合理

### 3. 测试基本功能

1. **检查合约状态：**
   - 确认 EnclaveToken 总供应量
   - 确认 NodeNFT 已正确配置 NFTManager
   - 确认 NFTManager 已正确初始化

2. **测试 Mint（如果已启用）：**
   - 连接钱包到 BSC 主网
   - 尝试 mint 一个 NFT
   - 检查 NFT 是否正确创建

## 🔒 安全注意事项

1. **私钥安全：**
   - ⚠️ **永远不要**将私钥提交到 Git
   - ⚠️ **永远不要**在公共渠道分享私钥
   - ⚠️ **永远不要**将私钥保存到 `.env` 文件中
   - ✅ 使用交互式输入（脚本已支持）
   - ✅ 部署脚本会自动清除内存中的私钥
   - ✅ 如需自动化部署，使用密钥管理服务（如 AWS Secrets Manager）

2. **合约验证：**
   - ✅ 部署后立即验证所有合约
   - ✅ 验证有助于用户信任和审计

3. **权限管理：**
   - ✅ 确认 Oracle 地址设置正确
   - ✅ 确认 Treasury 地址设置正确
   - ✅ 考虑使用多签钱包管理关键权限

4. **测试：**
   - ✅ 在主网部署前，先在测试网充分测试
   - ✅ 使用小金额进行首次测试

## 📝 部署清单

部署前检查：

- [ ] 已配置 `.env` 文件
- [ ] 钱包中有足够的 BNB（至少 0.1 BNB）
- [ ] 已获取 BSCScan API Key
- [ ] 已确认 USDT 地址正确（BSC 主网：`0x55d398326f99059fF775485246999027B3197955`）
- [ ] Oracle 和 Treasury 地址已确认
- [ ] 已在测试网完成测试

部署后检查：

- [ ] 所有合约已成功部署
- [ ] 合约地址已保存
- [ ] 前端 `.env.local` 已更新
- [ ] 后端 `.env` 已更新
- [ ] 合约已在 BSCScan 上验证（可选）
- [ ] 基本功能测试通过
- [ ] 部署报告已生成

## 🐛 故障排除

### 错误：Insufficient BNB balance

**解决方案：** 确保钱包中有足够的 BNB。建议至少 0.1 BNB。

### 错误：Contract verification failed

**解决方案：**
- 检查 BSCScan API Key 是否正确
- 确认网络连接正常
- 可以稍后手动在 BSCScan 上验证

### 错误：Transaction reverted

**解决方案：**
- 检查合约初始化参数是否正确
- 确认 USDT 地址是 BSC 主网地址
- 检查 gas limit 是否足够

### 错误：Nonce too high

**解决方案：**
- 等待之前的交易完成
- 或手动重置 nonce

## 📞 获取帮助

如果遇到问题：

1. 检查部署脚本的输出日志
2. 查看 BSCScan 上的交易详情
3. 参考项目文档：`docs/node-nft/`
4. 检查 Hardhat 配置：`hardhat.config.ts`

## 🔗 有用的链接

- BSC 主网浏览器：https://bscscan.com
- BSC 官方文档：https://docs.binance.org/smart-chain/developer/rpc.html
- BSCScan API：https://bscscan.com/apis
- 项目 GitHub：https://github.com/your-org/node-nft

---

**⚠️ 重要提醒：** 主网部署是不可逆的。请确保在部署前仔细检查所有配置，并在测试网上充分测试。

