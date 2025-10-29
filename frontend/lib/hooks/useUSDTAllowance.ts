import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { ERC20_ABI } from '@/lib/contracts/abis';

export interface USDTAllowance {
  allowance: string;
  loading: boolean;
  error: string | null;
}

export function useUSDTAllowance() {
  const { walletManager, address, isConnected } = useWallet();
  const [allowance, setAllowance] = useState<USDTAllowance>({
    allowance: '0',
    loading: false,
    error: null,
  });

  const fetchAllowance = useCallback(async () => {
    if (!walletManager || !address || !isConnected) {
      setAllowance({ allowance: '0', loading: false, error: null });
      return;
    }

    if (!CONTRACT_ADDRESSES.usdt || !CONTRACT_ADDRESSES.nftManager) {
      setAllowance({ 
        allowance: '0', 
        loading: false, 
        error: 'Contract addresses not configured' 
      });
      return;
    }

    setAllowance(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('🔍 查询USDT授权金额...');
      console.log('- USDT合约:', CONTRACT_ADDRESSES.usdt);
      console.log('- NFT Manager合约:', CONTRACT_ADDRESSES.nftManager);
      console.log('- 用户地址:', address);

      const allowanceResult = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      );

      console.log('✅ USDT授权查询成功:', allowanceResult.toString());

      setAllowance({
        allowance: allowanceResult.toString(),
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('❌ USDT授权查询失败:', error);
      setAllowance({
        allowance: '0',
        loading: false,
        error: error.message || 'Failed to fetch allowance',
      });
    }
  }, [walletManager, address, isConnected]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return {
    allowance: allowance.allowance,
    loading: allowance.loading,
    error: allowance.error,
    refetch: fetchAllowance,
  };
}
