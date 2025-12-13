# The Graph API Key 配置指南

## 📋 概述

The Graph Studio 的 API 需要 API Key 来避免限流。免费计划每月提供 100,000 次查询。

## 🔑 获取 API Key

### 步骤 1：访问 The Graph Studio

访问：https://thegraph.com/studio/

### 步骤 2：登录账户

使用你的账户登录（如果没有账户，需要先注册）。

### 步骤 3：选择子图

在子图列表中找到 `nft-minted` 子图，点击进入。

### 步骤 4：创建 API Key

1. 在子图详情页面，找到 **"API Keys"** 部分
2. 点击 **"Create API Key"**
3. 输入 API Key 名称（例如：`production` 或 `backend`）
4. 复制生成的 API Key（格式类似：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

⚠️ **重要**：API Key 只显示一次，请妥善保存！

## ⚙️ 配置 API Key

### 在 `.env` 文件中添加

```bash
# The Graph Subgraph Configuration
SUBGRAPH_URL=https://api.studio.thegraph.com/query/1718673/nft-minted/v1
SUBGRAPH_API_KEY=your-api-key-here
```

### 验证配置

重启应用后，查看日志：

```
🔄 Starting NFT sync from The Graph subgraph...
📡 Subgraph URL: https://api.studio.thegraph.com/query/1718673/nft-minted/v1
🔑 Using API Key: xxxxxxxx...
```

如果看到 `🔑 Using API Key`，说明配置成功。

## ⚠️ 注意事项

### API Key 是可选的

- **不配置 API Key**：可以正常使用，但可能遇到限流
- **配置 API Key**：避免限流，推荐生产环境使用

### 免费计划限制

- **查询次数**：每月 100,000 次免费查询
- **超出限制**：
  - 超出部分按每百万次查询约 40 美元计费（每次查询约 0.00002 美元）
  - 可通过 GRT 代币或信用卡支付
  - 查询成本可能因使用情况和支付方式有所不同
- **适用场景**：业余爱好者、黑客马拉松参与者、副项目开发者

### 使用量估算

当前配置（每30分钟同步一次）：
- **每天同步次数**：48 次（24 小时 × 2）
- **每月同步次数**：约 1,440 次（30 天 × 48）
- **每次查询**：1 次 GraphQL 查询
- **每月总查询**：约 1,440 次

**结论**：当前使用量远低于免费限额（100,000 次/月），可以放心使用。

### 安全建议

1. **不要提交到版本控制**：确保 `.env` 文件在 `.gitignore` 中
2. **使用不同环境**：测试网和主网使用不同的 API Key
3. **定期轮换**：定期更新 API Key 以提高安全性

## 🔍 故障排除

### 问题：API Key 无效

**错误信息：**
```
Subgraph query failed: Unauthorized
```

**解决方案：**
1. 检查 API Key 是否正确复制（没有多余空格）
2. 确认 API Key 是否已激活
3. 在 The Graph Studio 重新创建 API Key

### 问题：达到查询限制

**错误信息：**
```
Subgraph query failed: Rate limit exceeded
```

**解决方案：**
1. 检查本月查询次数是否超过 100,000
2. 等待下个月重置，或升级到付费计划
3. 优化查询频率（减少定时任务执行次数）

### 问题：API Key 未使用

**检查方法：**
查看应用日志，如果看到：
```
⚠️  No API Key configured (may hit rate limits)
```

说明 API Key 未正确配置，检查 `.env` 文件中的 `SUBGRAPH_API_KEY` 设置。

## 📚 相关文档

- [The Graph Studio 文档](https://thegraph.com/docs/en/studio/)
- [API Key 管理](https://thegraph.com/docs/en/studio/managing-api-keys/)
- [查询限制说明](https://thegraph.com/docs/en/studio/querying/)

