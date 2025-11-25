"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../contracts/config';
import { NFT_MANAGER_ABI, ERC20_ABI } from '../contracts/abis';
import { Interface } from 'ethers';

/**
 * ZKPayVault ABI (simplified for balance queries)
 */
const ZKPAY_VAULT_ABI = [
  {
    "inputs": [{"internalType": "string", "name": "tokenKey", "type": "string"}],
    "name": "platformFeeBalances",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "tokenKey", "type": "string"}],
    "name": "buybackFeeBalances",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "tokenKey", "type": "string"}],
    "name": "nodeMultisigFeeBalances",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface VaultBalance {
  platformFee: string;
  buybackFee: string;
  nodeMultisigFee: string;
  total: string;
}

export interface RewardDistributionRecord {
  token: string;
  totalAmount: string;
  nftAmount: string;
  multisigAmount: string;
  accRewardPerNFT: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface UnlockRecord {
  nftId: number;
  owner: string;
  amount: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Hook to query ZKPayVault balances for a token
 */
export function useVaultBalances(vaultAddress: string, tokenKey: string = 'USDT') {
  const { walletManager } = useWallet();
  const [balances, setBalances] = useState<VaultBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!walletManager || !vaultAddress) {
      setBalances(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [platformFee, buybackFee, nodeMultisigFee] = await Promise.all([
        walletManager.readContract(
          vaultAddress as `0x${string}`,
          ZKPAY_VAULT_ABI as unknown[],
          'platformFeeBalances',
          [tokenKey]
        ) as Promise<bigint>,
        walletManager.readContract(
          vaultAddress as `0x${string}`,
          ZKPAY_VAULT_ABI as unknown[],
          'buybackFeeBalances',
          [tokenKey]
        ) as Promise<bigint>,
        walletManager.readContract(
          vaultAddress as `0x${string}`,
          ZKPAY_VAULT_ABI as unknown[],
          'nodeMultisigFeeBalances',
          [tokenKey]
        ) as Promise<bigint>,
      ]);

      const total = platformFee + buybackFee + nodeMultisigFee;

      setBalances({
        platformFee: platformFee.toString(),
        buybackFee: buybackFee.toString(),
        nodeMultisigFee: nodeMultisigFee.toString(),
        total: total.toString(),
      });
    } catch (err) {
      console.error('Error fetching vault balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch vault balances');
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }, [walletManager, vaultAddress, tokenKey]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    data: balances,
    loading,
    error,
    refetch: fetchBalances,
  };
}

/**
 * Hook to query RewardDistributed events from NFT Manager
 */
export function useRewardDistributionRecords(limit: number = 50) {
  const { walletManager } = useWallet();
  const [records, setRecords] = useState<RewardDistributionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!walletManager || !CONTRACT_ADDRESSES.nftManager) {
      setRecords([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current block number
      const currentBlock = await walletManager.getBlockNumber();
      
      // Query events from last 10000 blocks (approximately last few days on BSC)
      const fromBlock = Math.max(0, currentBlock - 10000);
      const toBlock = currentBlock;

      console.log(`🔍 Querying RewardDistributed events from block ${fromBlock} to ${currentBlock}`);

      // Get event logs
      const logs = await walletManager.getLogs({
        address: CONTRACT_ADDRESSES.nftManager,
        fromBlock,
        toBlock,
        topics: [
          // RewardDistributed event signature
          '0x' + Interface.from(NFT_MANAGER_ABI as any[]).getEvent('RewardDistributed')?.topicHash?.slice(2)
        ],
      });

      console.log(`📋 Found ${logs.length} RewardDistributed events`);

      // Parse events
      const nftManagerInterface = Interface.from(NFT_MANAGER_ABI as any[]);
      const parsedRecords: RewardDistributionRecord[] = [];

      for (const log of logs) {
        try {
          const parsedLog = nftManagerInterface.parseLog({
            topics: log.topics || [],
            data: log.data || '0x',
            address: log.address,
          } as any);

          if (parsedLog && parsedLog.name === 'RewardDistributed') {
            const args = parsedLog.args as any[];
            parsedRecords.push({
              token: args[0], // address token
              totalAmount: args[1].toString(), // uint256 totalAmount
              nftAmount: args[2].toString(), // uint256 nftAmount
              multisigAmount: args[3].toString(), // uint256 multisigAmount
              accRewardPerNFT: args[4].toString(), // uint256 accRewardPerNFT
              timestamp: Number(args[5]), // uint256 timestamp
              blockNumber: Number(log.blockNumber),
              transactionHash: log.transactionHash || '',
            });
          }
        } catch (parseError) {
          console.warn('Failed to parse log:', parseError);
        }
      }

      // Sort by timestamp descending (newest first)
      parsedRecords.sort((a, b) => b.timestamp - a.timestamp);

      // Limit results
      setRecords(parsedRecords.slice(0, limit));
    } catch (err) {
      console.error('Error fetching reward distribution records:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reward distribution records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [walletManager, limit]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    data: records,
    loading,
    error,
    refetch: fetchRecords,
  };
}

/**
 * Hook to query UnlockedWithdrawn events from NFT Manager
 */
export function useUnlockRecords(limit: number = 50) {
  const { walletManager } = useWallet();
  const [records, setRecords] = useState<UnlockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!walletManager || !CONTRACT_ADDRESSES.nftManager) {
      setRecords([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current block number
      const currentBlock = await walletManager.getBlockNumber();
      
      // Query events from last 10000 blocks
      const fromBlock = Math.max(0, currentBlock - 10000);
      const toBlock = currentBlock;

      console.log(`🔍 Querying UnlockedWithdrawn events from block ${fromBlock} to ${currentBlock}`);

      // Get event logs
      const logs = await walletManager.getLogs({
        address: CONTRACT_ADDRESSES.nftManager,
        fromBlock,
        toBlock,
        topics: [
          // UnlockedWithdrawn event signature
          '0x' + Interface.from(NFT_MANAGER_ABI as any[]).getEvent('UnlockedWithdrawn')?.topicHash?.slice(2)
        ],
      });

      console.log(`📋 Found ${logs.length} UnlockedWithdrawn events`);

      // Parse events
      const nftManagerInterface = Interface.from(NFT_MANAGER_ABI as any[]);
      const parsedRecords: UnlockRecord[] = [];

      for (const log of logs) {
        try {
          const parsedLog = nftManagerInterface.parseLog({
            topics: log.topics || [],
            data: log.data || '0x',
            address: log.address,
          } as any);

          if (parsedLog && parsedLog.name === 'UnlockedWithdrawn') {
            const args = parsedLog.args as any[];
            parsedRecords.push({
              nftId: Number(args[0]), // uint256 indexed nftId
              owner: args[1], // address owner
              amount: args[2].toString(), // uint256 amount
              timestamp: Number(args[3]), // uint256 timestamp
              blockNumber: Number(log.blockNumber),
              transactionHash: log.transactionHash || '',
            });
          }
        } catch (parseError) {
          console.warn('Failed to parse log:', parseError);
        }
      }

      // Sort by timestamp descending (newest first)
      parsedRecords.sort((a, b) => b.timestamp - a.timestamp);

      // Limit results
      setRecords(parsedRecords.slice(0, limit));
    } catch (err) {
      console.error('Error fetching unlock records:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch unlock records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [walletManager, limit]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    data: records,
    loading,
    error,
    refetch: fetchRecords,
  };
}






