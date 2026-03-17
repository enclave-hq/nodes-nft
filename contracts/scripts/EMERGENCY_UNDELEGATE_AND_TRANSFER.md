# 🚨 紧急：取消恶意委托并转移所有权

## ⚠️ 当前情况

地址 `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6` 已被委托到恶意合约：
- **委托地址**: `0x3Ae1F70C...F62162D10` (需要从 BSCScan 获取完整地址)

## 🎯 完整执行流程

### 步骤 1: 获取完整的恶意委托地址

1. 访问 BSCScan: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
2. 查看 "Delegated to" 部分
3. 复制完整的恶意委托地址（应该是 `0x3Ae1F70C...` 开头的完整 42 字符地址）

### 步骤 2: 检查当前委托状态

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 检查委托状态
npx hardhat run scripts/check-delegation-status.ts --network bscMainnet
```

### 步骤 3: 取消恶意委托

**方法 A: 通过 BSCScan（最快）**

1. 访问委托合约: https://bscscan.com/address/0x0000000000000000000000000000000000001000
2. 点击 "Contract" → "Write Contract"
3. 连接钱包（使用目标地址 `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6` 的私钥）
4. 找到 `undelegate` 函数
5. 输入恶意验证者地址（完整地址）
6. 点击 "Write" 并确认交易

**方法 B: 使用脚本**

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 设置环境变量
export PRIVATE_KEY="0x目标地址的私钥"
export MALICIOUS_DELEGATE_ADDRESS="完整的恶意委托地址（0x开头）"
export RPC_URL="https://bsc-dataseed1.binance.org"

# 运行取消委托脚本
npx hardhat run scripts/undelegate-from-malicious.ts --network bscMainnet
```

### 步骤 4: 验证委托已取消

```bash
# 再次检查委托状态
npx hardhat run scripts/check-delegation-status.ts --network bscMainnet

# 或在 BSCScan 上验证
# https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
```

### 步骤 5: 转移合约所有权

委托取消后，立即转移所有合约的所有权：

```bash
# 设置新 Owner 地址（必须是多签钱包地址）
export NEW_OWNER_ADDRESS="新的多签钱包地址"
export PRIVATE_KEY="0x目标地址的私钥"

# 运行所有权转移脚本
npx hardhat run scripts/transfer-all-ownership.ts --network bscMainnet
```

## 📋 需要转移所有权的合约

根据 `MAINNET_CONFIG.md`：

1. **NFTManager (Diamond)**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
2. **NodeNFT**: `0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b`
3. **EnclaveToken**: `0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011`
4. **TokenVesting**: `0x67B8927F0835e79632f4622F017915Cb0B9a6c72`

## ⚠️ 重要提醒

1. **立即执行**: 委托到恶意合约意味着投票权被控制，需要立即取消
2. **使用正确私钥**: 确保使用目标地址 `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6` 对应的私钥
3. **新 Owner 必须是多签**: 不要使用单签地址作为新的 Owner
4. **验证每一步**: 每个步骤完成后都要验证结果

## 🔗 相关链接

- 目标地址: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
- 委托合约: https://bscscan.com/address/0x0000000000000000000000000000000000001000
- NFTManager: https://bscscan.com/address/0xD9eA9F4B8F24872262568fB2C6133117EC02C774
- NodeNFT: https://bscscan.com/address/0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b
- EnclaveToken: https://bscscan.com/address/0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011
- TokenVesting: https://bscscan.com/address/0x67B8927F0835e79632f4622F017915Cb0B9a6c72

---

**状态**: 🚨 紧急 - 需要立即处理
**最后更新**: $(date)























