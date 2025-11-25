# Stats API 数据源分析

## 📋 接口概览

### 1. `/api/admin/stats/overview`
获取总体统计数据

### 2. `/api/admin/stats/invite-codes`
获取邀请码统计数据

---

## 🔍 `/api/admin/stats/overview` 数据源分析

### 接口实现
- **Controller**: `StatsController.getOverview()`
- **Service**: `StatsService.getOverview()`

### 返回字段详细分析

| 字段 | 数据源 | 数据库表/合约函数 | 说明 |
|------|--------|-----------------|------|
| **totalUsers** | ✅ 合约 | `getWhitelistCount()` | 白名单用户数（实时准确） |
| **totalNFTs** | ✅ 合约 | `totalMinted()` | NFT 总数（实时准确） |
| **totalInviteCodes** | ✅ 数据库 | `invite_codes` 表 | 邀请码总数（元数据） |
| **activeInviteCodes** | ✅ 数据库 | `invite_codes` 表（`status='active'`） | 活跃邀请码数（元数据） |
| **totalWhitelisted** | ✅ 合约 | `getWhitelistCount()` | 白名单总数（实时准确） |
| **whitelistedUsers** | ✅ 合约 | `getWhitelistCount()` | 白名单用户数（别名） |
| **totalBatches** | ✅ 合约 | `getAllBatches()` | 批次总数（实时准确） |
| **activeBatches** | ✅ 合约 | `getAllBatches()` 过滤 `active=true` | 激活批次数（实时准确） |

### 代码实现

```typescript
// 从合约查询状态数据
totalNFTs = await this.contractService.getTotalMinted();
totalWhitelisted = await this.contractService.getWhitelistCount();
const contractBatches = await this.contractService.getAllBatches();
totalBatches = contractBatches.length;
activeBatches = contractBatches.filter(b => b.active).length;

// 从数据库查询元数据
totalInviteCodes = await this.prisma.inviteCode.count();
activeInviteCodes = await this.prisma.inviteCode.count({ where: { status: 'active' } });
```

---

## 🔍 `/api/admin/stats/invite-codes` 数据源分析

### 接口实现
- **Controller**: `StatsController.getInviteCodeStats()`
- **Service**: `StatsService.getInviteCodeStats()`

### 返回字段详细分析

| 字段 | 数据源 | 数据库表 | 说明 |
|------|--------|---------|------|
| **total** | ✅ 数据库 | `invite_codes` 表 | 邀请码总数 |
| **active** | ✅ 数据库 | `invite_codes` 表（`status='active'`） | 活跃邀请码数 |
| **used** | ✅ 数据库 | `invite_code_usage` 表 | 邀请码使用次数 |
| **pending** | ✅ 数据库 | `invite_codes` 表（`status='pending'`） | 待批准邀请码数 |
| **expired** | ✅ 数据库 | `invite_codes` 表（`expiresAt < now()`） | 已过期邀请码数（当前返回 0） |
| **byStatus** | ✅ 数据库 | `invite_codes` 表（`groupBy status`） | 按状态分类统计 |
| **pendingCount** | ✅ 数据库 | `invite_codes` 表 | 待批准数量（别名） |
| **activeCount** | ✅ 数据库 | `invite_codes` 表 | 活跃数量（别名） |
| **totalUsageCount** | ✅ 数据库 | `invite_code_usage` 表 | 总使用次数（别名） |

### 代码实现

```typescript
// 从数据库查询邀请码统计数据
const stats = await this.prisma.inviteCode.groupBy({
  by: ['status'],
  _count: true,
});
const totalUsageCount = await this.prisma.inviteCodeUsage.count();
const totalInviteCodes = await this.prisma.inviteCode.count();
const activeInviteCodes = await this.prisma.inviteCode.count({ where: { status: 'active' } });
```

---

## 📊 数据库表与合约数据关系

### 1. 状态数据（从合约查询）

#### NFT 数量
- **合约**: `totalMinted` (uint256)
- **数据库**: `nft_records` 表（仅存储元数据，不用于统计）
- **关系**: 
  - ✅ 合约是唯一数据源
  - ✅ 数据库只存储元数据（邀请码关联、追溯信息等）
  - ❌ 数据库记录不完整，不能用于统计

#### 白名单数量
- **合约**: `whitelistCount` (uint256) / `getWhitelistCount()`
- **数据库**: `whitelist_history` 表（历史记录）
- **关系**:
  - ✅ 合约是唯一数据源
  - ✅ 数据库存储历史记录（用于审计和追溯）
  - ⚠️ 数据库历史记录可能不完整（如果直接调用合约添加白名单）

#### 批次数据
- **合约**: `batches` mapping / `getAllBatches()`
- **数据库**: `batches` 表（历史记录）
- **关系**:
  - ✅ 合约是唯一数据源
  - ✅ 数据库存储历史记录（用于审计和追溯）
  - ✅ 创建/激活批次后，从合约读取状态保存到数据库

### 2. 元数据（从数据库查询）

#### 邀请码数据
- **合约**: ❌ 不在合约上
- **数据库**: `invite_codes` 表（唯一数据源）
- **关系**:
  - ✅ 邀请码完全由后端管理
  - ✅ 数据库是唯一数据源
  - ✅ 不在链上，所以没有一致性问题

#### 邀请码使用记录
- **合约**: ❌ 不在合约上
- **数据库**: `invite_code_usage` 表（唯一数据源）
- **关系**:
  - ✅ 使用记录完全由后端管理
  - ✅ 数据库是唯一数据源

#### NFT 元数据
- **合约**: NFT ID、所有者（状态数据）
- **数据库**: `nft_records` 表（元数据）
- **关系**:
  - ✅ 状态数据（NFT ID、所有者）从合约查询
  - ✅ 元数据（邀请码关联、追溯信息）存储在数据库
  - ✅ 两者结合提供完整信息

---

## 🔄 数据同步机制

### 1. 状态数据（不需要同步）

**原则**: 合约是唯一数据源，查询时直接从合约读取

```typescript
// ✅ 正确：从合约查询
totalNFTs = await this.contractService.getTotalMinted();
totalWhitelisted = await this.contractService.getWhitelistCount();
batches = await this.contractService.getAllBatches();
```

### 2. 历史记录（写入时同步）

**原则**: 操作合约后，从合约读取状态保存到数据库作为历史记录

#### 批次创建流程
```typescript
// 1. 调用合约创建批次
const txHash = await this.contractService.createBatch(maxMintable, mintPrice);

// 2. 从合约读取创建后的状态
const contractBatch = await this.contractService.getBatch(batchId);

// 3. 保存到数据库作为历史记录
await this.prisma.batch.create({
  data: {
    batchId: contractBatch.batchId,
    maxMintable: contractBatch.maxMintable,
    mintPrice: contractBatch.mintPrice.toString(),
    active: contractBatch.active,
    // ...
  },
});
```

#### 白名单添加流程
```typescript
// 1. 调用合约添加白名单
const txHash = await this.contractService.addToWhitelist(addresses);

// 2. 保存到数据库作为历史记录
for (const address of addresses) {
  await this.prisma.whitelistHistory.create({
    data: {
      address,
      action: 'add',
      txHash,
      // ...
    },
  });
}
```

### 3. 元数据（完全后端管理）

**原则**: 邀请码等元数据完全由后端管理，不在链上

```typescript
// 邀请码创建（完全后端管理）
await this.prisma.inviteCode.create({
  data: {
    code: generateInviteCode(),
    applicantAddress: address,
    status: 'active',
    // ...
  },
});
```

---

## 📋 数据库表详细说明

### 1. `invite_codes` 表
- **用途**: 存储邀请码信息（唯一数据源）
- **与合约关系**: ❌ 不在合约上，完全后端管理
- **字段**:
  - `code`: 邀请码（Base32 编码）
  - `applicantAddress`: 申请人地址
  - `status`: 状态（pending, active, revoked）
  - `usageCount`: 使用次数
  - `mintedNftCount`: 铸造的 NFT 数量
  - `parentInviteCodeId`: 父邀请码 ID（层级关系）
  - `rootInviteCodeId`: 根邀请码 ID（快速追溯）

### 2. `invite_code_usage` 表
- **用途**: 存储邀请码使用记录
- **与合约关系**: ❌ 不在合约上，完全后端管理
- **字段**:
  - `inviteCodeId`: 邀请码 ID
  - `userAddress`: 使用用户地址
  - `txHash`: 交易哈希（如果通过合约操作）

### 3. `nft_records` 表
- **用途**: 存储 NFT 元数据（邀请码关联、追溯信息）
- **与合约关系**: 
  - ✅ 状态数据（NFT ID、所有者）从合约查询
  - ✅ 元数据（邀请码关联）存储在数据库
- **字段**:
  - `nftId`: NFT ID（与合约对应）
  - `ownerAddress`: 当前所有者（可能已过时，应从合约查询）
  - `minterAddress`: 原始铸造者（不变）
  - `inviteCodeId`: 关联的邀请码 ID
  - `rootInviteCodeId`: 根邀请码 ID
  - `inviteChain`: 邀请链（JSON 格式）

### 4. `whitelist_history` 表
- **用途**: 存储白名单历史记录（用于审计和追溯）
- **与合约关系**:
  - ✅ 状态数据（是否在白名单）从合约查询
  - ✅ 历史记录存储在数据库
- **字段**:
  - `address`: 地址
  - `action`: 操作（add/remove）
  - `txHash`: 交易哈希
  - `inviteCode`: 关联的邀请码（如果有）

### 5. `batches` 表
- **用途**: 存储批次历史记录（用于审计和追溯）
- **与合约关系**:
  - ✅ 状态数据（批次信息）从合约查询
  - ✅ 历史记录存储在数据库
- **字段**:
  - `batchId`: 批次 ID（与合约对应）
  - `maxMintable`: 最大可铸造数
  - `mintPrice`: 铸造价格
  - `referralReward`: 返佣（仅在数据库，不在链上）
  - `active`: 是否激活
  - `currentMinted`: 当前已铸造数

---

## ✅ 数据一致性保证

### 1. 状态数据查询
- ✅ 所有状态数据查询都从合约读取
- ✅ 不依赖数据库，保证实时准确
- ✅ 如果合约查询失败，回退到数据库（容错）

### 2. 历史记录同步
- ✅ 操作合约后，从合约读取状态保存到数据库
- ✅ 数据库记录与合约状态一致
- ✅ 有交易哈希，可以追溯

### 3. 元数据管理
- ✅ 邀请码等元数据完全由后端管理
- ✅ 不在链上，所以没有一致性问题
- ✅ 数据库是唯一数据源

---

## 🎯 总结

### 数据源分类

| 数据类型 | 数据源 | 说明 |
|---------|--------|------|
| **状态数据** | ✅ 合约 | NFT 数量、白名单数量、批次信息（实时准确） |
| **元数据** | ✅ 数据库 | 邀请码信息、NFT 元数据（邀请码关联等） |
| **历史记录** | ✅ 数据库 | 操作历史、审计日志（用于追溯） |

### 设计原则

1. **合约是唯一数据源**
   - 所有状态数据从合约查询
   - 数据库不维护状态数据副本

2. **数据库存储元数据和历史记录**
   - 邀请码等元数据完全由后端管理
   - 操作历史用于审计和追溯

3. **查询时实时验证**
   - 状态数据查询时直接从合约读取
   - 不依赖数据库，保证实时准确

---

## 📝 相关文件

- `backend/src/modules/stats/stats.service.ts` - Stats 服务实现
- `backend/src/modules/stats/stats.controller.ts` - Stats 控制器
- `backend/src/modules/contract/contract.service.ts` - 合约服务
- `backend/prisma/schema.prisma` - 数据库 Schema
- `backend/DATA_SYNC_ANALYSIS.md` - 数据同步分析
- `backend/STATS_SERVICE_FIX.md` - Stats 服务修复说明

