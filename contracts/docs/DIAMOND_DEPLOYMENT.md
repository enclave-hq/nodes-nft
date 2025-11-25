# NFTManager 部署和使用指南

## 📋 概述

本项目使用 **Diamond Pattern (EIP-2535)** 将 `NFTManager`、`NFTMarketplace` 和 `RewardDistributor` 的所有功能整合到一个统一的 NFTManager 合约中。

### 优势

1. **解决合约大小限制**：单个合约不再受 24576 字节限制
2. **统一地址**：所有功能通过一个 NFTManager 地址访问
3. **模块化设计**：每个功能独立 Facet，便于维护和升级
4. **Gas 优化**：共享存储，减少跨合约调用
5. **灵活升级**：可以单独升级某个 Facet，不影响其他功能

## 🏗️ 架构

```
NFTManager (主合约，使用 Diamond Pattern 实现)
├── NFTManagerCutFacet (Facet 管理)
├── NFTManagerLoupeFacet (Facet 查询)
├── NFTManagerFacet (NFT 核心功能：铸造、批次、终止、解锁等)
├── MarketplaceFacet (市场功能：订单、交易、查询、配置)
├── RewardFacet (奖励功能：领取、分发、配置、多签、燃烧)
└── AdminFacet (管理功能：角色、配置、查询)
```

## 🚀 部署步骤

### 本地部署

```bash
cd contracts
npx hardhat run scripts/deploy-diamond-local.ts --network localhost
```

### 测试网/主网部署

1. 配置环境变量（`.env`）：
```env
NFT_ADDRESS=0x...          # NodeNFT 合约地址
ECLV_ADDRESS=0x...         # EnclaveToken 合约地址
USDT_ADDRESS=0x...         # USDT 合约地址
```

2. 运行部署脚本：
```bash
npx hardhat run scripts/deploy-diamond.ts --network bscTestnet
```

## 📝 部署后配置

部署完成后，NFTManager 地址会保存在 `deployment.diamond.json` 或 `deployment.diamond.local.json` 中。

### 1. 更新 NodeNFT 配置

NFTManager 部署脚本会自动配置 NodeNFT，但如需手动配置：

```typescript
const nodeNFT = await ethers.getContractAt("NodeNFT", NODE_NFT_ADDRESS);
await nodeNFT.setNFTManager(NFT_MANAGER_ADDRESS);
```

### 2. 更新前端/后端配置

使用 NFTManager 地址：

```env
# 前端
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x...  # NFTManager 地址

# 后端
NFT_MANAGER_ADDRESS=0x...  # NFTManager 地址
```

## 💻 使用方法

### 在代码中使用

#### 方式 1: 使用 Facet 接口（推荐）

```typescript
import { ethers } from "ethers";

// 获取 NFTManager 地址
const NFT_MANAGER_ADDRESS = "0x...";

// 使用 NFTManagerFacet 接口
const NFTManagerFacet = await ethers.getContractAt("NFTManagerFacet", NFT_MANAGER_ADDRESS);
await NFTManagerFacet.mintNFT();

// 使用 MarketplaceFacet 接口
const MarketplaceFacet = await ethers.getContractAt("MarketplaceFacet", NFT_MANAGER_ADDRESS);
await MarketplaceFacet.createSellOrder(nftId, price);

// 使用 RewardFacet 接口
const RewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);
await RewardFacet.claimReward(nftId, tokenAddress);
```

#### 方式 2: 使用完整 ABI

```typescript
// 合并所有 Facets 的 ABI
import NFTManagerFacetABI from "../artifacts/contracts/diamond/facets/NFTManagerFacet.sol/NFTManagerFacet.json";
import MarketplaceFacetABI from "../artifacts/contracts/diamond/facets/MarketplaceFacet.sol/MarketplaceFacet.json";
import RewardFacetABI from "../artifacts/contracts/diamond/facets/RewardFacet.sol/RewardFacet.json";
import AdminFacetABI from "../artifacts/contracts/diamond/facets/AdminFacet.sol/AdminFacet.json";

const combinedABI = [
  ...NFTManagerFacetABI.abi,
  ...MarketplaceFacetABI.abi,
  ...RewardFacetABI.abi,
  ...AdminFacetABI.abi,
];

const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, combinedABI, signer);
await nftManager.mintNFT();
await nftManager.createSellOrder(nftId, price);
```

### 在测试中使用

```typescript
describe("NFTManager Tests", () => {
  let nftManager: any;
  let nftManagerFacet: any;
  let marketplaceFacet: any;

  beforeEach(async () => {
    // 部署 NFTManager（使用部署脚本）
    const deployment = JSON.parse(
      fs.readFileSync("deployment.diamond.local.json", "utf-8")
    );
    
    nftManager = await ethers.getContractAt("NFTManager", deployment.contracts.nftManager);
    
    // 获取 Facet 接口
    nftManagerFacet = await ethers.getContractAt("NFTManagerFacet", nftManager.target);
    marketplaceFacet = await ethers.getContractAt("MarketplaceFacet", nftManager.target);
  });

  it("Should mint NFT", async () => {
    await nftManagerFacet.mintNFT();
  });

  it("Should create sell order", async () => {
    await marketplaceFacet.createSellOrder(nftId, price);
  });
});
```

## 🔍 查询 Facets

使用 `NFTManagerLoupeFacet` 查询 NFTManager 中已安装的 Facets：

```typescript
const nftManagerLoupe = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER_ADDRESS);

// 获取所有 Facets
const facets = await nftManagerLoupe.facets();
console.log("Facets:", facets);

// 获取特定 Facet 的函数选择器
const selectors = await nftManagerLoupe.facetFunctionSelectors(FACET_ADDRESS);
console.log("Selectors:", selectors);

// 查询函数对应的 Facet 地址
const facetAddress = await nftManagerLoupe.facetAddress("0x..."); // function selector
console.log("Facet address:", facetAddress);
```

## 🔄 升级 Facet

如果需要升级某个 Facet：

```typescript
const nftManagerCut = await ethers.getContractAt("INFTManagerCut", NFT_MANAGER_ADDRESS);

// 1. 部署新的 Facet 实现
const NewNFTManagerFacet = await ethers.getContractFactory("NFTManagerFacetV2");
const newNFTManagerFacet = await NewNFTManagerFacet.deploy();
await newNFTManagerFacet.waitForDeployment();

// 2. 获取函数选择器
const selectors = await getSelectors("NFTManagerFacet", newNFTManagerFacet.target);

// 3. 替换 Facet
const cut = [{
  facetAddress: await newNFTManagerFacet.getAddress(),
  action: 1, // Replace
  functionSelectors: selectors,
}];

await nftManagerCut.nftManagerCut(cut, ethers.ZeroAddress, "0x");
```

## 📊 功能映射

### NFTManager 功能

| 原函数 | Facet | 新调用方式 |
|--------|-------|-----------|
| `mintNFT()` | `NFTManagerFacet` | `nftManager.mintNFT()` |
| `createBatch()` | `NFTManagerFacet` | `nftManager.createBatch()` |
| `claimReward()` | `RewardFacet` | `nftManager.claimReward()` |
| `setMaster()` | `AdminFacet` | `nftManager.setMaster()` |
| `getNFTPool()` | `AdminFacet` | `nftManager.getNFTPool()` |

### Marketplace 功能

| 原函数 | Facet | 新调用方式 |
|--------|-------|-----------|
| `createSellOrder()` | `MarketplaceFacet` | `nftManager.createSellOrder()` |
| `buyNFT()` | `MarketplaceFacet` | `nftManager.buyNFT()` |
| `getOrder()` | `MarketplaceFacet` | `nftManager.getOrder()` |
| `setMarketFeeRate()` | `MarketplaceFacet` | `nftManager.setMarketFeeRate()` |

### RewardDistributor 功能

| 原函数 | Facet | 新调用方式 |
|--------|-------|-----------|
| `distributeReward()` | `RewardFacet` | `nftManager.distributeReward()` |
| `addRewardToken()` | `RewardFacet` | `nftManager.addRewardToken()` |
| `burnTokensFromSwap()` | `RewardFacet` | `nftManager.burnTokensFromSwap()` |

## ⚠️ 注意事项

1. **地址统一**：所有功能现在都通过 NFTManager 地址访问，不再需要单独的 `NFTMarketplace` 或 `RewardDistributor` 地址

2. **事件监听**：事件仍然正常发出，但需要从 NFTManager 地址监听：
   ```typescript
   nftManager.on("NFTMinted", (nftId, minter, batchId, price, timestamp) => {
     console.log("NFT Minted:", nftId);
   });
   ```

3. **权限管理**：所有权限检查（`onlyMaster`, `onlyOracle` 等）仍然有效，因为存储是共享的

4. **Gas 优化**：由于共享存储，跨功能调用不再需要外部调用，Gas 消耗更低

## 🧪 测试

运行测试：

```bash
npm test
```

测试会自动使用 NFTManager 部署脚本，无需修改现有测试代码（如果使用 Facet 接口）。

## 📚 相关文档

- [EIP-2535 Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [Diamond-3 Library](https://github.com/mudgen/diamond-3)
- [项目 README](../README.md)

## 🆘 故障排除

### 问题：函数不存在

**错误**：`NFTManager: Function does not exist`

**解决**：确保 Facet 已正确添加到 NFTManager，使用 `NFTManagerLoupeFacet.facets()` 检查

### 问题：初始化失败

**错误**：初始化函数调用失败

**解决**：检查 `NFTManagerInit.init()` 的参数是否正确，确保所有地址有效

### 问题：存储冲突

**错误**：存储变量值不正确

**解决**：确保所有 Facets 使用 `LibNFTManagerStorage.getStorage()` 访问共享存储

