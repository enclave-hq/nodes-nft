# 网络配置切换指南

## 概述

现在你可以通过一个简单的环境变量来切换测试网和主网配置，无需手动修改多个配置项。

## 快速开始

### 切换到测试网

在 `.env.local` 文件中设置：

```bash
NEXT_PUBLIC_NETWORK=testnet
```

### 切换到主网

在 `.env.local` 文件中设置：

```bash
NEXT_PUBLIC_NETWORK=mainnet
```

就这么简单！所有合约地址、RPC URL、链ID等配置都会自动切换。

## 配置详情

### 测试网配置 (BSC Testnet)

- **Chain ID**: 97
- **RPC URL**: https://data-seed-prebsc-1-s1.binance.org:8545
- **区块浏览器**: https://testnet.bscscan.com
- **合约地址**:
  - EnclaveToken: `0xCd0Ff5Fd00BD622563011A23091af30De24E7262`
  - NodeNFT: `0x92301C0acA7586d9F0B1968af2502616009Abf69`
  - NFTManager: `0xF87F9296955439C323ac79769959bEe087f6D06E`
  - USDT: `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34`

### 主网配置 (BSC Mainnet)

- **Chain ID**: 56
- **RPC URL**: https://bsc-dataseed1.binance.org
- **区块浏览器**: https://bscscan.com
- **合约地址**:
  - EnclaveToken: `0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc`
  - NodeNFT: `0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860`
  - NFTManager: `0xa5020E751277BbC90b7c8CdeAb4434b47F543d91`
  - USDT: `0x55d398326f99059fF775485246999027B3197955`

## 高级用法

### 覆盖特定配置

如果你需要覆盖某个特定的配置项（比如使用自定义的RPC节点），可以在 `.env.local` 中单独设置：

```bash
# 使用主网配置
NEXT_PUBLIC_NETWORK=mainnet

# 但使用自定义的RPC节点
NEXT_PUBLIC_RPC_URL=https://your-custom-rpc-node.com

# 或覆盖某个合约地址
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0xYourCustomAddress
```

环境变量会优先于预设配置，所以你可以灵活地混合使用。

## 配置文件位置

网络配置定义在 `lib/contracts/networkConfig.ts` 文件中。如果需要更新合约地址或添加新的网络配置，可以编辑该文件。

## 验证配置

启动应用后，在浏览器控制台中会看到类似以下的日志：

```
🔧 Initializing Web3 config: {...}
🌐 Active Network: BSC Testnet (Chain ID: 97)
```

这可以帮助你确认当前使用的网络配置。

## 注意事项

1. **重启开发服务器**: 修改 `.env.local` 后需要重启 Next.js 开发服务器才能生效
2. **生产环境**: 在生产环境中，这些配置需要在构建时通过环境变量设置
3. **默认值**: 如果没有设置 `NEXT_PUBLIC_NETWORK`，默认使用测试网配置

## 故障排除

### 配置没有生效

1. 确保 `.env.local` 文件在项目根目录
2. 重启开发服务器 (`npm run dev`)
3. 检查控制台日志确认使用的配置

### 需要更新合约地址

编辑 `lib/contracts/networkConfig.ts` 文件，更新对应的网络配置。






