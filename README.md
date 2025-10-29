# Node NFT 代币生态系统

基于 BSC 的 NFT 代币分发平台，支持份额分割、双重收益机制、O(1) 全局索引优化。

## 项目结构

```
node-nft/
├── contracts/          # 智能合约（Hardhat 项目）
│   ├── contracts/      # Solidity 合约源码
│   ├── scripts/        # 部署脚本
│   ├── test/          # 合约测试
│   └── hardhat.config.ts
│
├── frontend/          # 前端应用（Next.js + wallet-sdk）
│   ├── src/
│   │   ├── components/  # React 组件
│   │   ├── hooks/       # 自定义 Hooks
│   │   ├── lib/         # 工具函数
│   │   └── pages/       # 页面
│   └── package.json
│
└── docs/              # 设计文档
    ├── design-story.md
    ├── scenario-walkthrough.md
    ├── requirements.md
    ├── contract-spec.md
    ├── technical-faq.md
    └── summary.md
```

## 核心特性

- ✅ **O(1) 全局索引** - 预言机分发 Gas 固定 ~30k
- ✅ **双重收益机制** - TKN 产出 + USDT 奖励
- ✅ **NFT 状态管理** - Live/Dissolved 双状态
- ✅ **链上份额市场** - P2P 转让 + 订单簿交易
- ✅ **分期解锁** - 1年后开始，25个月完成

## 快速开始

### 合约开发

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

## 文档

详细设计文档请查看 `../docs/node-nft/` 目录：
- [设计文档](../docs/node-nft/design-story.md)
- [场景演练](../docs/node-nft/scenario-walkthrough.md)
- [需求规格](../docs/node-nft/requirements.md)
- [合约规格](../docs/node-nft/contract-spec.md)
- [技术问答](../docs/node-nft/technical-faq.md)

## License

MIT

