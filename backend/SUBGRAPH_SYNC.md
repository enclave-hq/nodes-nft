# The Graph 子图同步功能

## 概述

NFT 同步功能已更新为使用 The Graph 子图，替代了之前的链上区块扫描方式。这种方式更高效、更可靠，且无需担心 RPC 限流问题。

## 配置

### 环境变量

在 `.env` 文件中添加子图 URL 和 API Key：

```bash
# 必需：子图 URL
SUBGRAPH_URL=https://api.studio.thegraph.com/query/1718673/nft-minted/v1

# 推荐：API Key（避免限流）
SUBGRAPH_API_KEY=your-api-key-here
```

### 获取 API Key

1. 访问 [The Graph Studio](https://thegraph.com/studio/)
2. 登录你的账户
3. 选择你的子图（`nft-minted`）
4. 在 "API Keys" 部分创建新的 API Key
5. 复制 API Key 到 `.env` 文件

**注意**：
- 免费计划：每月 100,000 次查询
- 不配置 API Key 也可以使用，但可能遇到限流
- 生产环境强烈建议配置 API Key

### 主网配置

```bash
SUBGRAPH_URL=https://api.studio.thegraph.com/query/1718673/nft-minted/v1
SUBGRAPH_API_KEY=your-production-api-key
```

### 测试网配置

如果部署了测试网子图，配置对应的 URL：

```bash
SUBGRAPH_URL=https://api.studio.thegraph.com/query/YOUR_SUBGRAPH_ID/nft-minted/v1
SUBGRAPH_API_KEY=your-testnet-api-key
```

## API 端点

### 同步 NFT（推荐）

```bash
POST /admin/nfts/sync
```

使用子图同步 NFT 数据到数据库。

**响应示例：**

```json
{
  "totalEvents": 100,
  "synced": 98,
  "created": 5,
  "updated": 93,
  "errors": 2
}
```

### 同步 NFT（链上扫描，已废弃）

```bash
POST /admin/nfts/sync/chain
```

⚠️ **已废弃**：使用链上扫描方式，性能较差，仅作为备用方案。

## 定时任务

系统已配置自动定时同步任务：

### 1. 定期同步（每 2 分钟）

- **时间**：每 2 分钟执行一次（例如：0:00, 0:02, 0:04, 0:06...）
- **任务名**：`syncNFTsFromSubgraph`
- **功能**：同步最新的 NFT 铸造事件
- **说明**：由于直接从 The Graph 子图读取（无需 RPC 调用），可以非常频繁地同步以保持数据最新

### 2. 每日全量同步（每天凌晨）

- **时间**：每天 3:00 AM（北京时间）
- **任务名**：`dailyFullSyncNFTs`
- **功能**：完整同步所有 NFT 记录，确保数据一致性

### 定时任务日志

定时任务会在应用日志中输出同步结果：

```
🔄 Starting periodic NFT sync from subgraph...
✅ Periodic NFT sync completed in 1234ms: totalEvents=100, synced=98, created=5, updated=93, errors=0
```

## 功能特点

### ✅ 优势

1. **高性能**：直接从索引数据库查询，无需扫描区块
2. **无 RPC 限流**：不依赖 RPC 节点，避免限流问题
3. **完整数据**：子图已索引所有历史事件
4. **实时同步**：子图自动同步新区块
5. **幂等性**：可以多次运行，不会产生重复数据
6. **自动定时**：系统自动定时同步，无需手动操作

### 📊 同步逻辑

1. **查询子图**：从 The Graph 子图获取所有 `NFTMinted` 事件
2. **获取当前所有者**：从链上查询每个 NFT 的当前所有者（可能因转移而改变）
3. **关联邀请码**：根据铸造时间和 minter 地址查找使用的邀请码
4. **更新数据库**：
   - 如果记录存在：更新（幂等性）
   - 如果记录不存在：创建新记录

### 🔄 数据字段

同步的数据包括：

- `nftId`: NFT ID
- `minterAddress`: 铸造者地址（从事件获取）
- `ownerAddress`: 当前所有者地址（从链上查询）
- `batchId`: 批次 ID（从事件获取）
- `mintTxHash`: 铸造交易哈希（从事件获取）
- `mintedAt`: 铸造时间（从事件获取）
- `inviteCodeId`: 使用的邀请码 ID（从数据库查询）

## 使用示例

### 手动同步

```bash
curl -X POST http://localhost:4000/admin/nfts/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 测试脚本

使用测试脚本测试同步功能：

```bash
npm run test:subgraph-sync
```

或直接运行：

```bash
npx tsx scripts/test-subgraph-sync.ts
```

### 查看定时任务状态

定时任务会在应用启动时自动注册。查看应用日志可以看到：

```
[Nest] INFO [NftsSchedulerService] Scheduled task "syncNFTsFromSubgraph" registered
[Nest] INFO [NftsSchedulerService] Scheduled task "dailyFullSyncNFTs" registered
```

## 故障排除

### 问题：SUBGRAPH_URL 未配置

**错误信息：**
```
SUBGRAPH_URL is not configured in environment variables
```

**解决方案：**
在 `.env` 文件中添加 `SUBGRAPH_URL` 配置。

### 问题：API Key 未配置（限流）

**现象：**
- 查询失败或返回限流错误
- 日志显示 "No API Key configured"

**解决方案：**
1. 在 The Graph Studio 创建 API Key
2. 在 `.env` 文件中添加 `SUBGRAPH_API_KEY`
3. 重启应用

**注意**：API Key 是可选的，但强烈推荐配置以避免限流。

### 问题：子图查询失败

**错误信息：**
```
Subgraph query failed: ...
```

**可能原因：**
1. 子图 URL 不正确
2. 子图未部署或未同步完成
3. 网络连接问题

**解决方案：**
1. 检查子图 URL 是否正确
2. 在 The Graph Studio 查看子图状态
3. 检查网络连接

### 问题：部分 NFT 同步失败

**可能原因：**
1. NFT 所有者查询失败（使用 minter 作为备用）
2. 数据库连接问题
3. 数据格式问题

**解决方案：**
查看日志中的错误信息，通常会自动使用备用值（如使用 minter 作为 owner）。

### 问题：定时任务未运行

**检查步骤：**
1. 确认应用已启动
2. 查看应用日志，确认定时任务已注册
3. 检查时区设置（默认：Asia/Shanghai）
4. 确认 ScheduleModule 已正确导入

## 迁移说明

### 从链上扫描迁移到子图

1. **配置子图 URL**：在 `.env` 中添加 `SUBGRAPH_URL`
2. **更新 API 调用**：使用 `POST /admin/nfts/sync` 替代 `POST /admin/nfts/sync/chain`
3. **验证数据**：运行同步后，验证数据库中的数据是否正确
4. **重启应用**：重启应用以启用定时任务

### 保留链上扫描作为备用

链上扫描方法（`syncNFTsFromChain`）仍然保留，但标记为 `@deprecated`。如果子图不可用，可以使用 `POST /admin/nfts/sync/chain` 作为备用方案。

## 性能对比

| 方式 | 查询时间 | RPC 调用 | 限流风险 | 自动化 |
|------|---------|---------|---------|--------|
| 子图同步 | ~1-5 秒 | 0（仅查询所有者） | 无 | ✅ 定时任务 |
| 链上扫描 | ~30-300 秒 | 大量 | 高 | ❌ 需手动 |

## 相关文档

- [The Graph 子图部署指南](../../subgraph/README.md)
- [子图使用指南](../../subgraph/USAGE.md)
- [子图快速开始](../../subgraph/QUICK_START.md)
