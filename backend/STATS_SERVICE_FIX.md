# StatsService 修复说明

## 📋 问题

`StatsService.getOverview()` 中的 `totalNFTs` 从数据库查询，导致数据不准确：

### 问题原因

1. **从数据库查询 NFT 数量**
   ```typescript
   // ❌ 错误：从数据库查询
   totalNFTs = this.prisma.nftRecord.count()
   ```

2. **数据库记录可能不完整**
   - 数据库中的 `nftRecord` 表存储的是**元数据**（邀请码关联、追溯信息等）
   - 不是状态数据，可能不完整
   - 如果 NFT 已经同步到合约，但数据库中没有记录，查询结果就不准确

3. **不符合设计原则**
   - 根据 `DATA_SYNC_ANALYSIS.md`，NFT 数量应该从合约查询
   - 合约是唯一数据源

## ✅ 修复方案

### 1. 修改 `StatsService.getOverview()`

**修复前（❌ 不准确）**：
```typescript
totalNFTs = this.prisma.nftRecord.count()  // 从数据库查询
```

**修复后（✅ 准确）**：
```typescript
// 从合约查询（实时准确）
let totalNFTs = 0;
try {
  totalNFTs = await this.contractService.getTotalMinted();
} catch (error: any) {
  console.warn('⚠️ Failed to query totalNFTs from contract, falling back to database:', error.message);
  // 如果合约查询失败，回退到数据库查询
  totalNFTs = await this.prisma.nftRecord.count();
}
```

### 2. 添加 ContractService 依赖

```typescript
constructor(
  private prisma: PrismaService,
  private contractService: ContractService,  // 新增
) {}
```

## 🔄 数据源说明

| 数据类型 | 数据源 | 说明 |
|---------|--------|------|
| **totalNFTs** | ✅ 合约 | 从 `totalMinted()` 查询（实时准确） |
| **totalWhitelisted** | ✅ 合约 | 从 `getWhitelistCount()` 查询（实时准确） |
| **totalBatches** | ✅ 合约 | 从 `getAllBatches()` 查询（实时准确） |
| **activeBatches** | ✅ 合约 | 从 `getAllBatches()` 查询并过滤（实时准确） |
| **totalInviteCodes** | ✅ 数据库 | 元数据，从数据库查询 |
| **activeInviteCodes** | ✅ 数据库 | 元数据，从数据库查询 |

## ❓ 是否需要同步到数据库？

**答案：不需要**

### 原因

1. **NFT 数量是状态数据**
   - 应该从合约查询，实时准确
   - 不需要在数据库中维护副本

2. **数据库存储的是元数据**
   - `nftRecord` 表存储的是邀请码关联、追溯信息等元数据
   - 不是状态数据，不需要与合约同步

3. **设计原则**
   - 根据 `DATA_SYNC_ANALYSIS.md`：
     - ✅ **合约是唯一数据源**：所有状态数据直接从合约读取
     - ✅ **数据库只存储**：历史记录、不在链上的数据、元数据

### 如果 NFT 已经同步到合约

如果 NFT 已经通过 `sync-existing-nfts.ts` 同步到合约：
- ✅ 从合约查询 `totalMinted()` 就能得到正确的数量（4 个）
- ❌ 不需要同步到数据库的 `nftRecord` 表
- ✅ 数据库中的 `nftRecord` 表只存储元数据（邀请码关联等）

### 数据库记录的作用

数据库中的 `nftRecord` 表用于：
- ✅ 存储邀请码关联（`inviteCodeId`）
- ✅ 存储追溯信息（`rootInviteCodeId`、`inviteChain`）
- ✅ 存储铸造历史（`mintTxHash`、`mintedAt`）
- ❌ **不用于**存储 NFT 数量（这是状态数据，应该从合约查询）

## 📊 修复前后对比

### 修复前

```
前端请求 → StatsService.getOverview()
         ↓
    从数据库查询 nftRecord.count()
         ↓
    返回可能不准确的数量（如果数据库记录不完整）
```

### 修复后

```
前端请求 → StatsService.getOverview()
         ↓
    从合约查询 totalMinted()
         ↓
    返回实时准确的数量（4 个）
```

## ✅ 优势

1. **数据实时准确**
   - 从合约查询，反映链上真实状态
   - 不会出现数据不一致问题

2. **符合设计原则**
   - 合约是唯一数据源
   - 数据库只存储元数据

3. **容错处理**
   - 如果合约查询失败，会回退到数据库查询
   - 确保服务可用性

## 🧪 测试建议

1. **测试正常流程**
   ```bash
   # 查询统计信息
   GET /admin/stats/overview
   ```

2. **验证数据准确性**
   - 应该返回合约中的 `totalMinted()` 值（4 个）
   - 不应该返回数据库中的 `nftRecord.count()` 值

3. **测试合约查询失败**
   - 模拟 RPC 连接失败
   - 应该回退到数据库查询

## 📝 相关文件

- `backend/src/modules/stats/stats.service.ts` - 修复 `getOverview()` 方法
- `backend/src/modules/contract/contract.service.ts` - `getTotalMinted()` 方法
- `backend/DATA_SYNC_ANALYSIS.md` - 数据同步分析文档

## 🔗 相关文档

- [DATA_SYNC_ANALYSIS.md](./DATA_SYNC_ANALYSIS.md) - 数据同步分析
- [NFT_QUERY_FIX.md](./NFT_QUERY_FIX.md) - NFT 查询修复说明

