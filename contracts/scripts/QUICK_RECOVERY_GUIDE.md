# 🚨 快速恢复指南 - 取消委托并转移所有权

## ⚠️ 紧急情况

- **目标地址**: `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6` (私钥泄露)
- **恶意委托**: `0x3Ae1F70C...F62162D10`
- **问题**: 攻击者会持续委托，需要快速恢复

## 🎯 解决方案

由于 BNB Chain 委托合约的 `undelegate` 必须由委托者自己调用，我们使用以下方案：

1. **执行者代付 Gas**: 执行者发送少量 BNB 到目标地址
2. **使用目标地址私钥**: 使用目标地址的私钥签名交易（但 Gas 已由执行者支付）
3. **原子化执行**: 快速连续执行取消委托和转移所有权

## 📋 执行步骤

### 步骤 1: 获取完整的恶意委托地址

1. 访问: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
2. 查看 "Delegated to" 部分
3. 复制完整的恶意地址

### 步骤 2: 准备环境变量

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 创建 .env 文件或设置环境变量
export TARGET_PRIVATE_KEY="目标地址的私钥（0x开头）"
export NEW_OWNER_ADDRESS="新的多签钱包地址"
export MALICIOUS_VALIDATOR_ADDRESS="完整的恶意验证者地址（可选，会自动检测）"
export EXECUTOR_PRIVATE_KEY="执行者的私钥（有BNB支付gas）"
export RPC_URL="https://bsc-dataseed1.binance.org"
```

### 步骤 3: 执行快速恢复

```bash
# 运行快速恢复脚本
npx hardhat run scripts/quick-undelegate-and-transfer.ts --network bscMainnet
```

脚本会：
1. ✅ 检查目标地址余额，如果不足，执行者发送 BNB
2. ✅ 使用目标地址私钥取消委托
3. ✅ 使用目标地址私钥转移所有合约所有权
4. ✅ 验证所有操作

## ⚠️ 重要说明

### BNB Chain 委托限制

BNB Chain 委托合约的 `undelegate` 函数**必须由委托者自己调用**，无法由其他地址代表调用。

因此，我们需要：
1. 使用目标地址的私钥签名交易
2. 但 Gas 可以由执行者先发送 BNB 到目标地址来支付

### 执行顺序

由于攻击者会持续委托，需要：
1. **快速执行**: 在攻击者再次委托之前完成
2. **原子化**: 尽可能在一次交易中完成（但受限于委托合约的限制）
3. **验证**: 每个步骤后立即验证

## 🔄 如果目标地址完全没有 BNB

如果目标地址余额为 0：

1. **执行者发送 BNB**:
   ```bash
   # 脚本会自动发送，或手动发送
   # 使用 MetaMask 或其他钱包发送 0.1 BNB 到目标地址
   ```

2. **然后执行恢复脚本**

## 📝 需要转移所有权的合约

1. **NFTManager (Diamond)**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
   - ⚠️ 需要检查是否有转移所有权的函数
   - 可能需要添加新的 Facet

2. **NodeNFT**: `0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b`
   - ✅ 使用 OpenZeppelin Ownable，有 `transferOwnership`

3. **EnclaveToken**: `0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011`
   - ✅ 使用 OpenZeppelin Ownable，有 `transferOwnership`

4. **TokenVesting**: `0x67B8927F0835e79632f4622F017915Cb0B9a6c72`
   - ✅ 使用 OpenZeppelin Ownable，有 `transferOwnership`

## 🔍 验证结果

执行后，验证：

1. **委托状态**: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
   - 应该显示 "Delegated to" 为空

2. **合约 Owner**:
   - NodeNFT: https://bscscan.com/address/0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b#readContract
   - EnclaveToken: https://bscscan.com/address/0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011#readContract
   - TokenVesting: https://bscscan.com/address/0x67B8927F0835e79632f4622F017915Cb0B9a6c72#readContract
   - 所有 Owner 应该是新的多签钱包地址

## ⚠️ 重要提醒

1. **时间窗口**: 攻击者会持续委托，需要在短时间内完成
2. **私钥安全**: 使用目标地址私钥后，立即轮换所有密钥
3. **新 Owner**: 必须是多签钱包，不要使用单签地址
4. **Gas 准备**: 确保执行者地址有足够的 BNB

## 🔄 如果脚本执行失败

如果脚本执行失败，可以手动执行：

1. **通过 BSCScan 取消委托**:
   - 访问: https://bscscan.com/address/0x0000000000000000000000000000000000001000#writeContract
   - 连接目标地址的钱包
   - 调用 `undelegate` 函数

2. **通过 BSCScan 转移所有权**:
   - 访问各个合约页面
   - 连接目标地址的钱包
   - 调用 `transferOwnership` 函数

---

**状态**: 🚨 紧急 - 需要立即处理
**最后更新**: $(date)























