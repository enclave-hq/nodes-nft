"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { CONTRACT_ADDRESSES } from '../contracts/config';
import { ERC20_ABI } from '../contracts/abis';

export function useBalances() {
  const { address, isConnected, walletManager } = useWallet();
  const [balances, setBalances] = useState({
    usdt: '0',
    e: '0', // Changed from eclv to e
  });
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!walletManager || !address) return;
    
    setLoading(true);
    try {
      console.log('🔍 Fetching balances for address:', address);
      console.log('🔍 Test USDT contract address:', CONTRACT_ADDRESSES.usdt);
      console.log('🔍 EnclaveToken contract address:', CONTRACT_ADDRESSES.enclaveToken);
      
      // Check if contract addresses are set
      if (!CONTRACT_ADDRESSES.usdt || CONTRACT_ADDRESSES.usdt === '0x0000000000000000000000000000000000000000') {
        console.error('❌ Test USDT contract address not set');
        throw new Error('USDT contract address not configured');
      }

      if (!CONTRACT_ADDRESSES.enclaveToken || CONTRACT_ADDRESSES.enclaveToken === '0x0000000000000000000000000000000000000000') {
        console.error('❌ EnclaveToken contract address not set');
        throw new Error('EnclaveToken contract address not configured');
      }

      // Get Test USDT balance using wallet SDK
      console.log('📞 调用 balanceOf...');
      const usdtBalance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'balanceOf',
        [address]
      );
      
      console.log('📞 调用 decimals...');
      const usdtDecimals = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'decimals',
        []
      );
      
      console.log('✅ Test USDT balance (raw):', usdtBalance.toString());
      console.log('✅ Test USDT decimals:', usdtDecimals);
      console.log('✅ Balance type:', typeof usdtBalance);
      console.log('✅ Decimals type:', typeof usdtDecimals);
      
      // Get $E balance using wallet SDK
      const eBalance = await walletManager.readContract(
        CONTRACT_ADDRESSES.enclaveToken,
        ERC20_ABI as any[],
        'balanceOf',
        [address]
      );
      
      const eDecimals = await walletManager.readContract(
        CONTRACT_ADDRESSES.enclaveToken,
        ERC20_ABI as any[],
        'decimals',
        []
      );
      
      console.log('✅ $E balance (raw):', eBalance.toString());
      console.log('✅ $E decimals:', eDecimals);
      
      // Format balances (convert from wei to token units)
      // Use string processing to avoid precision loss
      // Limit to maximum 6 decimal places for display
      const formatTokenAmount = (amount: bigint, decimals: number): string => {
        const amountStr = amount.toString();
        const maxDisplayDecimals = 6;
        
        if (amountStr.length <= decimals) {
          // If amount is less than 1 token, return decimal
          const padded = amountStr.padStart(decimals, '0');
          const integerPart = '0';
          let decimalPart = padded.slice(-decimals).replace(/0+$/, '') || '0';
          // Limit to 6 decimal places
          if (decimalPart.length > maxDisplayDecimals) {
            decimalPart = decimalPart.substring(0, maxDisplayDecimals).replace(/0+$/, '');
          }
          return decimalPart === '0' ? integerPart : `${integerPart}.${decimalPart}`;
        } else {
          // If amount is greater than or equal to 1 token
          const integerPart = amountStr.slice(0, -decimals);
          let decimalPart = amountStr.slice(-decimals).replace(/0+$/, '');
          // Limit to 6 decimal places
          if (decimalPart.length > maxDisplayDecimals) {
            decimalPart = decimalPart.substring(0, maxDisplayDecimals).replace(/0+$/, '');
          }
          return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
        }
      };
      
      const formattedBalances = {
        usdt: formatTokenAmount(BigInt(usdtBalance.toString()), Number(usdtDecimals)),
        e: formatTokenAmount(BigInt(eBalance.toString()), Number(eDecimals)),
      };
      
      console.log('✅ USDT formatted calculation:');
      console.log('- Raw balance:', usdtBalance.toString());
      console.log('- Decimals:', usdtDecimals);
      console.log('- Formatted:', formattedBalances.usdt);
      console.log('✅ Formatted balances:', formattedBalances);
      setBalances(formattedBalances);
    } catch (error) {
      console.error('❌ Error fetching balances:', error);
      console.error('❌ Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      // Don't set mock data, let error show
      setBalances({
        usdt: '0',
        e: '0',
      });
    } finally {
      setLoading(false);
    }
  }, [walletManager, address]);

  useEffect(() => {
    if (isConnected && address && walletManager) {
      fetchBalances();
    } else {
      setBalances({ usdt: '0', e: '0' });
    }
  }, [isConnected, address, walletManager, fetchBalances]);

  return {
    data: balances,
    balances,
    loading,
    refetch: fetchBalances,
  };
}

export function useBNBBalance() {
  const { address, isConnected } = useWallet();
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);

  const fetchBNBBalance = useCallback(async () => {
    if (!window.ethereum) return;
    
    setLoading(true);
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      
      // Convert from wei to BNB
      const balanceInBNB = parseInt(balance as string, 16) / 1e18;
      setBalance(balanceInBNB.toString());
    } catch (error) {
      console.error('Error fetching BNB balance:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBNBBalance();
    } else {
      setBalance('0');
    }
  }, [isConnected, address, fetchBNBBalance]);

  return {
    data: balance,
    balance,
    loading,
    refetch: fetchBNBBalance,
  };
}
