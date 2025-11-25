# 后端迁移到 Diamond Pattern 检查清单

## ✅ 已完成

- [x] 生成合并的 ABI 文件（`abis/NFTManager.json`）
- [x] 创建 ABI 生成脚本（`scripts/generate-combined-abi.ts`）
- [x] 创建验证脚本（`scripts/verify-diamond-connection.ts`）
- [x] 更新 package.json 添加新脚本
- [x] 创建使用指南（`DIAMOND_PATTERN_GUIDE.md`）

## 📋 需要执行的操作

### 1. 更新环境变量

```bash
# 从部署结果复制环境变量
cp ../contracts/env.testnet .env
# 或
cp ../contracts/env.mainnet .env
# 或
cp ../contracts/env.localnode .env
```

**检查项：**
- [ ] `NFT_MANAGER_ADDRESS` 已更新为新的 Diamond 地址
- [ ] 其他环境变量保持不变

### 2. 验证 ABI 文件

```bash
# 重新生成 ABI（如果需要）
npm run generate-abi

# 验证 ABI 文件存在
ls -la abis/NFTManager.json
```

**检查项：**
- [ ] `abis/NFTManager.json` 文件存在
- [ ] ABI 包含所有 Facet 的函数

### 3. 验证合约连接

```bash
# 运行验证脚本
npm run verify-diamond
```

**检查项：**
- [ ] 合约地址存在
- [ ] Facets 已正确安装
- [ ] 基本读取函数正常工作

### 4. 测试后端功能

```bash
# 启动后端
npm run start:dev

# 测试基本功能
# 1. 读取合约状态
# 2. 创建批次
# 3. 管理白名单
# 4. 其他业务功能
```

**检查项：**
- [ ] 合约读取功能正常
- [ ] 合约写入功能正常
- [ ] 所有 API 端点正常工作

## 🔍 验证步骤

### 步骤 1: 检查环境变量

```bash
# 在 .env 文件中确认
cat .env | grep NFT_MANAGER_ADDRESS
```

应该显示新的 NFTManager (Diamond) 地址。

### 步骤 2: 验证 ABI

```bash
# 检查 ABI 文件
node -e "const abi = require('./abis/NFTManager.json'); console.log('Functions:', abi.abi.filter(i => i.type === 'function').length);"
```

应该显示 80+ 个函数。

### 步骤 3: 运行验证脚本

```bash
npm run verify-diamond
```

应该看到：
- ✅ Contract exists
- ✅ Found X Facets
- ✅ 所有测试函数正常工作

### 步骤 4: 测试实际功能

```typescript
// 在 ContractService 中测试
const totalMinted = await contractService.getTotalMinted();
console.log('Total minted:', totalMinted);

const activeBatch = await contractService.getActiveBatch();
console.log('Active batch:', activeBatch);
```

## ⚠️ 常见问题

### Q: 函数调用失败 - "function not found"

**A:** 
1. 检查 ABI 文件是否已更新：`npm run generate-abi`
2. 检查 Facets 是否已安装：`npm run verify-diamond`
3. 重启后端服务

### Q: 合约地址错误

**A:**
1. 使用部署脚本生成的环境文件
2. 确认 `NFT_MANAGER_ADDRESS` 是正确的 Diamond 地址
3. 检查网络配置是否正确

### Q: 需要修改后端代码吗？

**A:** 不需要！所有函数调用方式保持不变，因为 Diamond Pattern 通过 fallback 函数统一暴露所有 Facet 的函数。

## 📚 相关文档

- [DIAMOND_PATTERN_GUIDE.md](./DIAMOND_PATTERN_GUIDE.md) - 详细使用指南
- [../../contracts/docs/DIAMOND_DEPLOYMENT.md](../../contracts/docs/DIAMOND_DEPLOYMENT.md) - 合约部署文档

## 🎯 完成标准

迁移完成的标准：
- ✅ ABI 文件已更新
- ✅ 环境变量已更新
- ✅ 验证脚本通过
- ✅ 所有后端功能测试通过
- ✅ 生产环境部署并验证

