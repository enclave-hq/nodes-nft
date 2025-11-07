"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { CONTRACT_ADDRESSES, GAS_CONFIG } from '@/lib/contracts/config';
import { NFT_MANAGER_ABI } from '@/lib/contracts/abis';
import type { BatchInfo } from '@/lib/contracts/config';

const ABI = NFT_MANAGER_ABI;

/**
 * Hook to get the current active batch
 */
export function useActiveBatch() {
  const { walletManager, isConnected } = useWallet();
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveBatch = useCallback(async () => {
    if (!walletManager || !isConnected) {
      setBatch(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 验证 ABI
      if (!ABI || !Array.isArray(ABI) || ABI.length === 0) {
        throw new Error('Invalid ABI: NFT_MANAGER_ABI must be a non-empty array');
      }
      
      // 1. Get active batch ID
      let activeBatchId: bigint;
      try {
        activeBatchId = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          ABI as unknown[],
          'getActiveBatch',
          []
        ) as bigint;
      } catch (contractError: unknown) {
        // 检查是否是钱包未连接错误
        const errorMessage = contractError instanceof Error ? contractError.message : String(contractError);
        const isWalletNotConnected = errorMessage.includes('WalletNotConnectedError') ||
                                     errorMessage.includes('No wallet is connected') ||
                                     errorMessage.includes('wallet not connected');

        if (isWalletNotConnected) {
          console.log('⚠️ Wallet not connected, skipping batch fetch');
          setBatch(null);
          setLoading(false);
          setError(null);
          return;
        }

        // 如果合约回滚（例如没有激活批次或合约未初始化），视为没有激活批次
        const isContractRevert = errorMessage.includes('reverted') ||
                                 errorMessage.includes('execution reverted') ||
                                 errorMessage.includes('ContractFunctionExecutionError');

        if (isContractRevert) {
          console.log('⚠️ Contract reverted for getActiveBatch, treating as no active batch');
          setBatch(null);
          setLoading(false);
          setError(null); // 不记录错误，因为这是正常的合约行为
          return;
        }
        // 如果是其他错误，重新抛出
        throw contractError;
      }

      if (activeBatchId === BigInt(0)) {
        setBatch(null);
        setLoading(false);
        return;
      }

      // 2. Get batch details
      const batchData = await walletManager.readContract(
        CONTRACT_ADDRESSES.nftManager,
        ABI as unknown[],
        'batches',
        [activeBatchId]
      ) as [bigint, bigint, bigint, bigint, boolean, bigint];

      // batchData structure: [batchId, maxMintable, currentMinted, mintPrice, active, createdAt]
      const [batchId, maxMintable, currentMinted, mintPrice, active, createdAt] = batchData;

      setBatch({
        batchId: batchId.toString(),
        maxMintable: maxMintable.toString(),
        currentMinted: currentMinted.toString(),
        mintPrice: mintPrice.toString(),
        active: active,
        createdAt: new Date(Number(createdAt) * 1000).toISOString(),
      });
    } catch (err) {
      console.error('Failed to fetch active batch:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch active batch');
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }, [walletManager, isConnected]);

  useEffect(() => {
    fetchActiveBatch();
  }, [fetchActiveBatch]);

  return {
    batch,
    loading,
    error,
    refetch: fetchActiveBatch,
  };
}

