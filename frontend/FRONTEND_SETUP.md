# Frontend Setup Guide

Complete guide for setting up and running the Node NFT frontend application.

---

## �� Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Development](#development)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This is a Next.js 15 application with:
- ✅ React 19
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ Ethers.js v6
- ✅ Multi-language support (en, zh, ja, ko)
- ✅ Wallet integration (MetaMask)

---

## 📦 Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask wallet extension
- (Optional) BSC Testnet BNB for testing

---

## 🚀 Installation

```bash
cd frontend
npm install
```

---

## ⚙️ Configuration

### 1. Create Environment File

```bash
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local`:

```bash
# Contract Addresses (from deployment)
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_NODE_NFT_ADDRESS=0x...
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_USDT_ADDRESS=0x...

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=97                                      # BSC Testnet
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_ENABLE_TESTNET=true

# For Mainnet (when ready):
# NEXT_PUBLIC_CHAIN_ID=56
# NEXT_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org
# NEXT_PUBLIC_ENABLE_TESTNET=false
```

### 3. MetaMask Configuration

**Add BSC Testnet:**
1. Open MetaMask
2. Click network dropdown → "Add Network" → "Add Manually"
3. Fill in:
   - **Network Name:** BSC Testnet
   - **RPC URL:** `https://data-seed-prebsc-1-s1.binance.org:8545`
   - **Chain ID:** `97`
   - **Currency Symbol:** `BNB`
   - **Block Explorer:** `https://testnet.bscscan.com`
4. Save

**Import Tokens:**
1. Click "Import tokens"
2. Paste USDT contract address
3. Paste $E (EnclaveToken) contract address

---

## 💻 Development

### Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

---

## 🌍 Multi-Language Support

The app supports 4 languages out of the box:
- 🇺🇸 English (en) - Default
- 🇨🇳 Chinese (zh)
- 🇯🇵 Japanese (ja)
- 🇰🇷 Korean (ko)

Language is automatically detected from browser settings or can be switched via the UI.

### Translation Files

Located in `messages/*.json`:
- `en.json` - English
- `zh.json` - Chinese
- `ja.json` - Japanese
- `ko.json` - Korean

---

## 🧪 Testing the Frontend

### Test Flow

1. **Connect Wallet**
   - Click "Connect Wallet"
   - Select MetaMask
   - Confirm connection to BSC Testnet

2. **Mint NFT**
   - Go to "Mint" page
   - Select NFT type (Standard/Premium)
   - Confirm USDT balance sufficient
   - Click "Mint NFT"
   - Approve USDT authorization (if needed)
   - Confirm mint transaction
   - Wait for confirmation

3. **View My NFTs**
   - Go to "My NFTs" page
   - See owned NFTs
   - Check pending rewards
   - Click "Claim" to claim rewards

4. **Use Marketplace**
   - Go to "Marketplace" page
   - Create sell order
   - Buy shares from orders
   - Cancel orders

---

## 🎨 Project Structure

```
frontend/
├── app/                      # Next.js app directory
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   ├── mint/                # Mint page
│   ├── my-nfts/             # My NFTs page
│   └── marketplace/         # Marketplace page
├── components/              # React components
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   └── ...
├── lib/
│   ├── contracts/           # ABIs & config
│   ├── hooks/               # Custom React hooks
│   ├── providers/           # Context providers
│   └── utils.ts             # Utility functions
├── messages/                # Translation files
│   ├── en.json
│   ├── zh.json
│   ├── ja.json
│   └── ko.json
└── public/                  # Static assets
```

---

## 🔧 Custom Hooks

The app provides custom hooks for easy blockchain interaction:

- `useWalletConnection()` - Wallet connection state
- `useContract(address, abi)` - Get contract instance
- `useBalance(address)` - Get token balance
- `useNFTs()` - Get user's NFTs
- `usePendingRewards(nftId)` - Get pending rewards
- And more...

---

## 🐛 Troubleshooting

### Issue 1: "Wrong Network"
**Problem:** MetaMask connected to wrong network  
**Solution:** Switch to BSC Testnet in MetaMask

### Issue 2: "Insufficient Balance"
**Problem:** Not enough USDT or BNB  
**Solution:** 
- Get test BNB from faucet
- Get test USDT from contract owner

### Issue 3: "Transaction Failed"
**Problem:** Transaction reverted  
**Solution:** 
- Check if USDT is approved
- Check if you have enough gas (BNB)
- Check error message for details

### Issue 4: "Page Not Loading"
**Problem:** Contract addresses not set  
**Solution:** Check `.env.local` has all addresses

### Issue 5: "Translations Not Working"
**Problem:** Language files not loading  
**Solution:** 
- Restart dev server
- Check `messages/*.json` files exist
- Check browser console for errors

---

## 📊 Performance

### Build Output

```bash
npm run build

# Expected output:
✓ Compiled successfully
✓ Linting and checking types
✓ Collecting page data
✓ Generating static pages (16 pages)
✓ Finalizing page optimization

File sizes:
  ○ / (Home page)           ~15 KB
  ○ /mint                   ~20 KB
  ○ /my-nfts               ~25 KB
  ○ /marketplace           ~30 KB
```

---

## 🚀 Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or push to GitHub and connect to Vercel dashboard
```

### Environment Variables on Vercel

Don't forget to add all environment variables in Vercel dashboard:
- NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS
- NEXT_PUBLIC_NODE_NFT_ADDRESS
- NEXT_PUBLIC_NFT_MANAGER_ADDRESS
- NEXT_PUBLIC_USDT_ADDRESS
- NEXT_PUBLIC_CHAIN_ID
- NEXT_PUBLIC_RPC_URL

---

## �� Code Standards

See [CODE_STANDARDS.md](../CODE_STANDARDS.md) for:
- TypeScript conventions
- React best practices
- Component structure
- Naming conventions

---

## 🔗 Related Documentation

- **[Contract Testing](../contracts/TESTING.md)** - Smart contract testing
- **[CODE_STANDARDS.md](../CODE_STANDARDS.md)** - Coding standards
- **[Main README.md](../README.md)** - Project overview

---

**Happy coding!** 🎉
