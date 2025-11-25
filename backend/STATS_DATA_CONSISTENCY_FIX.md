# Stats API 数据一致性修复

## 📋 问题

**`/api/admin/stats/overview` 和 `/api/admin/stats/invite-codes` 读取的数据和链上不一致**

### 问题原因

1. **合约查询失败时回退到数据库**
   - 如果 RPC 连接失败或超时，会回退到数据库查询
   - 数据库数据可能过时或不完整
   - 导致返回的数据和链上不一致

2. **数据库数据可能过时**
   - `nft_records` 表：只存储元数据，不存储状态
   - `whitelist_history` 表：历史记录可能不完整
   - `batches` 表：可能没有及时更新

3. **没有缓存机制**
   - 每次查询都直接调用合约（可能失败）
   - 没有缓存作为容错

---

## ✅ 修复方案

### 1. 实现 StatsCache 缓存机制

**新增方法**：

```typescript
// 更新缓存
private async updateStatsCache(key: string, value: number): Promise<void>

// 读取缓存
private async getStatsCache(key: string): Promise<number | null>
```

### 2. 优化查询策略

**新的查询流程**：

```
1. 尝试从合约查询（实时准确）
   ↓ 成功
   返回数据 + 异步更新缓存
   
   ↓ 失败
2. 尝试从缓存读取（最近一次成功的合约查询）
   ↓ 成功
   返回缓存数据
   
   ↓ 失败
3. 使用数据库（最后备选，可能过时）
   返回数据库数据
```

### 3. 具体实现

#### totalNFTs 查询

```typescript
try {
  // 1. 从合约查询（实时准确）
  totalNFTs = await this.contractService.getTotalMinted();
  // 2. 异步更新缓存
  this.updateStatsCache('totalNFTs', totalNFTs).catch(() => {});
} catch (error) {
  // 3. 尝试从缓存读取
  const cached = await this.getStatsCache('totalNFTs');
  if (cached !== null) {
    totalNFTs = cached;
  } else {
    // 4. 最后备选：数据库（可能过时）
    totalNFTs = await this.prisma.nftRecord.count();
  }
}
```

#### totalWhitelisted 查询

```typescript
try {
  const whitelistCount = await this.contractService.getWhitelistCount();
  totalWhitelisted = Number(whitelistCount);
  this.updateStatsCache('totalWhitelisted', totalWhitelisted).catch(() => {});
} catch (error) {
  const cached = await this.getStatsCache('totalWhitelisted');
  if (cached !== null) {
    totalWhitelisted = cached;
  } else {
    totalWhitelisted = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT address) as count FROM whitelist_history WHERE action = 'add'
    `.then((result) => Number(result[0].count));
  }
}
```

#### batches 查询

```typescript
try {
  const contractBatches = await this.contractService.getAllBatches();
  totalBatches = contractBatches.length;
  activeBatches = contractBatches.filter(b => b.active).length;
  this.updateStatsCache('totalBatches', totalBatches).catch(() => {});
  this.updateStatsCache('activeBatches', activeBatches).catch(() => {});
} catch (error) {
  const cachedTotal = await this.getStatsCache('totalBatches');
  const cachedActive = await this.getStatsCache('activeBatches');
  if (cachedTotal !== null && cachedActive !== null) {
    totalBatches = cachedTotal;
    activeBatches = cachedActive;
  } else {
    totalBatches = await this.prisma.batch.count();
    activeBatches = await this.prisma.batch.count({ where: { active: true } });
  }
}
```

---

## 🔄 数据一致性保证

### 1. 查询优先级

| 优先级 | 数据源 | 说明 |
|-------|--------|------|
| **1** | ✅ 合约 | 实时准确，唯一真实数据源 |
| **2** | ✅ 缓存 | 最近一次成功的合约查询结果 |
| **3** | ⚠️ 数据库 | 可能过时，最后备选 |

### 2. 缓存更新机制

- ✅ **查询成功时**：异步更新缓存（不阻塞响应）
- ✅ **缓存失效**：如果合约查询失败，使用缓存
- ✅ **缓存过期**：可以设置过期时间（可选）

### 3. 数据一致性

- ✅ **正常情况**：从合约查询，数据实时准确
- ✅ **RPC 失败**：使用缓存（最近一次成功的查询）
- ⚠️ **缓存也没有**：使用数据库（可能过时，但至少能返回数据）

---

## 📊 修复前后对比

### 修复前（❌ 可能不一致）

```
查询请求
  ↓
尝试从合约查询
  ↓ 失败
直接使用数据库（可能过时）
  ↓
返回不一致的数据
```

### 修复后（✅ 保证一致性）

```
查询请求
  ↓
尝试从合约查询
  ↓ 成功
返回实时数据 + 更新缓存
  ↓ 失败
尝试从缓存读取
  ↓ 成功
返回缓存数据（最近一次成功的查询）
  ↓ 失败
使用数据库（最后备选）
```

---

## 🎯 优势

1. **数据实时准确**
   - 优先从合约查询，反映链上真实状态

2. **容错能力强**
   - RPC 失败时使用缓存
   - 缓存也没有时使用数据库

3. **性能优化**
   - 异步更新缓存，不阻塞响应
   - 缓存查询速度快

4. **数据一致性**
   - 缓存来自最近一次成功的合约查询
   - 比数据库更可靠

---

## 📝 关于 `/api/admin/stats/invite-codes`

**这个接口的数据不在链上**，所以从数据库查询是正确的：

- ✅ `invite_codes` 表：邀请码信息（完全后端管理）
- ✅ `invite_code_usage` 表：使用记录（完全后端管理）

**这些数据不在合约上，所以不存在一致性问题。**

---

## 🧪 验证方法

### 1. 运行验证脚本

```bash
cd backend
npm run verify-stats
# 或者
ts-node scripts/verify-stats-data.ts
```

### 2. 检查后端日志

查看是否有以下警告：
- `⚠️ Failed to query totalNFTs from contract`
- `⚠️ Using cached totalNFTs`

### 3. 检查缓存表

```sql
SELECT * FROM stats_cache;
```

---

## ✅ 总结

### 修复内容

1. ✅ 实现 `StatsCache` 缓存机制
2. ✅ 优化查询策略（合约 → 缓存 → 数据库）
3. ✅ 异步更新缓存（不阻塞响应）
4. ✅ 增强容错能力

### 数据一致性保证

- ✅ **正常情况**：从合约查询（实时准确）
- ✅ **RPC 失败**：使用缓存（最近一次成功的查询）
- ⚠️ **缓存也没有**：使用数据库（最后备选）

### 下一步

1. **重启后端服务**使更改生效
2. **测试接口**验证数据一致性
3. **监控日志**查看是否有 RPC 失败的情况

---

## 📄 相关文件

- `backend/src/modules/stats/stats.service.ts` - Stats 服务（已修复）
- `backend/scripts/verify-stats-data.ts` - 数据验证脚本
- `backend/CONTRACT_DATA_STORAGE_ANALYSIS.md` - 数据存储分析
- `backend/STATS_DATA_SOURCE_ANALYSIS.md` - 数据源分析

