"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { useWeb3Store, callContractWithFallback } from '../stores/web3Store';
import { CONTRACT_ADDRESSES, NFTType, GAS_CONFIG } from '../contracts/config';
import { NFT_MANAGER_ABI, ERC20_ABI } from '../contracts/abis';

export function useUserNFTs() {
  const { address, isConnected } = useWallet();
  const [nfts, setNfts] = useState<Array<{
    id: number;
    type: string;
    shares: number;
    totalShares: number;
    status: string;
    mintPrice: string;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  // Use useCallback to cache functions and avoid unnecessary recreation
  const fetchUserNFTs = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      // For now, return mock data - in real implementation, you'd scan for NFTs owned by user
      setNfts([
        {
          id: 1,
          type: 'Standard',
          shares: 10,
          totalShares: 10,
          status: 'Live',
          mintPrice: '10000',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Use useMemo to cache dependency arrays and avoid unnecessary recalculation
  const shouldFetch = useMemo(() => 
    isConnected && address, 
    [isConnected, address]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchUserNFTs();
    } else {
      setNfts([]);
    }
  }, [shouldFetch, fetchUserNFTs]);

  // Use useMemo to cache return values and avoid unnecessary recreation
  return useMemo(() => ({
    nfts,
    loading,
    refetch: fetchUserNFTs,
  }), [nfts, loading, fetchUserNFTs]);
}

export function useMintNFT() {
  const { address, isConnected, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mintNFT = async (nftType: number, recipient: string) => {
    if (!isConnected || !address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setMinting(true);
    setError(null);

    try {
      // Get mint price
      const mintPrice = nftType === NFTType.Premium ? "50000" : "10000";
      const mintPriceWei = BigInt(mintPrice) * BigInt(10 ** 18); // Convert to wei
      
      console.log('🚀 Starting NFT mint process:');
      console.log('- NFT Type:', nftType);
      console.log('- Recipient:', recipient);
      console.log('- Mint Price:', mintPrice, 'USDT');
      console.log('- Mint Price (wei):', mintPriceWei.toString());
      console.log('- Gas Price: Handled automatically by Wallet SDK');
      console.log('');
      
      // First check current allowance amount
      console.log('🔍 Step 1: Checking current USDT allowance...');
      console.log('- User Address:', address);
      console.log('- NFT Manager Address:', CONTRACT_ADDRESSES.nftManager);
      console.log('- Required Allowance:', mintPriceWei.toString());
      
      const currentAllowance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as unknown[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      );
      
      const allowanceBigInt = BigInt(currentAllowance.toString());
      const requiredBigInt = BigInt(mintPriceWei.toString());
      
      console.log('✅ Current Allowance:', allowanceBigInt.toString());
      console.log('✅ Required Allowance:', requiredBigInt.toString());
      console.log('🔍 Allowance Comparison:', allowanceBigInt >= requiredBigInt ? '✅ Sufficient' : '❌ Insufficient');

      // Only approve if allowance is insufficient
      if (allowanceBigInt < requiredBigInt) {
        console.log('📝 Step 2: Approving USDT spending (current allowance insufficient)...');
        const approveTxHash = await walletManager.writeContract(
          CONTRACT_ADDRESSES.usdt,
          ERC20_ABI as unknown[],
          'approve',
          [CONTRACT_ADDRESSES.nftManager, mintPriceWei.toString()],
        {
          gas: GAS_CONFIG.gasLimits.erc20Approve, // 设置gas limit
          gasPrice: 'auto', // 使用自动 Gas Price
        }
        );
        
        console.log('✅ USDT授权交易哈希:', approveTxHash);
        
        // Wait for approval transaction
        console.log('⏳ 等待USDT授权确认...');
        const approveReceipt = await walletManager.waitForTransaction(approveTxHash);
        console.log('✅ USDT授权确认完成');
        
        // 额外等待确保状态更新
        console.log('⏳ 等待状态更新...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        console.log('📋 USDT授权交易详情:', {
          hash: approveTxHash,
          status: approveReceipt.status,
          gasUsed: approveReceipt.gasUsed?.toString(),
          blockNumber: approveReceipt.blockNumber?.toString()
        });
        
        // 检查授权是否成功
        console.log('🔍 检查授权交易状态:', approveReceipt.status);
        if ((approveReceipt as { status: string }).status !== '0x1' && approveReceipt.status !== 'success') {
          throw new Error('USDT授权交易失败');
        }
        
        // 验证新的授权金额
        console.log('🔍 验证新的USDT授权金额...');
        const newAllowance = await walletManager.readContract(
          CONTRACT_ADDRESSES.usdt,
          ERC20_ABI as unknown[],
          'allowance',
          [address, CONTRACT_ADDRESSES.nftManager]
        );
        
        const newAllowanceBigInt = BigInt(newAllowance.toString());
        console.log('✅ 新授权金额:', newAllowanceBigInt.toString());
        
        if (newAllowanceBigInt < requiredBigInt) {
          console.error('❌ 授权后金额仍然不足:', {
            current: newAllowanceBigInt.toString(),
            required: requiredBigInt.toString(),
            difference: (requiredBigInt - newAllowanceBigInt).toString()
          });
          throw new Error(`USDT授权金额不足: 当前${newAllowanceBigInt.toString()}, 需要${requiredBigInt.toString()}`);
        }
        
        console.log('✅ USDT授权金额验证通过');
      } else {
        console.log('✅ 当前授权金额足够，跳过授权步骤');
      }

      // Mint NFT using wallet SDK with explicit gasPrice and gas limit
      console.log('🎨 步骤2: 铸造NFT...');
      console.log('📋 铸造参数详情:');
      console.log('- 合约地址:', CONTRACT_ADDRESSES.nftManager);
      console.log('- 函数名: mintNFT');
      console.log('- NFT类型:', nftType, '(0=Standard, 1=Premium)');
      console.log('- Gas limit:', GAS_CONFIG.gasLimits.mintNFT);
      console.log('- Gas price: 0.3 Gwei (配置值)');
      console.log('- 用户地址:', address);
      console.log('- USDT授权金额:', allowanceBigInt.toString());
      console.log('- 合约函数签名: mintNFT(uint8 nftType_)');
      
      console.log('📞 调用合约函数...');
      const mintTxHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'mintNFT',
        [nftType], // 只有一个参数：nftType (0=Standard, 1=Premium)
        {
          gas: GAS_CONFIG.gasLimits.mintNFT, // 使用配置的gas limit
          gasPrice: 'auto', // 使用自动 Gas Price
        }
      );
      
      console.log('✅ NFT铸造交易哈希:', mintTxHash);
      console.log('🔗 交易链接: https://testnet.bscscan.com/tx/' + mintTxHash);
      
      // Wait for mint transaction
      console.log('⏳ 等待NFT铸造确认...');
      console.log('📋 等待交易详情:');
      console.log('- 交易哈希:', mintTxHash);
      console.log('- 网络: BSC Testnet');
      console.log('- 区块浏览器: https://testnet.bscscan.com');
      
      const receipt = await walletManager.waitForTransaction(mintTxHash);
      
      console.log('✅ NFT铸造确认完成');
      console.log('📋 交易确认详情:');
      console.log('- 状态:', receipt.status);
      console.log('- Gas使用:', receipt.gasUsed?.toString());
      console.log('- Gas价格:', (receipt as { gasPrice?: string }).gasPrice?.toString());
      console.log('- 区块号:', receipt.blockNumber?.toString());
      console.log('- 区块哈希:', receipt.blockHash);
      console.log('- 交易索引:', (receipt as { transactionIndex?: string }).transactionIndex?.toString());
      
      // 检查交易状态
      if (receipt.status === 'success' || (receipt as { status: string }).status === '0x1') {
        console.log('🎉 NFT铸造成功！');
      } else {
        console.log('❌ NFT铸造失败，状态:', receipt.status);
        throw new Error(`NFT铸造失败: 交易状态 ${receipt.status}`);
      }
      
      // 分析交易日志
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 交易事件日志:');
        console.log('- 事件数量:', receipt.logs.length);
        receipt.logs.forEach((log, index) => {
          console.log(`- 事件${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data,
          });
        });
      } else {
        console.log('⚠️ 没有交易事件日志');
      }
      
      // Extract NFT ID from events (simplified for now)
      const nftId = "1"; // In real implementation, parse from receipt logs
      
      // 🔄 更新web3Store数据
      console.log('🔄 更新Web3数据...');
      await web3Store.refreshData();
      console.log('✅ Web3数据更新完成');
      
      return {
        success: true,
        transactionHash: mintTxHash,
        nftId: parseInt(nftId),
      };
    } catch (err) {
      console.error('❌ NFT铸造过程中发生错误:');
      console.error('❌ 错误对象:', err);
      console.error('❌ 错误类型:', typeof err);
      console.error('❌ 错误名称:', err instanceof Error ? err.name : 'Unknown');
      console.error('❌ 错误消息:', err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ 错误堆栈:', err instanceof Error ? err.stack : 'No stack trace');
      
      // 检查是否是特定的错误类型
      if (err instanceof Error) {
        if (err.message.includes('Transaction reverted')) {
          console.error('🔍 交易被revert，可能的原因:');
          console.error('- 合约逻辑检查失败');
          console.error('- 用户余额不足');
          console.error('- 授权金额不足');
          console.error('- 合约状态不正确');
          console.error('- Gas limit不足');
          console.error('- 合约函数参数错误');
        } else if (err.message.includes('insufficient funds')) {
          console.error('🔍 资金不足错误:');
          console.error('- 检查BNB余额是否足够支付Gas费用');
        } else if (err.message.includes('user rejected')) {
          console.error('🔍 用户拒绝错误:');
          console.error('- 用户在钱包中拒绝了交易');
        }
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Minting failed';
      setError(errorMessage);
      throw err;
    } finally {
      setMinting(false);
    }
  };

  return {
    mintNFT,
    minting,
    error,
  };
}

export function useNFTPool(nftId: number) {
  const { walletManager } = useWallet();
  const [pool, setPool] = useState<{
    nftType: number;
    status: number;
    createdAt: string;
    remainingMintQuota: string;
    unlockedNotWithdrawn: string;
    unlockedPeriods: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // 使用 useCallback 缓存函数
  const fetchPool = useCallback(async () => {
    if (!walletManager) return;
    
    setLoading(true);
    try {
      const poolData = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'nftPools',
        [nftId],
        `nftPools(${nftId})`
      );
      
      // 检查 poolData 是否为有效数组
      if (!poolData || !Array.isArray(poolData)) {
        console.error('❌ Invalid poolData received:', poolData);
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
        , // totalEclvLocked (未使用)
        remainingMintQuota,
        unlockedNotWithdrawn,
        , // lastUnlockTime (未使用)
        unlockedPeriods,
        , // totalShares (未使用)
        , // shareWeight (未使用)
      ] = poolData;
      
      setPool({
        nftType: Number(nftType),
        status: Number(status),
        createdAt: Number(createdAt) > 0 ? new Date(Number(createdAt) * 1000).toISOString() : new Date().toISOString(),
        remainingMintQuota: remainingMintQuota ? String(remainingMintQuota) : "0",
        unlockedNotWithdrawn: unlockedNotWithdrawn ? String(unlockedNotWithdrawn) : "0",
        unlockedPeriods: unlockedPeriods ? String(unlockedPeriods) : "0",
      });
    } catch (error) {
      console.error('Error fetching NFT pool:', error);
    } finally {
      setLoading(false);
    }
  }, [walletManager, nftId]);

  // 使用 useMemo 缓存依赖条件
  const shouldFetch = useMemo(() => 
    nftId && walletManager, 
    [nftId, walletManager]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchPool();
    }
  }, [shouldFetch, fetchPool]);

  // 使用 useMemo 缓存返回值
  return useMemo(() => ({ 
    data: pool, 
    loading, 
    refetch: fetchPool 
  }), [pool, loading, fetchPool]);
}

export function useUserShare(nftId: number) {
  const { address, walletManager } = useWallet();
  const [userShare, setUserShare] = useState<{
    shares: string;
    debtProduced: string;
    withdrawnAfterDissolve: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // 使用 useCallback 缓存函数
  const fetchUserShare = useCallback(async () => {
    if (!address || !walletManager) return;
    
    setLoading(true);
    try {
      // 使用 web3Store 中的 callContractWithFallback 机制
      const shareData = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'userShares',
        [BigInt(nftId), address],
        `userShares(${nftId})`
      );
      
      // 检查 shareData 是否为有效数组
      if (!shareData || !Array.isArray(shareData)) {
        console.log(`ℹ️ No shares found for NFT ${nftId} and user ${address}`);
        // 用户没有该NFT的份额，返回默认值
        setUserShare({
          shares: "0",
          debtProduced: "0",
          withdrawnAfterDissolve: "0",
        });
        return;
      }
      
      // shareData 是一个数组，包含所有结构体字段
      // 根据 ABI 顺序：shares, producedDebt, withdrawnAfterDissolve
      const [shares, producedDebt, withdrawnAfterDissolve] = shareData;
      
      setUserShare({
        shares: shares ? String(shares) : "0",
        debtProduced: producedDebt ? String(producedDebt) : "0",
        withdrawnAfterDissolve: withdrawnAfterDissolve ? String(withdrawnAfterDissolve) : "0",
      });
    } catch (error) {
      console.error('Error fetching user share:', error);
    } finally {
      setLoading(false);
    }
  }, [address, walletManager, nftId]);

  // 使用 useMemo 缓存依赖条件
  const shouldFetch = useMemo(() => 
    nftId && address && walletManager, 
    [nftId, address, walletManager]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchUserShare();
    }
  }, [shouldFetch, fetchUserShare]);

  // 使用 useMemo 缓存返回值
  return useMemo(() => ({ 
    data: userShare, 
    loading, 
    refetch: fetchUserShare 
  }), [userShare, loading, fetchUserShare]);
}

export function usePendingProduced(nftId: number) {
  const { address, walletManager } = useWallet();
  const [pendingProduced, setPendingProduced] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  // 使用 useCallback 缓存函数
  const fetchPendingProduced = useCallback(async () => {
    if (!address || !walletManager) return;
    
    setLoading(true);
    try {
      const pending = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getPendingProduced',
        [nftId, address],
        `getPendingProduced(${nftId})`
      );
      setPendingProduced(pending ? String(pending) : "0");
    } catch (error) {
      console.error('Error fetching pending produced:', error);
    } finally {
      setLoading(false);
    }
  }, [address, walletManager, nftId]);

  // 使用 useMemo 缓存依赖条件
  const shouldFetch = useMemo(() => 
    nftId && address && walletManager, 
    [nftId, address, walletManager]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchPendingProduced();
    }
  }, [shouldFetch, fetchPendingProduced]);

  // 使用 useMemo 缓存返回值
  return useMemo(() => ({ 
    data: pendingProduced, 
    loading, 
    refetch: fetchPendingProduced 
  }), [pendingProduced, loading, fetchPendingProduced]);
}

export function usePendingReward(nftId: number, tokenAddress: string) {
  const { address, walletManager } = useWallet();
  const [pendingReward, setPendingReward] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  // 使用 useCallback 缓存函数
  const fetchPendingReward = useCallback(async () => {
    if (!address || !walletManager || !tokenAddress) return;
    
    setLoading(true);
    try {
      const pending = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getPendingReward',
        [nftId, address, tokenAddress],
        `getPendingReward(${nftId})`
      );
      setPendingReward(pending ? String(pending) : "0");
    } catch (error) {
      console.error('Error fetching pending reward:', error);
    } finally {
      setLoading(false);
    }
  }, [address, walletManager, nftId, tokenAddress]);

  // 使用 useMemo 缓存依赖条件
  const shouldFetch = useMemo(() => 
    nftId && address && walletManager && tokenAddress, 
    [nftId, address, walletManager, tokenAddress]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchPendingReward();
    }
  }, [shouldFetch, fetchPendingReward]);

  // 使用 useMemo 缓存返回值
  return useMemo(() => ({ 
    data: pendingReward, 
    loading, 
    refetch: fetchPendingReward 
  }), [pendingReward, loading, fetchPendingReward]);
}

export function useClaimProduced() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [claiming, setClaiming] = useState(false);

  const claimProduced = async (nftId: number) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setClaiming(true);
    try {
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'claimProduced',
        [nftId],
        {
          gasPrice: 'auto', // 使用自动 Gas Price
          gas: GAS_CONFIG.gasLimits.contractCall, // 设置gas limit
        }
      );
      
      await walletManager.waitForTransaction(txHash);
      
      // 🔄 更新web3Store数据
      console.log('🔄 更新Web3数据...');
      await web3Store.refreshData();
      console.log('✅ Web3数据更新完成');
      
      return { success: true, transactionHash: txHash };
    } catch (error) {
      console.error('Error claiming produced:', error);
      throw error;
    } finally {
      setClaiming(false);
    }
  };

  return { mutateAsync: claimProduced, isLoading: claiming };
}

export function useClaimReward() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [claiming, setClaiming] = useState(false);

  const claimReward = async (nftId: number, token: string) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setClaiming(true);
    try {
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'claimReward',
        [nftId, token],
        {
          gasPrice: 'auto', // 使用自动 Gas Price
          gas: GAS_CONFIG.gasLimits.contractCall, // 设置gas limit
        }
      );
      
      await walletManager.waitForTransaction(txHash);
      
      // 🔄 更新web3Store数据
      console.log('🔄 更新Web3数据...');
      await web3Store.refreshData();
      console.log('✅ Web3数据更新完成');
      
      return { success: true, transactionHash: txHash };
    } catch (error) {
      console.error('Error claiming reward:', error);
      throw error;
    } finally {
      setClaiming(false);
    }
  };

  return { mutateAsync: claimReward, isLoading: claiming };
}

export function useBatchClaimProduced() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [claiming, setClaiming] = useState(false);

  const batchClaimProduced = async (nftIds: number[]) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setClaiming(true);
    try {
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'batchClaimProduced',
        [nftIds],
        {
          gasPrice: 'auto', // 使用自动 Gas Price
          gas: GAS_CONFIG.gasLimits.contractCall, // 设置gas limit
        }
      );
      
      await walletManager.waitForTransaction(txHash);
      
      // 🔄 更新web3Store数据
      console.log('🔄 更新Web3数据...');
      await web3Store.refreshData();
      console.log('✅ Web3数据更新完成');
      
      return { success: true, transactionHash: txHash };
    } catch (error) {
      console.error('Error batch claiming produced:', error);
      throw error;
    } finally {
      setClaiming(false);
    }
  };

  return { mutateAsync: batchClaimProduced, isLoading: claiming };
}

export function useAvailableShares(nftId: number) {
  const { address, walletManager } = useWallet();
  const [availableShares, setAvailableShares] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAvailableShares = useCallback(async () => {
    if (!address || !walletManager || !nftId) {
      setAvailableShares(0);
      return;
    }

    setIsLoading(true);
    try {
      // 暂时简化：直接获取总份额作为可用份额
      const shareData = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'userShares',
        [BigInt(nftId), address],
        `userShares(${nftId})`
      );
      
      // 检查 shareData 是否为有效数组
      if (!shareData || !Array.isArray(shareData) || shareData.length === 0) {
        console.log(`ℹ️ No shares found for NFT ${nftId} and user ${address}`);
        setAvailableShares(0);
        return;
      }
      
      const totalShares = Number(shareData[0].toString());
      setAvailableShares(totalShares);
    } catch (error) {
      console.error('Failed to fetch available shares:', error);
      setAvailableShares(0);
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, nftId]);

  useEffect(() => {
    fetchAvailableShares();
  }, [fetchAvailableShares]);

  return { availableShares, isLoading, refetch: fetchAvailableShares };
}

export function useUserSharesInfo(nftId: number) {
  const { address, walletManager } = useWallet();
  const [totalShares, setTotalShares] = useState<number>(0);
  const [availableShares, setAvailableShares] = useState<number>(0);
  const [listedShares, setListedShares] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSharesInfo = useCallback(async () => {
    if (!address || !walletManager || !nftId) {
      setTotalShares(0);
      setAvailableShares(0);
      setListedShares(0);
      return;
    }

    setIsLoading(true);
    try {
      // 获取总份额 - 使用 web3Store 的 callContractWithFallback 机制
      const shareData = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'userShares',
        [BigInt(nftId), address],
        `userShares(${nftId})`
      );

      // 检查 shareData 是否为有效数组
      if (!shareData || !Array.isArray(shareData) || shareData.length === 0) {
        console.log(`ℹ️ No shares found for NFT ${nftId} and user ${address}`);
        setTotalShares(0);
        setAvailableShares(0);
        setListedShares(0);
        return;
      }

      const totalNum = Number(shareData[0].toString()); // shares 是第一个字段
      
      // 暂时简化：假设没有挂单，所有份额都可出售
      // TODO: 修复 getAvailableShares 函数后再启用
      const availableNum = totalNum;
      const listedNum = 0;

      setTotalShares(totalNum);
      setAvailableShares(availableNum);
      setListedShares(listedNum);
    } catch (error) {
      console.error('Failed to fetch shares info:', error);
      setTotalShares(0);
      setAvailableShares(0);
      setListedShares(0);
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, nftId]);

  useEffect(() => {
    fetchSharesInfo();
  }, [fetchSharesInfo]);

  return { 
    totalShares, 
    availableShares, 
    listedShares, 
    isLoading, 
    refetch: fetchSharesInfo 
  };
}

export function useCreateSellOrder() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const createSellOrder = useCallback(async (params: {
    nftId: number;
    shares: number;
    pricePerShare: bigint;
  }) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      console.log('📝 创建出售订单...');
      console.log('📋 订单参数:');
      console.log('- NFT ID:', params.nftId);
      console.log('- 份额数量:', params.shares);
      console.log('- 每份额价格:', params.pricePerShare.toString(), 'wei');
      console.log('- Gas limit:', GAS_CONFIG.gasLimits.createSellOrder);
      console.log('- Gas price: 自动获取 (Wallet SDK)');

      // 🔍 调试：检查用户份额情况
      console.log('🔍 检查用户份额情况...');
      try {
        const userShareCount = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getUserShareCount',
          [BigInt(params.nftId), address],
          `getUserShareCount(${params.nftId})`
        );
        console.log('📊 用户总份额:', userShareCount ? String(userShareCount) : "0");

        const availableShares = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getAvailableShares',
          [BigInt(params.nftId), address],
          `getAvailableShares(${params.nftId})`
        );
        const availableSharesStr = availableShares ? String(availableShares) : "0";
        console.log('📊 可用份额:', availableSharesStr);

        if (BigInt(availableSharesStr) < BigInt(params.shares)) {
          throw new Error(`可用份额不足: 需要 ${params.shares} 份额，但只有 ${availableSharesStr} 份额可用`);
        }
      } catch (error) {
        console.error('❌ 份额检查失败:', error);
        throw error;
      }

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'createSellOrder',
        [BigInt(params.nftId), BigInt(params.shares), params.pricePerShare],
        {
          gas: GAS_CONFIG.gasLimits.createSellOrder,
          gasPrice: 'auto', // 使用自动 Gas Price
        }
      );

      console.log('✅ 创建订单交易哈希:', txHash);
      console.log('⏳ 等待交易确认...');

      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ 订单创建确认完成');
      console.log('📋 交易详情:', {
        hash: receipt.transactionHash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber?.toString(),
      });

      // 刷新数据
      await web3Store.refreshData();

      // 从交易日志中解析Order ID
      let orderId = 'unknown';
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 交易事件日志:', receipt.logs.length, '个事件');
        
        // 查找 SellOrderCreated 事件
        // SellOrderCreated(uint256,uint256,address,uint256,uint256) 的事件签名哈希
        const sellOrderCreatedTopic = '0x019885652a4a8dfdfca02c68db30c0e34d05185a6ffcd7779d140e33d1a2a90c';
        
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          console.log(`📋 事件${i}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data
          });
          
          if (log.topics && log.topics[0] === sellOrderCreatedTopic) {
            // orderId 是第一个 indexed 参数，在 topics[1] 中
            orderId = BigInt(log.topics[1]).toString();
            console.log('✅ 解析到Order ID:', orderId);
            break;
          }
        }
      }

      return {
        success: true,
        transactionHash: txHash,
        orderId: orderId
      };
    } catch (error: unknown) {
      console.error('❌ 创建订单失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return {
    mutateAsync: createSellOrder,
    isLoading,
  };
}

export function useTransferShares() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const transferShares = useCallback(async (params: {
    nftId: number;
    recipient: string;
    shares: number;
  }) => {
    if (!walletManager || !address) {
      throw new Error('钱包未连接');
    }

    setIsLoading(true);

    try {
      console.log('🔄 开始转让份额:', params);

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'transferShares',
        [BigInt(params.nftId), params.recipient, BigInt(params.shares)],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      console.log('✅ 转让交易已提交:', txHash);

      // 等待交易确认
      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ 转让交易已确认:', receipt);

      // 刷新数据
      await web3Store.refreshData();

      return txHash;
    } catch (error: unknown) {
      console.error('❌ 转让失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return {
    mutateAsync: transferShares,
    isLoading,
  };
}

/**
 * Hook to get dissolution proposal for an NFT
 */
export function useDissolutionProposal(nftId: number) {
  const { walletManager } = useWallet();
  const [data, setData] = useState<{
    nftId: number;
    proposer: string;
    createdAt: number;
    approvalCount: number;
    totalShareholderCount: number;
    executed: boolean;
    exists: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!walletManager) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const proposal = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getDissolutionProposal',
        [BigInt(nftId)]
      );
      
      // 检查 proposal 是否为有效数组
      if (!proposal || !Array.isArray(proposal) || proposal.length < 6) {
        console.error('❌ Invalid proposal data received:', proposal);
        throw new Error('Invalid proposal data received from contract');
      }
      
      const [proposalNftId, proposer, createdAt, approvalCount, totalShareholderCount, executed] = proposal;
      
      setData({
        nftId: Number(proposalNftId),
        proposer,
        createdAt: Number(createdAt),
        approvalCount: Number(approvalCount),
        totalShareholderCount: Number(totalShareholderCount),
        executed,
        exists: proposer !== '0x0000000000000000000000000000000000000000'
      });
    } catch (err: unknown) {
      console.error('Failed to fetch dissolution proposal:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [walletManager, nftId]);

  useEffect(() => {
    // 添加防抖，避免频繁调用
    const timeoutId = setTimeout(() => {
      fetchProposal();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [fetchProposal]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchProposal,
  };
}

/**
 * Hook to propose NFT dissolution
 */
export function useProposeDissolution() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const proposeDissolution = useCallback(async (nftId: number) => {
    if (!walletManager || !address) {
      throw new Error('钱包未连接');
    }

    setIsLoading(true);

    try {
      console.log('🗳️ 提议解散 NFT:', nftId);

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'proposeDissolution',
        [BigInt(nftId)],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      console.log('✅ 解散提议交易已提交:', txHash);

      // 等待交易确认
      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ 解散提议交易已确认:', receipt);

      // 刷新数据
      await web3Store.refreshData();

      return txHash;
    } catch (error: unknown) {
      console.error('❌ 解散提议失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return {
    mutateAsync: proposeDissolution,
    isLoading,
  };
}

/**
 * Hook to approve dissolution proposal
 */
export function useApproveDissolution() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const approveDissolution = useCallback(async (nftId: number) => {
    if (!walletManager || !address) {
      throw new Error('钱包未连接');
    }

    setIsLoading(true);

    try {
      console.log('✅ 同意解散提议 NFT:', nftId);

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'approveDissolution',
        [BigInt(nftId)],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      console.log('✅ 同意解散交易已提交:', txHash);

      // 等待交易确认
      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ 同意解散交易已确认:', receipt);

      // 刷新数据
      await web3Store.refreshData();

      return txHash;
    } catch (error: unknown) {
      console.error('❌ 同意解散失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return {
    mutateAsync: approveDissolution,
    isLoading,
  };
}
