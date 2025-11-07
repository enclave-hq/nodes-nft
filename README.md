# Node NFT Token Ecosystem

> **Languages:** [English](README.md) | [中文](README.zh.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

BSC-based NFT token distribution platform with share splitting, dual reward mechanism, and O(1) global index optimization.

## Project Structure

```
node-nft/
├── contracts/          # Smart Contracts (Hardhat project)
│   ├── contracts/      # Solidity contract source code
│   ├── scripts/        # Deployment scripts
│   ├── test/          # Contract tests
│   └── hardhat.config.ts
│
├── frontend/          # Frontend Application (Next.js + wallet-sdk)
│   ├── app/           # Next.js App Router
│   ├── components/    # React components
│   ├── lib/           # Utility functions, hooks, stores
│   └── package.json
│
├── backend/           # Management Backend Service (NestJS/Express)
│   ├── src/           # Backend source code
│   │   ├── modules/   # Feature modules (auth, invite-codes, users, etc.)
│   │   └── config/    # Configuration files
│   └── package.json
│
└── docs/              # Design documentation (in frontend/docs/ directory)
```

## Core Features

- ✅ **O(1) Global Index** - Oracle distribution with fixed ~30k Gas
- ✅ **Dual Reward Mechanism** - TKN production + USDT rewards
- ✅ **NFT Status Management** - Live/Dissolved dual states
- ✅ **On-chain Share Market** - P2P transfer + order book trading
- ✅ **Phased Unlock** - Starts after 1 year, completes in 25 months

## Quick Start

### Contract Development

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Backend Development (Management)

```bash
cd backend
npm install
npm run dev
```

## Documentation

For detailed design documentation, please refer to the `../docs/node-nft/` directory:
- [Design Document](../docs/node-nft/design-story.md)
- [Scenario Walkthrough](../docs/node-nft/scenario-walkthrough.md)
- [Requirements Specification](../docs/node-nft/requirements.md)
- [Contract Specification](../docs/node-nft/contract-spec.md)
- [Technical FAQ](../docs/node-nft/technical-faq.md)

## License

MIT

