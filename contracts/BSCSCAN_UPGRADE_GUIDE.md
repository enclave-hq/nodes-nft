# BSCScan 手动升级指南

## 📋 升级信息

- **NFTManager 地址**: `0x31C052e02281Cb04445d309bCA9eaB25dC031141`
- **新 Facet 地址**: `0x6EEEA89e272AFCFf6FC54511f6b57B8572ACB691`
- **函数**: `nftManagerCut`
- **Action**: Replace (1)

## 🔧 操作步骤

### 1. 打开 BSCScan 合约页面

访问：https://testnet.bscscan.com/address/0x31C052e02281Cb04445d309bCA9eaB25dC031141#writeContract

### 2. 连接钱包

- 点击 "Connect to Web3" 按钮
- 使用 deployer 地址的钱包连接：`0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E`

### 3. 找到 `nftManagerCut` 函数

在 "Write Contract" 标签页中找到 `nftManagerCut` 函数

### 4. 填写参数

#### 参数 1: `_nftManagerCut` (array)

展开数组，添加一个元素：

```json
{
  "facetAddress": "0x6EEEA89e272AFCFf6FC54511f6b57B8572ACB691",
  "action": 1,
  "functionSelectors": [
    "0x45d332a8",
    "0x7f649783",
    "0x5f16f03d",
    "0x831cb288",
    "0xd5aef15d",
    "0x2940d29b",
    "0xa6a8fbaf",
    "0x92a2d846",
    "0x29e3cbb5",
    "0xfbe532fa",
    "0x626384ee",
    "0xb56eebfb",
    "0xe720ac8e",
    "0x5b7121f8",
    "0xed12e8ef",
    "0x3edff20f",
    "0xac271628",
    "0x670e9011",
    "0x3af32abf",
    "0x14f710fe",
    "0x239d460e",
    "0x8ab1d681",
    "0xa048046b",
    "0x4561828e"
  ]
}
```

#### 参数 2: `_init`

```
0x0000000000000000000000000000000000000000
```

#### 参数 3: `_calldata`

```
0x
```

### 5. 执行交易

- 点击 "Write" 按钮
- 确认交易
- 等待交易确认

## ✅ 验证升级

升级成功后：

1. 检查交易状态：应该是 "Success"
2. 验证新函数：调用 `getAllWhitelistedAddresses()` 应该可用
3. 运行初始化脚本：
   ```bash
   npx hardhat run scripts/init-whitelist-array.ts --network bscTestnet
   ```

## 📝 函数选择器说明

包含 24 个函数，包括新增的：
- `getAllWhitelistedAddresses` (0xb56eebfb)
- `importExistingNFT` (0xac271628)
- `batchImportExistingNFTs` (0x5f16f03d)

## ⚠️ 注意事项

1. 确保使用正确的钱包地址（deployer 或 contractOwner）
2. 如果交易失败，检查错误信息
3. 如果权限错误，说明 deployer 不是 owner，需要找到正确的 owner 地址


