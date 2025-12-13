# 子图使用指南

## ✅ 部署成功

子图已成功部署到 The Graph Studio！

**GraphQL API 端点：**
```
https://api.studio.thegraph.com/query/1718673/nft-minted/v1
```

## 📊 检查同步状态

子图需要时间同步历史数据。可以通过以下方式检查：

### 方式 1：在 The Graph Studio 查看

访问：https://thegraph.com/studio/subgraph/nft-minted

在 Dashboard 中可以看到：
- **Current Block**: 当前同步到的区块号
- **Synced**: 是否已同步完成
- **Health**: 子图健康状态

### 方式 2：通过 GraphQL 查询

```graphql
{
  _meta {
    block {
      number
    }
  }
}
```

这会返回当前同步到的区块号。如果返回的区块号接近最新区块，说明同步完成。

## 🔍 查询示例

### 1. 查询所有 NFT 铸造记录（最近 10 条）

```graphql
{
  nftmints(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    nftId
    minter
    batchId
    mintPrice
    timestamp
    txHash
    blockNumber
  }
}
```

### 2. 查询特定地址的所有 NFT

```graphql
{
  nftmints(
    where: { minter: "0x4e989201be2216bca9332ca5587910cfc0cde268" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    nftId
    batchId
    mintPrice
    timestamp
    txHash
  }
}
```

### 3. 查询特定 batchId 的所有 NFT

```graphql
{
  nftmints(
    where: { batchId: "1" }
    orderBy: nftId
  ) {
    id
    nftId
    minter
    timestamp
  }
}
```

### 4. 查询时间范围内的 NFT

```graphql
{
  nftmints(
    where: {
      timestamp_gte: "1700000000"
      timestamp_lte: "1701000000"
    }
    orderBy: timestamp
  ) {
    id
    nftId
    minter
    batchId
    timestamp
  }
}
```

### 5. 统计信息

```graphql
{
  nftmints(
    first: 1
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    nftId
  }
  _meta {
    block {
      number
    }
  }
}
```

## 🔌 在后端集成

### TypeScript/Node.js 示例

```typescript
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718673/nft-minted/v1';

async function querySubgraph(query: string, variables?: any) {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

// 查询某个地址的所有 NFT
async function getNFTsByMinter(minter: string) {
  const query = `
    query GetNFTsByMinter($minter: Bytes!) {
      nftmints(where: { minter: $minter }) {
        id
        nftId
        batchId
        mintPrice
        timestamp
        txHash
      }
    }
  `;
  const result = await querySubgraph(query, { minter });
  return result.data.nftmints;
}

// 查询所有 NFT（分页）
async function getAllNFTs(first: number = 100, skip: number = 0) {
  const query = `
    query GetAllNFTs($first: Int!, $skip: Int!) {
      nftmints(
        first: $first
        skip: $skip
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        nftId
        minter
        batchId
        mintPrice
        timestamp
      }
    }
  `;
  const result = await querySubgraph(query, { first, skip });
  return result.data.nftmints;
}
```

### 替换后端同步逻辑

现在可以替换 `syncNFTsFromChain` 方法，直接查询子图：

```typescript
// 在 nfts.service.ts 中
async syncNFTsFromSubgraph(): Promise<{
  totalEvents: number;
  synced: number;
  created: number;
  updated: number;
  errors: number;
}> {
  const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718673/nft-minted/v1';
  
  // 查询所有 NFT 铸造记录
  const query = `
    {
      nftmints(orderBy: timestamp, orderDirection: asc) {
        id
        nftId
        minter
        batchId
        mintPrice
        timestamp
        txHash
        blockNumber
      }
    }
  `;
  
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  
  const result = await response.json();
  const events = result.data.nftmints;
  
  // 处理每个事件，同步到数据库
  // ... 同步逻辑
}
```

## ⚠️ 注意事项

1. **同步时间**: 首次部署后，子图需要时间同步历史数据（从区块 69515099 到现在）
2. **实时性**: 子图会实时同步新区块，但可能有几分钟延迟
3. **查询限制**: The Graph Studio 免费版有查询限制，生产环境建议使用托管服务
4. **数据验证**: 建议定期对比子图数据和链上数据，确保一致性

## 🚀 下一步

1. **等待同步完成**: 在 Studio Dashboard 查看同步进度
2. **测试查询**: 使用上面的查询示例测试 API
3. **集成后端**: 在后端代码中使用子图 API 替换链上扫描逻辑
4. **监控**: 定期检查子图健康状态和同步情况

