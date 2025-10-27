# 🏠 本地测试指南 (Hardhat Network)

**推荐：先在本地测试，再部署到测试网！**

---

## 🎯 为什么先本地测试？

### ✅ 优势
1. **零成本** - 不需要真实 BNB
2. **快速迭代** - 即时确认，无需等待区块
3. **完全控制** - 可以操纵时间、快照、回滚
4. **便于调试** - 详细的错误信息和堆栈跟踪
5. **无限重置** - 随时重新开始

### ⚠️ 局限
1. 前端无法直接连接（需要 localhost RPC）
2. 无法在区块浏览器查看
3. 不是真实网络环境

---

## 🚀 快速开始

### 1. 启动本地节点

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 终端 1: 启动 Hardhat 节点
npx hardhat node
```

**输出示例:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

**保持这个终端运行！**

### 2. 在新终端运行测试

```bash
# 终端 2: 运行测试脚本
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 部署所有合约
npx hardhat run scripts/local-01-deploy-all.ts --network localhost

# 运行铸造测试
npx hardhat run scripts/local-02-test-mint.ts --network localhost

# 运行分发和领取测试
npx hardhat run scripts/local-03-test-distribution.ts --network localhost

# 运行份额转让测试
npx hardhat run scripts/local-04-test-transfer.ts --network localhost

# 运行 Marketplace 测试
npx hardhat run scripts/local-05-test-marketplace.ts --network localhost

# 运行解锁测试（包含时间操纵）
npx hardhat run scripts/local-06-test-unlock.ts --network localhost
```

---

## 📜 本地测试脚本

我们需要创建本地测试专用的脚本，因为本地测试有一些特殊能力：

### 脚本列表
1. `local-01-deploy-all.ts` - 一键部署所有合约
2. `local-02-test-mint.ts` - 测试铸造
3. `local-03-test-distribution.ts` - 测试分发和领取
4. `local-04-test-transfer.ts` - 测试份额转让
5. `local-05-test-marketplace.ts` - 测试市场功能
6. `local-06-test-unlock.ts` - 测试解锁（包含时间快进）

---

## 🧪 高级测试功能

### 1. 时间操纵（测试解锁机制）

```typescript
import { time } from "@nomicfoundation/hardhat-network-helpers";

// 快进 1 年
await time.increase(365 * 24 * 60 * 60);

// 快进到特定时间戳
await time.increaseTo(futureTimestamp);

// 获取当前区块时间
const currentTime = await time.latest();
```

### 2. 账户切换

```typescript
const [deployer, alice, bob, charlie] = await ethers.getSigners();

// 使用 Alice 的账户执行操作
const tx = await manager.connect(alice).mintNFT(0);
```

### 3. 快照和回滚

```typescript
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// 创建快照
const snapshotId = await ethers.provider.send("evm_snapshot", []);

// ... 进行一些测试 ...

// 回滚到快照
await ethers.provider.send("evm_revert", [snapshotId]);
```

### 4. 自动挖矿控制

```typescript
// 禁用自动挖矿
await network.provider.send("evm_setAutomine", [false]);

// 手动挖一个块
await network.provider.send("evm_mine");

// 启用自动挖矿
await network.provider.send("evm_setAutomine", [true]);
```

---

## 📊 本地测试场景

### 场景 1: 基础功能测试（15分钟）

```bash
# 1. 启动节点
npx hardhat node

# 2. 部署合约
npx hardhat run scripts/local-01-deploy-all.ts --network localhost

# 3. 测试铸造
npx hardhat run scripts/local-02-test-mint.ts --network localhost

# 4. 测试分发
npx hardhat run scripts/local-03-test-distribution.ts --network localhost
```

**验证内容：**
- ✅ 合约部署成功
- ✅ NFT 铸造正常
- ✅ 奖励分发和领取正确
- ✅ Gas 消耗合理

### 场景 2: 多用户交互测试（20分钟）

```bash
# 测试份额转让
npx hardhat run scripts/local-04-test-transfer.ts --network localhost

# 测试 Marketplace
npx hardhat run scripts/local-05-test-marketplace.ts --network localhost
```

**验证内容：**
- ✅ 份额转让正确结算奖励
- ✅ 订单创建和购买正常
- ✅ USDT 转账正确

### 场景 3: 时间相关测试（15分钟）

```bash
# 测试解锁机制
npx hardhat run scripts/local-06-test-unlock.ts --network localhost
```

**验证内容：**
- ✅ 解锁时间计算正确
- ✅ 解锁百分比准确
- ✅ Dissolved 状态正常

### 场景 4: 边界和异常测试（20分钟）

创建专门的边界测试脚本：
```bash
npx hardhat run scripts/local-07-test-edge-cases.ts --network localhost
```

**测试内容：**
- ⚠️ 余额不足情况
- ⚠️ 权限拒绝
- ⚠️ 重入攻击保护
- ⚠️ 溢出/下溢保护

---

## 🎮 交互式测试 (Hardhat Console)

### 启动 Console

```bash
# 确保节点在运行，然后：
npx hardhat console --network localhost
```

### 常用命令

```javascript
// 1. 获取账户
const [deployer, alice, bob] = await ethers.getSigners();
console.log("Deployer:", deployer.address);

// 2. 连接到已部署的合约（需要先部署）
const manager = await ethers.getContractAt("NFTManager", "0x5FbDB2315678afecb367f032d93F642f64180aa3");
const nft = await ethers.getContractAt("NodeNFT", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
const usdt = await ethers.getContractAt("TestUSDT", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");

// 3. 查询状态
const config = await manager.nftConfigs(0);
console.log("Standard NFT config:", config);

// 4. 铸造 NFT (作为 Alice)
const mintPrice = ethers.parseUnits("10000", 18);
await usdt.connect(alice).approve(manager.target, mintPrice);
const tx = await manager.connect(alice).mintNFT(0);
await tx.wait();
console.log("Minted!");

// 5. 时间快进
await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
await ethers.provider.send("evm_mine");
console.log("Fast-forwarded 1 year!");

// 6. 查询待领取奖励
const pending = await manager.pendingProduced(1);
console.log("Pending ECLV:", ethers.formatEther(pending));
```

---

## 📝 创建本地测试脚本

让我为你创建完整的本地测试脚本套件。这些脚本会：

1. ✅ 自动部署所有合约
2. ✅ 初始化测试数据
3. ✅ 执行各种测试场景
4. ✅ 输出详细的测试结果
5. ✅ 验证正确性

---

## 🔄 本地测试 vs 测试网测试对比

| 特性 | 本地 Hardhat | BSC 测试网 |
|------|-------------|-----------|
| **成本** | 免费 | 需要测试 BNB |
| **速度** | 即时 | 3秒/区块 |
| **重置** | 随时 | 不可逆 |
| **时间控制** | 完全控制 | 真实时间 |
| **前端连接** | 需配置 | 直接连接 |
| **区块浏览器** | 无 | BSCScan |
| **多用户测试** | 简单 | 需多钱包 |
| **调试信息** | 详细 | 有限 |
| **真实性** | 低 | 高 |

---

## 🎯 推荐测试流程

### 阶段 1: 本地快速验证（1-2小时）
```
本地节点 → 部署 → 基础功能测试 → 发现问题 → 修复 → 重复
```

**目标：**
- 验证合约逻辑正确
- 发现明显 bug
- 优化 Gas 消耗
- 测试边界条件

### 阶段 2: 本地完整测试（2-3小时）
```
所有功能场景 → 多用户交互 → 时间相关测试 → 异常处理
```

**目标：**
- 覆盖所有功能
- 测试各种组合
- 压力测试
- 性能测试

### 阶段 3: 测试网部署验证（2-4小时）
```
BSC 测试网部署 → 前端集成 → 真实环境测试 → 记录结果
```

**目标：**
- 验证真实网络行为
- 前端完整集成
- 用户体验测试
- 准备主网部署

---

## 💡 最佳实践

### 1. 先本地，后测试网
```
✅ 本地测试通过 → 部署测试网
❌ 直接测试网 → 浪费时间和 Gas
```

### 2. 使用 Fixtures
```typescript
// 创建可重用的测试环境
async function deployFixture() {
  const contracts = await deployAllContracts();
  const users = await setupTestUsers();
  return { ...contracts, ...users };
}

// 在测试中使用
const { manager, nft, usdt, alice, bob } = await loadFixture(deployFixture);
```

### 3. 测试驱动开发
```
写测试 → 运行测试（失败）→ 实现功能 → 测试通过 → 重构
```

### 4. 保留测试快照
```bash
# 保存成功的部署状态
npx hardhat node --hostname 127.0.0.1 --port 8545 > node.log &

# 定期创建快照
curl -X POST --data '{"jsonrpc":"2.0","method":"evm_snapshot","params":[],"id":1}' http://127.0.0.1:8545
```

---

## 🐛 常见问题

### Q1: 本地节点重启后合约地址变了？
**A:** 是的，每次重启都会重新部署。建议：
- 使用脚本保存地址到文件
- 或使用 `--fork` 模式连接测试网

### Q2: 如何连接前端到本地节点？
**A:** 修改前端配置：
```typescript
// frontend/.env.local
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
```

然后在 MetaMask 添加本地网络：
- Network Name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency: ETH

### Q3: 时间快进后如何验证？
**A:** 使用合约的时间相关函数：
```typescript
const blockTime = await time.latest();
const nftPool = await manager.nftPools(1);
const elapsed = blockTime - nftPool.mintTime;
console.log("Days elapsed:", elapsed / (24 * 60 * 60));
```

### Q4: 本地测试 Gas 准确吗？
**A:** 基本准确，但：
- 本地网络 Gas Price 固定
- 网络拥堵效果无法模拟
- 建议测试网再次验证

---

## 📚 相关资源

- **Hardhat Network Docs:** https://hardhat.org/hardhat-network/docs
- **Hardhat Network Helpers:** https://hardhat.org/hardhat-network-helpers/docs
- **Testing Best Practices:** https://hardhat.org/tutorial/testing-contracts

---

## 🚀 下一步

完成本地测试后，使用：
- **[QUICK_START.md](./QUICK_START.md)** - 快速部署到测试网
- **[TESTNET_DEPLOYMENT_GUIDE.md](./TESTNET_DEPLOYMENT_GUIDE.md)** - 完整测试网测试

---

**准备开始本地测试？运行：**
```bash
npx hardhat node
```

**Then in another terminal:**
```bash
npx hardhat run scripts/local-01-deploy-all.ts --network localhost
```

🎉 **享受快速、免费的本地测试！**

