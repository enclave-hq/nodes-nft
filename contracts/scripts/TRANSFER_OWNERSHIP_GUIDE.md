# 🔐 合约所有权转移完整指南

## ⚠️ 重要警告

在私钥泄露的情况下，需要立即执行以下步骤：

1. **第一步**：通过多签系统（4367）恢复私钥所有权
2. **第二步**：转移所有合约的所有权到新的安全地址

## 📋 需要转移所有权的合约

根据 `MAINNET_CONFIG.md`，以下合约需要转移所有权：

### BSC Mainnet 合约

1. **NFTManager (Diamond)**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
2. **NodeNFT**: `0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b`
3. **EnclaveToken ($E)**: `0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011`
4. **TokenVesting**: `0x67B8927F0835e79632f4622F017915Cb0B9a6c72`

## 🚀 执行步骤

### 步骤 1: 通过多签系统恢复私钥所有权

**通过 4367 端口/服务恢复私钥控制权**

```bash
# 1. 连接到多签服务（4367）
# 具体操作取决于多签系统的实现
# 可能需要：
# - 访问多签管理界面
# - 使用多签 API
# - 通过多签节点服务

# 2. 使用多签提案恢复私钥所有权
# 创建提案：将私钥对应的地址控制权转移到新的安全地址
```

**重要**：
- 确保新的安全地址是**多签钱包地址**或**硬件钱包地址**
- 不要使用单签地址作为新的 Owner
- 建议使用多签钱包（如 Gnosis Safe）作为新的 Owner

### 步骤 2: 检查当前 Owner

在转移所有权之前，先检查当前 Owner：

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts

# 运行检查脚本
npx hardhat run scripts/check-current-owners.ts --network bscMainnet
```

### 步骤 3: 转移合约所有权

#### 3.1 NFTManager (Diamond) 所有权转移

NFTManager 使用 Diamond Pattern，需要添加一个转移所有权的 Facet，或者直接调用内部函数。

**选项 A：如果 AdminFacet 已有转移所有权函数**

```typescript
// 调用 AdminFacet 的转移所有权函数
const adminFacet = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
await adminFacet.transferOwnership(newOwnerAddress);
```

**选项 B：如果没有公开函数，需要添加 Facet**

需要创建一个新的 Facet 或更新 AdminFacet 添加 `transferOwnership` 函数。

#### 3.2 NodeNFT 所有权转移

NodeNFT 使用 OpenZeppelin Ownable，有标准的 `transferOwnership` 函数：

```typescript
const nodeNFT = await ethers.getContractAt("NodeNFT", NODE_NFT_ADDRESS);
await nodeNFT.transferOwnership(newOwnerAddress);
```

#### 3.3 EnclaveToken 所有权转移

EnclaveToken 使用 OpenZeppelin Ownable：

```typescript
const enclaveToken = await ethers.getContractAt("EnclaveToken", ENCLAVE_TOKEN_ADDRESS);
await enclaveToken.transferOwnership(newOwnerAddress);
```

#### 3.4 TokenVesting 所有权转移

TokenVesting 使用 OpenZeppelin Ownable：

```typescript
const tokenVesting = await ethers.getContractAt("TokenVesting", TOKEN_VESTING_ADDRESS);
await tokenVesting.transferOwnership(newOwnerAddress);
```

## 📝 创建转移所有权脚本

创建一个完整的脚本来转移所有合约的所有权：

```typescript
// scripts/transfer-all-ownership.ts
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const MAINNET_ADDRESSES = {
  NFT_MANAGER: "0xD9eA9F4B8F24872262568fB2C6133117EC02C774",
  NODE_NFT: "0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b",
  ENCLAVE_TOKEN: "0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011",
  TOKEN_VESTING: "0x67B8927F0835e79632f4622F017915Cb0B9a6c72",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  // 新 Owner 地址（应该是多签钱包地址）
  const newOwner = process.env.NEW_OWNER_ADDRESS;
  if (!newOwner) {
    throw new Error("NEW_OWNER_ADDRESS environment variable is required");
  }
  console.log("New Owner address:", newOwner);
  console.log("");

  // 1. 转移 NodeNFT 所有权
  console.log("1. Transferring NodeNFT ownership...");
  const nodeNFT = await ethers.getContractAt("NodeNFT", MAINNET_ADDRESSES.NODE_NFT);
  const nodeNFTOwner = await nodeNFT.owner();
  console.log("  Current Owner:", nodeNFTOwner);
  if (nodeNFTOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  ⚠️  Warning: Deployer is not the current owner!");
  } else {
    const tx1 = await nodeNFT.transferOwnership(newOwner);
    await tx1.wait();
    console.log("  ✅ NodeNFT ownership transferred");
    console.log("  Tx:", tx1.hash);
  }
  console.log("");

  // 2. 转移 EnclaveToken 所有权
  console.log("2. Transferring EnclaveToken ownership...");
  const enclaveToken = await ethers.getContractAt("EnclaveToken", MAINNET_ADDRESSES.ENCLAVE_TOKEN);
  const tokenOwner = await enclaveToken.owner();
  console.log("  Current Owner:", tokenOwner);
  if (tokenOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  ⚠️  Warning: Deployer is not the current owner!");
  } else {
    const tx2 = await enclaveToken.transferOwnership(newOwner);
    await tx2.wait();
    console.log("  ✅ EnclaveToken ownership transferred");
    console.log("  Tx:", tx2.hash);
  }
  console.log("");

  // 3. 转移 TokenVesting 所有权
  console.log("3. Transferring TokenVesting ownership...");
  const tokenVesting = await ethers.getContractAt("TokenVesting", MAINNET_ADDRESSES.TOKEN_VESTING);
  const vestingOwner = await tokenVesting.owner();
  console.log("  Current Owner:", vestingOwner);
  if (vestingOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  ⚠️  Warning: Deployer is not the current owner!");
  } else {
    const tx3 = await tokenVesting.transferOwnership(newOwner);
    await tx3.wait();
    console.log("  ✅ TokenVesting ownership transferred");
    console.log("  Tx:", tx3.hash);
  }
  console.log("");

  // 4. 转移 NFTManager 所有权（需要检查是否有公开函数）
  console.log("4. Transferring NFTManager ownership...");
  // 注意：NFTManager 使用 Diamond Pattern，需要检查 AdminFacet 是否有转移所有权的函数
  // 如果没有，需要先添加 Facet
  console.log("  ⚠️  NFTManager 需要特殊处理（Diamond Pattern）");
  console.log("  请检查 AdminFacet 是否有 transferOwnership 函数");
  console.log("  如果没有，需要添加新的 Facet 或更新 AdminFacet");
  console.log("");

  console.log("✅ Ownership transfer process completed!");
  console.log("⚠️  Please verify all ownership transfers on BSCScan");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## 🔍 验证转移结果

转移完成后，验证所有合约的 Owner：

```bash
# 运行验证脚本
npx hardhat run scripts/verify-ownership.ts --network bscMainnet
```

## ⚠️ 重要提醒

1. **必须先恢复私钥所有权**：在转移合约所有权之前，必须确保私钥控制权已恢复
2. **使用多签钱包**：新的 Owner 地址应该是多签钱包地址，而不是单签地址
3. **测试网测试**：建议先在测试网上测试整个流程
4. **备份交易哈希**：保存所有转移所有权的交易哈希，以便后续验证
5. **验证链上状态**：在 BSCScan 上验证所有合约的 Owner 已正确更新

## 📞 需要帮助？

如果遇到问题：
1. 检查当前 Owner 是否正确
2. 确认私钥所有权已恢复
3. 验证新 Owner 地址的有效性
4. 检查合约是否有转移所有权的函数

---

**最后更新**: $(date)
**状态**: ⏳ 待执行























