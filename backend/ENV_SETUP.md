# 环境配置设置指南

## 📋 概述

本项目使用环境变量来配置不同网络（本地、测试网、主网）的合约地址和其他设置。

## 🚀 快速开始

### 1. 选择网络配置

根据你要部署的网络，复制对应的环境文件：

```bash
# 测试网
cp env.testnet .env

# 主网（部署后生成）
cp ../contracts/env.mainnet .env

# 本地节点
cp ../contracts/env.localnode .env
```

### 2. 配置必需的后端变量

打开 `.env` 文件，设置以下必需变量：

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@localhost:5432/nft_db

# JWT 密钥
JWT_SECRET=your-secret-key-change-this-in-production

# 管理员私钥（用于合约调用）
ADMIN_PRIVATE_KEY=0x...
```

### 3. 验证配置

```bash
# 验证 Diamond Pattern 连接
npm run verify-diamond
```

## 📝 环境变量说明

### 网络配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `NETWORK` | 网络名称 | `bscTestnet`, `bscMainnet`, `localhost` |
| `CHAIN_ID` | 链 ID | `97` (BSC Testnet), `56` (BSC Mainnet) |
| `RPC_URL` | RPC 节点 URL | `https://data-seed-prebsc-1-s1.binance.org:8545` |

### 合约地址（Diamond Pattern）

| 变量 | 说明 | 必需 |
|------|------|------|
| `NFT_MANAGER_ADDRESS` | NFTManager (Diamond) 地址 | ✅ 必需 |
| `NODE_NFT_ADDRESS` | NodeNFT 合约地址 | ✅ 必需 |
| `ECLV_ADDRESS` | EnclaveToken 合约地址 | ✅ 必需 |
| `USDT_ADDRESS` | USDT 合约地址 | ✅ 必需 |
| `ORACLE_ADDRESS` | Oracle 地址 | ✅ 必需 |
| `TREASURY_ADDRESS` | Treasury 地址 | ✅ 必需 |

**注意**：所有功能（NFTManager、Marketplace、RewardDistributor）都通过 `NFT_MANAGER_ADDRESS` 访问。

### Facets 地址（参考用）

这些地址通常不需要直接使用，但可以用于调试和验证：

- `NFT_MANAGER_CUT_FACET` - Facet 管理
- `NFT_MANAGER_LOUPE_FACET` - Facet 查询
- `NFT_MANAGER_FACET` - NFT 核心功能
- `MARKETPLACE_FACET` - 市场功能
- `REWARD_FACET` - 奖励功能
- `ADMIN_FACET` - 管理功能

### 后端配置

| 变量 | 说明 | 必需 | 默认值 |
|------|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ 必需 | - |
| `JWT_SECRET` | JWT 签名密钥 | ✅ 必需 | - |
| `JWT_EXPIRES_IN` | JWT 过期时间 | ❌ | `7d` |
| `ADMIN_PRIVATE_KEY` | 管理员私钥（合约调用） | ✅ 必需 | - |
| `PORT` | 服务端口 | ❌ | `4000` |
| `FRONTEND_URL` | 前端 URL（CORS） | ❌ | `http://localhost:3000` |

## 🔐 安全注意事项

### 1. 私钥安全

⚠️ **永远不要将私钥提交到版本控制！**

```bash
# 确保 .env 在 .gitignore 中
echo ".env" >> .gitignore

# 使用环境变量或密钥管理服务
export ADMIN_PRIVATE_KEY=0x...
```

### 2. JWT 密钥

使用强随机字符串作为 JWT 密钥：

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 数据库密码

使用强密码，并限制数据库访问权限。

## 📂 文件结构

```
backend/
├── env.testnet          # 测试网配置模板
├── env.mainnet          # 主网配置（部署后生成）
├── env.localnode        # 本地节点配置（部署后生成）
├── .env                 # 实际使用的配置文件（不提交到版本控制）
└── .env.example         # 示例文件（可以提交）
```

## 🔄 更新配置

### 更新合约地址

如果合约重新部署，更新对应的环境文件：

```bash
# 1. 从部署脚本生成新的环境文件
cd ../contracts
npx hardhat run scripts/deploy.ts --network bscTestnet

# 2. 复制到后端
cp env.testnet ../backend/env.testnet

# 3. 更新 .env
cd ../backend
cp env.testnet .env
```

### 添加新变量

1. 在对应的 `env.*` 文件中添加
2. 在 `.env.example` 中添加（带示例值）
3. 在 `ENV_SETUP.md` 中更新文档

## ✅ 验证清单

使用环境配置前，确认：

- [ ] `.env` 文件已创建
- [ ] `NFT_MANAGER_ADDRESS` 已设置
- [ ] `RPC_URL` 已设置且可访问
- [ ] `ADMIN_PRIVATE_KEY` 已设置（用于合约调用）
- [ ] `DATABASE_URL` 已设置且可连接
- [ ] `JWT_SECRET` 已设置
- [ ] 运行 `npm run verify-diamond` 通过

## 🆘 故障排除

### 问题：合约调用失败

**检查：**
1. `NFT_MANAGER_ADDRESS` 是否正确
2. `RPC_URL` 是否可访问
3. `ADMIN_PRIVATE_KEY` 是否正确
4. 私钥对应的地址是否有足够的 gas

### 问题：数据库连接失败

**检查：**
1. `DATABASE_URL` 格式是否正确
2. 数据库服务是否运行
3. 网络连接是否正常

### 问题：JWT 验证失败

**检查：**
1. `JWT_SECRET` 是否设置
2. 前后端是否使用相同的 `JWT_SECRET`

## 📚 相关文档

- [DIAMOND_PATTERN_GUIDE.md](./DIAMOND_PATTERN_GUIDE.md) - Diamond Pattern 使用指南
- [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) - 迁移检查清单
- [../../contracts/scripts/README_DEPLOY.md](../../contracts/scripts/README_DEPLOY.md) - 部署文档

