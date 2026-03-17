# 快速部署指南

## 1. 安装依赖

```bash
npm install
```

## 2. 生成代码

```bash
npm run codegen
```

## 3. 构建子图

```bash
npm run build
```

## 4. 在 The Graph Studio 创建子图

1. 访问 https://thegraph.com/studio/
2. 创建新子图，名称：`nft-minted`
3. 复制 **Deploy Key**

## 5. 身份验证

```bash
graph auth https://api.studio.thegraph.com/deploy/ <YOUR_DEPLOY_KEY>
```

## 6. 部署

```bash
graph deploy --node https://api.studio.thegraph.com/deploy/ nft-minted
```

或者：

```bash
npm run deploy
```

## 完成！

部署后，在 The Graph Studio 中等待子图同步完成，然后就可以使用 GraphQL API 查询数据了。
























