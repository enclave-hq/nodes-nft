/**
 * Contract addresses configuration
 */
export const CONTRACT_ADDRESSES = {
  enclaveToken: process.env.NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS as `0x${string}`,
  nodeNFT: process.env.NEXT_PUBLIC_NODE_NFT_ADDRESS as `0x${string}`,
  nftManager: process.env.NEXT_PUBLIC_NFT_MANAGER_ADDRESS as `0x${string}`,
  usdt: process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`,
} as const;

/**
 * Network configuration
 */
export const NETWORK_CONFIG = {
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "97"),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://data-seed-prebsc-2-s1.binance.org:8545/",
  blockExplorer: process.env.NEXT_PUBLIC_CHAIN_ID === "56"
    ? "https://bscscan.com"
    : "https://testnet.bscscan.com",
  isTestnet: process.env.NEXT_PUBLIC_ENABLE_TESTNET === "true",
} as const;

// Fallback RPC node list, sorted by reliability
export const FALLBACK_RPC_URLS = [
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://data-seed-prebsc-1-s2.binance.org:8545", 
  "https://data-seed-prebsc-2-s2.binance.org:8545",
  "https://data-seed-prebsc-1-s3.binance.org:8545",
  "https://data-seed-prebsc-2-s3.binance.org:8545",
  "https://data-seed-prebsc-1-s1.binance.org:8545", // Original main node as last fallback
] as const;

/**
 * NFT type enumeration (must match contract)
 */
export enum NFTType {
  Standard = 0,
  Premium = 1,
}

/**
 * NFT status enumeration (must match contract)
 */
export enum NFTStatus {
  Live = 0,
  Dissolved = 1,
}

/**
 * NFT configuration (must match contract)
 */
export const NFT_CONFIG = {
  [NFTType.Standard]: {
    name: "Standard Node",
    mintPrice: "10000", // 10,000 USDT
    eLockAmount: "20000", // 20,000 $E
    shareWeight: 1,
    sharesPerNFT: 10,
  },
  [NFTType.Premium]: {
    name: "Premium Node",
    mintPrice: "50000", // 50,000 USDT
    eLockAmount: "100000", // 100,000 $E
    shareWeight: 6,
    sharesPerNFT: 10,
  },
} as const;

/**
 * Unlock constants (must match contract)
 */
export const UNLOCK_CONFIG = {
  lockPeriod: 365 * 24 * 60 * 60, // 365 days in seconds
  unlockInterval: 30 * 24 * 60 * 60, // 30 days in seconds
  unlockPeriods: 25, // 25 months
  unlockPercentage: 4, // 4% per month
} as const;

/**
 * Token decimals
 */
export const TOKEN_DECIMALS = {
  E: 18,
  USDT: 18, // BSC USDT uses 18 decimals
} as const;

/**
 * Gas configuration for BSC Testnet
 */
export const GAS_CONFIG = {
  // Gas price for BSC Testnet (in wei)
  gasPrice: "300000000", // 0.3 Gwei = 300000000 wei
  // Gas limits for different operations
  gasLimits: {
    erc20Transfer: 21000,
    erc20Approve: 100000, // Increased USDT approval gas limit
    contractCall: 200000, // Increased general contract call gas limit
    createSellOrder: 500000, // Creating sell orders requires more gas (increased from 300k to 500k)
    buyShares: 400000, // Buying shares requires more gas
    mintNFT: 500000, // Increased mintNFT gas limit
  },
} as const;
