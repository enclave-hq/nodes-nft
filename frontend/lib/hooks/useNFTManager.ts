"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { useWeb3Store, callContractWithFallback } from '../stores/web3Store';
import { CONTRACT_ADDRESSES, GAS_CONFIG } from '../contracts/config';
import { NFT_MANAGER_ABI, ERC20_ABI, NODE_NFT_ABI } from '../contracts/abis';
import { handleNftMintCallback } from '../api/revenue';
import { Interface } from 'ethers';

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

  const mintNFT = async () => {
    if (!isConnected || !address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setMinting(true);
    setError(null);

    try {
      console.log('🚀 Starting NFT mint process...');
      
      // 1. Check if there's an active batch
      console.log('🔍 Step 1: Checking for active batch...');
      let activeBatchId: bigint;
      try {
        activeBatchId = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getActiveBatch',
          []
        ) as bigint;
      } catch (contractError: unknown) {
        // If contract reverts (e.g., no active batch or contract not initialized), treat as no active batch
        const errorMessage = contractError instanceof Error ? contractError.message : String(contractError);
        const isContractRevert = errorMessage.includes('reverted') ||
                                 errorMessage.includes('execution reverted') ||
                                 errorMessage.includes('ContractFunctionExecutionError');

        if (isContractRevert) {
          console.log('⚠️ Contract reverted for getActiveBatch, treating as no active batch');
          throw new Error('No active batch found, cannot mint NFT');
        }
        // If it's another error, rethrow it
        throw contractError;
      }
      
      if (activeBatchId === BigInt(0)) {
        throw new Error('No active batch found, cannot mint NFT');
      }
      
      console.log('✅ Active batch found:', activeBatchId.toString());
      
      // 2. Get batch details to get mint price
      console.log('🔍 Step 2: Getting batch details...');
      const batchData = await walletManager.readContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'batches',
        [activeBatchId]
      ) as [bigint, bigint, bigint, bigint, boolean, bigint];
      
      // batchData: [batchId, maxMintable, currentMinted, mintPrice, active, createdAt]
      const [, , , mintPriceWei, , ] = batchData;
      
      console.log('✅ Batch details retrieved:');
      console.log('- Batch ID:', activeBatchId.toString());
      console.log('- Mint Price (wei):', mintPriceWei.toString());
      console.log('- Mint Price (USDT):', (Number(mintPriceWei) / 1e18).toFixed(2));
      console.log('');
      
      // 3. Check current allowance amount
      console.log('🔍 Step 3: Checking current USDT allowance...');
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
        console.log('📝 Step 4: Approving USDT spending (current allowance insufficient)...');
        const approveTxHash = await walletManager.writeContract(
          CONTRACT_ADDRESSES.usdt,
          ERC20_ABI as unknown[],
          'approve',
          [CONTRACT_ADDRESSES.nftManager, mintPriceWei.toString()],
        {
          gas: GAS_CONFIG.gasLimits.erc20Approve, // Set gas limit
          gasPrice: 'auto', // Use automatic Gas Price
        }
        );
        
        console.log('✅ USDT approval transaction hash:', approveTxHash);
        
        // Wait for approval transaction
        console.log('⏳ Waiting for USDT approval confirmation...');
        const approveReceipt = await walletManager.waitForTransaction(approveTxHash);
        console.log('✅ USDT approval confirmed');
        
        // Additional wait to ensure state update
        console.log('⏳ Waiting for state update...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        console.log('📋 USDT approval transaction details:', {
          hash: approveTxHash,
          status: approveReceipt.status,
          gasUsed: approveReceipt.gasUsed?.toString(),
          blockNumber: approveReceipt.blockNumber?.toString()
        });
        
        // Check if approval was successful
        console.log('🔍 Checking approval transaction status:', approveReceipt.status);
        if ((approveReceipt as { status: string }).status !== '0x1' && approveReceipt.status !== 'success') {
          throw new Error('USDT approval transaction failed');
        }
        
        // Verify new allowance amount
        console.log('🔍 Verifying new USDT allowance...');
        const newAllowance = await walletManager.readContract(
          CONTRACT_ADDRESSES.usdt,
          ERC20_ABI as unknown[],
          'allowance',
          [address, CONTRACT_ADDRESSES.nftManager]
        );
        
        const newAllowanceBigInt = BigInt(newAllowance.toString());
        console.log('✅ New allowance amount:', newAllowanceBigInt.toString());
        
        if (newAllowanceBigInt < requiredBigInt) {
          console.error('❌ Allowance still insufficient after approval:', {
            current: newAllowanceBigInt.toString(),
            required: requiredBigInt.toString(),
            difference: (requiredBigInt - newAllowanceBigInt).toString()
          });
          throw new Error(`USDT allowance insufficient: current ${newAllowanceBigInt.toString()}, required ${requiredBigInt.toString()}`);
        }
        
        console.log('✅ USDT allowance verification passed');
      } else {
        console.log('✅ Current allowance is sufficient, skipping approval step');
      }

      // 5. Mint NFT (no parameters, price comes from batch)
      console.log('🎨 Step 5: Minting NFT...');
      console.log('📋 Mint parameters:');
      console.log('- Contract Address:', CONTRACT_ADDRESSES.nftManager);
      console.log('- Function: mintNFT()');
      console.log('- Gas limit:', GAS_CONFIG.gasLimits.mintNFT);
      console.log('- User Address:', address);
      console.log('- USDT Allowance:', allowanceBigInt.toString());
      console.log('- Contract Function Signature: mintNFT()');
      
      console.log('📞 Calling contract function...');
      const mintTxHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'mintNFT',
        [], // No parameters - price comes from active batch
        {
          gas: GAS_CONFIG.gasLimits.mintNFT,
          gasPrice: 'auto',
        }
      );
      
      console.log('✅ NFT minting transaction hash:', mintTxHash);
      console.log('🔗 Transaction link: https://testnet.bscscan.com/tx/' + mintTxHash);
      
      // Wait for mint transaction
      console.log('⏳ Waiting for NFT minting confirmation...');
      console.log('📋 Waiting for transaction details:');
      console.log('- Transaction Hash:', mintTxHash);
      console.log('- Network: BSC Testnet');
      console.log('- Block Explorer: https://testnet.bscscan.com');
      
      const receipt = await walletManager.waitForTransaction(mintTxHash);
      
      console.log('✅ NFT minting confirmed');
      console.log('📋 Transaction confirmation details:');
      console.log('- Status:', receipt.status);
      console.log('- Gas Used:', receipt.gasUsed?.toString());
      console.log('- Gas Price:', (receipt as { gasPrice?: string }).gasPrice?.toString());
      console.log('- Block Number:', receipt.blockNumber?.toString());
      console.log('- Block Hash:', receipt.blockHash);
      console.log('- Transaction Index:', (receipt as { transactionIndex?: string }).transactionIndex?.toString());
      
      // Check transaction status
      if (receipt.status === 'success' || (receipt as { status: string }).status === '0x1') {
        console.log('🎉 NFT minting successful!');
      } else {
        console.log('❌ NFT minting failed, status:', receipt.status);
        throw new Error(`NFT minting failed: transaction status ${receipt.status}`);
      }
      
      // Analyze transaction logs
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 Transaction event logs:');
        console.log('- Event count:', receipt.logs.length);
        receipt.logs.forEach((log, index) => {
          console.log(`- Event ${index}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data,
          });
        });
      } else {
        console.log('⚠️ No transaction event logs');
      }
      
      // Extract NFT ID from events
      // NFTMinted(uint256 indexed nftId, address indexed minter, uint256 indexed batchId, uint256 mintPrice, uint256 timestamp)
      let nftId: number | null = null;
      let batchId: bigint | null = null;
      
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 Parsing NFTMinted event from transaction logs...');
        
        // Create interface to parse events
        const nftManagerInterface = new Interface(NFT_MANAGER_ABI);
        
        // Find NFTMinted event
        for (const log of receipt.logs) {
          try {
            // Check if this log is from NFTManager contract
            if (log.address?.toLowerCase() !== CONTRACT_ADDRESSES.nftManager.toLowerCase()) {
              continue;
            }
            
            // Try to parse the log (ethers v6 API)
            // In ethers v6, parseLog takes a log object directly
            const parsedLog = nftManagerInterface.parseLog({
              topics: log.topics || [],
              data: log.data || '0x',
              address: log.address,
            } as any);
            
            if (parsedLog && parsedLog.name === 'NFTMinted') {
              // Extract NFT ID (first indexed parameter)
              // In ethers v6, args is a tuple-like object
              const args = parsedLog.args as any[];
              nftId = Number(args[0]);
              batchId = BigInt(args[2]); // batchId is third indexed parameter
              console.log(`✅ Parsed NFT ID: ${nftId}, Batch ID: ${batchId}`);
              break;
            }
          } catch (error) {
            // Not the event we're looking for, continue
            continue;
          }
        }
      }
      
      if (!nftId) {
        console.warn('⚠️ Could not extract NFT ID from transaction logs');
        // Fallback: try to get from totalMinted
        try {
          const totalMinted = await walletManager.readContract(
            CONTRACT_ADDRESSES.nftManager,
            NFT_MANAGER_ABI as unknown[],
            'totalMinted',
            []
          ) as bigint;
          nftId = Number(totalMinted);
          console.log(`✅ Using totalMinted as NFT ID: ${nftId}`);
        } catch (error) {
          console.error('❌ Failed to get NFT ID:', error);
          throw new Error('Failed to extract NFT ID from transaction');
        }
      }
      
      // Call backend to process NFT mint callback
      try {
        console.log('📞 Calling backend NFT mint callback...');
        const callbackResult = await handleNftMintCallback({
          nftId,
          minterAddress: address,
          mintTxHash,
          batchId: batchId ? batchId.toString() : undefined,
        });
        console.log('✅ Backend callback completed:', callbackResult);
      } catch (error: any) {
        // Log error but don't fail the mint - backend can process it later
        console.error('⚠️ Backend callback failed (non-critical):', error.message);
      }
      
      // 🔄 Update web3Store data
      console.log('🔄 Updating Web3 data...');
      await web3Store.refreshData();
      console.log('✅ Web3 data update completed');
      
      return {
        success: true,
        transactionHash: mintTxHash,
        nftId,
      };
    } catch (err) {
      console.error('❌ Error occurred during NFT minting:');
      console.error('❌ Error object:', err);
      console.error('❌ Error type:', typeof err);
      console.error('❌ Error name:', err instanceof Error ? err.name : 'Unknown');
      console.error('❌ Error message:', err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      
      // Check if it's a specific error type
      if (err instanceof Error) {
        if (err.message.includes('Transaction reverted')) {
          console.error('🔍 Transaction reverted, possible reasons:');
          console.error('- Contract logic check failed');
          console.error('- Insufficient user balance');
          console.error('- Insufficient allowance');
          console.error('- Incorrect contract state');
          console.error('- Insufficient gas limit');
          console.error('- Incorrect contract function parameters');
        } else if (err.message.includes('insufficient funds')) {
          console.error('🔍 Insufficient funds error:');
          console.error('- Check if BNB balance is sufficient to pay gas fees');
        } else if (err.message.includes('user rejected')) {
          console.error('🔍 User rejection error:');
          console.error('- User rejected the transaction in wallet');
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
    status: number;
    createdAt: string;
    terminationInitiatedAt: string;
    totalEclvLocked: string;
    remainingMintQuota: string;
    unlockedAmount: string;
    unlockedWithdrawn: string;
    unlockedPeriods: string;
    producedDebt: string; // Withdrawn $E production
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Use useCallback to cache function
  const fetchPool = useCallback(async () => {
    if (!walletManager) return;
    
    setLoading(true);
    try {
      const poolData = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getNFTPool',
        [nftId],
        `getNFTPool(${nftId})`
      );
      
      // Check if poolData is a valid array
      if (!poolData || !Array.isArray(poolData)) {
        console.warn('⚠️ Invalid poolData received:', poolData, '- Using default values');
        // Set default values instead of throwing error
        setPool({
          status: 0,
          createdAt: new Date().toISOString(),
          terminationInitiatedAt: "0",
          totalEclvLocked: "0",
          remainingMintQuota: "0",
          unlockedAmount: "0",
          unlockedWithdrawn: "0",
          unlockedPeriods: "0",
          producedDebt: "0",
        });
        return;
      }
      
      // getNFTPool returns: status, createdAt, terminationInitiatedAt, totalEclvLocked, remainingMintQuota, unlockedAmount, unlockedWithdrawn, unlockedPeriods, producedDebt
      const [
        status,
        createdAt,
        terminationInitiatedAt,
        totalEclvLocked,
        remainingMintQuota,
        unlockedAmount,
        unlockedWithdrawn,
        unlockedPeriods,
        producedDebt,
      ] = poolData;
      
      setPool({
        status: Number(status),
        createdAt: Number(createdAt) > 0 ? new Date(Number(createdAt) * 1000).toISOString() : new Date().toISOString(),
        terminationInitiatedAt: terminationInitiatedAt ? String(terminationInitiatedAt) : "0",
        totalEclvLocked: totalEclvLocked ? String(totalEclvLocked) : "0",
        remainingMintQuota: remainingMintQuota ? String(remainingMintQuota) : "0",
        unlockedAmount: unlockedAmount ? String(unlockedAmount) : "0",
        unlockedWithdrawn: unlockedWithdrawn ? String(unlockedWithdrawn) : "0",
        unlockedPeriods: unlockedPeriods ? String(unlockedPeriods) : "0",
        producedDebt: producedDebt ? String(producedDebt) : "0",
      });
    } catch (error) {
      console.warn('⚠️ Error fetching NFT pool:', error, '- Using default values');
      // Set default values on error instead of leaving state as null
      setPool({
        status: 0,
        createdAt: new Date().toISOString(),
        terminationInitiatedAt: "0",
        totalEclvLocked: "0",
        remainingMintQuota: "0",
        unlockedAmount: "0",
        unlockedWithdrawn: "0",
        unlockedPeriods: "0",
        producedDebt: "0",
      });
    } finally {
      setLoading(false);
    }
  }, [walletManager, nftId]);

  // Use useMemo to cache dependency conditions
  const shouldFetch = useMemo(() => 
    nftId && walletManager, 
    [nftId, walletManager]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchPool();
    }
  }, [shouldFetch, fetchPool]);

  // Use useMemo to cache return value
  return useMemo(() => ({ 
    data: pool, 
    loading, 
    refetch: fetchPool 
  }), [pool, loading, fetchPool]);
}

export function useGlobalState() {
  const { walletManager } = useWallet();
  const [globalState, setGlobalState] = useState<{
    accProducedPerNFT: string;
    totalActiveNFTs: string;
    lastUpdateTime: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGlobalState = useCallback(async () => {
    if (!walletManager) return;
    
    setLoading(true);
    try {
      const stateData = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'globalState',
        [],
        'globalState()'
      );
      
      if (!stateData || !Array.isArray(stateData)) {
        console.warn('⚠️ Invalid globalState data received:', stateData, '- Using default values');
        // Set default values instead of throwing error
        setGlobalState({
          accProducedPerNFT: "0",
          totalActiveNFTs: "0",
          lastUpdateTime: "0",
        });
        return;
      }
      
      // globalState returns: [accProducedPerNFT, totalActiveNFTs, lastUpdateTime]
      const [accProducedPerNFT, totalActiveNFTs, lastUpdateTime] = stateData;
      
      setGlobalState({
        accProducedPerNFT: accProducedPerNFT ? String(accProducedPerNFT) : "0",
        totalActiveNFTs: totalActiveNFTs ? String(totalActiveNFTs) : "0",
        lastUpdateTime: lastUpdateTime ? String(lastUpdateTime) : "0",
      });
    } catch (error) {
      console.warn('⚠️ Error fetching global state:', error, '- Using default values');
      // Set default values on error instead of leaving state as null
      setGlobalState({
        accProducedPerNFT: "0",
        totalActiveNFTs: "0",
        lastUpdateTime: "0",
      });
    } finally {
      setLoading(false);
    }
  }, [walletManager]);

  useEffect(() => {
    if (walletManager) {
      fetchGlobalState();
    }
  }, [walletManager, fetchGlobalState]);

  return useMemo(() => ({ 
    data: globalState, 
    loading, 
    refetch: fetchGlobalState 
  }), [globalState, loading, fetchGlobalState]);
}

export function usePendingProduced(nftId: number) {
  const { address, walletManager } = useWallet();
  const [pendingProduced, setPendingProduced] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  // Use useCallback to cache function
  const fetchPendingProduced = useCallback(async () => {
    if (!address || !walletManager) return;
    
    setLoading(true);
    try {
      const pending = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getPendingProduced',
        [nftId],
        `getPendingProduced(${nftId})`
      );
      setPendingProduced(pending ? String(pending) : "0");
    } catch (error) {
      console.error('Error fetching pending produced:', error);
    } finally {
      setLoading(false);
    }
  }, [address, walletManager, nftId]);

  // Use useMemo to cache dependency conditions
  const shouldFetch = useMemo(() => 
    nftId && address && walletManager, 
    [nftId, address, walletManager]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchPendingProduced();
    }
  }, [shouldFetch, fetchPendingProduced]);

  // Use useMemo to cache return value
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

  // Use useCallback to cache function
  const fetchPendingReward = useCallback(async () => {
    if (!address || !walletManager || !tokenAddress) return;
    
    setLoading(true);
    try {
      const pending = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getPendingReward',
        [nftId, tokenAddress],
        `getPendingReward(${nftId})`
      );
      setPendingReward(pending ? String(pending) : "0");
    } catch (error) {
      console.error('Error fetching pending reward:', error);
    } finally {
      setLoading(false);
    }
  }, [address, walletManager, nftId, tokenAddress]);

  // Use useMemo to cache dependency conditions
  const shouldFetch = useMemo(() => 
    nftId && address && walletManager && tokenAddress, 
    [nftId, address, walletManager, tokenAddress]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchPendingReward();
    }
  }, [shouldFetch, fetchPendingReward]);

  // Use useMemo to cache return value
  return useMemo(() => ({ 
    data: pendingReward, 
    loading, 
    refetch: fetchPendingReward 
  }), [pendingReward, loading, fetchPendingReward]);
}

/**
 * Hook to get reward withdrawn amount for a specific NFT and token
 * @param nftId NFT ID
 * @param tokenAddress Token address (e.g., USDT)
 */
export function useRewardDebt(nftId: number, tokenAddress: string) {
  const { walletManager } = useWallet();
  const [rewardDebt, setRewardDebt] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  const fetchRewardDebt = useCallback(async () => {
    if (!walletManager || !tokenAddress) return;
    
    setLoading(true);
    try {
      const debt = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getRewardWithdrawn',
        [nftId, tokenAddress],
        `getRewardWithdrawn(${nftId}, ${tokenAddress})`
      );
      setRewardDebt(debt ? String(debt) : "0");
    } catch (error) {
      console.warn('⚠️ Error fetching reward withdrawn:', error);
      setRewardDebt("0");
    } finally {
      setLoading(false);
    }
  }, [walletManager, nftId, tokenAddress]);

  useEffect(() => {
    if (walletManager && tokenAddress) {
      fetchRewardDebt();
    }
  }, [walletManager, tokenAddress, fetchRewardDebt]);

  return useMemo(() => ({ 
    data: rewardDebt, 
    loading, 
    refetch: fetchRewardDebt 
  }), [rewardDebt, loading, fetchRewardDebt]);
}

/**
 * Hook to get accumulated reward per NFT for a specific token (total reward)
 * @param tokenAddress Token address (e.g., USDT)
 */
export function useAccRewardPerNFT(tokenAddress: string) {
  const { walletManager } = useWallet();
  const [accReward, setAccReward] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  const fetchAccReward = useCallback(async () => {
    if (!walletManager || !tokenAddress) return;
    
    setLoading(true);
    try {
      const reward = await callContractWithFallback(
        walletManager,
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getAccRewardPerNFT',
        [tokenAddress],
        `getAccRewardPerNFT(${tokenAddress})`
      );
      setAccReward(reward ? String(reward) : "0");
    } catch (error) {
      console.warn('⚠️ Error fetching accRewardPerNFT:', error);
      setAccReward("0");
    } finally {
      setLoading(false);
    }
  }, [walletManager, tokenAddress]);

  useEffect(() => {
    if (walletManager && tokenAddress) {
      fetchAccReward();
    }
  }, [walletManager, tokenAddress, fetchAccReward]);

  return useMemo(() => ({ 
    data: accReward, 
    loading, 
    refetch: fetchAccReward 
  }), [accReward, loading, fetchAccReward]);
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
          gasPrice: 'auto', // Use automatic Gas Price
          gas: GAS_CONFIG.gasLimits.contractCall, // Set gas limit
        }
      );
      
      await walletManager.waitForTransaction(txHash);
      
      // 🔄 Update web3Store data
      console.log('🔄 Updating Web3 data...');
      await web3Store.refreshData();
      console.log('✅ Web3 data update completed');
      
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
          gasPrice: 'auto', // Use automatic Gas Price
          gas: GAS_CONFIG.gasLimits.contractCall, // Set gas limit
        }
      );
      
      await walletManager.waitForTransaction(txHash);
      
      // 🔄 Update web3Store data
      console.log('🔄 Updating Web3 data...');
      await web3Store.refreshData();
      console.log('✅ Web3 data update completed');
      
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
          gasPrice: 'auto', // Use automatic Gas Price
          gas: GAS_CONFIG.gasLimits.contractCall, // Set gas limit
        }
      );
      
      await walletManager.waitForTransaction(txHash);
      
      // 🔄 Update web3Store data
      console.log('🔄 Updating Web3 data...');
      await web3Store.refreshData();
      console.log('✅ Web3 data update completed');
      
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


export function useCreateSellOrder() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const createSellOrder = useCallback(async (params: {
    nftId: number;
    price: bigint; // Price for the whole NFT in USDT wei
  }) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      console.log('📝 Creating sell order...');
      console.log('📋 Order parameters:');
      console.log('- NFT ID:', params.nftId);
      console.log('- NFT Price:', params.price.toString(), 'wei');
      console.log('- Gas limit:', GAS_CONFIG.gasLimits.createSellOrder);
      console.log('- Gas price: Auto (Wallet SDK)');

      // Step 1: Check if transfers are enabled
      console.log('🔍 Step 1: Checking if transfers are enabled...');
      try {
        const transfersEnabled = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'transfersEnabled',
          [],
          'transfersEnabled()'
        ) as boolean;
        
        if (!transfersEnabled) {
          throw new Error('Transfers not enabled, cannot create order');
        }
        console.log('✅ Transfers are enabled');
      } catch (error) {
        console.error('❌ Transfer check failed:', error);
        throw error;
      }

      // Step 2: Check if user owns the NFT (use ownerOf directly from NodeNFT)
      console.log('🔍 Step 2: Checking if user owns the NFT...');
      try {
        const ownerOf = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nodeNFT,
          NODE_NFT_ABI as unknown[],
          'ownerOf',
          [BigInt(params.nftId)],
          `ownerOf(${params.nftId})`
        ) as string;
        
        console.log('📋 NFT ownership:');
        console.log('- NFT Owner:', ownerOf);
        console.log('- Current User:', address);
        console.log('- Match:', ownerOf.toLowerCase() === address.toLowerCase());
        
        if (ownerOf.toLowerCase() !== address.toLowerCase()) {
          throw new Error(`You are not the owner of NFT #${params.nftId} (Owner: ${ownerOf})`);
        }
        console.log('✅ User owns the NFT');
      } catch (error) {
        console.error('❌ NFT ownership check failed:', error);
        throw error;
      }

      // Step 3: Check if NFT already has an active order
      console.log('🔍 Step 3: Checking if NFT already has an active order...');
      try {
        const activeOrderId = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getActiveOrderByNFT',
          [params.nftId],
          `getActiveOrderByNFT(${params.nftId})`
        ) as bigint;

        if (activeOrderId && activeOrderId !== BigInt(0)) {
          throw new Error(`NFT #${params.nftId} already has an active order (Order ID: ${activeOrderId.toString()})`);
        }
        console.log('✅ NFT has no active order');
      } catch (error) {
        console.error('❌ Order check failed:', error);
        throw error;
      }

      // Step 4: Check and handle NFT approval
      console.log('🔍 Step 4: Checking NFT approval status...');
      try {
        const currentApproval = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nodeNFT,
          NODE_NFT_ABI as unknown[],
          'getApproved',
          [BigInt(params.nftId)],
          `getApproved(${params.nftId})`
        ) as string;

        const isApprovedForAll = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nodeNFT,
          NODE_NFT_ABI as unknown[],
          'isApprovedForAll',
          [address, CONTRACT_ADDRESSES.nftManager],
          `isApprovedForAll(${address}, ${CONTRACT_ADDRESSES.nftManager})`
        ) as boolean;

        console.log('📋 Approval status:');
        console.log('- Current approval address:', currentApproval);
        console.log('- NFTManager address:', CONTRACT_ADDRESSES.nftManager);
        console.log('- Approved for all:', isApprovedForAll);

        const needsApproval = currentApproval.toLowerCase() !== CONTRACT_ADDRESSES.nftManager.toLowerCase() && !isApprovedForAll;

        if (needsApproval) {
          console.log('📝 NFT not approved, starting approval process...');
          console.log('📋 Approval parameters:');
          console.log('- NFT Contract:', CONTRACT_ADDRESSES.nodeNFT);
          console.log('- Approve to:', CONTRACT_ADDRESSES.nftManager);
          console.log('- Token ID:', params.nftId);
          console.log('- Function signature: approve(address to, uint256 tokenId) [ERC721]');
          console.log('- MethodID: 0x095ea7b3 (same as ERC20, but different parameter meaning)');

          // Verify NFT ownership
          console.log('🔍 Verifying NFT ownership...');
          try {
            const ownerOf = await callContractWithFallback(
              walletManager,
              CONTRACT_ADDRESSES.nodeNFT,
              NODE_NFT_ABI as unknown[],
              'ownerOf',
              [BigInt(params.nftId)],
              `ownerOf(${params.nftId})`
            ) as string;
            
            console.log('📋 NFT ownership:');
            console.log('- NFT Owner:', ownerOf);
            console.log('- Current User:', address);
            console.log('- Match:', ownerOf.toLowerCase() === address.toLowerCase());
            
            if (ownerOf.toLowerCase() !== address.toLowerCase()) {
              throw new Error(`You are not the owner of NFT #${params.nftId} (Owner: ${ownerOf})`);
            }
            console.log('✅ NFT ownership verified');
          } catch (error) {
            console.error('❌ NFT ownership verification failed:', error);
            throw error;
          }

          const approveTxHash = await walletManager.writeContract(
            CONTRACT_ADDRESSES.nodeNFT,
            NODE_NFT_ABI as unknown[],
            'approve',
            [CONTRACT_ADDRESSES.nftManager, BigInt(params.nftId)], // ERC721: approve(address to, uint256 tokenId)
            {
              gas: GAS_CONFIG.gasLimits.erc20Approve, // Use similar gas limit
              // Don't set gasPrice, let Wallet SDK auto-fetch
            }
          );

          console.log('✅ Approval transaction submitted:', approveTxHash);
          console.log('⏳ Waiting for approval transaction confirmation...');

          const approveReceipt = await walletManager.waitForTransaction(approveTxHash);
          
          // Check transaction status
          const receiptStatus = approveReceipt.status as string | number;
          const statusStr = String(receiptStatus);
          const isSuccess = statusStr === 'success' || statusStr === '0x1' || statusStr === '1' || receiptStatus === 1;
          
          console.log('📋 Approval transaction details:', {
            hash: approveReceipt.transactionHash || approveTxHash,
            status: receiptStatus,
            isSuccess: isSuccess,
            blockNumber: approveReceipt.blockNumber?.toString(),
          });

          if (!isSuccess) {
            throw new Error(`Approval transaction failed, status: ${receiptStatus}`);
          }
          
          console.log('✅ Approval transaction confirmed and successful');

          // Wait for state sync (after approval transaction confirmation, state may need time to sync)
          console.log('⏳ Waiting for state sync...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

          // Verify approval success (with retry mechanism)
          console.log('🔍 Verifying approval status...');
          let newApproval: string | null = null;
          const maxRetries = 3;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              newApproval = await callContractWithFallback(
                walletManager,
                CONTRACT_ADDRESSES.nodeNFT,
                NODE_NFT_ABI as unknown[],
                'getApproved',
                [BigInt(params.nftId)],
                `getApproved(${params.nftId})`
              ) as string;

              console.log(`📋 Verification attempt ${attempt}/${maxRetries}:`);
              console.log('- Retrieved approval address:', newApproval);
              console.log('- Expected approval address:', CONTRACT_ADDRESSES.nftManager);
              console.log('- Address match:', newApproval.toLowerCase() === CONTRACT_ADDRESSES.nftManager.toLowerCase());

              // Normalize address comparison (remove 0x prefix, convert to lowercase)
              const normalizedNewApproval = newApproval.toLowerCase().replace(/^0x/, '');
              const normalizedExpected = CONTRACT_ADDRESSES.nftManager.toLowerCase().replace(/^0x/, '');

              if (normalizedNewApproval === normalizedExpected || newApproval.toLowerCase() === CONTRACT_ADDRESSES.nftManager.toLowerCase()) {
                console.log('✅ NFT approval verification successful');
                break;
              }

              // If last attempt still fails
              if (attempt === maxRetries) {
                console.error('❌ Approval verification failed:');
                console.error('- Retrieved approval address:', newApproval);
                console.error('- Expected approval address:', CONTRACT_ADDRESSES.nftManager);
                console.error('- Is zero address:', newApproval === '0x0000000000000000000000000000000000000000' || newApproval === '0x0');
                throw new Error(`Approval verification failed: Retrieved approval address (${newApproval}) does not match expected address (${CONTRACT_ADDRESSES.nftManager})`);
              }

              // Wait before retry
              console.log(`⏳ Approval status not synced, waiting before retry (${attempt}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
              if (attempt === maxRetries) {
                throw error;
              }
              console.warn(`⚠️ Verification attempt ${attempt} failed, retrying...`, error);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        } else {
          console.log('✅ NFT already approved, skipping approval step');
        }
      } catch (error) {
        console.error('❌ NFT approval check/processing failed:', error);
        throw error;
      }

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'createSellOrder',
        [BigInt(params.nftId), params.price],
        {
          gas: GAS_CONFIG.gasLimits.createSellOrder,
          gasPrice: 'auto', // Use automatic Gas Price
        }
      );

      console.log('✅ Create order transaction hash:', txHash);
      console.log('⏳ Waiting for transaction confirmation...');

      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ Order creation confirmed');
      console.log('📋 Transaction details:', {
        hash: receipt.transactionHash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber?.toString(),
      });

      // Refresh data
      await web3Store.refreshData();

      // Parse Order ID from transaction logs
      let orderId = 'unknown';
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 Transaction event logs:', receipt.logs.length, 'events');
        
        // Find SellOrderCreated event
        // Event signature hash for SellOrderCreated(uint256,uint256,address,uint256,uint256)
        const sellOrderCreatedTopic = '0x019885652a4a8dfdfca02c68db30c0e34d05185a6ffcd7779d140e33d1a2a90c';
        
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          console.log(`📋 Event ${i}:`, {
            address: log.address,
            topics: log.topics,
            data: log.data
          });
          
          if (log.topics && log.topics[0] === sellOrderCreatedTopic) {
            // orderId is the first indexed parameter, in topics[1]
            orderId = BigInt(log.topics[1]).toString();
            console.log('✅ Parsed Order ID:', orderId);
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
      console.error('❌ Create order failed:', error);
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check common failure reasons
      if (errorMessage.includes('Transaction reverted') || errorMessage.includes('execution reverted')) {
        // Try to extract revert reason
        let detailedError = 'Transaction reverted';
        
        if (errorMessage.includes('Transfers not enabled')) {
          detailedError = 'Transfers not enabled, cannot create order';
        } else if (errorMessage.includes('Not NFT owner')) {
          detailedError = 'You are not the owner of this NFT';
        } else if (errorMessage.includes('Price must be > 0')) {
          detailedError = 'Price must be greater than 0';
        } else if (errorMessage.includes('NFT already has active order')) {
          detailedError = 'This NFT already has an active order';
        } else if (errorMessage.includes('NFT not found')) {
          detailedError = 'NFT does not exist in pool';
        } else if (errorMessage.includes('NFTManager not approved')) {
          detailedError = 'NFTManager not approved, please approve NFT first';
        } else if (errorMessage.includes('ERC721InsufficientApproval')) {
          detailedError = 'NFT approval insufficient, please approve NFT to NFTManager first';
        }
        
        throw new Error(detailedError);
      }
      
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

/**
 * Hook to initiate NFT termination
 */
export function useInitiateTermination() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const initiateTermination = useCallback(async (nftId: number) => {
    if (!walletManager || !address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'initiateTermination',
        [nftId],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      await walletManager.waitForTransaction(txHash);
      await web3Store.refreshData();

      return { success: true, transactionHash: txHash };
    } catch (error: unknown) {
      console.error('❌ Initiate termination failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: initiateTermination, isLoading };
}

/**
 * Hook to confirm termination (after cooldown)
 */
export function useConfirmTermination() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const confirmTermination = useCallback(async (nftId: number) => {
    if (!walletManager || !address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'confirmTermination',
        [nftId],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      await walletManager.waitForTransaction(txHash);
      await web3Store.refreshData();

      return { success: true, transactionHash: txHash };
    } catch (error: unknown) {
      console.error('❌ Confirm termination failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: confirmTermination, isLoading };
}

/**
 * Hook to cancel termination
 */
export function useCancelTermination() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const cancelTermination = useCallback(async (nftId: number) => {
    if (!walletManager || !address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'cancelTermination',
        [nftId],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      await walletManager.waitForTransaction(txHash);
      await web3Store.refreshData();

      return { success: true, transactionHash: txHash };
    } catch (error: unknown) {
      console.error('❌ Cancel termination failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: cancelTermination, isLoading };
}

/**
 * Hook to withdraw unlocked $E (only for Terminated NFTs)
 */
export function useWithdrawUnlocked() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const withdrawUnlocked = useCallback(async (nftId: number, amount?: string) => {
    if (!walletManager || !address) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      const amountBigInt = amount ? BigInt(amount) : BigInt(0);
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'withdrawUnlocked',
        [nftId, amountBigInt],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto',
        }
      );

      await walletManager.waitForTransaction(txHash);
      await web3Store.refreshData();

      return { success: true, transactionHash: txHash };
    } catch (error: unknown) {
      console.error('❌ Claim unlocked amount failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: withdrawUnlocked, isLoading };
}
