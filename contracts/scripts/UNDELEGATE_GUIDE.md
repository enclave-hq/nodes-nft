# 🚨 紧急：取消恶意委托指南

## ⚠️ 当前情况

地址 `0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6` 已被委托到恶意合约：
- **委托地址**: `0x3Ae1F70C...F62162D10` (需要查找完整地址)

## 🎯 执行步骤

### 步骤 1: 查找完整的恶意委托地址

从 BSCScan 上查找完整的委托地址：

1. 访问: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
2. 查看 "Delegated to" 部分，获取完整的恶意地址
3. 记录完整地址

### 步骤 2: 通过 BSCScan 取消委托（推荐）

**方法 A: 使用 BSCScan 合约交互**

1. 访问 BNB Chain 委托合约: https://bscscan.com/address/0x0000000000000000000000000000000000001000
2. 点击 "Contract" → "Write Contract"
3. 连接钱包（使用目标地址的私钥）
4. 找到 `undelegate` 函数
5. 输入恶意验证者地址
6. 点击 "Write" 并确认交易

**方法 B: 使用脚本**

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 1. 设置环境变量
export PRIVATE_KEY="目标地址的私钥（0x开头）"
export MALICIOUS_DELEGATE="完整的恶意委托地址"

# 2. 运行取消委托脚本
npx hardhat run scripts/undelegate-from-malicious.ts --network bscMainnet
```

### 步骤 3: 验证委托已取消

1. 在 BSCScan 上检查地址: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
2. 确认 "Delegated to" 显示为空或已取消
3. 等待几个区块确认

### 步骤 4: 执行合约所有权转移

委托取消后，执行所有权转移：

```bash
# 设置新 Owner 地址（应该是多签钱包）
export NEW_OWNER_ADDRESS="新的多签钱包地址"

# 运行所有权转移脚本
npx hardhat run scripts/transfer-all-ownership.ts --network bscMainnet
```

## 🔍 BNB Chain 委托机制说明

### 委托合约地址

- **Mainnet**: `0x0000000000000000000000000000000000001000`
- 这是 BNB Chain 的系统委托合约

### 主要函数

1. **delegate(address validator)**: 委托给验证者
2. **undelegate(address validator)**: 取消委托
3. **getDelegated(address)**: 查询当前委托的验证者
4. **getDelegations(address)**: 查询所有委托

### 注意事项

- 取消委托可能需要等待一段时间才能生效
- 某些委托可能有锁定期
- 取消委托需要支付 gas 费用

## ⚠️ 重要提醒

1. **立即行动**: 委托到恶意合约意味着该地址的投票权被控制，需要立即取消
2. **使用正确私钥**: 确保使用目标地址对应的私钥进行操作
3. **验证结果**: 取消委托后，务必在 BSCScan 上验证
4. **转移所有权**: 委托取消后，立即转移所有合约的所有权到安全地址

## 📝 完整流程

```
1. 查找完整恶意委托地址
   ↓
2. 取消委托（通过 BSCScan 或脚本）
   ↓
3. 验证委托已取消
   ↓
4. 转移合约所有权到新地址
   ↓
5. 验证所有权转移成功
```

## 🔗 相关链接

- BSCScan 地址: https://bscscan.com/address/0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6
- 委托合约: https://bscscan.com/address/0x0000000000000000000000000000000000001000
- BNB Chain 文档: https://docs.bnbchain.org/

---

**状态**: 🚨 紧急 - 需要立即处理
**最后更新**: $(date)























