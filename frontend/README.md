# Enclave Node NFT Frontend

Modern Next.js 14 frontend for the Enclave Node NFT platform with wallet integration and smart contract interactions.

## Features

- ✅ **Next.js 14** with App Router
- ✅ **TypeScript** for type safety
- ✅ **Tailwind CSS** for styling
- ✅ **Wallet SDK** for blockchain interactions
- ✅ **React Query** for data fetching and caching
- ✅ **Wallet Connection** (MetaMask, etc.)
- ✅ **BSC Network** support (Testnet & Mainnet)

## Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── mint/              # NFT minting page
│   ├── my-nfts/           # User's NFT dashboard
│   └── marketplace/       # Share marketplace
├── components/            # React components
│   ├── Navbar.tsx        # Navigation bar
│   └── ...               # Other components
├── lib/                   # Core library code
│   ├── contracts/        # Contract ABIs and config
│   ├── hooks/            # Custom React hooks
│   ├── providers/        # Context providers
│   └── utils.ts          # Utility functions
└── public/               # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp env.example .env.local

# Update .env.local with your contract addresses
# NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=0x...
# NEXT_PUBLIC_NODE_NFT_ADDRESS=0x...
# NEXT_PUBLIC_NFT_MANAGER_ADDRESS=0x...
# NEXT_PUBLIC_USDT_ADDRESS=0x...
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Smart Contract Integration

### Hooks Available

#### Wallet
- `useWallet()` - Wallet connection and account info
- `useContracts()` - Contract instances for write operations
- `useReadOnlyContracts()` - Read-only contract instances

#### NFT Management
- `useMintNFT()` - Mint new NFT
- `useUserNFTs()` - Get user's NFT list
- `useNFTPool()` - Get NFT pool data
- `useUserShare()` - Get user's share in an NFT
- `usePendingProduced()` - Get pending ECLV production
- `usePendingReward()` - Get pending rewards
- `useClaimProduced()` - Claim ECLV production
- `useClaimReward()` - Claim rewards
- `useBatchClaimProduced()` - Batch claim from multiple NFTs
- `useTransferShares()` - Transfer shares P2P
- `useProposeDissolution()` - Propose NFT dissolution
- `useApproveDissolution()` - Approve dissolution
- `useWithdrawUnlocked()` - Withdraw unlocked tokens

#### Balances
- `useBalances()` - Get ECLV and USDT balances
- `useBNBBalance()` - Get BNB balance

### Example Usage

```tsx
import { useWallet } from "@/lib/providers/WalletProvider";
import { useMintNFT, useUserNFTs } from "@/lib/hooks/useNFTManager";
import { NFTType } from "@/lib/contracts/config";

function MintPage() {
  const { isConnected } = useWallet();
  const { data: nftIds } = useUserNFTs();
  const mintNFT = useMintNFT();

  const handleMint = async () => {
    try {
      const result = await mintNFT.mutateAsync({ nftType: NFTType.Standard });
      console.log("Minted NFT:", result.nftId);
    } catch (error) {
      console.error("Mint failed:", error);
    }
  };

  return (
    <div>
      {isConnected ? (
        <button onClick={handleMint}>
          Mint NFT
        </button>
      ) : (
        <p>Please connect your wallet</p>
      )}
      <p>You have {nftIds?.length || 0} NFTs</p>
    </div>
  );
}
```

## Utilities

### Format Functions

```tsx
import {
  formatAddress,
  formatTokenAmount,
  formatUSD,
  formatDate,
  formatDateTime,
} from "@/lib/utils";

// Format wallet address
formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb") 
// => "0x742d...0bEb"

// Format token amount (from wei)
formatTokenAmount(BigInt("1000000000000000000"), 18, 2) 
// => "1.00"

// Format USD
formatUSD(10000) 
// => "$10,000.00"

// Format timestamp
formatDate(1700000000) 
// => "Nov 14, 2023"
```

## Network Configuration

The app supports both BSC Testnet and Mainnet. Configure in `.env.local`:

**BSC Testnet:**
```
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
```

**BSC Mainnet:**
```
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org/
```

## Pages

### Home (`/`)
- Hero section with CTA
- Feature overview
- NFT type comparison
- User stats (if connected)

### Mint (`/mint`)
- NFT type selection
- Balance checks
- Token approvals
- Minting interface

### My NFTs (`/my-nfts`)
- NFT list
- Pending rewards display
- Claim interface
- Share transfer
- NFT details

### Marketplace (`/marketplace`)
- Browse available share listings
- Create sell orders
- Buy shares
- Order management

## Styling

Uses Tailwind CSS with custom configuration. Key design elements:

- **Colors**: Blue (primary), Purple (accent), Gray (neutral)
- **Typography**: Inter font family
- **Components**: Buttons, cards, forms with consistent styling
- **Responsive**: Mobile-first design

## Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Type checking
npm run type-check   # Run TypeScript compiler
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Note:** MetaMask or compatible wallet required

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

See main project LICENSE

---

**Built with ❤️ for the Enclave ecosystem**
