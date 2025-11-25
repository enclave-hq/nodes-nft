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
  rpcUrl: 'https://bsc-dataseed1.binance.org',
  blockExplorer: 'https://bscscan.com',
  isTestnet: false,
  contracts: {
    enclaveToken: '0x3b8Aa22B8A07074101a47EbD16d213f11Eb32fbc',
    nodeNFT: '0xcDaBC60cEBa3371DF2000a9176bAD8ea19C45860',
    nftManager: '0xa5020E751277BbC90b7c8CdeAb4434b47F543d91',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    tokenVesting: '0x50FA7D13725302954Ad41Cb25C2F52198c7521b2',
  },
  fallbackRpcUrls: [
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://bsc-dataseed.binance.org',
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
  const networkEnv = (process.env.NEXT_PUBLIC_NETWORK || 'testnet').toLowerCase();
  
  if (networkEnv === 'mainnet') {
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
  return networkEnv === 'mainnet' ? 'mainnet' : 'testnet';
}





