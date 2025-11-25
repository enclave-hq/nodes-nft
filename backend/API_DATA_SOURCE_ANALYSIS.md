# API 数据源详细分析

## 📋 接口列表

### 1. `/api/admin/stats/overview` (GET)
### 2. `/api/admin/stats/invite-codes` (GET)
### 3. `/api/admin/whitelist?page=1&limit=50` (GET)
### 4. `/api/admin/batches` (GET)

---

## 🔍 详细数据源分析

### 1. `/api/admin/stats/overview`

**实现**: `StatsService.getOverview()`

| 字段 | 数据源 | 数据库表/合约函数 | 说明 |
|------|--------|-----------------|------|
| **totalUsers** | ✅ 合约 | `getWhitelistCount()` | 白名单用户数（实时准确） |
| **totalNFTs** | ✅ 合约 | `totalMinted()` | NFT 总数（实时准确） |
| **totalWhitelisted** | ✅ 合约 | `getWhitelistCount()` | 白名单总数（实时准确） |
| **totalBatches** | ✅ 合约 | `getAllBatches()` | 批次总数（实时准确） |
| **activeBatches** | ✅ 合约 | `getAllBatches()` 过滤 | 激活批次数（实时准确） |
| **totalInviteCodes** | ✅ 数据库 | `invite_codes` 表 | 邀请码总数（元数据） |
| **activeInviteCodes** | ✅ 数据库 | `invite_codes` 表 | 活跃邀请码数（元数据） |

**查询策略**：
```
合约查询 → 成功：返回数据 + 更新缓存
         → 失败：使用缓存 → 失败：使用数据库
```

**可能的不一致原因**：
- ⚠️ 如果合约查询失败，且缓存也没有，会使用数据库（可能过时）
- ⚠️ 数据库 `nft_records` 表可能不完整

---

### 2. `/api/admin/stats/invite-codes`

**实现**: `StatsService.getInviteCodeStats()`

| 字段 | 数据源 | 数据库表 | 说明 |
|------|--------|---------|------|
| **total** | ✅ 数据库 | `invite_codes` 表 | 邀请码总数 |
| **active** | ✅ 数据库 | `invite_codes` 表（`status='active'`） | 活跃邀请码数 |
| **used** | ✅ 数据库 | `invite_code_usage` 表 | 使用次数 |
| **pending** | ✅ 数据库 | `invite_codes` 表（`status='pending'`） | 待批准数 |
| **expired** | ✅ 数据库 | `invite_codes` 表 | 已过期数（当前返回 0） |
| **byStatus** | ✅ 数据库 | `invite_codes` 表（`groupBy status`） | 按状态分类 |

**说明**：
- ✅ **这些数据不在链上**，所以从数据库查询是正确的
- ✅ **不存在一致性问题**（邀请码完全由后端管理）

**可能的不一致原因**：
- ❌ 无（邀请码不在链上，数据库是唯一数据源）

---

### 3. `/api/admin/whitelist?page=1&limit=50`

**实现**: `WhitelistService.getWhitelist()`

**数据源**：
1. **地址列表**：从数据库 `whitelist_history` 表查询（`action='add'`）
2. **状态验证**：每个地址都验证合约状态 `isWhitelisted(address)`

**查询流程**：
```typescript
// 1. 从数据库历史记录获取地址列表（作为索引）
const historyRecords = await this.prisma.whitelistHistory.findMany({
  where: { action: 'add' },
  // ...
});

// 2. 验证每个地址的合约状态（过滤已移除的地址）
for (const record of historyRecords) {
  const isWhitelisted = await this.contractService.isWhitelisted(record.address);
  if (isWhitelisted) {
    verifiedEntries.push(record);
  }
}
```

**可能的不一致原因**：
- ⚠️ **数据库历史记录可能不完整**
  - 如果地址直接通过合约添加（不经过后端），数据库没有记录
  - 导致白名单列表不完整
- ⚠️ **分页问题**
  - 从数据库分页，然后验证合约状态
  - 如果某些地址被移除，实际返回的数量可能少于 `limit`
- ⚠️ **total 计数不准确**
  - `total` 是验证后的数量，不是数据库的总数
  - 可能导致分页计算错误

**问题**：
- ❌ 如果地址直接通过合约添加，数据库没有记录，不会出现在列表中
- ❌ 分页基于数据库历史记录，但实际返回的是验证后的地址，可能导致分页不准确

---

### 4. `/api/admin/batches`

**实现**: `BatchesService.findAll()`

**数据源**：
1. **批次信息**：从合约 `getAllBatches()` 查询（实时准确）
2. **返佣信息**：从数据库 `batches` 表查询（`referralReward` 不在链上）

**查询流程**：
```typescript
// 1. 从合约查询批次信息（实时准确）
const contractBatches = await this.contractService.getAllBatches();

// 2. 从数据库查询返佣信息（不在链上）
const dbBatches = await this.prisma.batch.findMany({
  select: { batchId: true, referralReward: true },
});

// 3. 合并数据
return contractBatches.map(batch => ({
  ...batch,
  referralReward: referralRewardMap.get(batch.batchId.toString()) || null,
}));
```

**可能的不一致原因**：
- ⚠️ **如果合约查询失败**，会抛出错误（没有容错）
- ⚠️ **数据库 `batches` 表可能不完整**
  - 如果批次直接通过合约创建（不经过后端），数据库没有记录
  - 导致 `referralReward` 为 `null`

---

## 🔍 问题分析

### 问题 1: 白名单列表可能不完整

**原因**：
- 如果地址直接通过合约添加（不经过后端 API），数据库 `whitelist_history` 表没有记录
- 导致这些地址不会出现在白名单列表中

**解决方案**：
- ⚠️ 合约不支持枚举白名单，无法直接获取所有地址
- ✅ 当前实现：使用数据库历史记录作为索引，然后验证合约状态
- 💡 建议：监听合约事件，实时同步白名单历史记录

### 问题 2: 统计数据可能不一致

**原因**：
- 如果合约查询失败，且缓存也没有，会使用数据库（可能过时）
- 数据库记录可能不完整

**解决方案**：
- ✅ 已实现：缓存机制（合约 → 缓存 → 数据库）
- 💡 建议：确保缓存及时更新

### 问题 3: 批次返佣信息可能缺失

**原因**：
- `referralReward` 不在链上，只存储在数据库
- 如果批次直接通过合约创建，数据库没有记录

**解决方案**：
- ✅ 当前实现：从数据库查询返佣信息
- 💡 建议：创建批次时确保保存到数据库

---

## ✅ 数据源总结

| 接口 | 主要数据源 | 辅助数据源 | 一致性问题 |
|------|-----------|-----------|-----------|
| `/api/admin/stats/overview` | ✅ 合约 | 缓存/数据库 | ⚠️ 如果合约查询失败 |
| `/api/admin/stats/invite-codes` | ✅ 数据库 | 无 | ✅ 无（不在链上） |
| `/api/admin/whitelist` | ⚠️ 数据库历史 + 合约验证 | 无 | ⚠️ 历史记录可能不完整 |
| `/api/admin/batches` | ✅ 合约 | 数据库（返佣） | ⚠️ 返佣信息可能缺失 |

---

## 🎯 建议修复

### 1. 白名单列表 - 监听事件同步

```typescript
// 监听 WhitelistAdded 事件，实时同步到数据库
@OnEvent('WhitelistAdded')
async handleWhitelistAdded(address: string, txHash: string) {
  await this.prisma.whitelistHistory.create({
    data: {
      address: address.toLowerCase(),
      action: 'add',
      txHash,
    },
  });
}
```

### 2. 批次信息 - 确保数据库同步

```typescript
// 创建批次时，确保保存到数据库
async createBatch(...) {
  const txHash = await this.contractService.createBatch(...);
  const contractBatch = await this.contractService.getBatch(batchId);
  
  // 确保保存到数据库
  await this.prisma.batch.upsert({
    where: { batchId },
    update: { ...contractBatch, referralReward },
    create: { ...contractBatch, referralReward },
  });
}
```

### 3. 统计数据 - 确保缓存更新

```typescript
// 监听相关事件，实时更新缓存
@OnEvent('NFTMinted')
async handleNFTMinted() {
  const totalNFTs = await this.contractService.getTotalMinted();
  await this.updateStatsCache('totalNFTs', totalNFTs);
}
```

---

## 📝 总结

### 当前状态

1. ✅ `/api/admin/stats/overview` - 已修复，从合约查询
2. ✅ `/api/admin/stats/invite-codes` - 正确，从数据库查询（不在链上）
3. ⚠️ `/api/admin/whitelist` - 可能不完整（如果地址直接通过合约添加）
4. ⚠️ `/api/admin/batches` - 返佣信息可能缺失（如果批次直接通过合约创建）

### 数据一致性保证

- ✅ **状态数据**：从合约查询（实时准确）
- ✅ **元数据**：从数据库查询（邀请码等）
- ⚠️ **历史记录**：可能不完整（如果直接通过合约操作）

### 下一步

1. **实现事件监听**：实时同步白名单和批次历史记录
2. **确保数据库同步**：创建/更新时确保保存到数据库
3. **监控和日志**：记录数据不一致的情况

