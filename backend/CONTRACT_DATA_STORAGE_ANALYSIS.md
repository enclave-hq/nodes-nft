# 合约数据存储分析

## ❓ 问题

**从合约获取的状态数据，是否应该存储到数据库中？**

---

## 📊 当前设计

### 状态数据查询方式

```typescript
// 当前实现：直接从合约查询
totalNFTs = await this.contractService.getTotalMinted();
totalWhitelisted = await this.contractService.getWhitelistCount();
batches = await this.contractService.getAllBatches();
```

### 数据库存储情况

- ✅ **历史记录**：`batches` 表、`whitelist_history` 表（操作后保存）
- ✅ **元数据**：`invite_codes` 表、`nft_records` 表
- ⚠️ **缓存表**：`stats_cache` 表（存在但未使用）

---

## 🤔 是否应该存储到数据库？

### 方案对比

#### 方案 1：不存储（当前方案）

**优点**：
- ✅ 数据实时准确，不会出现不一致
- ✅ 不需要同步机制，简单可靠
- ✅ 符合"合约是唯一数据源"的设计原则

**缺点**：
- ❌ 每次查询都需要调用合约（RPC 调用，可能较慢）
- ❌ 无法做历史分析（时间序列数据）
- ❌ 如果 RPC 失败，无法提供数据

#### 方案 2：存储到数据库（缓存方案）

**优点**：
- ✅ 查询速度快（数据库查询比 RPC 调用快）
- ✅ 可以做历史分析（时间序列数据）
- ✅ 可以作为缓存，提高性能
- ✅ RPC 失败时可以提供服务

**缺点**：
- ❌ 需要同步机制，保证数据一致性
- ❌ 如果不同步，数据会过时
- ❌ 增加系统复杂度

---

## ✅ 推荐方案：混合方案（缓存 + 实时查询）

### 设计思路

1. **查询时优先从合约读取**（实时准确）
2. **同时更新数据库缓存**（用于历史分析和容错）
3. **如果合约查询失败，使用数据库缓存**（容错）

### 实现方式

#### 方式 1：使用 `StatsCache` 表（推荐）

```typescript
async getOverview() {
  // 1. 尝试从合约查询（实时准确）
  let totalNFTs = 0;
  try {
    totalNFTs = await this.contractService.getTotalMinted();
    
    // 2. 更新缓存（异步，不阻塞）
    await this.updateStatsCache('totalNFTs', totalNFTs);
  } catch (error) {
    // 3. 如果合约查询失败，使用缓存
    const cached = await this.getStatsCache('totalNFTs');
    totalNFTs = cached || 0;
  }
  
  return { totalNFTs, ... };
}

async updateStatsCache(key: string, value: any) {
  await this.prisma.statsCache.upsert({
    where: { key },
    update: { value: JSON.stringify(value), updatedAt: new Date() },
    create: { key, value: JSON.stringify(value) },
  });
}
```

#### 方式 2：写入时同步（当前部分实现）

```typescript
// 创建批次后，已经保存到数据库
async createBatch(...) {
  // 1. 调用合约
  const txHash = await this.contractService.createBatch(...);
  
  // 2. 从合约读取状态
  const contractBatch = await this.contractService.getBatch(batchId);
  
  // 3. 保存到数据库（已实现）
  await this.prisma.batch.create({
    data: { ...contractBatch, ... }
  });
}
```

---

## 📋 具体建议

### 1. NFT 数量（totalMinted）

**建议**：✅ 可以存储到 `StatsCache` 表

**原因**：
- 查询频率高（每次打开统计页面）
- 变化频率低（只有铸造时变化）
- 可以缓存提高性能

**实现**：
```typescript
// 查询时
totalNFTs = await this.contractService.getTotalMinted();
await this.updateStatsCache('totalNFTs', totalNFTs);

// 或者：监听铸造事件，实时更新缓存
```

### 2. 白名单数量（whitelistCount）

**建议**：✅ 可以存储到 `StatsCache` 表

**原因**：
- 查询频率高
- 变化频率中等（添加/移除白名单时变化）
- 可以缓存提高性能

**实现**：
```typescript
// 查询时
totalWhitelisted = await this.contractService.getWhitelistCount();
await this.updateStatsCache('totalWhitelisted', totalWhitelisted);

// 或者：添加/移除白名单时更新缓存
```

### 3. 批次信息（batches）

**建议**：✅ 已经存储到 `batches` 表（当前实现）

**原因**：
- 创建/激活批次时已经保存到数据库
- 可以作为历史记录和缓存
- 查询时从合约读取，数据库作为备份

**当前实现**：
```typescript
// 创建批次后，已经保存到数据库
await this.prisma.batch.create({ ... });

// 查询时，从合约读取（实时准确）
const contractBatches = await this.contractService.getAllBatches();
```

---

## 🎯 最佳实践建议

### 1. 查询策略（推荐）

```typescript
async getOverview() {
  // 策略：优先从合约查询，同时更新缓存
  
  // 1. 从合约查询（实时准确）
  const totalNFTs = await this.contractService.getTotalMinted();
  
  // 2. 异步更新缓存（不阻塞响应）
  this.updateStatsCacheAsync('totalNFTs', totalNFTs);
  
  // 3. 返回实时数据
  return { totalNFTs, ... };
}

// 异步更新缓存
private updateStatsCacheAsync(key: string, value: any) {
  setImmediate(async () => {
    try {
      await this.prisma.statsCache.upsert({
        where: { key },
        update: { value: JSON.stringify(value), updatedAt: new Date() },
        create: { key, value: JSON.stringify(value) },
      });
    } catch (error) {
      // 静默失败，不影响主流程
    }
  });
}
```

### 2. 容错策略

```typescript
async getOverview() {
  // 策略：合约查询失败时，使用缓存
  
  let totalNFTs = 0;
  try {
    // 1. 尝试从合约查询
    totalNFTs = await this.contractService.getTotalMinted();
    
    // 2. 更新缓存
    await this.updateStatsCache('totalNFTs', totalNFTs);
  } catch (error) {
    // 3. 如果合约查询失败，使用缓存
    const cached = await this.getStatsCache('totalNFTs');
    if (cached) {
      totalNFTs = cached;
      console.warn('⚠️ Using cached totalNFTs due to contract query failure');
    } else {
      // 4. 如果缓存也没有，使用数据库记录（最后备选）
      totalNFTs = await this.prisma.nftRecord.count();
    }
  }
  
  return { totalNFTs, ... };
}
```

### 3. 事件驱动更新（高级）

```typescript
// 监听合约事件，实时更新缓存
@OnEvent('nft.minted')
async handleNFTMinted(nftId: number) {
  // 更新 totalNFTs 缓存
  const totalNFTs = await this.contractService.getTotalMinted();
  await this.updateStatsCache('totalNFTs', totalNFTs);
}

@OnEvent('whitelist.added')
async handleWhitelistAdded(address: string) {
  // 更新 whitelistCount 缓存
  const count = await this.contractService.getWhitelistCount();
  await this.updateStatsCache('totalWhitelisted', Number(count));
}
```

---

## 📊 数据存储位置建议

### 1. 使用 `StatsCache` 表（推荐）

**用途**：缓存统计数据（totalNFTs, totalWhitelisted 等）

**优点**：
- 专门用于缓存
- 结构简单（key-value）
- 易于管理

**实现**：
```typescript
// 存储
await this.prisma.statsCache.upsert({
  where: { key: 'totalNFTs' },
  update: { value: JSON.stringify(4), updatedAt: new Date() },
  create: { key: 'totalNFTs', value: JSON.stringify(4) },
});

// 读取
const cached = await this.prisma.statsCache.findUnique({
  where: { key: 'totalNFTs' },
});
```

### 2. 使用现有表（当前实现）

**批次信息**：`batches` 表
- ✅ 已经存储（创建/激活时保存）
- ✅ 可以作为历史记录和缓存

**白名单历史**：`whitelist_history` 表
- ✅ 已经存储（添加/移除时保存）
- ✅ 可以作为历史记录

---

## ✅ 最终建议

### 推荐方案：缓存 + 实时查询

1. **查询时**：
   - ✅ 优先从合约查询（实时准确）
   - ✅ 异步更新缓存（不阻塞响应）

2. **容错时**：
   - ✅ 如果合约查询失败，使用缓存
   - ✅ 如果缓存也没有，使用数据库记录（最后备选）

3. **存储位置**：
   - ✅ 使用 `StatsCache` 表缓存统计数据
   - ✅ 使用 `batches` 表存储批次历史（已实现）
   - ✅ 使用 `whitelist_history` 表存储白名单历史（已实现）

### 实现优先级

1. **高优先级**：实现 `StatsCache` 缓存机制
   - 提高查询性能
   - 提供容错能力

2. **中优先级**：事件驱动更新
   - 实时更新缓存
   - 减少合约查询次数

3. **低优先级**：历史分析功能
   - 时间序列数据
   - 趋势分析

---

## 📝 总结

**是否应该存储到数据库？**

**答案**：✅ **可以存储，但作为缓存，不是数据源**

**原则**：
1. ✅ 查询时优先从合约读取（实时准确）
2. ✅ 同时更新数据库缓存（用于容错和性能）
3. ✅ 如果合约查询失败，使用缓存（容错）
4. ✅ 数据库缓存不是数据源，只是辅助

**好处**：
- 提高查询性能
- 提供容错能力
- 可以做历史分析

**注意**：
- 不要依赖数据库缓存作为数据源
- 合约是唯一真实数据源
- 缓存只是辅助，用于性能和容错

