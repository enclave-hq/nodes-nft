# 🧪 BSC 测试网部署和测试指南

**日期:** October 27, 2025  
**网络:** BSC Testnet (Chain ID: 97)  
**状态:** 🚀 **准备部署**

---

## 📋 目录

1. [前置准备](#前置准备)
2. [环境配置](#环境配置)
3. [编译合约](#编译合约)
4. [部署流程](#部署流程)
5. [测试计划](#测试计划)
6. [前端连接](#前端连接)
7. [故障排除](#故障排除)

---

## 🎯 前置准备

### 1. 需要的资源

- ✅ **测试网 BNB** - 用于部署和交易 Gas 费
  - 获取地址: https://testnet.binance.org/faucet-smart
  - 建议准备: 至少 0.5 BNB

- ✅ **测试网 USDT** - 用于铸造 NFT
  - 我们需要部署一个测试 USDT 代币

- ✅ **BSCScan API Key** - 用于合约验证
  - 获取地址: https://bscscan.com/myapikey

### 2. 钱包准备

```bash
# 创建或导入钱包
# 记录以下信息：
DEPLOYER_ADDRESS=0x...
PRIVATE_KEY=0x...
```

---

## ⚙️ 环境配置

### 1. 创建 `.env` 文件

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
cp .env.example .env
```

### 2. 编辑 `.env` 文件

```bash
# BSC Testnet Configuration
PRIVATE_KEY=你的私钥（不要包含0x）
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=你的BSCScan_API_Key

# Optional: Gas Reporter
REPORT_GAS=false
COINMARKETCAP_API_KEY=

# Network Selection (for deployment)
NETWORK=bscTestnet
```

### 3. 安装依赖

```bash
cd contracts
npm install
```

---

## 🔨 编译合约

### 编译所有合约

```bash
npx hardhat compile
```

**预期输出:**
```
Compiled 5 Solidity files successfully
✓ EnclaveToken
✓ NodeNFT
✓ NFTManager
```

---

## 🚀 部署流程

### 阶段 1: 部署测试 USDT

创建部署脚本 `scripts/01-deploy-usdt.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Test USDT...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Deploy Test USDT (ERC20)
  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const usdt = await TestUSDT.deploy();
  await usdt.waitForDeployment();

  const usdtAddress = await usdt.getAddress();
  console.log("✅ Test USDT deployed to:", usdtAddress);

  // Mint initial supply (1,000,000 USDT for testing)
  const mintAmount = ethers.parseUnits("1000000", 18);
  await usdt.mint(deployer.address, mintAmount);
  console.log("✅ Minted 1,000,000 USDT to deployer");

  console.log("\n📝 Save these addresses:");
  console.log("USDT:", usdtAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**运行:**
```bash
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet
```

### 阶段 2: 部署主要合约

创建部署脚本 `scripts/02-deploy-main.ts`:

```typescript
import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🚀 Deploying Main Contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get USDT address from previous deployment
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  if (!USDT_ADDRESS) {
    throw new Error("Please set USDT_ADDRESS in .env");
  }

  // 1. Deploy EnclaveToken
  console.log("\n1️⃣ Deploying EnclaveToken...");
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  const eclvToken = await EnclaveToken.deploy();
  await eclvToken.waitForDeployment();
  const eclvAddress = await eclvToken.getAddress();
  console.log("✅ EnclaveToken deployed to:", eclvAddress);

  // 2. Deploy NodeNFT
  console.log("\n2️⃣ Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy();
  await nodeNFT.waitForDeployment();
  const nftAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nftAddress);

  // 3. Deploy NFTManager (Upgradeable)
  console.log("\n3️⃣ Deploying NFTManager (Upgradeable)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [nftAddress, eclvAddress, USDT_ADDRESS],
    { initializer: "initialize" }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager deployed to:", managerAddress);

  // 4. Set NFTManager in NodeNFT
  console.log("\n4️⃣ Configuring NodeNFT...");
  await nodeNFT.setNFTManager(managerAddress);
  console.log("✅ NFTManager set in NodeNFT");

  // 5. Set Base URI (optional)
  const baseURI = "https://api.enclave.com/nft/metadata/";
  await nodeNFT.setBaseURI(baseURI);
  console.log("✅ Base URI set");

  // 6. Add reward tokens
  console.log("\n5️⃣ Adding reward tokens...");
  await nftManager.addRewardToken(USDT_ADDRESS);
  console.log("✅ USDT added as reward token");

  // 7. Transfer some ECLV to NFTManager for testing
  console.log("\n6️⃣ Setting up initial balances...");
  const initialECLV = ethers.parseEther("10000000"); // 10M ECLV
  await eclvToken.transfer(managerAddress, initialECLV);
  console.log("✅ Transferred 10M ECLV to NFTManager");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📝 Contract Addresses:");
  console.log("EnclaveToken:", eclvAddress);
  console.log("NodeNFT:", nftAddress);
  console.log("NFTManager:", managerAddress);
  console.log("USDT:", USDT_ADDRESS);

  console.log("\n💾 Add these to frontend .env:");
  console.log(`NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${eclvAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nftAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=97`);
  console.log(`NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**运行:**
```bash
# 先设置 USDT 地址
export USDT_ADDRESS=0x... # 从阶段1获取的地址

# 然后部署
npx hardhat run scripts/02-deploy-main.ts --network bscTestnet
```

### 阶段 3: 验证合约

```bash
# 验证 EnclaveToken
npx hardhat verify --network bscTestnet <ECLV_ADDRESS>

# 验证 NodeNFT
npx hardhat verify --network bscTestnet <NFT_ADDRESS>

# 验证 NFTManager (代理合约)
npx hardhat verify --network bscTestnet <MANAGER_ADDRESS>
```

---

## 🧪 测试计划

### 测试环境设置

创建测试脚本 `scripts/03-test-setup.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Setting up test environment...");

  const [deployer] = await ethers.getSigners();
  
  // Contract addresses (from deployment)
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  const ECLV_ADDRESS = process.env.ECLV_ADDRESS || "";
  const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS || "";

  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const eclv = await ethers.getContractAt("EnclaveToken", ECLV_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);

  // Create test accounts
  const testAccounts = [
    "0x...", // Alice
    "0x...", // Bob
    "0x...", // Charlie
  ];

  console.log("\n💰 Distributing test tokens...");
  for (const account of testAccounts) {
    // Give 100,000 USDT to each
    await usdt.mint(account, ethers.parseUnits("100000", 18));
    console.log(`✅ Minted 100,000 USDT to ${account}`);
  }

  console.log("\n✅ Test environment ready!");
}

main();
```

### 测试场景

#### **场景 1: 基础铸造测试**

```bash
# 创建测试脚本
npx hardhat run scripts/test-01-basic-minting.ts --network bscTestnet
```

**测试内容:**
1. Alice 铸造 Standard NFT (10,000 USDT)
2. Bob 铸造 Premium NFT (50,000 USDT)
3. 验证 NFT 所有权
4. 检查 NFT 配置（shares, weight, ECLV quota）

#### **场景 2: 奖励分发测试**

**测试内容:**
1. 设置 Oracle 地址（deployer）
2. 分发 ECLV 产出（使用 distributeProduced）
3. 分发 USDT 奖励（使用 distributeReward）
4. 验证待领取奖励金额
5. Claim 产出和奖励

#### **场景 3: 解锁机制测试**

**测试内容:**
1. 检查初始解锁状态（应该是 0）
2. 模拟时间流逝（使用 Hardhat time helpers）
3. 触发解锁（通过 claim 或手动调用）
4. 验证解锁百分比
5. 测试 Dissolved 状态下的提取

#### **场景 4: 份额转让测试**

**测试内容:**
1. Alice 转让 4 份额给 Bob
2. 验证份额余额变化
3. 检查奖励分配是否正确
4. 测试转让后的 claim

#### **场景 5: Marketplace 测试**

**测试内容:**
1. Alice 创建卖单（2 shares, 6000 USDT/share）
2. Bob 购买份额
3. 验证订单状态
4. 取消订单测试

#### **场景 6: NFT 解散测试**

**测试内容:**
1. 提议解散 NFT
2. 所有份额持有者批准
3. 验证 NFT 状态变为 Dissolved
4. 测试解散后的代币提取
5. 验证历史奖励仍可领取

---

## 🌐 前端连接

### 1. 更新前端环境变量

在 `frontend/.env.local` 创建文件:

```bash
# Contract Addresses (from deployment)
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_NODE_NFT_ADDRESS=0x...
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_USDT_ADDRESS=0x...

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_ENABLE_TESTNET=true
```

### 2. 配置 MetaMask

**添加 BSC Testnet:**
- Network Name: BSC Testnet
- RPC URL: https://data-seed-prebsc-1-s1.binance.org:8545
- Chain ID: 97
- Symbol: BNB
- Block Explorer: https://testnet.bscscan.com

### 3. 启动前端

```bash
cd frontend
npm run dev
```

访问: http://localhost:3000

### 4. 前端测试流程

**Step 1: 连接钱包**
- 打开前端
- 点击 "Connect Wallet"
- 选择 MetaMask
- 确认连接到 BSC Testnet

**Step 2: 铸造 NFT**
- 进入 Mint 页面
- 选择 NFT 类型（Standard / Premium）
- 确认 USDT 余额充足
- 点击 "Mint" 按钮
- 批准 USDT 授权（如需要）
- 确认铸造交易

**Step 3: 查看 My NFTs**
- 进入 My NFTs 页面
- 查看已拥有的 NFT
- 检查 Pending 奖励
- 测试 Claim 功能

**Step 4: 测试 Marketplace**
- 进入 Marketplace 页面
- 创建卖单
- 用另一个账户购买
- 测试取消订单

---

## 📊 监控和验证

### 使用 BSCScan Testnet

访问: https://testnet.bscscan.com

**验证内容:**
1. **合约部署**
   - 查看合约地址
   - 验证源代码
   - 查看交易历史

2. **交易监控**
   - Mint 交易
   - Transfer 交易
   - Claim 交易
   - Marketplace 交易

3. **事件日志**
   - NFTMinted
   - Produced 分发
   - Reward 分发
   - SharesTransferred
   - SellOrderCreated

### 使用 Hardhat Console

```bash
npx hardhat console --network bscTestnet
```

```javascript
// 连接到合约
const manager = await ethers.getContractAt("NFTManager", "0x...");

// 查询信息
const config = await manager.nftConfigs(0); // Standard NFT
console.log("Mint Price:", ethers.formatUnits(config.mintPrice, 18));

const pool = await manager.nftPools(1); // NFT #1
console.log("Total Weighted Shares:", pool.totalWeightedShares);

// 查询全局状态
const globalState = await manager.globalState();
console.log("Accumulated Per Weight:", globalState.accProducedPerWeight);
```

---

## 🐛 故障排除

### 常见问题

**1. Gas 不足**
```
Error: insufficient funds for gas
```
**解决:** 从 faucet 获取更多测试 BNB

**2. USDT 余额不足**
```
Error: Insufficient USDT balance
```
**解决:** 使用测试脚本 mint 更多 USDT

**3. 授权失败**
```
Error: ERC20: insufficient allowance
```
**解决:** 先批准 USDT，再进行操作

**4. 合约未验证**
```
Error: Contract source code not verified
```
**解决:** 运行 verify 命令

**5. Nonce 太低**
```
Error: nonce too low
```
**解决:** 重置 MetaMask 账户（Settings > Advanced > Reset Account）

---

## 📝 测试检查清单

### 部署检查 ✅

- [ ] EnclaveToken 部署成功
- [ ] NodeNFT 部署成功
- [ ] NFTManager 部署成功
- [ ] 测试 USDT 部署成功
- [ ] 所有合约已验证
- [ ] NFTManager 已设置到 NodeNFT
- [ ] 奖励代币已添加

### 功能测试 ✅

- [ ] Standard NFT 铸造
- [ ] Premium NFT 铸造
- [ ] ECLV 产出分发
- [ ] USDT 奖励分发
- [ ] Claim 产出
- [ ] Claim 奖励
- [ ] 份额转让
- [ ] 创建卖单
- [ ] 购买份额
- [ ] 取消订单
- [ ] 解锁机制
- [ ] NFT 解散
- [ ] Dissolved 状态提取

### 前端测试 ✅

- [ ] 钱包连接
- [ ] 网络切换
- [ ] 余额显示
- [ ] NFT 铸造界面
- [ ] My NFTs 显示
- [ ] Claim 按钮功能
- [ ] Marketplace 界面
- [ ] 多语言切换

---

## 🚀 下一步

部署和测试完成后:

1. **记录所有合约地址** - 保存到安全位置
2. **创建测试报告** - 记录所有测试结果
3. **性能分析** - 记录 Gas 消耗
4. **安全审计** - 检查潜在问题
5. **准备主网部署** - 最终部署计划

---

## 📚 有用的命令

```bash
# 编译
npx hardhat compile

# 测试
npx hardhat test

# 部署
npx hardhat run scripts/deploy.ts --network bscTestnet

# 验证
npx hardhat verify --network bscTestnet <ADDRESS>

# Console
npx hardhat console --network bscTestnet

# 清理
npx hardhat clean

# Gas 报告
REPORT_GAS=true npx hardhat test

# 覆盖率
npx hardhat coverage
```

---

**准备就绪！让我们开始部署和测试！** 🚀

**Created by the Enclave Team**  
**October 27, 2025**


