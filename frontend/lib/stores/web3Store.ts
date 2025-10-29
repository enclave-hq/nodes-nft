"use client";

import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useWallet } from '@/lib/providers/WalletProvider';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { ERC20_ABI, NFT_MANAGER_ABI } from '@/lib/contracts/abis';
import type { WalletManager } from '@enclave-hq/wallet-sdk';
import { ChainType } from '@enclave-hq/wallet-sdk';

// NFT information interface
export interface NFTInfo {
  id: number;
  type: string;
  status: string;
  shares: string;
  totalShares: string;
  mintPrice: string;
  createdAt: string;
}

// User share information interface
export interface UserShareInfo {
  nftId: number;
  shares: string;
  debtProduced: string;
  withdrawnAfterDissolve: string;
}

// Pending reward information interface
export interface PendingRewardInfo {
  nftId: number;
  pendingProduced: string;  // Pending $E production
  pendingUsdt: string;     // Pending USDT rewards
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
  
  // User share information
  userShares: UserShareInfo[];
  
  // Pending reward information
  pendingRewards: PendingRewardInfo[];
  
  // Loading states
  loading: {
    balances: boolean;
    allowances: boolean;
    nfts: boolean;
    userShares: boolean;
    pendingRewards: boolean;
  };
  
  // Error information
  errors: {
    balances: string | null;
    allowances: string | null;
    nfts: string | null;
    userShares: string | null;
    pendingRewards: string | null;
  };
  
  // Last update time
  lastUpdated: {
    balances: number | null;
    allowances: number | null;
    nfts: number | null;
    userShares: number | null;
    pendingRewards: number | null;
  };
}

// Store状态接口
interface Web3Store extends Web3Data {
  // Actions
  fetchBalances: () => Promise<void>;
  fetchAllowances: () => Promise<void>;
  fetchNFTs: () => Promise<void>;
  fetchUserShares: () => Promise<void>;
  fetchPendingRewards: () => Promise<void>;
  fetchAllData: () => Promise<void>;
  refreshData: () => Promise<void>; // 智能刷新，避免频繁调用
  clearData: () => void;
  
  // 内部状态
  walletManager: WalletManager | null;
  address: string | null;
  isConnected: boolean;
  lastFetchTime: number; // 最后获取数据的时间戳
  lastRefreshTime: number; // 最后手动刷新的时间戳
  
  // 设置钱包信息
  setWalletInfo: (walletManager: WalletManager | null, address: string | null, isConnected: boolean) => void;
}

// 格式化代币金额的工具函数
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

// 请求限流和缓存机制
const requestCache = new Map<string, { result: unknown; timestamp: number; promise?: Promise<unknown> }>();
const REQUEST_CACHE_TTL = 10000; // 10秒缓存，增加缓存时间
const REQUEST_DELAY = 200; // 200ms延迟，增加延迟
const BATCH_SIZE = 3; // 批量处理大小

// 添加请求延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 批量处理请求
const batchRequests = async <T>(
  requests: (() => Promise<T>)[],
  batchSize: number = BATCH_SIZE
): Promise<T[]> => {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(req => req()));
    results.push(...batchResults);
    
    // 批次间添加延迟
    if (i + batchSize < requests.length) {
      await delay(REQUEST_DELAY);
    }
  }
  
  return results;
};

// RPC 健康检查已移除 - 所有 RPC 交互都应该通过 Wallet SDK 处理

// 合约调用辅助函数，带fallback机制和限流
export const callContractWithFallback = async (
  walletManager: WalletManager,
  contractAddress: string,
  abi: unknown[],
  functionName: string,
  args: unknown[] = [],
  operationName: string = 'contract call'
): Promise<unknown> => {
  // 生成缓存键
  const cacheKey = `${contractAddress}-${functionName}-${args.join(',')}`;
  
  // 检查缓存
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL) {
    console.log(`📋 Using cached result for ${operationName}`);
    return cached.result;
  }
  
  // 如果已有相同的请求在进行中，等待它完成
  if (cached?.promise) {
    console.log(`⏳ Waiting for existing request for ${operationName}`);
    return await cached.promise;
  }
  
  // 创建请求Promise
  const requestPromise = (async () => {
    try {
      // 添加请求延迟以避免过于频繁的调用
      await delay(REQUEST_DELAY);
      
      console.log(`📞 Calling ${operationName}...`);
      console.log(`📋 Call details:`, {
        contractAddress,
        functionName,
        args: args.map(arg => String(arg)),
        operationName
      });
      
      const result = await walletManager.readContract(contractAddress, abi, functionName, args);
      console.log(`✅ ${operationName} success:`, result.toString());
      
      // 缓存结果
      requestCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error: unknown) {
      // 清理缓存中的Promise
      requestCache.delete(cacheKey);
      throw error;
    }
  })();
  
  // 设置Promise到缓存中
  requestCache.set(cacheKey, { result: null, timestamp: Date.now(), promise: requestPromise });
  
  try {
    const result = await requestPromise;
    return result;
  } catch (error: unknown) {
    console.error(`❌ ${operationName} failed:`, error);
    
    // 安全地提取错误信息
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as { code?: string })?.code || 'N/A',
      data: (error as { data?: unknown })?.data || 'N/A',
      cause: (error as { cause?: unknown })?.cause || 'N/A',
      stack: error instanceof Error ? error.stack : 'N/A',
      name: error instanceof Error ? error.name : 'Unknown',
      toString: (error as { toString?: () => string })?.toString?.() || 'Unknown error'
    };
    
    console.error('❌ Error details:', errorDetails);
    
    // 所有 RPC 错误都应该在 Wallet SDK 层面处理
    console.log(`❌ RPC error detected: ${errorDetails.message}`);
    console.log(`❌ This should be handled by Wallet SDK's RPC fallback mechanism`);
    
    // 不再进行直接 RPC fallback，所有链交互都应该通过 Wallet SDK
    console.log(`❌ ${operationName} failed through Wallet SDK. This should be handled at the Wallet SDK level.`);
    throw error; // Throw original error
  }
};

// 初始化环境配置
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

// 创建Web3 Store
export const useWeb3Store = create<Web3Store>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态 - 直接初始化配置
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
    userShares: [],
    pendingRewards: [],
    loading: {
      balances: false,
      allowances: false,
      nfts: false,
      userShares: false,
      pendingRewards: false,
    },
    errors: {
      balances: null,
      allowances: null,
      nfts: null,
      userShares: null,
      pendingRewards: null,
    },
    lastUpdated: {
      balances: null,
      allowances: null,
      nfts: null,
      userShares: null,
      pendingRewards: null,
    },
    
    // 内部状态
    walletManager: null,
    address: null,
    isConnected: false,
    lastFetchTime: 0,
    lastRefreshTime: 0,
    
    // Actions
    setWalletInfo: (walletManager, address, isConnected) => {
      set({ walletManager, address, isConnected });
      
      // 如果钱包断开连接，清除数据
      if (!isConnected) {
        get().clearData();
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
        // 先单独测试USDT合约调用
        console.log('🔍 Testing USDT contract calls...');
        
        const usdtBalance = await callContractWithFallback(
          walletManager,
          config.contracts.usdt,
          ERC20_ABI as unknown[],
          'balanceOf',
          [address],
          'USDT balanceOf'
        );
        
        const usdtDecimals = await callContractWithFallback(
          walletManager,
          config.contracts.usdt,
          ERC20_ABI as unknown[],
          'decimals',
          [],
          'USDT decimals'
        );
        
        const eBalance = await callContractWithFallback(
          walletManager,
          config.contracts.enclaveToken,
          ERC20_ABI as unknown[],
          'balanceOf',
          [address],
          'Enclave Token balanceOf'
        );
        
        const eDecimals = await callContractWithFallback(
          walletManager,
          config.contracts.enclaveToken,
          ERC20_ABI as unknown[],
          'decimals',
          [],
          'Enclave Token decimals'
        );
        
        // 获取BNB余额 - 通过适配器的publicClient
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
        
        const formattedBalances = {
          usdt: formatTokenAmount(BigInt(String(usdtBalance)), Number(usdtDecimals)),
          e: formatTokenAmount(BigInt(String(eBalance)), Number(eDecimals)),
          bnb: formatTokenAmount(BigInt(bnbBalance.toString()), 18),
        };
        
        set(state => ({
          balances: formattedBalances,
          loading: { ...state.loading, balances: false },
          lastUpdated: { ...state.lastUpdated, balances: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching balances:', error);
        set(state => ({
          loading: { ...state.loading, balances: false },
          errors: { ...state.errors, balances: error instanceof Error ? error.message : 'Failed to fetch balances' }
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
      
      // 检查链ID是否匹配
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
        // 先测试单个调用
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
        // 获取用户的NFT列表
        const nftIds = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getUserNFTs',
          [address],
          'getUserNFTs'
        );
        
        console.log('✅ User NFT IDs:', nftIds);
        
        // 确保nftIds是数组
        const nftIdsArray = Array.isArray(nftIds) ? nftIds : [];
        
        // 为每个NFT获取详细信息
        const nftPromises = nftIdsArray.map(async (nftId: unknown) => {
          const poolData = await callContractWithFallback(
            walletManager,
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'nftPools',
            [String(nftId)],
            `nftPools(${nftId})`
          );
          
          // 确保poolData是数组
          if (!Array.isArray(poolData)) {
            throw new Error('Invalid pool data received from contract');
          }
          
          // poolData 是一个数组，包含所有结构体字段
          // 根据 ABI 顺序：nftId, nftType, status, createdAt, dissolvedAt, totalEclvLocked, remainingMintQuota, unlockedNotWithdrawn, lastUnlockTime, unlockedPeriods, totalShares, shareWeight
          const [
            , // nftIdFromPool (未使用)
            nftType,
            status,
            createdAt,
            , // dissolvedAt (未使用)
            totalEclvLocked,
            , // remainingMintQuota (未使用)
            , // unlockedNotWithdrawn (未使用)
            , // lastUnlockTime (未使用)
            , // unlockedPeriods (未使用)
            totalShares,
            , // shareWeight (未使用)
          ] = poolData;
          
          return {
            id: Number(nftId),
            type: Number(nftType) === 0 ? 'Standard' : 'Premium',
            status: Number(status) === 0 ? 'Live' : 'Dissolved',
            shares: totalShares.toString(),
            totalShares: totalShares.toString(),
            mintPrice: totalEclvLocked.toString(), // 使用 totalEclvLocked 作为 mintPrice
            createdAt: Number(createdAt) > 0 ? new Date(Number(createdAt) * 1000).toISOString() : new Date().toISOString(),
          };
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
    
    fetchUserShares: async () => {
      const { walletManager, address, isConnected, nfts } = get();
      
      if (!walletManager || !address || !isConnected || nfts.length === 0) {
        console.log('🔍 Wallet not connected or no NFTs, skipping user shares fetch');
        return;
      }
      
      console.log('🔍 Fetching user shares...');
      set(state => ({
        loading: { ...state.loading, userShares: true },
        errors: { ...state.errors, userShares: null }
      }));
      
      try {
        // 使用批量处理获取用户份额信息
        const shareRequests = nfts.map((nft) => () => 
          callContractWithFallback(
            walletManager,
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'userShares',
            [BigInt(nft.id), address],
            `userShares(${nft.id})`
          )
        );
        
        const shareDataArray = await batchRequests(shareRequests);
        
        const userShares = shareDataArray.map((shareData, index) => {
          const nft = nfts[index];
          
          // 检查 shareData 是否为有效数组
          if (!shareData || !Array.isArray(shareData)) {
            console.log(`ℹ️ No shares found for NFT ${nft.id} and user ${address}`);
            return {
              nftId: nft.id,
              shares: "0",
              debtProduced: "0",
              withdrawnAfterDissolve: "0",
            };
          }
          
          // shareData 是一个数组，包含所有结构体字段
          // 根据 ABI 顺序：shares, producedDebt, withdrawnAfterDissolve
          const [shares, producedDebt, withdrawnAfterDissolve] = shareData;
          
          return {
            nftId: nft.id,
            shares: shares.toString(),
            debtProduced: producedDebt.toString(),
            withdrawnAfterDissolve: withdrawnAfterDissolve.toString(),
          };
        });
        
        set(state => ({
          userShares,
          loading: { ...state.loading, userShares: false },
          lastUpdated: { ...state.lastUpdated, userShares: Date.now() }
        }));
        
      } catch (error: unknown) {
        console.error('❌ Error fetching user shares:', error);
        set(state => ({
          loading: { ...state.loading, userShares: false },
          errors: { ...state.errors, userShares: error instanceof Error ? error.message : 'Failed to fetch user shares' }
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
        // 使用批量处理获取待领取奖励
        const rewardRequests = nfts.flatMap((nft) => [
          () => callContractWithFallback(
            walletManager,
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'getPendingProduced',
            [nft.id, address],
            `getPendingProduced(${nft.id})`
          ),
          () => callContractWithFallback(
            walletManager,
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'getPendingReward',
            [nft.id, address, CONTRACT_ADDRESSES.usdt],
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
    
    fetchAllData: async () => {
      const state = get();
      const now = Date.now();
      
      // 防抖：如果距离上次获取数据不到3秒，则跳过
      if (now - state.lastFetchTime < 3000) {
        console.log('⏳ Store级别防抖：数据获取过于频繁，跳过此次请求');
        return;
      }
      
      console.log('🔄 Fetching all Web3 data...');
      
      // 更新最后获取时间
      set(state => ({ ...state, lastFetchTime: now }));
      
      try {
        // 并行获取基础数据
        await Promise.all([
          get().fetchBalances(),
          get().fetchAllowances(),
          get().fetchNFTs(),
        ]);
        
        // NFT相关数据需要先获取NFTs，再获取shares和rewards
        const { nfts } = get();
        if (nfts.length > 0) {
          // 并行获取NFT相关数据
          await Promise.all([
            get().fetchUserShares(),
            get().fetchPendingRewards(),
          ]);
        }
        
        console.log('✅ All Web3 data fetched successfully');
      } catch (error) {
        console.error('❌ Error fetching all Web3 data:', error);
      }
    },
    
    refreshData: async () => {
      const state = get();
      const now = Date.now();
      
      // 智能刷新：如果距离上次刷新不到2秒，则跳过
      if (now - state.lastRefreshTime < 2000) {
        console.log('⏳ 刷新过于频繁，跳过此次刷新');
        return;
      }
      
      console.log('🔄 智能刷新数据...');
      
      // 更新最后刷新时间
      set(state => ({ ...state, lastRefreshTime: now }));
      
      // 调用 fetchAllData
      await get().fetchAllData();
    },
    
    clearData: () => {
      console.log('🧹 Clearing Web3 data');
      set({
        balances: { usdt: '0', e: '0', bnb: '0' },
        allowances: { usdt: '0' },
        nfts: [],
        userShares: [],
        pendingRewards: [],
        loading: { balances: false, allowances: false, nfts: false, userShares: false, pendingRewards: false },
        errors: { balances: null, allowances: null, nfts: null, userShares: null, pendingRewards: null },
        lastUpdated: { balances: null, allowances: null, nfts: null, userShares: null, pendingRewards: null },
      });
    },
  }))
);

// 全局标志，确保只有一个useWeb3Data实例在运行
let isWeb3DataActive = false;

// Hook for easy access to Web3 data (只读，不触发数据获取)
export function useWeb3Data() {
  const store = useWeb3Store();
  return store;
}

// Hook for Web3DataProvider to manage data fetching
export function useWeb3DataManager() {
  const store = useWeb3Store();
  const { walletManager, address, isConnected } = useWallet();
  
  // 使用useRef来避免无限循环
  const prevWalletInfo = React.useRef({ walletManager, address, isConnected });
  const lastFetchTime = React.useRef(0);
  
  // 检查是否已经有实例在运行
  React.useEffect(() => {
    if (isWeb3DataActive) {
      console.warn('⚠️ 检测到多个useWeb3DataManager实例，建议使用Web3DataProvider');
      return;
    }
    isWeb3DataActive = true;
    
    return () => {
      isWeb3DataActive = false;
    };
  }, []);
  
  // 同步钱包状态到Store - 只在真正变化时更新
  React.useEffect(() => {
    const current = { walletManager, address, isConnected };
    const prev = prevWalletInfo.current;
    
    // 只有当钱包信息真正改变时才更新Store
    if (
      current.walletManager !== prev.walletManager ||
      current.address !== prev.address ||
      current.isConnected !== prev.isConnected
    ) {
      store.setWalletInfo(walletManager, address, isConnected);
      prevWalletInfo.current = current;
    }
  }, [walletManager, address, isConnected, store]); // 添加store依赖
  
  // 当钱包连接时自动获取数据 - 添加防抖机制
  React.useEffect(() => {
    // 只有在第一个实例时才执行数据获取
    if (!isWeb3DataActive) {
      return;
    }
    
    if (isConnected && address && walletManager) {
      const now = Date.now();
      // 防抖：如果距离上次获取数据不到5秒，则跳过
      if (now - lastFetchTime.current < 5000) {
        console.log('⏳ 数据获取过于频繁，跳过此次请求');
        return;
      }
      
      lastFetchTime.current = now;
      console.log('🔄 钱包状态变化，开始获取数据...');
      store.fetchAllData();
    }
  }, [isConnected, address, walletManager, store]); // 添加store依赖
  
  return store;
}
