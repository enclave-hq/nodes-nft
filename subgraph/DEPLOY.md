# The Graph 子图部署指南

## 当前状态

✅ 子图文件已创建完成
✅ ABI 文件已配置（使用本地 ABI，不依赖 Sourcify）
✅ 合约地址已配置：`0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
✅ 起始区块已设置：`69515099`

## 问题解决

The Graph CLI 无法从 Sourcify 获取 ABI（合约未验证），但我们已经手动配置了本地 ABI 文件。

## 部署步骤

### 1. 安装依赖

```bash
cd subgraph
npm install
```

### 2. 安装 The Graph CLI（如果还没有）

```bash
npm install -g @graphprotocol/graph-cli
```

### 3. 生成代码

```bash
npm run codegen
```

这会根据 `schema.graphql` 和 `subgraph.yaml` 生成 TypeScript 类型和映射函数。

### 4. 构建子图

```bash
npm run build
```

### 5. 部署到 The Graph Studio

#### 步骤 1：在 The Graph Studio 创建子图

1. 访问 https://thegraph.com/studio/
2. 登录你的账户
3. 点击 "Create a Subgraph"
4. 填写信息：
   - Subgraph slug: `nft-minted`（或你喜欢的名称）
   - 选择 "Smart Contract"
   - 选择 "ethereum"
5. 创建后会显示 **Deploy Key**，复制这个密钥

#### 步骤 2：身份验证

使用从 Studio 获取的 Deploy Key 进行身份验证：

```bash
graph auth https://api.studio.thegraph.com/deploy/ <YOUR_DEPLOY_KEY>
```

#### 步骤 3：部署子图

```bash
graph deploy --node https://api.studio.thegraph.com/deploy/ nft-minted
```

或者使用 npm 脚本：

```bash
npm run deploy
```

### 6. 验证部署

部署成功后，在 The Graph Studio 中：
1. 等待子图同步（可能需要几分钟到几小时，取决于历史事件数量）
2. 在 "Playground" 中测试查询：

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
    batchId
    mintPrice
    timestamp
    txHash
    blockNumber
  }
}
```

## 文件说明

- `subgraph.yaml` - 子图配置文件（合约地址、事件处理等）
- `schema.graphql` - 数据模型定义
- `src/mapping.ts` - 事件处理逻辑（将链上事件转换为实体）
- `abis/NFTManager.json` - 合约 ABI（包含 NFTMinted 事件定义）
- `package.json` - 依赖和脚本

## 注意事项

1. **起始区块**: 已设置为 `69515099`，这是合约部署的区块号，避免从头开始索引
2. **网络**: 当前配置为 `bsc`（BSC 主网）
3. **同步时间**: 首次部署后，子图需要时间同步历史数据，取决于历史事件数量
4. **API 端点**: 部署后，The Graph Studio 会提供一个 GraphQL API 端点，可以在后端代码中使用

## 在后端使用子图数据

部署完成后，可以在后端代码中查询子图：

```typescript
// 示例：查询某个地址的所有 NFT 铸造记录
const query = `
  query GetNFTMintsByMinter($minter: Bytes!) {
    nftMints(where: { minter: $minter }) {
      id
      nftId
      batchId
      mintPrice
      timestamp
      txHash
    }
  }
`;

const response = await fetch('YOUR_SUBGRAPH_API_URL', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query,
    variables: { minter: '0x...' }
  })
});
```

## 故障排除

### 问题：codegen 失败
- 检查 `subgraph.yaml` 格式是否正确
- 确认 `abis/NFTManager.json` 文件存在且格式正确

### 问题：build 失败
- 检查 `src/mapping.ts` 中的代码是否正确
- 确认所有导入的实体都在 `schema.graphql` 中定义

### 问题：部署失败
- 确认已登录 The Graph Studio
- 检查子图名称是否正确
- 查看错误日志获取详细信息

