# 🚨 紧急恢复完整指南

## ⚠️ 当前情况

- **目标地址**: `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6` (私钥泄露)
- **恶意委托**: `0x3Ae1F70C...F62162D10` (需要完整地址)
- **问题**: 攻击者会持续委托，需要快速恢复

## 🎯 解决方案

创建一个紧急恢复合约，支持：
1. ✅ 取消委托（使用 EIP-712 签名，由执行者代付 gas）
2. ✅ 转移合约所有权（使用 EIP-712 签名，由执行者代付 gas）
3. ✅ 原子化执行（一次交易完成所有操作）

## 📋 执行步骤

### 步骤 1: 获取完整的恶意委托地址

1. 访问: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
2. 查看 "Delegated to" 部分
3. 复制完整的恶意地址

### 步骤 2: 部署紧急恢复合约

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 部署紧急恢复合约
npx hardhat run scripts/deploy-emergency-recovery.ts --network bscMainnet
```

**重要**：
- 部署后，将合约 Owner 设置为多签钱包
- 保存合约地址

### 步骤 3: 准备签名

由于 BNB Chain 委托合约的 `undelegate` 需要由委托者调用，我们需要：

**方案 A: 使用 EIP-712 签名（如果委托合约支持）**

```typescript
// 目标地址签名恢复操作
// 执行者使用签名发送交易
```

**方案 B: 直接使用目标地址私钥（如果还有控制权）**

```bash
# 如果还能访问目标地址的私钥，直接使用
export TARGET_PRIVATE_KEY="目标地址的私钥"
```

**方案 C: 通过多签恢复（推荐）**

如果目标地址是多签钱包的一部分，可以通过多签提案恢复。

### 步骤 4: 执行紧急恢复

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 设置环境变量
export EMERGENCY_RECOVERY_ADDRESS="部署的紧急恢复合约地址"
export MALICIOUS_VALIDATOR_ADDRESS="完整的恶意验证者地址"
export NEW_OWNER_ADDRESS="新的多签钱包地址"
export EXECUTOR_PRIVATE_KEY="执行者的私钥（有BNB支付gas）"

# 如果目标地址还有控制权，也设置
export TARGET_PRIVATE_KEY="目标地址的私钥（如果有）"

# 执行紧急恢复
npx hardhat run scripts/execute-emergency-recovery.ts --network bscMainnet
```

## 🔧 合约设计要点

### 1. 支持 EIP-712 签名

紧急恢复合约需要支持：
- 目标地址签名恢复操作
- 执行者使用签名发送交易并代付 gas

### 2. 原子化操作

一次交易完成：
- 取消委托
- 转移所有合约所有权

### 3. 权限控制

- 只有合约 Owner（多签钱包）可以执行恢复
- 验证目标地址的签名

## ⚠️ 重要提醒

1. **时间窗口**: 攻击者会持续委托，需要在短时间内完成恢复
2. **Gas 准备**: 确保执行者地址有足够的 BNB 支付 gas
3. **多签 Owner**: 紧急恢复合约的 Owner 必须是多签钱包
4. **测试**: 建议先在测试网测试整个流程

## 🔄 如果目标地址已完全失控

如果目标地址的私钥完全泄露且无法控制：

1. **立即转移资金**: 如果地址中有资金，立即转移到新地址
2. **使用多签**: 如果目标地址是多签的一部分，通过其他签名者恢复
3. **联系 BNB Chain**: 如果是严重安全事件，联系 BNB Chain 官方

## 📝 完整流程

```
1. 获取完整恶意委托地址
   ↓
2. 部署紧急恢复合约
   ↓
3. 将合约 Owner 设置为多签钱包
   ↓
4. 准备签名（目标地址签名恢复操作）
   ↓
5. 执行紧急恢复（执行者代付 gas）
   ↓
6. 验证委托已取消
   ↓
7. 验证所有权已转移
```

---

**状态**: 🚨 紧急 - 需要立即处理
**最后更新**: $(date)























