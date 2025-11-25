# 白名单数组功能部署步骤

## 📋 部署流程

### 1️⃣ 编译合约（已完成）
```bash
cd contracts
npx hardhat compile
```

### 2️⃣ 部署 NFTManagerFacet 到测试网
```bash
npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscTestnet
```

**注意**：这会：
- 部署新的 NFTManagerFacet（包含 whitelistAddresses 数组）
- 升级 Diamond 中的 Facet
- 更新 env.testnet 文件

### 3️⃣ 初始化白名单数组
```bash
npx hardhat run scripts/init-whitelist-array.ts --network bscTestnet
```

**说明**：这个脚本会：
- 查询所有 WhitelistAdded 事件
- 验证哪些地址仍然在白名单中
- 重新添加这些地址到数组（addToWhitelist 会检查，不会重复添加）

### 4️⃣ 重新生成 ABI
```bash
cd ../backend
npm run generate-abi
```

### 5️⃣ 重新生成 TypeScript 类型
```bash
cd ../contracts
npx hardhat typechain
```

### 6️⃣ 重启后端服务
```bash
cd ../backend
npm run start:dev
```

## ⚠️ 重要提示

1. **白名单数组初始化**：
   - 新部署的 Facet 会有空的 `whitelistAddresses` 数组
   - 现有的白名单地址（在 mapping 中）仍然有效
   - 运行 `init-whitelist-array.ts` 后，数组会被填充

2. **数据一致性**：
   - `whitelist` mapping 是数据源（不会丢失）
   - `whitelistAddresses` 数组用于枚举（需要初始化）

3. **后续添加**：
   - 之后通过 `addToWhitelist()` 添加的地址会自动添加到数组

## ✅ 验证

部署后，可以通过以下方式验证：

```bash
# 查询白名单总数
npx hardhat run scripts/query-total-minted.ts --network bscTestnet

# 检查数组长度
# 应该等于 whitelistCount
```

