# NFT Manager Subgraph

The Graph 子图，用于索引 NFT Manager 合约的 NFTMinted 事件。

## 功能

- 索引所有 `NFTMinted` 事件
- 支持单个 mint 和批量 mint（batchMintNFT 会触发多个 NFTMinted 事件）

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置合约地址和起始区块

编辑 `subgraph.yaml`：
- `address`: 合约地址（NFT_MANAGER_ADDRESS）
- `startBlock`: 合约部署的区块号（可选，设置为 0 表示从合约部署开始）

### 3. 生成代码

```bash
npm run codegen
```

### 4. 构建子图

```bash
npm run build
```

### 5. 部署到 The Graph Studio

1. 访问 https://thegraph.com/studio/
2. 创建新子图
3. 获取部署命令（类似：`graph deploy --studio nft-manager-subgraph`）
4. 运行部署命令

### 6. 查询子图

部署后，可以使用 GraphQL 查询：

```graphql
{
  nftMints(
    first: 100
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

## 查询示例

### 获取所有 NFT 铸造记录

```graphql
{
  nftMints {
    id
    nftId
    minter
    batchId
    mintPrice
    timestamp
  }
}
```

### 按 minter 地址查询

```graphql
{
  nftMints(where: { minter: "0x..." }) {
    id
    nftId
    batchId
    timestamp
  }
}
```

### 按 batchId 查询

```graphql
{
  nftMints(where: { batchId: "1" }) {
    id
    nftId
    minter
    timestamp
  }
}
```

### 查询最近的事件

```graphql
{
  nftMints(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    nftId
    minter
    timestamp
  }
}
```

## 注意事项

1. **起始区块**: 如果合约已经部署，建议设置 `startBlock` 为合约部署的区块号，避免从头开始索引
2. **网络**: 当前配置为 BSC (bsc)，如需其他网络需要修改 `subgraph.yaml` 中的 `network`
3. **同步时间**: 首次部署后，子图需要时间同步历史数据，取决于历史事件数量





