# 如何查询 NFTManager 的 Owner

## 📋 NFTManager 地址
`0xD9eA9F4B8F24872262568fB2C6133117EC02C774`

## 🔍 查询方法

### 方法 1: 通过 OwnerFacet 读取（如果已添加）

```bash
npx hardhat run scripts/query-nftmanager-owner.ts --network bscMainnet
```

**结果**: ❌ OwnerFacet 未添加到 NFTManager

### 方法 2: 通过 AdminFacet 读取 master

```typescript
const nftManager = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
const master = await nftManager.master();
```

**结果**: ✅ Master = `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`

⚠️ **注意**: Master 不一定是 Owner，但在这个项目中可能是。

### 方法 3: 查看最近的 nftManagerCut 交易

**升级交易**: `0x11d9281b852f010b3738d42cc478d5bcfd490e609a9290ca450c9e86137b7bb6`

**From 地址**: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`

💡 这个地址应该是 `contractOwner`，因为只有 `contractOwner` 可以调用 `nftManagerCut`。

### 方法 4: 添加 OwnerFacet 然后读取

需要 owner 权限，如果目标地址已被盗，无法添加。

## 📋 结论

根据查询结果：

**contractOwner = `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`**

这是：
- 目标地址（被盗地址）
- Deployer 地址
- Master 地址
- 升级交易的 From 地址

## 💡 为什么 EIP-7702 检查失败？

如果：
- `msg.sender` = 目标地址（根据 EIP-7702 规范）
- `contractOwner` = 目标地址（根据证据）

那么检查应该通过，但实际失败了。

**可能的原因**:
1. `msg.sender` 不是目标地址（BSC 的 EIP-7702 实现问题）
2. 或者 `contractOwner` 不是目标地址（但证据显示它是）

## 🔧 解决方案

1. **添加 OwnerFacet**（需要 owner 权限）
2. **查看事件日志**，确认实际的 `msg.sender` 值
3. **检查 BSC 的 EIP-7702 实现**，确认 `msg.sender` 的行为























