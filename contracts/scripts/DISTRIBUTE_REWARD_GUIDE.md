# NFT 奖励发放命令指南

## 📋 概述

发放 NFT 奖励有两种方式：
1. **分发 ECLV 代币** - 使用 `distributeProduced(rewardPerNFT)`
2. **分发其他代币（如 USDT）** - 使用 `distributeReward(token, rewardPerNFT)`

---

## 🚀 快速命令

### 方式 1: 使用 Hardhat Console（推荐用于测试）

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 启动 Hardhat Console
npx hardhat console --network bscTestnet

# 在 Console 中执行：
```

#### 分发 USDT 奖励

```javascript
// 1. 获取合约实例
const NFTManager = await ethers.getContractAt("RewardFacet", "NFT_MANAGER_ADDRESS");
const USDT = await ethers.getContractAt("IERC20", "USDT_ADDRESS");

// 2. 计算 rewardPerNFT（按 5000 计算，保证公平）
// 例如：想给每个 NFT 分配 2 USDT
const rewardPerNFT = ethers.parseUnits("2", 18); // 2 USDT per NFT

// 3. 查询需要打入的金额
const [requiredAmount, nftAmount, multisigAmount] = 
  await NFTManager.calculateRequiredAmountForDistribution(USDT.address, rewardPerNFT);
console.log(`需要打入: ${ethers.formatUnits(requiredAmount, 18)} USDT`);

// 4. Oracle 先 approve（使用 Oracle 私钥）
const oracle = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, ethers.provider);
const usdtOracle = USDT.connect(oracle);
await usdtOracle.approve(NFTManager.target, requiredAmount);

// 5. Oracle 调用分发
const nftManagerOracle = NFTManager.connect(oracle);
await nftManagerOracle.distributeReward(USDT.address, rewardPerNFT);
```

#### 分发 ECLV 代币奖励

```javascript
// 1. 获取合约实例
const NFTManager = await ethers.getContractAt("RewardFacet", "NFT_MANAGER_ADDRESS");

// 2. 计算 rewardPerNFT
// 例如：想给每个 NFT 分配 100 ECLV
const rewardPerNFT = ethers.parseUnits("100", 18); // 100 ECLV per NFT

// 3. Oracle 直接调用分发（会自动挖矿）
const oracle = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, ethers.provider);
const nftManagerOracle = NFTManager.connect(oracle);
await nftManagerOracle.distributeProduced(rewardPerNFT);
```

---

### 方式 2: 使用 TypeScript 脚本

创建一个脚本文件 `distribute-reward.ts`：

```typescript
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS!;
  const USDT_ADDRESS = process.env.USDT_ADDRESS!;
  const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY!;

  // 获取合约实例
  const nftManager = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);
  const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS);

  // 计算 rewardPerNFT（按 5000 计算）
  const totalAmount = ethers.parseUnits("10000", 18); // 10,000 USDT 总金额
  const rewardPerNFT = totalAmount / 5000n; // 2 USDT per NFT

  // 查询需要打入的金额
  const [requiredAmount] = await nftManager.calculateRequiredAmountForDistribution(
    USDT_ADDRESS,
    rewardPerNFT
  );
  console.log(`需要打入: ${ethers.formatUnits(requiredAmount, 18)} USDT`);

  // Oracle 操作
  const oracle = new ethers.Wallet(ORACLE_PRIVATE_KEY, ethers.provider);
  const usdtOracle = usdt.connect(oracle);
  const nftManagerOracle = nftManager.connect(oracle);

  // 1. Approve
  console.log("Approving...");
  await usdtOracle.approve(NFT_MANAGER_ADDRESS, requiredAmount);

  // 2. Distribute
  console.log("Distributing rewards...");
  const tx = await nftManagerOracle.distributeReward(USDT_ADDRESS, rewardPerNFT);
  await tx.wait();
  console.log(`✅ 奖励分发成功! Tx: ${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

运行脚本：

```bash
npx hardhat run scripts/distribute-reward.ts --network bscTestnet
```

---

## 📝 详细说明

### 函数签名（升级后）

#### `distributeReward` - 分发代币奖励（如 USDT）

```solidity
function distributeReward(address token, uint256 rewardPerNFT) external onlyOracle nonReentrant
```

**参数：**
- `token`: 代币合约地址（必须是已添加的 reward token）
- `rewardPerNFT`: 每个 NFT 的奖励（按 MAX_SUPPLY=5000 计算）

**示例：**
```javascript
// 想给每个 NFT 分配 2 USDT（按 5000 计算）
const rewardPerNFT = ethers.parseUnits("2", 18);
await nftManager.distributeReward(usdtAddress, rewardPerNFT);
```

#### `distributeProduced` - 分发 ECLV 代币奖励

```solidity
function distributeProduced(uint256 rewardPerNFT) external onlyOracle nonReentrant
```

**参数：**
- `rewardPerNFT`: 每个 NFT 的奖励（按 MAX_SUPPLY=5000 计算）

**示例：**
```javascript
// 想给每个 NFT 分配 100 ECLV（按 5000 计算）
const rewardPerNFT = ethers.parseUnits("100", 18);
await nftManager.distributeProduced(rewardPerNFT);
```

---

## 💰 资金计算

### 计算 Oracle 需要打入的金额

```javascript
// 查询需要打入的金额
const rewardPerNFT = ethers.parseUnits("2", 18); // 2 USDT per NFT
const [requiredAmount, nftAmount, multisigAmount] = 
  await nftManager.calculateRequiredAmountForDistribution(usdtAddress, rewardPerNFT);

console.log(`总金额: ${ethers.formatUnits(requiredAmount, 18)} USDT`);
console.log(`NFT 部分: ${ethers.formatUnits(nftAmount, 18)} USDT`);
console.log(`多签部分: ${ethers.formatUnits(multisigAmount, 18)} USDT`);
```

### 计算示例

**场景**：当前有 1000 个 Active NFT，想给每个 NFT 分配 2 USDT

```javascript
// 1. 计算 rewardPerNFT（按 5000 计算，保证公平）
const rewardPerNFT = ethers.parseUnits("2", 18); // 2 USDT per NFT

// 2. 系统自动计算：
// - nftAmount = 2 * 1000 = 2000 USDT（给 Active NFT）
// - multisigAmount = 2000 * 2000 / 8000 = 500 USDT（给多签，20%）
// - requiredAmount = 2000 + 500 = 2500 USDT（Oracle 需要打入）

// 3. Oracle 只需要打入 2500 USDT（而不是 10000 USDT）
```

---

## ⚙️ 前置条件

### 1. 环境配置

```bash
# .env 文件需要配置：
NFT_MANAGER_ADDRESS=0x...
USDT_ADDRESS=0x...
ORACLE_PRIVATE_KEY=0x...  # Oracle 私钥
```

### 2. Oracle 权限

- Oracle 地址必须被设置为 NFTManager 的 `oracle` 或 `oracleMultisig`
- 只有 Oracle 可以调用 `distributeReward` 和 `distributeProduced`

### 3. 代币准备

**对于 USDT 等代币：**
- Oracle 地址必须有足够的代币余额
- Oracle 必须先 `approve` NFTManager 可以转账

**对于 ECLV 代币：**
- NFTManager 必须被设置为 EnclaveToken 的 oracle
- 会自动调用 `mineTokens` 挖矿，无需提前准备代币

---

## 🔄 完整流程示例

### 分发 USDT 奖励（完整流程）

```bash
# 1. 进入合约目录
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 2. 启动 Hardhat Console
npx hardhat console --network bscTestnet

# 3. 在 Console 中执行：
```

```javascript
// 配置
const NFT_MANAGER = "0x..."; // NFTManager 地址
const USDT = "0x..."; // USDT 地址
const ORACLE_KEY = "0x..."; // Oracle 私钥

// 获取合约
const nftManager = await ethers.getContractAt("RewardFacet", NFT_MANAGER);
const usdt = await ethers.getContractAt("IERC20", USDT);

// 计算 rewardPerNFT（想给每个 NFT 2 USDT）
const rewardPerNFT = ethers.parseUnits("2", 18);

// 查询需要打入的金额
const [requiredAmount] = await nftManager.calculateRequiredAmountForDistribution(USDT, rewardPerNFT);
console.log(`需要打入: ${ethers.formatUnits(requiredAmount, 18)} USDT`);

// Oracle 操作
const oracle = new ethers.Wallet(ORACLE_KEY, ethers.provider);
const usdtOracle = usdt.connect(oracle);
const nftManagerOracle = nftManager.connect(oracle);

// Approve
await usdtOracle.approve(NFT_MANAGER, requiredAmount);
console.log("✅ Approved");

// Distribute
const tx = await nftManagerOracle.distributeReward(USDT, rewardPerNFT);
await tx.wait();
console.log(`✅ 分发成功! Tx: ${tx.hash}`);
```

---

## 📊 多签比例配置

### 查询当前多签比例

```javascript
const bps = await nftManager.getMultisigRewardBps();
console.log(`多签比例: ${bps} BPS (${Number(bps) / 100}%)`); // 默认 2000 = 20%
```

### 设置多签比例（需要 Master 权限）

```javascript
// 设置为 15%
const master = new ethers.Wallet(MASTER_PRIVATE_KEY, ethers.provider);
const nftManagerMaster = nftManager.connect(master);
await nftManagerMaster.setMultisigRewardBps(1500); // 1500 = 15%
```

---

## ⚠️ 重要注意事项

1. **函数签名已变更**：
   - 旧版本：`distributeReward(token, amount)` - amount 是总金额
   - 新版本：`distributeReward(token, rewardPerNFT)` - rewardPerNFT 是按 5000 计算的每个 NFT 奖励

2. **资金计算**：
   - Oracle 只需要打入 Active NFT 对应的资金
   - 系统会自动计算多签部分
   - 使用 `calculateRequiredAmountForDistribution` 查询需要打入的金额

3. **公平性保证**：
   - `rewardPerNFT` 仍然按 MAX_SUPPLY (5000) 计算
   - 所有 NFT 获得相同的奖励
   - 新 NFT 铸造后可以领取从它被铸造时开始的新奖励

4. **权限要求**：
   - 只有 Oracle 可以调用分发函数
   - Oracle 必须先用 `approve` 授权代币转账

---

## 🔍 验证分发结果

```javascript
// 查询全局累积奖励
const accReward = await nftManager.getAccRewardPerNFT(USDT);
console.log(`累积奖励: ${ethers.formatUnits(accReward, 18)} USDT per NFT`);

// 查询 NFT 的待领取奖励
const nftId = 1;
const pendingReward = await nftManager.getPendingReward(nftId, USDT);
console.log(`NFT #${nftId} 待领取: ${ethers.formatUnits(pendingReward, 18)} USDT`);
```

---

## 📚 相关文档

- [奖励分发优化方案](../REWARD_DISTRIBUTION_OPTIMIZATION.md)
- [升级指南](../REWARD_FACET_UPGRADE_GUIDE.md)
- [Oracle APIs](../../ORACLE_APIS.md)

---

**最后更新**：2025-01-21  
**版本**：v2.0.0




