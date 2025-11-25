/**
 * Network configuration management
 * 
 * This module automatically selects the correct network configuration
 * based on NEXT_PUBLIC_NETWORK environment variable.
 * 
 * To switch networks, simply set NEXT_PUBLIC_NETWORK in your .env.local:
 *   - NEXT_PUBLIC_NETWORK=testnet  (for BSC Testnet)
 *   - NEXT_PUBLIC_NETWORK=mainnet  (for BSC Mainnet)
 * 
 * All other contract addresses and network settings will be automatically
 * configured based on this single variable.
 */
import { getNetworkConfig, getCurrentNetworkType, type NetworkConfig } from './networkConfig';

// Get the active network configuration
const activeNetworkConfig: NetworkConfig = getNetworkConfig();

/**
 * Contract addresses configuration
 * Automatically configured based on NEXT_PUBLIC_NETWORK
 */
export const CONTRACT_ADDRESSES = {
  enclaveToken: (
    process.env.NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS || 
    activeNetworkConfig.contracts.enclaveToken
  ) as `0x${string}`,
  nodeNFT: (
    process.env.NEXT_PUBLIC_NODE_NFT_ADDRESS || 
    activeNetworkConfig.contracts.nodeNFT
  ) as `0x${string}`,
  nftManager: (
    process.env.NEXT_PUBLIC_NFT_MANAGER_ADDRESS || 
    activeNetworkConfig.contracts.nftManager
  ) as `0x${string}`,
  usdt: (
    process.env.NEXT_PUBLIC_USDT_ADDRESS || 
    activeNetworkConfig.contracts.usdt
  ) as `0x${string}`,
  tokenVesting: (
    process.env.NEXT_PUBLIC_VESTING_ADDRESS || 
    activeNetworkConfig.contracts.tokenVesting
  ) as `0x${string}`,
} as const;

/**
 * Network configuration
 * Automatically configured based on NEXT_PUBLIC_NETWORK
 */
export const NETWORK_CONFIG = {
  chainId: parseInt(
    process.env.NEXT_PUBLIC_CHAIN_ID || 
    activeNetworkConfig.chainId.toString()
  ),
  rpcUrl: (
    process.env.NEXT_PUBLIC_RPC_URL || 
    activeNetworkConfig.rpcUrl
  ),
  blockExplorer: activeNetworkConfig.blockExplorer,
  isTestnet: activeNetworkConfig.isTestnet,
  name: activeNetworkConfig.name,
} as const;

// Fallback RPC node list, sorted by reliability
export const FALLBACK_RPC_URLS = activeNetworkConfig.fallbackRpcUrls as readonly string[];

/**
 * Current network type (testnet or mainnet)
 */
export const CURRENT_NETWORK_TYPE = getCurrentNetworkType();

/**
 * NFT status enumeration (must match contract)
 */
export enum NFTStatus {
  Active = 0,      // 0 = Active (Producing, can receive rewards)
  Terminating = 1, // 1 = Terminating (Termination initiated, waiting for confirmation or timeout)
  Terminated = 2   // 2 = Terminated (Terminated, no new rewards, cannot recover)
}

/**
 * Order status enumeration (must match contract)
 */
export enum OrderStatus {
  Active = 0,  // 0 = Active
  Cancelled = 1,  // 1 = Cancelled
  Filled = 2,  // 2 = Filled
}

/**
 * Batch information structure (from contract)
 */
export interface BatchInfo {
  batchId: string;
  maxMintable: string;
  currentMinted: string;
  mintPrice: string; // wei format
  active: boolean;
  createdAt: string;
}

/**
 * Unified NFT configuration (all NFTs are the same)
 */
export const NFT_UNIFIED_CONFIG = {
  eLockAmount: "2000", // Each NFT contains 2000 $E (fixed)
  lockPeriod: 365 * 24 * 60 * 60, // 365 days in seconds
  unlockInterval: 30 * 24 * 60 * 60, // 30 days in seconds
  unlockPeriods: 25, // 25 months
  unlockPercentage: 4, // 4% per month
} as const;

/**
 * Unlock constants (must match contract)
 * @deprecated Use NFT_UNIFIED_CONFIG instead
 */
export const UNLOCK_CONFIG = NFT_UNIFIED_CONFIG;

/**
 * Termination constants (must match contract)
 */
export const TERMINATION_CONFIG = {
  cooldown: 1 * 24 * 60 * 60, // 1 day in seconds
  timeout: 30 * 24 * 60 * 60, // 30 days in seconds
} as const;

/**
 * Token decimals
 */
export const TOKEN_DECIMALS = {
  E: 18,
  USDT: 18, // BSC USDT uses 18 decimals
} as const;

/**
 * Gas configuration
 * Automatically configured based on NEXT_PUBLIC_NETWORK
 */
export const GAS_CONFIG = activeNetworkConfig.gasConfig as const;
