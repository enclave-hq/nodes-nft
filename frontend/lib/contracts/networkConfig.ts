/**
 * Network Configuration Presets
 * 
 * This file contains predefined configurations for different networks.
 * Switch between networks by setting NEXT_PUBLIC_NETWORK environment variable
 * to 'testnet' or 'mainnet'
 */

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  contracts: {
    enclaveToken: `0x${string}`;
    nodeNFT: `0x${string}`;
    nftManager: `0x${string}`;
    usdt: `0x${string}`;
    tokenVesting: `0x${string}`;
    rewardVault: `0x${string}`; // Referral RewardVault (users claim referral rewards)
  };
  fallbackRpcUrls: string[];
  gasConfig: {
    gasPrice: string;
    gasLimits: {
      erc20Transfer: number;
      erc20Approve: number;
      contractCall: number;
      createSellOrder: number;
      buyNFT: number;
      mintNFT: number;
    };
  };
}

/**
 * BSC Testnet Configuration
 */
export const TESTNET_CONFIG: NetworkConfig = {
  name: 'BSC Testnet',
  chainId: 97,
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  blockExplorer: 'https://testnet.bscscan.com',
  isTestnet: true,
  contracts: {
    enclaveToken: '0x2E18cAE3f9e011802e15b4E9c5c79485Af5AB09F',
    nodeNFT: '0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe',
    nftManager: '0xCD59C34ac5a9962C2F00f2d107159bdAD8001d67', // Diamond Pattern
    usdt: '0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34', // TestUSDT on BSC Testnet
    tokenVesting: '0x0b6a47631294D4DB753f7BEF56d615c268c87F78',
    rewardVault: '0x0000000000000000000000000000000000000000', // Set via NEXT_PUBLIC_REWARD_VAULT_ADDRESS
  },
  fallbackRpcUrls: [
    'https://data-seed-prebsc-2-s1.binance.org:8545',
    'https://data-seed-prebsc-1-s2.binance.org:8545',
    'https://data-seed-prebsc-2-s2.binance.org:8545',
    'https://data-seed-prebsc-1-s3.binance.org:8545',
    'https://data-seed-prebsc-2-s3.binance.org:8545',
    'https://data-seed-prebsc-1-s1.binance.org:8545',
  ],
  gasConfig: {
    gasPrice: '300000000', // 0.3 Gwei
    gasLimits: {
      erc20Transfer: 21000,
      erc20Approve: 100000,
      contractCall: 300000,
      createSellOrder: 500000,
      buyNFT: 500000,
      mintNFT: 500000,
    },
  },
};

/**
 * BSC Mainnet Configuration
 */
export const MAINNET_CONFIG: NetworkConfig = {
  name: 'BSC Mainnet',
  chainId: 56,
  rpcUrl: 'https://bsc-rpc.publicnode.com',
  blockExplorer: 'https://bscscan.com',
  isTestnet: false,
  contracts: {
    // Contract addresses from docker-compose.yaml (production)
    enclaveToken: '0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011',
    nodeNFT: '0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b',
    nftManager: '0xD9eA9F4B8F24872262568fB2C6133117EC02C774',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    tokenVesting: '0x67B8927F0835e79632f4622F017915Cb0B9a6c72',
    rewardVault: '0x0000000000000000000000000000000000000000', // Set via NEXT_PUBLIC_REWARD_VAULT_ADDRESS
  },
  fallbackRpcUrls: [
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://bsc-dataseed.binance.org',
    'https://bsc-rpc.publicnode.com',
  ],
  gasConfig: {
    gasPrice: '3000000000', // 3 Gwei (mainnet typically needs higher gas)
    gasLimits: {
      erc20Transfer: 21000,
      erc20Approve: 100000,
      contractCall: 300000,
      createSellOrder: 500000,
      buyNFT: 500000,
      mintNFT: 500000,
    },
  },
};

/**
 * Get network configuration based on environment variable
 * 
 * Set NEXT_PUBLIC_NETWORK to 'testnet' or 'mainnet' to switch networks
 * Defaults to 'testnet' if not set or invalid value
 */
export function getNetworkConfig(): NetworkConfig {
  // Debug: Log environment variable reading
  const networkEnvRaw = process.env.NEXT_PUBLIC_NETWORK;
  const networkEnv = (networkEnvRaw || 'testnet').toLowerCase();
  
  // Support both 'mainnet' and 'bscmainnet' as mainnet aliases
  const isMainnet = networkEnv === 'mainnet' || networkEnv === 'bscmainnet';
  
  // Log for debugging (only in development)
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
    console.log('🔍 Reading network config:', {
      'NEXT_PUBLIC_NETWORK (raw)': networkEnvRaw,
      'NEXT_PUBLIC_NETWORK (normalized)': networkEnv,
      'Is mainnet': isMainnet,
      'Selected config': isMainnet ? 'MAINNET' : 'TESTNET',
    });
  }
  
  if (isMainnet) {
    return MAINNET_CONFIG;
  }
  
  // Default to testnet
  return TESTNET_CONFIG;
}

/**
 * Get current network type
 */
export function getCurrentNetworkType(): NetworkType {
  const networkEnv = (process.env.NEXT_PUBLIC_NETWORK || 'testnet').toLowerCase();
  // Support both 'mainnet' and 'bscmainnet' as mainnet aliases
  const isMainnet = networkEnv === 'mainnet' || networkEnv === 'bscmainnet';
  return isMainnet ? 'mainnet' : 'testnet';
}





