# 🚀 快速恢复脚本使用说明

## 📋 环境变量配置

在运行脚本前，需要在 `.env` 文件中设置以下环境变量：

```bash
# 目标地址的私钥（私钥泄露的地址）
TARGET_PRIVATE_KEY=0x你的目标地址私钥

# 执行者的私钥（有BNB支付gas的地址）
EXECUTOR_PRIVATE_KEY=0x你的执行者私钥

# 新的 Owner 地址（应该是多签钱包）
NEW_OWNER_ADDRESS=0x新的多签钱包地址

# 恶意验证者地址（可选，如果不设置会自动从链上查询）
MALICIOUS_VALIDATOR_ADDRESS=0x恶意验证者地址

# RPC URL（可选，默认使用 BSC 主网）
RPC_URL=https://bsc-dataseed1.binance.org
# 或
BSC_MAINNET_RPC_URL=https://bsc-dataseed1.binance.org
```

## 🚀 执行步骤

1. **创建或编辑 `.env` 文件**:
   ```bash
   cd /Users/qizhongzhu/enclave/node-nft/contracts
   nano .env  # 或使用其他编辑器
   ```

2. **设置环境变量**（见上方）

3. **运行脚本**:
   ```bash
   npx hardhat run scripts/quick-undelegate-and-transfer.ts --network bscMainnet
   ```

## ⚠️ 重要提醒

1. **私钥安全**: 不要将 `.env` 文件提交到 Git
2. **目标地址**: `TARGET_PRIVATE_KEY` 对应的地址必须是 `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6`
3. **执行者余额**: 确保执行者地址有足够的 BNB（至少 0.1 BNB）
4. **新 Owner**: 必须是多签钱包地址，不要使用单签地址

## 📝 脚本执行流程

1. ✅ 检查环境变量
2. ✅ 检查目标地址余额，不足时执行者发送 BNB
3. ✅ 查询并取消委托
4. ✅ 转移所有合约所有权
5. ✅ 验证结果

---

**最后更新**: $(date)























