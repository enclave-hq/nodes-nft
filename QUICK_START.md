# 🚀 快速开始 - BSC 测试网部署

这是一个简化的快速部署指南。完整的测试计划请参考 [TESTNET_DEPLOYMENT_GUIDE.md](./TESTNET_DEPLOYMENT_GUIDE.md)。

---

## ⚡ 30秒快速检查清单

- [ ] 有测试网 BNB（至少 0.5 BNB）
- [ ] 有私钥（用于部署）
- [ ] 安装了 Node.js 和 npm
- [ ] 配置了 MetaMask

---

## 📋 第一步：准备环境

### 1. 获取测试网 BNB

访问 BSC 测试网水龙头：
```
https://testnet.binance.org/faucet-smart
```

输入你的钱包地址，获取测试 BNB。

### 2. 配置环境变量

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 复制示例文件
cp .env.example .env

# 编辑 .env 文件
nano .env  # 或使用其他编辑器
```

**必填项：**
```bash
PRIVATE_KEY=你的私钥（不要包含0x前缀）
BSCSCAN_API_KEY=你的BSCScan_API_Key（可选，用于验证合约）
```

### 3. 安装依赖

```bash
npm install
```

---

## 🚀 第二步：部署合约

### 部署步骤 1：部署测试 USDT

```bash
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet
```

**预期输出：**
```
✅ Test USDT deployed to: 0x...
```

**保存这个地址！** 将它添加到 `.env` 文件：
```bash
USDT_ADDRESS=0x...
```

### 部署步骤 2：部署主要合约

```bash
npx hardhat run scripts/02-deploy-main.ts --network bscTestnet
```

**预期输出：**
```
✅ EnclaveToken deployed to: 0x...
✅ NodeNFT deployed to: 0x...
✅ NFTManager deployed to: 0x...
```

**保存所有地址！** 将它们添加到 `.env` 文件。

---

## 🧪 第三步：测试合约

### 测试 1：铸造 NFT

```bash
npx hardhat run scripts/04-test-mint.ts --network bscTestnet
```

这会铸造一个 Standard NFT 和一个 Premium NFT。

### 测试 2：分发和领取奖励

```bash
npx hardhat run scripts/05-test-distribute-and-claim.ts --network bscTestnet
```

这会测试：
- 分发 ECLV 产出
- 分发 USDT 奖励
- 查询待领取奖励
- 领取奖励

---

## 🌐 第四步：连接前端

### 1. 配置前端环境

在 `frontend/.env.local` 创建文件：

```bash
cd /Users/qizhongzhu/enclave/node-nft/frontend

# 使用部署输出中的地址
cat > .env.local << 'EOF'
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=你的ECLV地址
NEXT_PUBLIC_NODE_NFT_ADDRESS=你的NFT地址
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=你的Manager地址
NEXT_PUBLIC_USDT_ADDRESS=你的USDT地址
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_ENABLE_TESTNET=true
EOF
```

### 2. 启动前端

```bash
npm run dev
```

访问: http://localhost:3000

### 3. 配置 MetaMask

**添加 BSC Testnet 网络：**

1. 打开 MetaMask
2. 点击网络下拉菜单
3. 点击"添加网络" → "手动添加网络"
4. 填写以下信息：
   - **Network Name:** BSC Testnet
   - **RPC URL:** `https://data-seed-prebsc-1-s1.binance.org:8545`
   - **Chain ID:** `97`
   - **Currency Symbol:** `BNB`
   - **Block Explorer:** `https://testnet.bscscan.com`
5. 保存

### 4. 添加代币到 MetaMask

**添加 USDT:**
1. 在 MetaMask 中点击"导入代币"
2. 粘贴 USDT 合约地址
3. 确认

**添加 ECLV:**
1. 在 MetaMask 中点击"导入代币"
2. 粘贴 ECLV 合约地址
3. 确认

---

## 🎮 第五步：测试前端功能

### 场景 1：铸造 NFT

1. 连接 MetaMask 钱包
2. 进入 "Mint" 页面
3. 选择 NFT 类型（Standard 或 Premium）
4. 点击 "Mint NFT"
5. 批准 USDT 授权（如需要）
6. 确认铸造交易
7. 等待交易确认

### 场景 2：查看 My NFTs

1. 进入 "My NFTs" 页面
2. 查看你拥有的 NFT
3. 检查待领取的奖励
4. 点击 "Claim" 领取奖励

### 场景 3：测试 Marketplace

1. 进入 "Marketplace" 页面
2. 创建卖单（点击你的 NFT）
3. 设置份额数量和价格
4. 确认创建订单
5. 用另一个账户测试购买

---

## 📊 监控部署

### 在 BSCScan 上查看

访问 BSC 测试网浏览器：
```
https://testnet.bscscan.com
```

搜索你的合约地址，可以看到：
- 部署交易
- 合约代码（如已验证）
- 交易历史
- 事件日志

### 验证合约（可选但推荐）

```bash
# 验证 USDT
npx hardhat verify --network bscTestnet <USDT_ADDRESS>

# 验证 EnclaveToken
npx hardhat verify --network bscTestnet <ECLV_ADDRESS>

# 验证 NodeNFT
npx hardhat verify --network bscTestnet <NFT_ADDRESS>

# 验证 NFTManager
npx hardhat verify --network bscTestnet <MANAGER_ADDRESS>
```

---

## 🎯 测试场景建议

### 基础测试（必做）

1. ✅ **铸造测试**
   - 铸造 Standard NFT
   - 铸造 Premium NFT
   - 验证 NFT 所有权

2. ✅ **奖励测试**
   - 分发 ECLV 产出
   - 分发 USDT 奖励
   - 领取奖励

3. ✅ **前端测试**
   - 钱包连接
   - UI 显示正确
   - 多语言切换

### 进阶测试（可选）

4. **份额转让**
   - 转让部分份额给其他用户
   - 验证奖励分配

5. **Marketplace**
   - 创建卖单
   - 购买份额
   - 取消订单

6. **解散机制**
   - 提议解散 NFT
   - 多方签名批准
   - 提取资产

---

## 🐛 常见问题

### 问题 1: Gas 不足
```
Error: insufficient funds for gas
```
**解决:** 从水龙头获取更多测试 BNB

### 问题 2: 私钥格式错误
```
Error: invalid private key
```
**解决:** 确保私钥不包含 `0x` 前缀

### 问题 3: USDT 余额不足
```
Error: Insufficient USDT balance
```
**解决:** 使用 `03-setup-test-accounts.ts` 脚本 mint 更多 USDT

### 问题 4: 合约地址未设置
```
Error: Please set USDT_ADDRESS in .env
```
**解决:** 确保 `.env` 文件中设置了所有合约地址

### 问题 5: MetaMask nonce 错误
```
Error: nonce too low
```
**解决:** 在 MetaMask 设置中重置账户
1. 设置 > 高级 > 清除活动数据

---

## 📝 部署检查清单

完成后打勾：

### 部署阶段
- [ ] 获取测试 BNB
- [ ] 配置 .env 文件
- [ ] 部署 TestUSDT
- [ ] 部署主要合约
- [ ] 验证合约（可选）

### 测试阶段
- [ ] 测试铸造
- [ ] 测试分发和领取
- [ ] 配置前端环境
- [ ] 启动前端
- [ ] 配置 MetaMask
- [ ] 测试前端铸造
- [ ] 测试前端领取
- [ ] 测试 Marketplace

### 完成
- [ ] 记录所有合约地址
- [ ] 截图保存测试结果
- [ ] 准备测试报告

---

## 🚀 下一步

部署和测试成功后：

1. **创建测试报告** - 记录所有功能是否正常
2. **性能分析** - 记录 Gas 消耗
3. **安全检查** - 检查潜在安全问题
4. **准备主网部署** - 最终部署计划

---

## 📞 需要帮助？

如果遇到问题：

1. 查看完整指南：[TESTNET_DEPLOYMENT_GUIDE.md](./TESTNET_DEPLOYMENT_GUIDE.md)
2. 检查合约文档：[CONTRACTS_COMPLETE.md](./CONTRACTS_COMPLETE.md)
3. 查看代码规范：[CODE_STANDARDS.md](./CODE_STANDARDS.md)

---

**祝部署顺利！** 🎉

