"use client";

import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useWallet } from '@/lib/providers/WalletProvider';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { ERC20_ABI, NFT_MANAGER_ABI } from '@/lib/contracts/abis';
import type { WalletManager } from '@enclave-hq/wallet-sdk';
import { ChainType } from '@enclave-hq/wallet-sdk';
import { getUserInviteCodes } from '@/lib/api/invite-codes';

// NFT information interface
export interface NFTInfo {
  id: number;
  type: string;
  status: string;
  mintPrice: string;
  createdAt: string;
}

// Pending reward information interface
export interface PendingRewardInfo {
  nftId: number;
  pendingProduced: string;  // Pending $E production
  pendingUsdt: string;     // Pending USDT rewards
}

// Sell order information interface
export interface SellOrderInfo {
  orderId: number;
  nftId: number;
  seller: string;
  price: string; // Price for the whole NFT (in USDT wei)
  createdAt: number;
  active: boolean;
  status?: number; // OrderStatus enum: 0 = Active, 1 = Cancelled, 2 = Filled
  createdAtDisplay?: string; // Formatted date
}

// Trade history information interface
export interface TradeHistoryInfo {
  nftId: number;
  orderId: number;
  buyer: string;
  seller: string;
  shares: string;
  totalPrice: string;
  timestamp: number;
  transactionHash?: string;
}

// Environment configuration interface
export interface EnvConfig {
  // Network configuration
  network: {
    chainId: number;
    rpcUrl: string;
    blockExplorer: string;
    isTestnet: boolean;
  };
  
  // Contract addresses
  contracts: {
    enclaveToken: string;
    nodeNFT: string;
    nftManager: string;
    usdt: string;
  };
  
  // Feature flags
  features: {
    debug: boolean;
    testnet: boolean;
  };
}

// Web3 data interface
export interface Web3Data {
  // Environment configuration
  config: EnvConfig;
  
  // Balance information
  balances: {
    usdt: string;
    e: string;
    bnb: string;
  };
  
  // Allowance information
  allowances: {
    usdt: string;
  };
  
  // NFT information
  nfts: NFTInfo[];
  
  // Pending reward information
  pendingRewards: PendingRewardInfo[];
  
  // Sell orders information
  sellOrders: SellOrderInfo[];
  
  // Trade history information
  tradeHistory: TradeHistoryInfo[];
  
  // Whitelist information
  whitelist: {
    isWhitelisted: boolean;
  };
  
  // Invite codes information
  inviteCodes: {
    inviteCodeStatus: 'none' | 'pending' | 'approved_pending_activation' | 'approved';
    ownedInviteCodes: Array<{
      id: number;
      code: string;
      status: string;
      maxUses?: number;
      usageCount: number;
      createdAt: string;
    }>;
    pendingInviteCodes?: Array<{
      id: number;
      code: string;
      status: string;
      maxUses?: number;
      usageCount: number;
      createdAt: string;
    }>;
    usedInviteCode?: {
      id: number;
      code: string;
      status: string;
      createdAt: string;
    };
  };
  
  // Loading states
  loading: {
    balances: boolean;
    allowances: boolean;
    nfts: boolean;
    pendingRewards: boolean;
    sellOrders: boolean;
    tradeHistory: boolean;
    whitelist: boolean;
    inviteCodes: boolean;
  };
  
  // Error information
  errors: {
    balances: string | null;
    allowances: string | null;
    nfts: string | null;
    pendingRewards: string | null;
    sellOrders: string | null;
    tradeHistory: string | null;
    whitelist: string | null;
    inviteCodes: string | null;
  };
  
  // Last update time
  lastUpdated: {
    balances: number | null;
    allowances: number | null;
    nfts: number | null;
    pendingRewards: number | null;
    sellOrders: number | null;
    tradeHistory: number | null;
    whitelist: number | null;
    inviteCodes: number | null;
  };
}

// Store state interface
interface Web3Store extends Web3Data {
  // Actions
  fetchBalances: () => Promise<void>;
  fetchAllowances: () => Promise<void>;
  fetchNFTs: () => Promise<void>;
  fetchPendingRewards: () => Promise<void>;
  fetchSellOrders: () => Promise<void>;
  fetchTradeHistory: () => Promise<void>;
  fetchWhitelist: () => Promise<void>;
  fetchInviteCodes: () => Promise<void>;
  fetchAllData: () => Promise<void>;
  refreshData: () => Promise<void>; // Smart refresh, avoid frequent calls
  clearData: () => void;
  
  // Internal state
  walletManager: WalletManager | null;
  address: string | null;
  isConnected: boolean;
  lastFetchTime: number; // Timestamp of last data fetch
  lastRefreshTime: number; // Timestamp of last manual refresh
  
  // Set wallet info
  setWalletInfo: (walletManager: WalletManager | null, address: string | null, isConnected: boolean) => Promise<void>;
}

// Utility function to format token amounts
const formatTokenAmount = (amount: bigint, decimals: number): string => {
  const amountStr = amount.toString();
  
  if (amountStr.length <= decimals) {
    const padded = amountStr.padStart(decimals, '0');
    const integerPart = '0';
    const decimalPart = padded.slice(-decimals).replace(/0+$/, '') || '0';
    return decimalPart === '0' ? integerPart : `${integerPart}.${decimalPart}`;
  } else {
    const integerPart = amountStr.slice(0, -decimals);
    const decimalPart = amountStr.slice(-decimals).replace(/0+$/, '');
    return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  }
};

// Request throttling and caching mechanism
const requestCache = new Map<string, { result: unknown; timestamp: number; promise?: Promise<unknown> }>();
const REQUEST_CACHE_TTL = 10000; // 10 second cache, increased cache time
const REQUEST_DELAY = 200; // 200ms delay, increased delay
const BATCH_SIZE = 3; // Batch processing size

// Add request delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Batch process requests
const batchRequests = async <T>(
  requests: (() => Promise<T>)[],
  batchSize: number = BATCH_SIZE
): Promise<T[]> => {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(req => req()));
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < requests.length) {
      await delay(REQUEST_DELAY);
    }
  }
  
  return results;
};

// RPC health check removed - all RPC interactions should be handled through Wallet SDK

// Contract call helper function with fallback mechanism and throttling
export const callContractWithFallback = async (
  walletManager: WalletManager,
  contractAddress: string,
  abi: unknown[],
  functionName: string,
  args: unknown[] = [],
  operationName: string = 'contract call'
): Promise<unknown> => {
  // Validate ABI
  if (!abi || !Array.isArray(abi) || abi.length === 0) {
    throw new Error(`Invalid ABI provided for ${operationName}: ABI must be a non-empty array`);
  }
  
  // Ensure args is always an array
  const safeArgs = Array.isArray(args) ? args : (args ? [args] : []);
  
  // Generate cache key
  const cacheKey = `${contractAddress}-${functionName}-${safeArgs.join(',')}`;
  
  // Check cache
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL) {
    console.log(`📋 Using cached result for ${operationName}`);
    return cached.result;
  }
  
  // If same request is already in progress, wait for it to complete
  if (cached?.promise) {
    console.log(`⏳ Waiting for existing request for ${operationName}`);
    return await cached.promise;
  }
  
  // Create request Promise with retry mechanism
  const requestPromise = (async () => {
    const maxRetries = 3; // Maximum 3 retries
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add request delay to avoid too frequent calls
        if (attempt > 1) {
          // Increase delay time on retry
          await delay(REQUEST_DELAY * attempt);
        } else {
      await delay(REQUEST_DELAY);
        }
      
        if (attempt === 1) {
      console.log(`📞 Calling ${operationName}...`);
        } else {
          console.log(`🔄 Retrying ${operationName} (attempt ${attempt}/${maxRetries})...`);
        }
      
      const result = await walletManager.readContract(contractAddress, abi, functionName, safeArgs);
      console.log(`✅ ${operationName} success:`, result.toString());
      
      // Cache result
      requestCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error: unknown) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if it's an RPC-related error
        const isRpcError = errorMessage.includes('RPC') || 
                          errorMessage.includes('network') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('ECONNREFUSED') ||
                          errorMessage.includes('fetch failed') ||
                          (error as { code?: string })?.code === 'NETWORK_ERROR' ||
                          (error as { code?: string })?.code === 'TIMEOUT';
        
        // If it's an RPC error and there are retries left, continue retrying
        if (isRpcError && attempt < maxRetries) {
          console.debug(`⚠️ RPC error on attempt ${attempt}, will retry...`);
          continue;
        }
        
        // If it's not an RPC error, or retries are exhausted, throw error
        break;
      }
    }
    
      // Clean up Promise in cache
      requestCache.delete(cacheKey);
    throw lastError;
  })();
  
  // Set Promise in cache
  requestCache.set(cacheKey, { result: null, timestamp: Date.now(), promise: requestPromise });
  
  try {
    const result = await requestPromise;
    return result;
  } catch (error: unknown) {
    // Check if it's a wallet not connected error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isWalletNotConnected = errorMessage.includes('WalletNotConnectedError') ||
                                 errorMessage.includes('No wallet is connected') ||
                                 errorMessage.includes('wallet not connected');

    if (isWalletNotConnected) {
      console.log(`⚠️ Wallet not connected for ${operationName}, skipping...`);
      throw new Error(`Wallet not connected: ${errorMessage}`);
    }

    // Safely extract error information (errorMessage already defined above)
    const errorCode = (error as { code?: string })?.code;
    
    // Check if it's an RPC-related error
    const isRpcError = errorMessage.includes('RPC') || 
                      errorMessage.includes('network') ||
                      errorMessage.includes('timeout') ||
                      errorMessage.includes('ECONNREFUSED') ||
                      errorCode === 'NETWORK_ERROR' ||
                      errorCode === 'TIMEOUT';
    
    if (isRpcError) {
      // RPC errors should be handled at Wallet SDK level, only log debug info here
      // Use console.debug instead of console.error to avoid too many errors in console
      console.debug(`⚠️ RPC error for ${operationName}: ${errorMessage}`);
      console.debug(`ℹ️ This should be handled by Wallet SDK's RPC fallback mechanism`);
    } else {
      // Non-RPC errors (such as contract errors, parameter errors, etc.) need to be logged
      console.error(`❌ ${operationName} failed:`, error);
    }
    
    throw error; // Throw original error
  }
};

// Initialize environment configuration
const initializeEnvConfig = (): EnvConfig => {
  const config: EnvConfig = {
    network: {
      chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "97"),
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      blockExplorer: process.env.NEXT_PUBLIC_CHAIN_ID === "56"
        ? "https://bscscan.com"
        : "https://testnet.bscscan.com",
      isTestnet: process.env.NEXT_PUBLIC_ENABLE_TESTNET === "true",
    },
    contracts: {
      enclaveToken: process.env.NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS || '',
      nodeNFT: process.env.NEXT_PUBLIC_NODE_NFT_ADDRESS || '',
      nftManager: process.env.NEXT_PUBLIC_NFT_MANAGER_ADDRESS || '',
      usdt: process.env.NEXT_PUBLIC_USDT_ADDRESS || '',
    },
    features: {
      debug: process.env.NEXT_PUBLIC_DEBUG === "true",
      testnet: process.env.NEXT_PUBLIC_ENABLE_TESTNET === "true",
    },
  };
  
  console.log('🔧 Initializing Web3 config:', config);
  return config;
};

// Create Web3 Store
export const useWeb3Store = create<Web3Store>()(
  subscribeWithSelector((set, get) => ({
    // Initial state - directly initialize configuration
    config: initializeEnvConfig(),
    balances: {
      usdt: '0',
      e: '0',
      bnb: '0',
    },
    allowances: {
      usdt: '0',
    },
    nfts: [],
    pendingRewards: [],
    sellOrders: [],
    tradeHistory: [],
    whitelist: {
      isWhitelisted: false,
    },
    inviteCodes: {
      inviteCodeStatus: 'none',
      ownedInviteCodes: [],
      pendingInviteCodes: [],
      usedInviteCode: undefined,
    },
    loading: {
      balances: false,
      allowances: false,
      nfts: false,
      pendingRewards: false,
      sellOrders: false,
      tradeHistory: false,
      whitelist: false,
      inviteCodes: false,
    },
    errors: {
      balances: null,
      allowances: null,
      nfts: null,
      pendingRewards: null,
      sellOrders: null,
      tradeHistory: null,
      whitelist: null,
      inviteCodes: null,
    },
    lastUpdated: {
      balances: null,
      allowances: null,
      nfts: null,
      pendingRewards: null,
      sellOrders: null,
      tradeHistory: null,
      whitelist: null,
      inviteCodes: null,
    },
    
    // Internal state
    walletManager: null,
    address: null,
    isConnected: false,
    lastFetchTime: 0,
    lastRefreshTime: 0,
    
    // Actions
    setWalletInfo: async (walletManager, address, isConnected) => {
      const currentState = get();
      const prevAddress = currentState.address;
      
      // If address changed or disconnected, clear old address data
      if (prevAddress && prevAddress !== address) {
        console.log(`🔄 Address changed from ${prevAddress} to ${address}, clearing old data...`);
        get().clearData();
      }
      
      // If wallet disconnected, clear data
      if (!isConnected) {
        console.log('🔌 Wallet disconnected, clearing data...');
        get().clearData();
      }
      
      // Update wallet info
      set({ walletManager, address, isConnected });
      
      // If new wallet connected, automatically fetch whitelist status
      if (isConnected && walletManager && address) {
        console.log(`✅ Wallet connected: ${address}, fetching whitelist...`);
        get().fetchWhitelist().catch(err => {
          console.error('Failed to fetch whitelist on wallet connect:', err);
        });
      }
    },
    
    fetchBalances: async () => {
      const { walletManager, address, isConnected, config } = get();
      
      if (!walletManager || !address || !isConnected) {
        console.log('🔍 Wallet not connected, skipping balance fetch');
        return;
      }
      
      if (!config.contracts.usdt || !config.contracts.enclaveToken) {
        console.error('❌ Contract addresses not configured');
        console.error('USDT Address:', config.contracts.usdt);
        console.error('Enclave Token Address:', config.contracts.enclaveToken);
        set(state => ({
          errors: { ...state.errors, balances: 'Contract addresses not configured' }
        }));
        return;
      }
      
      console.log('🔍 Contract addresses:', {
        usdt: config.contracts.usdt,
        enclaveToken: config.contracts.enclaveToken,
        nftManager: config.contracts.nftManager,
      });
      
      console.log('🔍 Fetching balances...');
      set(state => ({
        loading: { ...state.loading, balances: true },
        errors: { ...state.errors, balances: null }
      }));
      
      try {
        // First test USDT contract call separately
        console.log('🔍 Testing USDT contract calls...');
        
        const usdtBalance = await callContractWithFallback(
          walletManager,
          config.contracts.usdt,
          ERC20_ABI as unknown[],
          'balanceOf',
          [address],
          'USDT balanceOf'
        );
        
        console.log('✅ USDT balance result:', usdtBalance, 'type:', typeof usdtBalance, 'toString:', String(usdtBalance));
        
        const usdtDecimals = await callContractWithFallback(
          walletManager,
          config.contracts.usdt,
          ERC20_ABI as unknown[],
          'decimals',
          [],
          'USDT decimals'
        );
        
        console.log('✅ USDT decimals result:', usdtDecimals, 'type:', typeof usdtDecimals);
        
        const eBalance = await callContractWithFallback(
          walletManager,
          config.contracts.enclaveToken,
          ERC20_ABI as unknown[],
          'balanceOf',
          [address],
          'Enclave Token balanceOf'
        );
        
        console.log('✅ Enclave Token balance result:', eBalance, 'type:', typeof eBalance, 'toString:', String(eBalance));
        
        const eDecimals = await callContractWithFallback(
          walletManager,
          config.contracts.enclaveToken,
          ERC20_ABI as unknown[],
          'decimals',
          [],
          'Enclave Token decimals'
        );
        
        console.log('✅ Enclave Token decimals result:', eDecimals, 'type:', typeof eDecimals);
        
        // Get BNB balance - through adapter's publicClient
        let bnbBalance = BigInt(0);
        try {
          const connectedWallets = walletManager.getConnectedWallets();
          const evmWallet = connectedWallets.find(w => w.chainType === ChainType.EVM);
          if (evmWallet && evmWallet.adapter && 'publicClient' in evmWallet.adapter) {
            const publicClient = (evmWallet.adapter as { publicClient?: { getBalance?: (params: { address: `0x${string}` }) => Promise<bigint> } }).publicClient;
            if (publicClient && publicClient.getBalance) {
              bnbBalance = await publicClient.getBalance({ address: address as `0x${string}` });
            }
          }
        } catch (error) {
          console.warn('Failed to get BNB balance:', error);
        }
        
        console.log('✅ Balances fetched successfully:', {
          usdt: String(usdtBalance),
          e: String(eBalance),
          bnb: bnbBalance.toString()
        });
        
        // Ensure decimals is a number type
        const usdtDecimalsNum = typeof usdtDecimals === 'bigint' ? Number(usdtDecimals) : Number(usdtDecimals);
        const eDecimalsNum = typeof eDecimals === 'bigint' ? Number(eDecimals) : Number(eDecimals);
        
        console.log('✅ Decimals converted:', {
          usdtDecimals: usdtDecimalsNum,
          eDecimals: eDecimalsNum,
          usdtDecimalsType: typeof usdtDecimalsNum,
          eDecimalsType: typeof eDecimalsNum
        });
        
        const formattedBalances = {
          usdt: formatTokenAmount(BigInt(String(usdtBalance)), usdtDecimalsNum),
          e: formatTokenAmount(BigInt(String(eBalance)), eDecimalsNum),
          bnb: formatTokenAmount(BigInt(bnbBalance.toString()), 18),
        };
        
        set(state => ({
          balances: formattedBalances,
          loading: { ...state.loading, balances: false },
          lastUpdated: { ...state.lastUpdated, balances: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching balances:', error);
        // Even if error occurs, try to set some default values, but log error
        set(state => ({
          balances: {
            usdt: '0',
            e: '0',
            bnb: '0',
          },
          loading: { ...state.loading, balances: false },
          errors: { ...state.errors, balances: error instanceof Error ? error.message : 'Failed to fetch balances' },
          lastUpdated: { ...state.lastUpdated, balances: Date.now() }
        }));
      }
    },
    
    fetchAllowances: async () => {
      const { walletManager, address, isConnected, config } = get();
      
      if (!walletManager || !address || !isConnected) {
        console.log('🔍 Wallet not connected, skipping allowance fetch');
        return;
      }
      
      if (!config.contracts.usdt || !config.contracts.nftManager) {
        console.error('❌ Contract addresses not configured');
        set(state => ({
          errors: { ...state.errors, allowances: 'Contract addresses not configured' }
        }));
        return;
      }
      
      console.log('🔍 Wallet Manager debug info:', {
        hasPrimaryWallet: !!walletManager.getPrimaryAccount(),
        connectedWallets: walletManager.getConnectedWallets().map(w => ({
          hasPublicClient: !!(w as { publicClient?: unknown }).publicClient,
        })),
        primaryAccount: walletManager.getPrimaryAccount(),
        expectedChainId: config.network.chainId,
        currentChainId: walletManager.getPrimaryAccount()?.chainId,
        chainIdMatch: walletManager.getPrimaryAccount()?.chainId === config.network.chainId,
      });
      
      // Check if chain ID matches
      const currentChainId = walletManager.getPrimaryAccount()?.chainId;
      if (currentChainId !== config.network.chainId) {
        console.error('❌ Chain ID mismatch!', {
          expected: config.network.chainId,
          current: currentChainId,
        });
        set(state => ({
          errors: { ...state.errors, allowances: `Wrong chain. Expected ${config.network.chainId}, got ${currentChainId}` }
        }));
        return;
      }
      
      console.log('🔍 Fetching allowances...');
      set(state => ({
        loading: { ...state.loading, allowances: true },
        errors: { ...state.errors, allowances: null }
      }));
      
      try {
        // First test single call
        console.log('📞 Testing allowance call...');
        const usdtAllowance = await walletManager.readContract(config.contracts.usdt, ERC20_ABI as unknown[], 'allowance', [address, config.contracts.nftManager]);
        console.log('✅ Allowance call success:', usdtAllowance.toString());
        
        console.log('📞 Testing decimals call...');
        const usdtDecimals = await walletManager.readContract(config.contracts.usdt, ERC20_ABI as unknown[], 'decimals', []);
        console.log('✅ Decimals call success:', usdtDecimals.toString());
        
        console.log('✅ Allowances fetched successfully:', {
          usdt: usdtAllowance.toString()
        });
        
        const formattedAllowances = {
          usdt: formatTokenAmount(BigInt(usdtAllowance.toString()), Number(usdtDecimals)),
        };
        
        set(state => ({
          allowances: formattedAllowances,
          loading: { ...state.loading, allowances: false },
          lastUpdated: { ...state.lastUpdated, allowances: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching allowances:', error);
        set(state => ({
          loading: { ...state.loading, allowances: false },
          errors: { ...state.errors, allowances: error instanceof Error ? error.message : 'Failed to fetch allowances' }
        }));
      }
    },
    
    fetchNFTs: async () => {
      const { walletManager, address, isConnected } = get();
      
      if (!walletManager || !address || !isConnected) {
        console.log('🔍 Wallet not connected, skipping NFT fetch');
        return;
      }
      
      console.log('🔍 Fetching user NFTs...');
      set(state => ({
        loading: { ...state.loading, nfts: true },
        errors: { ...state.errors, nfts: null }
      }));
      
      try {
        // Get user's NFT list
        const nftIds = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getUserNFTs',
          [address],
          'getUserNFTs'
        );
        
        console.log('✅ User NFT IDs:', nftIds);
        
        // Ensure nftIds is an array
        const nftIdsArray = Array.isArray(nftIds) ? nftIds : [];
        
        // Get detailed information for each NFT
        const nftPromises = nftIdsArray.map(async (nftId: unknown) => {
          try {
            const nftIdNum = typeof nftId === 'number' ? nftId : typeof nftId === 'string' ? parseInt(nftId, 10) : Number(nftId);
            const poolData = await callContractWithFallback(
              walletManager,
              CONTRACT_ADDRESSES.nftManager,
              NFT_MANAGER_ABI as unknown[],
              'getNFTPool',
              [BigInt(nftIdNum)],
              `getNFTPool(${nftIdNum})`
            );
            
            // Ensure poolData is an array
            if (!poolData || !Array.isArray(poolData)) {
              console.warn(`⚠️ NFT ${nftId}: Invalid pool data received, using default values`);
              return {
                id: Number(nftId),
                type: 'Standard',
                status: 'Live',
                mintPrice: '0',
                createdAt: new Date().toISOString(),
              };
            }
            
            // getNFTPool returns: status, createdAt, terminationInitiatedAt, totalEclvLocked, remainingMintQuota, unlockedAmount, unlockedWithdrawn, unlockedPeriods, producedWithdrawn
            const [
              status,
              createdAt,
              , // terminationInitiatedAt (unused)
              totalEclvLocked,
              , // remainingMintQuota (unused)
              , // unlockedAmount (unused)
              , // unlockedWithdrawn (unused)
              , // unlockedPeriods (unused)
              , // producedWithdrawn (unused)
            ] = poolData;
            
            // Verify required fields exist
            const totalEclvLockedValue = totalEclvLocked ?? BigInt(0);
            const statusValue = status ?? BigInt(0);
            const createdAtValue = createdAt ?? BigInt(0);
            
            return {
              id: Number(nftId),
              type: 'Standard', // New contract no longer has nftType, unified as Standard
              status: Number(statusValue) === 0 ? 'Live' : Number(statusValue) === 1 ? 'PendingTermination' : 'Terminated',
              mintPrice: totalEclvLockedValue.toString(),
              createdAt: Number(createdAtValue) > 0 ? new Date(Number(createdAtValue) * 1000).toISOString() : new Date().toISOString(),
            };
          } catch (error: any) {
            console.warn(`⚠️ NFT ${nftId}: Error fetching pool data:`, error.message);
            // Return default values instead of throwing error, to avoid interrupting entire fetch process
            return {
              id: Number(nftId),
              type: 'Standard',
              status: 'Live',
              mintPrice: '0',
              createdAt: new Date().toISOString(),
            };
          }
        });
        
        const nfts = await Promise.all(nftPromises);
        
        set(state => ({
          nfts,
          loading: { ...state.loading, nfts: false },
          lastUpdated: { ...state.lastUpdated, nfts: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching NFTs:', error);
        set(state => ({
          loading: { ...state.loading, nfts: false },
          errors: { ...state.errors, nfts: error instanceof Error ? error.message : 'Failed to fetch NFTs' }
        }));
      }
    },
    
    fetchPendingRewards: async () => {
      const { walletManager, address, isConnected, nfts } = get();
      
      if (!walletManager || !address || !isConnected || nfts.length === 0) {
        console.log('🔍 Wallet not connected or no NFTs, skipping pending rewards fetch');
        return;
      }
      
      console.log('🔍 Fetching pending rewards...');
      set(state => ({
        loading: { ...state.loading, pendingRewards: true },
        errors: { ...state.errors, pendingRewards: null }
      }));
      
      try {
        // Use batch processing to get pending rewards
        const rewardRequests = nfts.flatMap((nft) => [
          () => callContractWithFallback(
            walletManager,
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'getPendingProduced',
            [nft.id],
            `getPendingProduced(${nft.id})`
          ),
          () => callContractWithFallback(
            walletManager,
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'getPendingReward',
            [nft.id, CONTRACT_ADDRESSES.usdt],
            `getPendingReward(${nft.id})`
          )
        ]);
        
        const rewardDataArray = await batchRequests(rewardRequests);
        
        const pendingRewards = nfts.map((nft, index) => {
          const pendingProduced = rewardDataArray[index * 2];
          const pendingUsdt = rewardDataArray[index * 2 + 1];
          
          return {
            nftId: nft.id,
            pendingProduced: String(pendingProduced),
            pendingUsdt: String(pendingUsdt),
          };
        });
        
        set(state => ({
          pendingRewards,
          loading: { ...state.loading, pendingRewards: false },
          lastUpdated: { ...state.lastUpdated, pendingRewards: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching pending rewards:', error);
        set(state => ({
          loading: { ...state.loading, pendingRewards: false },
          errors: { ...state.errors, pendingRewards: error instanceof Error ? error.message : 'Failed to fetch pending rewards' }
        }));
      }
    },
    
    fetchSellOrders: async () => {
      const { walletManager, isConnected } = get();
      
      if (!walletManager || !isConnected) {
        console.log('🔍 Wallet not connected, skipping sell orders fetch');
        return;
      }
      
      console.log('🔍 Fetching sell orders using getAllActiveOrders...');
      set(state => ({
        loading: { ...state.loading, sellOrders: true },
        errors: { ...state.errors, sellOrders: null }
      }));
      
      try {
        // Use getAllActiveOrders to get all active orders at once
        const orders = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getAllActiveOrders',
          [],
          'getAllActiveOrders()'
        ) as Array<{
          orderId: bigint;
          nftId: bigint;
          seller: string;
          price: bigint;
          createdAt: bigint;
          status: number;
        }>;
        
        if (!orders || orders.length === 0) {
          console.log('✅ No active orders found');
          set(state => ({
            sellOrders: [],
            loading: { ...state.loading, sellOrders: false },
            lastUpdated: { ...state.lastUpdated, sellOrders: Date.now() }
          }));
          return;
        }
        
        console.log(`✅ Found ${orders.length} active orders`);
        
        // Map to SellOrderInfo format
        const sellOrderInfos: SellOrderInfo[] = orders.map(order => ({
          orderId: Number(order.orderId),
          nftId: Number(order.nftId),
          seller: order.seller.toLowerCase(),
          price: order.price.toString(), // Price for whole NFT
          createdAt: Number(order.createdAt),
          active: order.status === 0, // OrderStatus: 0 = Active
          status: order.status,
        }));
        
        console.log(`✅ Processed ${sellOrderInfos.length} active sell orders`);
        
        set(state => ({
          sellOrders: sellOrderInfos,
          loading: { ...state.loading, sellOrders: false },
          lastUpdated: { ...state.lastUpdated, sellOrders: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching sell orders:', error);
        set(state => ({
          loading: { ...state.loading, sellOrders: false },
          errors: { ...state.errors, sellOrders: error instanceof Error ? error.message : 'Failed to fetch sell orders' }
        }));
      }
    },
    
    fetchTradeHistory: async () => {
      const { walletManager, isConnected, address, nfts } = get();
      
      if (!walletManager || !isConnected || !address || nfts.length === 0) {
        console.log('🔍 Wallet not connected or no NFTs, skipping trade history fetch');
        return;
      }
      
      console.log('🔍 Fetching trade history...');
      set(state => ({
        loading: { ...state.loading, tradeHistory: true },
        errors: { ...state.errors, tradeHistory: null }
      }));
      
      try {
        // Get historical transactions from event logs
        // Note: This requires querying on-chain event logs, currently returns empty array
        // Future implementation can use event filters to get SharesSold events
        // SharesSold(uint256 indexed orderId, uint256 indexed nftId, address indexed buyer, uint256 shares, uint256 totalPrice)
        
        // Temporarily return empty array, waiting for event query logic implementation
        set(state => ({
          tradeHistory: [],
          loading: { ...state.loading, tradeHistory: false },
          lastUpdated: { ...state.lastUpdated, tradeHistory: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching trade history:', error);
        set(state => ({
          loading: { ...state.loading, tradeHistory: false },
          errors: { ...state.errors, tradeHistory: error instanceof Error ? error.message : 'Failed to fetch trade history' }
        }));
      }
    },
    
    fetchWhitelist: async () => {
      const { walletManager, address, isConnected } = get();
      
      if (!walletManager || !address || !isConnected) {
        console.log('🔍 Wallet not connected, skipping whitelist fetch');
        set(state => ({
          whitelist: { isWhitelisted: false },
          loading: { ...state.loading, whitelist: false },
        }));
        return;
      }
      
      // Verify address matches (prevent getting wrong data when address switches)
      const currentAddress = get().address;
      if (currentAddress !== address) {
        console.log(`⚠️ Address mismatch during fetch: expected ${address}, got ${currentAddress}, skipping...`);
        return;
      }
      
      console.log('🔍 Fetching whitelist status...');
      set(state => ({
        loading: { ...state.loading, whitelist: true },
        errors: { ...state.errors, whitelist: null }
      }));
      
      try {
        const isWhitelisted = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'isWhitelisted',
          [address],
          `isWhitelisted(${address})`
        ) as boolean;
        
        // Verify address again (prevent address change during data fetch)
        const finalAddress = get().address;
        if (finalAddress !== address) {
          console.log(`⚠️ Address changed during fetch: expected ${address}, got ${finalAddress}, discarding result...`);
          return;
        }
        
        set(state => ({
          whitelist: { isWhitelisted },
          loading: { ...state.loading, whitelist: false },
          lastUpdated: { ...state.lastUpdated, whitelist: Date.now() }
        }));
        
        console.log(`✅ Whitelist status: ${isWhitelisted}`);
      } catch (error: unknown) {
        // If contract reverts (e.g., function doesn't exist or execution fails), treat as not whitelisted
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isContractRevert = errorMessage.includes('reverted') || 
                                 errorMessage.includes('execution reverted') ||
                                 errorMessage.includes('ContractFunctionExecutionError');
        
        if (isContractRevert) {
          console.log(`⚠️ Contract reverted for isWhitelisted, treating as not whitelisted`);
          
          // Verify address again
          const finalAddress = get().address;
          if (finalAddress !== address) {
            console.log(`⚠️ Address changed during fetch: expected ${address}, got ${finalAddress}, discarding result...`);
            return;
          }
          
          // Contract revert treated as not whitelisted
          set(state => ({
            whitelist: { isWhitelisted: false },
            loading: { ...state.loading, whitelist: false },
            lastUpdated: { ...state.lastUpdated, whitelist: Date.now() },
            errors: { ...state.errors, whitelist: null } // Don't log error, as this is normal contract behavior
          }));
          
          console.log(`✅ Whitelist status: false (contract reverted)`);
          return;
        }
        console.error('❌ Error fetching whitelist:', error);
        set(state => ({
          whitelist: { isWhitelisted: false },
          loading: { ...state.loading, whitelist: false },
          errors: { ...state.errors, whitelist: error instanceof Error ? error.message : 'Failed to fetch whitelist status' }
        }));
      }
    },
    
    fetchInviteCodes: async () => {
      const { address, isConnected } = get();
      
      if (!isConnected || !address) {
        console.log('⚠️ Cannot fetch invite codes: wallet not connected');
        return;
      }
      
      set(state => ({
        loading: { ...state.loading, inviteCodes: true },
        errors: { ...state.errors, inviteCodes: null }
      }));
      
      try {
        const data = await getUserInviteCodes(address);
        
        // Verify address again (prevent address change during data fetch)
        const finalAddress = get().address;
        if (finalAddress !== address) {
          console.log(`⚠️ Address changed during fetch: expected ${address}, got ${finalAddress}, discarding result...`);
          return;
        }
        
        set(state => ({
          inviteCodes: {
            inviteCodeStatus: data.inviteCodeStatus,
            ownedInviteCodes: data.ownedInviteCodes,
            pendingInviteCodes: data.pendingInviteCodes || [],
            usedInviteCode: data.usedInviteCode,
          },
          loading: { ...state.loading, inviteCodes: false },
          lastUpdated: { ...state.lastUpdated, inviteCodes: Date.now() }
        }));
        
        console.log(`✅ Invite codes fetched: status=${data.inviteCodeStatus}, owned=${data.ownedInviteCodes.length}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error fetching invite codes:`, errorMessage);
        
        // Verify address again
        const finalAddress = get().address;
        if (finalAddress !== address) {
          console.log(`⚠️ Address changed during fetch: expected ${address}, got ${finalAddress}, discarding result...`);
          return;
        }
        
        // On network error, set to default value instead of error state
        const isNetworkError = errorMessage.includes('Network error') || 
                              errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('NETWORK_ERROR');
        
        set(state => ({
          inviteCodes: {
            inviteCodeStatus: 'none',
            ownedInviteCodes: [],
            usedInviteCode: undefined,
          },
          loading: { ...state.loading, inviteCodes: false },
          lastUpdated: { ...state.lastUpdated, inviteCodes: Date.now() },
          errors: { ...state.errors, inviteCodes: isNetworkError ? null : errorMessage }
        }));
      }
    },
    
    fetchAllData: async () => {
      const state = get();
      const now = Date.now();
      
      // Debounce: skip if less than 3 seconds since last fetch
      if (now - state.lastFetchTime < 3000) {
        console.log('⏳ Store-level debounce: data fetch too frequent, skipping this request');
        return;
      }
      
      console.log('🔄 Fetching all Web3 data...');
      
      // Update last fetch time
      set(state => ({ ...state, lastFetchTime: now }));
      
      try {
        // Fetch basic data in parallel (including whitelist and invite codes)
        await Promise.all([
          get().fetchBalances(),
          get().fetchAllowances(),
          get().fetchNFTs(),
          get().fetchWhitelist(),
          get().fetchInviteCodes(),
        ]);
        
        // NFT-related data needs to fetch NFTs first, then shares and rewards
        const { nfts } = get();
        if (nfts.length > 0) {
          // Fetch NFT-related data in parallel
          await Promise.all([
            get().fetchPendingRewards(),
            get().fetchSellOrders(),
          ]);
        }
        
        // Trade history can be fetched independently
        await get().fetchTradeHistory();
        
        console.log('✅ All Web3 data fetched successfully');
      } catch (error) {
        console.error('❌ Error fetching all Web3 data:', error);
      }
    },
    
    refreshData: async () => {
      const state = get();
      const now = Date.now();
      
      // Smart refresh: skip if less than 2 seconds since last refresh
      if (now - state.lastRefreshTime < 2000) {
        console.log('⏳ Refresh too frequent, skipping this refresh');
        return;
      }
      
      console.log('🔄 Smart refreshing data...');
      set(state => ({ ...state, lastRefreshTime: now }));
      
      // Call fetchAllData
      await get().fetchAllData();
    },
    
    clearData: () => {
      console.log('🧹 Clearing Web3 data');
      set({
        balances: { usdt: '0', e: '0', bnb: '0' },
        allowances: { usdt: '0' },
        nfts: [],
        pendingRewards: [],
        sellOrders: [],
        tradeHistory: [],
        whitelist: { isWhitelisted: false },
        inviteCodes: {
          inviteCodeStatus: 'none',
          ownedInviteCodes: [],
          usedInviteCode: undefined,
        },
        loading: { 
          balances: false, 
          allowances: false, 
          nfts: false, 
          pendingRewards: false,
          sellOrders: false,
          tradeHistory: false,
          whitelist: false,
          inviteCodes: false
        },
        errors: { 
          balances: null, 
          allowances: null, 
          nfts: null, 
          pendingRewards: null,
          sellOrders: null,
          tradeHistory: null,
          whitelist: null,
          inviteCodes: null
        },
        lastUpdated: { 
          balances: null, 
          allowances: null, 
          nfts: null, 
          pendingRewards: null,
          sellOrders: null,
          tradeHistory: null,
          whitelist: null,
          inviteCodes: null
        },
      });
    },
  }))
);

// Global flag to ensure only one useWeb3Data instance is running
let isWeb3DataActive = false;

// Hook for easy access to Web3 data (read-only, does not trigger data fetching)
export function useWeb3Data() {
  const store = useWeb3Store();
  return store;
}

// Hook for Web3DataProvider to manage data fetching
export function useWeb3DataManager() {
  const store = useWeb3Store();
  const { walletManager, address, isConnected } = useWallet();
  
  // Use useRef to avoid infinite loop
  const prevWalletInfo = React.useRef({ walletManager, address, isConnected });
  const lastFetchTime = React.useRef(0);
  
  // Check if instance is already running
  React.useEffect(() => {
    if (isWeb3DataActive) {
      console.warn('⚠️ Multiple useWeb3DataManager instances detected, recommend using Web3DataProvider');
      return;
    }
    isWeb3DataActive = true;
    
    return () => {
      isWeb3DataActive = false;
    };
  }, []);
  
  // Sync wallet state to Store - only update when truly changed
  React.useEffect(() => {
    const current = { walletManager, address, isConnected };
    const prev = prevWalletInfo.current;
    
      // Only update Store when wallet info truly changes
      if (
        current.walletManager !== prev.walletManager ||
        current.address !== prev.address ||
        current.isConnected !== prev.isConnected
      ) {
        store.setWalletInfo(walletManager, address, isConnected).catch(err => {
          console.error('Failed to set wallet info:', err);
        });
        prevWalletInfo.current = current;
      }
  }, [walletManager, address, isConnected, store]); // Add store dependency
  
  // Automatically fetch data when wallet connects - add debounce mechanism
  React.useEffect(() => {
    // Only execute data fetching in the first instance
    if (!isWeb3DataActive) {
      return;
    }
    
    if (isConnected && address && walletManager) {
      const now = Date.now();
      // Debounce: skip if less than 5 seconds since last fetch
      if (now - lastFetchTime.current < 5000) {
        console.log('⏳ Data fetch too frequent, skipping this request');
        return;
      }
      
      lastFetchTime.current = now;
      console.log('🔄 Wallet state changed, starting data fetch...');
      store.fetchAllData();
    }
  }, [isConnected, address, walletManager, store]); // Add store dependency
  
  return store;
}
