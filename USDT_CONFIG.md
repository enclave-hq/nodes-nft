# USDT 配置说明

## 📋 概述

不同网络使用不同的 USDT 合约：

- **本地节点 (localhost)**: 自动部署 `TestUSDT` 合约
- **BSC 测试网 (bscTestnet)**: 使用已部署的 `TestUSDT` 合约
- **BSC 主网 (bscMainnet)**: 使用 BSC 主网的官方 USDT 合约

## 🔍 各网络 USDT 地址

### 本地节点 (localhost)

**地址**: 部署时自动生成  
**类型**: `TestUSDT` 合约（自动部署）  
**说明**: `deploy.ts` 脚本会自动部署 TestUSDT 并铸造 10M USDT 给部署者

### BSC 测试网 (bscTestnet)

**地址**: `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34`  
**类型**: `TestUSDT` 合约（项目部署）  
**BSCScan**: https://testnet.bscscan.com/address/0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34  
**说明**: 
- 这是项目自己部署的 TestUSDT 合约
- 已铸造 100,000,000 USDT 给部署者
- 用于测试网测试

### BSC 主网 (bscMainnet)

**地址**: `0x55d398326f99059fF775485246999027B3197955`  
**类型**: BSC 官方 USDT 合约  
**BSCScan**: https://bscscan.com/address/0x55d398326f99059fF775485246999027B3197955  
**说明**: 这是 BSC 主网的官方 USDT 合约（BEP20）

## ⚠️ 重要提示

### 测试网配置错误

**之前的问题**: `env.testnet` 中错误地使用了主网 USDT 地址 `0x55d398326f99059fF775485246999027B3197955`

**已修复**: 现在使用正确的测试网 TestUSDT 地址 `0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34`

### 如何部署新的 TestUSDT

如果需要重新部署 TestUSDT 到测试网：

```bash
cd contracts
npx hardhat run scripts/01-deploy-usdt.ts --network bscTestnet
```

然后更新所有配置文件中的 `USDT_ADDRESS`。

## 📝 配置文件位置

需要更新 USDT 地址的配置文件：

1. **合约配置**:
   - `contracts/env.testnet`
   - `contracts/env.mainnet`
   - `contracts/env.localnode` (自动生成)

2. **前端配置**:
   - `frontend/lib/contracts/networkConfig.ts`
   - `frontend/env.testnet`
   - `frontend/.env.local` (用户配置)

3. **后端配置**:
   - `backend/env.testnet`
   - `backend/.env` (用户配置)

## 🔄 更新检查清单

- [x] `contracts/env.testnet` - 已更新为 TestUSDT 地址
- [x] `frontend/lib/contracts/networkConfig.ts` - 已更新测试网配置
- [x] `frontend/env.testnet` - 已更新
- [x] `backend/env.testnet` - 已更新

## 📚 相关文档

- [DEPLOYMENT_RESULTS.md](./contracts/DEPLOYMENT_RESULTS.md) - 部署结果详情
- [01-deploy-usdt.ts](./contracts/scripts/01-deploy-usdt.ts) - TestUSDT 部署脚本

