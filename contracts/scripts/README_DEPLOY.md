# BSC 主网部署脚本使用说明

## 快速开始

```bash
cd node-nft/contracts
./scripts/deploy-bsc-mainnet.sh
```

## 功能特点

✅ **安全的私钥输入**
- 私钥通过交互式输入（输入会被隐藏）
- 私钥不会保存到任何文件
- 部署完成后自动从内存清除

✅ **自动化流程**
- 自动检查环境配置
- 验证私钥格式
- 检查钱包余额
- 编译合约
- 部署所有合约
- 更新配置文件
- 生成部署报告

## 使用步骤

1. **准备环境**
   ```bash
   cd node-nft/contracts
   ```

2. **运行部署脚本**
   ```bash
   ./scripts/deploy-bsc-mainnet.sh
   ```

3. **按提示操作**
   - 输入私钥（输入时不会显示）
   - 可选：输入 BSCScan API Key
   - 确认部署信息
   - 输入 `DEPLOY` 开始部署

4. **等待部署完成**
   - 脚本会自动部署所有合约
   - 更新前端和后端配置
   - 生成部署报告

## 环境变量配置

在 `contracts/.env` 文件中配置（**不要包含私钥**）：

```env
# BSC 主网配置
BSC_MAINNET_RPC_URL=https://bsc-dataseed1.binance.org/
BSCSCAN_API_KEY=your_bscscan_api_key  # 可选

# BSC 主网 USDT 地址（固定）
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# Oracle 和 Treasury 地址（可选）
ORACLE_ADDRESS=0x...
TREASURY_ADDRESS=0x...
```

## 安全提示

⚠️ **重要安全注意事项：**

1. **私钥安全**
   - ✅ 使用交互式输入（脚本已支持）
   - ❌ 不要将私钥保存到 `.env` 文件
   - ❌ 不要将私钥提交到 Git
   - ❌ 不要在公共渠道分享私钥

2. **部署前检查**
   - ✅ 确认钱包有足够的 BNB（至少 0.1 BNB）
   - ✅ 确认 USDT 地址正确
   - ✅ 确认 Oracle 和 Treasury 地址（如需要）

3. **部署后验证**
   - ✅ 在 BSCScan 上验证合约
   - ✅ 测试基本功能
   - ✅ 检查所有配置是否正确

## 故障排除

### 私钥格式错误
- 确保私钥是 64 个十六进制字符
- 可以包含或不包含 `0x` 前缀（脚本会自动处理）

### 余额不足
- 确保钱包中有至少 0.1 BNB
- 检查网络连接是否正常

### 部署失败
- 检查 BSC 主网 RPC 是否可访问
- 检查 gas price 设置
- 查看详细错误信息

## 更多信息

详细部署指南请参考：[BSC_MAINNET_DEPLOYMENT.md](../BSC_MAINNET_DEPLOYMENT.md)





