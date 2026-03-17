# EIP-7702 紧急恢复执行指南

## 📋 执行步骤

### 步骤 1: 重新部署代理合约

由于代码已更新（使用 nftManagerCut 方式），需要重新部署：

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
npx hardhat run scripts/deploy-eip7702-recovery-proxy.ts --network bscMainnet
```

**重要：** 保存输出的代理合约地址！

### 步骤 2: 配置环境变量

在 `.env` 文件中添加以下环境变量：

```bash
# EIP-7702 恢复配置
EIP7702_PROXY_ADDRESS=<步骤1中部署的代理合约地址>

# 目标地址（被盗地址）的私钥
TARGET_PRIVATE_KEY=<目标地址的私钥>

# 执行者地址（支付 gas）的私钥
EXECUTOR_PRIVATE_KEY=<执行者地址的私钥>

# 新 Owner 地址（多签钱包）
NEW_OWNER_ADDRESS=0x4561a736b9663948e06371d19541aa1dc5107e1a

# 恶意验证者地址（如果需要取消委托，否则设为 0x0000000000000000000000000000000000000000）
MALICIOUS_VALIDATOR_ADDRESS=0x0000000000000000000000000000000000000000

# RPC URL（如果未设置，会使用默认值）
RPC_URL=https://bsc-dataseed1.binance.org
```

### 步骤 3: 执行恢复脚本

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
npx hardhat run scripts/execute-eip7702-recovery.ts --network bscMainnet
```

## 🔍 执行流程说明

1. **生成 EIP-7702 授权签名**：目标地址签名授权给代理合约
2. **构建调用数据**：准备 `emergencyRecover` 函数的调用数据
3. **构建 EIP-7702 交易**：Type 0x04 交易，包含授权列表
4. **执行者签名交易**：执行者签名并支付 gas
5. **广播交易**：发送到 BSC 主网
6. **验证所有权转移**：检查所有合约的 owner 是否已转移

## 📝 需要转移所有权的合约

- **NFT_MANAGER**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
- **NODE_NFT**: `0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b`
- **ENCLAVE_TOKEN**: `0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011`
- **TOKEN_VESTING**: `0x67B8927F0835e79632f4622F017915Cb0B9a6c72`

## ⚠️ 重要提示

1. **代理合约只需要部署一次**：如果之前已部署，但代码已更新，需要重新部署
2. **执行者地址必须有足够的 BNB**：用于支付 gas 费用（预计约 0.00015 BNB）
3. **目标地址必须是所有合约的 owner**：否则会失败
4. **NFTManager 特殊处理**：使用 nftManagerCut 添加临时 Facet 来转移所有权

## 🔧 故障排查

### 错误：`EIP7702_PROXY_ADDRESS 未设置`
- 检查 `.env` 文件中是否设置了 `EIP7702_PROXY_ADDRESS`

### 错误：`insufficient funds for gas`
- 确认执行者地址有足够的 BNB（至少 0.001 BNB）

### 错误：`NFTManager: Failed to transfer ownership`
- 检查目标地址是否是 NFTManager 的 owner
- 检查代理合约代码是否正确部署

### 错误：`Owner mismatch`
- 确认目标地址是所有合约的 owner
- 检查合约地址是否正确

## 📊 验证结果

脚本执行成功后，会输出每个合约的 owner 验证结果：

```
✅ NFT_MANAGER owner: 0x4561a736b9663948e06371d19541aa1dc5107e1a
✅ NODE_NFT owner: 0x4561a736b9663948e06371d19541aa1dc5107e1a
✅ ENCLAVE_TOKEN owner: 0x4561a736b9663948e06371d19541aa1dc5107e1a
✅ TOKEN_VESTING owner: 0x4561a736b9663948e06371d19541aa1dc5107e1a
```

## 🔗 相关文件

- `scripts/deploy-eip7702-recovery-proxy.ts` - 部署代理合约
- `scripts/execute-eip7702-recovery.ts` - 执行恢复脚本
- `contracts/emergency/EIP7702RecoveryProxy.sol` - 代理合约代码
- `contracts/emergency/OwnerTransferFacet.sol` - 临时 Facet 代码























