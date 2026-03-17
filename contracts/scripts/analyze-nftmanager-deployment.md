# NFTManager 部署和 Owner 分析

## 📋 基本信息

### NFTManager 地址
- **地址**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
- **定义位置**: `deployment.mainnet.json`
- **部署时间**: 2025-11-26T06:15:15.920Z

### 部署信息
- **Deployer**: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`
- **部署脚本**: `scripts/deploy-mainnet.ts`
- **构造函数调用**: `NFTManager.deploy(deployer.address, nftManagerCutFacetAddress)`

## 🔍 Owner 设置流程

### 1. 构造函数设置 Owner

```solidity
// NFTManager.sol
constructor(address _contractOwner, address _nftManagerCutFacet) payable {
    LibNFTManager.setContractOwner(_contractOwner);
    // ...
}
```

### 2. setContractOwner 实现

```solidity
// LibNFTManager.sol
function setContractOwner(address _newOwner) internal {
    NFTManagerStorage storage ds = nftManagerStorage();
    address previousOwner = ds.contractOwner;
    ds.contractOwner = _newOwner;
    emit OwnershipTransferred(previousOwner, _newOwner);
}
```

### 3. 存储位置

```solidity
// LibNFTManager.sol
bytes32 constant NFT_MANAGER_STORAGE_POSITION = keccak256("nftmanager.standard.storage");

struct NFTManagerStorage {
    mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition; // 不占槽
    mapping(address => FacetFunctionSelectors) facetFunctionSelectors; // 不占槽
    address[] facetAddresses; // 槽 0: 数组长度
    mapping(bytes4 => bool) supportedInterfaces; // 不占槽
    address contractOwner; // 槽 1
}
```

**存储槽计算**:
- Base position: `keccak256("nftmanager.standard.storage")`
- `contractOwner` 存储槽: `basePosition + 1`

## ❓ 问题分析

### 存储读取返回 0

**可能的原因**:
1. ✅ **Owner 已经被转移了**（最可能）
2. ⚠️ **部署时使用了不同的地址**作为 `_contractOwner`
3. ⚠️ **存储槽计算错误**（但代码看起来是对的）

### 模拟调用失败

- Deployer 地址 `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6` 不是 contractOwner
- 说明 owner 可能已经被转移，或者部署时使用了不同的地址

## 💡 建议

1. **查看 BSCScan 上的部署交易**:
   - https://bscscan.com/address/0xD9eA9F4B8F24872262568fB2C6133117EC02C774
   - 查看 "Contract Creation" 交易
   - 解析 constructor 参数，确认实际的 `_contractOwner`

2. **直接尝试 EIP-7702 恢复**:
   - 如果 owner 确实是目标地址，应该可以工作
   - 如果失败，说明 owner 不是目标地址，需要找到真正的 owner

3. **检查最近的 nftManagerCut 交易**:
   - 查看谁调用了 `nftManagerCut`
   - 那个人就是当前的 contractOwner























