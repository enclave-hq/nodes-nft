# BSC Mainnet 配置说明

本文档包含从 `docker-compose.yaml` 提取的正式网（BSC Mainnet）配置。

## 📋 配置来源

配置从 `docker-compose.yaml` 文件中提取，用于生产环境部署。

## 🌐 网络配置

- **网络名称**: BSC Mainnet
- **Chain ID**: 56
- **RPC URL**: `https://bsc-rpc.publicnode.com` (主)
- **备用 RPC URLs**:
  - `https://bsc-dataseed1.binance.org`
  - `https://bsc-dataseed2.binance.org`
  - `https://bsc-dataseed3.binance.org`
  - `https://bsc-dataseed4.binance.org`
  - `https://bsc-dataseed.binance.org`
- **区块浏览器**: `https://bscscan.com`

## 📝 合约地址

### 核心合约

- **NFT Manager (Diamond)**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
  - 所有功能通过此地址访问（Diamond Pattern）
  
- **Node NFT**: `0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b`
  
- **Enclave Token ($E)**: `0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011`
  
- **USDT Token**: `0x55d398326f99059fF775485246999027B3197955`
  - BSC 主网 USDT 标准地址
  
- **Token Vesting**: `0x67B8927F0835e79632f4622F017915Cb0B9a6c72`

### 角色地址

- **Oracle**: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`
- **Treasury**: `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6`

### Facets 地址（参考用）

- **Cut Facet**: `0xA9BFe1a83F481BC97257bDf8e2E6014Ce38FB2D9`
- **Loupe Facet**: `0x90c7520a4652F6B1E585a92dC1829d269624183a`
- **Init**: `0x2F02E6a4105a447f5fe3C93834d82AAaB2271919`
- **NFT Manager Facet**: `0x499411186D71256956043855F89BDa007B9887C0`
- **Marketplace Facet**: `0x0Ad73B10cA0B5cF3bfa3D5718497b764F78e85B2`
- **Reward Facet**: `0xEB6aFa9855D2c717e7667599568c22c991Bbe19c`
- **Admin Facet**: `0x838fCA63D99d8580a7BF415dF4a91D3269DdE12A`

## 🔧 环境变量配置

### Frontend (.env.local)

```bash
# Network Configuration
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_RPC_URL=https://bsc-rpc.publicnode.com

# Contract Addresses
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011
NEXT_PUBLIC_NODE_NFT_ADDRESS=0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0xD9eA9F4B8F24872262568fB2C6133117EC02C774
NEXT_PUBLIC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# Feature Flags
NEXT_PUBLIC_ENABLE_TESTNET=false
NEXT_PUBLIC_API_URL=https://nodes-back.enclave-hq.com/api
```

### Backend (.env)

```bash
# Network Configuration
NETWORK=bscMainnet
CHAIN_ID=56
RPC_URL=https://bsc-rpc.publicnode.com

# Contract Addresses
NFT_MANAGER_ADDRESS=0xD9eA9F4B8F24872262568fB2C6133117EC02C774
ENCLAVE_TOKEN_ADDRESS=0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011
USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
NODE_NFT_ADDRESS=0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b

# Service Configuration
PORT=4000
FRONTEND_URL=https://nodes.enclave-hq.com,http://localhost:4001,http://frontend:4001
```

## 📦 Docker Compose 配置

在 `docker-compose.yaml` 中，这些配置已经设置为默认值：

```yaml
backend:
  environment:
    NFT_MANAGER_ADDRESS: ${NFT_MANAGER_ADDRESS:-0xD9eA9F4B8F24872262568fB2C6133117EC02C774}
    ENCLAVE_TOKEN_ADDRESS: ${ENCLAVE_TOKEN_ADDRESS:-0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011}
    USDT_TOKEN_ADDRESS: ${USDT_TOKEN_ADDRESS:-0x55d398326f99059fF775485246999027B3197955}
    RPC_URL: ${RPC_URL:-https://bsc-dataseed1.binance.org/}

frontend:
  environment:
    NEXT_PUBLIC_NFT_MANAGER_ADDRESS: ${NEXT_PUBLIC_NFT_MANAGER_ADDRESS:-0xD9eA9F4B8F24872262568fB2C6133117EC02C774}
    NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS: ${NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS:-0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011}
    NEXT_PUBLIC_NODE_NFT_ADDRESS: ${NEXT_PUBLIC_NODE_NFT_ADDRESS:-0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b}
    NEXT_PUBLIC_USDT_ADDRESS: ${NEXT_PUBLIC_USDT_ADDRESS:-0x55d398326f99059fF775485246999027B3197955}
    NEXT_PUBLIC_CHAIN_ID: ${NEXT_PUBLIC_CHAIN_ID:-56}
    NEXT_PUBLIC_RPC_URL: ${NEXT_PUBLIC_RPC_URL:-https://bsc-dataseed1.binance.org/}
```

## ✅ 配置已更新

以下文件已更新为主网配置：

1. ✅ `frontend/lib/contracts/networkConfig.ts` - MAINNET_CONFIG 已更新
2. ✅ 支持 `bscMainnet` 作为 `mainnet` 的别名
3. ✅ blockExplorer 已修复为使用动态配置

## 🔍 验证配置

启动应用后，在浏览器控制台应该看到：

```
📋 Active Network Config: {
  name: "BSC Mainnet",
  chainId: 56,
  rpcUrl: "https://bsc-rpc.publicnode.com",
  blockExplorer: "https://bscscan.com",
  isTestnet: false,
  ...
}

🌐 Active Network: BSC Mainnet (Chain ID: 56)
```

## 📌 注意事项

1. **重启服务**: 修改配置后需要重启开发服务器或 Docker 容器
2. **环境变量优先级**: 环境变量会覆盖代码中的默认配置
3. **Docker 部署**: 使用 `docker-compose.yaml` 时，配置会自动从环境变量读取
4. **生产环境**: 确保在生产环境中正确设置所有环境变量



























