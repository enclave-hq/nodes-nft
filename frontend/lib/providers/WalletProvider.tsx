"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WalletManager, WalletType, Account } from '@enclave-hq/wallet-sdk';

interface WalletContextType {
  address: string | null;
  account: string | null; // Alias for address
  isConnected: boolean;
  isConnecting: boolean;
  isRestoring: boolean; // Whether connection is being restored
  connect: () => Promise<void>;
  disconnect: () => void;
  chainId: number | null;
  switchToBSC: () => Promise<void>;
  walletManager: WalletManager | null;
  hasWallet: boolean; // Whether wallet is available
  connectionError: string | null; // Connection error message
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletManager, setWalletManager] = useState<WalletManager | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      if (!walletManager) {
        console.log('🔍 No wallet manager available for connection check');
        return;
      }
      
      console.log('🔍 Checking existing wallet connection...');
      
      // Check if wallet SDK has a connected account
      const account = walletManager.getPrimaryAccount();
      console.log('🔍 Primary account from wallet manager:', account);
      
      if (account) {
        console.log('✅ Found existing connection:', {
          address: account.nativeAddress,
          chainId: account.chainId,
        });
        setAddress(account.nativeAddress);
        setIsConnected(true);
        setChainId(account.chainId);
      } else {
        console.log('ℹ️ No existing wallet connection found');
        setAddress(null);
        setIsConnected(false);
        setChainId(null);
      }
    } catch (error) {
      console.error('❌ Error checking connection:', error);
      setAddress(null);
      setIsConnected(false);
      setChainId(null);
    }
  }, [walletManager]);

  useEffect(() => {
    // Check if wallet is available
    const checkWalletAvailability = () => {
      const hasEthereum = typeof window !== 'undefined' && !!window.ethereum;
      console.log('🔍 Checking wallet availability:', hasEthereum);
      setHasWallet(hasEthereum);
      
      if (!hasEthereum) {
        setConnectionError('Please install MetaMask or another Web3 wallet');
      } else {
        setConnectionError(null);
      }
    };

    checkWalletAvailability();
    
    // Clear incompatible wallet storage before initializing
    // This app only supports BSC (EVM), so clear any Tron wallet data
    const clearIncompatibleWalletStorage = () => {
      if (typeof window === 'undefined') return;
      
      try {
        const storageKey = 'enclave_wallet_data';
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          // Check if saved wallet type is TRONLINK (incompatible with BSC)
          if (data.primaryWalletType === 'TRONLINK' || data.primaryWalletType === 'tronlink') {
            console.log('⚠️ Found incompatible TronLink wallet data, clearing for BSC...');
            localStorage.removeItem(storageKey);
            console.log('✅ Cleared incompatible wallet storage');
          }
        }
      } catch (error) {
        console.warn('⚠️ Error checking wallet storage:', error);
      }
    };
    
    clearIncompatibleWalletStorage();
    
    // Initialize wallet manager
    console.log('🔧 Initializing WalletManager...');
    try {
      const manager = new WalletManager();
      console.log('✅ WalletManager created successfully');
      setWalletManager(manager);
    } catch (error) {
      console.error('❌ Failed to create WalletManager:', error);
      setIsRestoring(false);
    }
  }, []);

  // Auto-restore connection from storage (only once on mount)
  useEffect(() => {
    if (!walletManager) return;

    const restoreConnection = async () => {
      try {
        console.log('🔄 Attempting to restore wallet connection from storage...');
        setIsRestoring(true);
        
        // Try to restore connection from localStorage
        const restoredAccount = await walletManager.restoreFromStorage();
        
        if (restoredAccount) {
          console.log('✅ Wallet connection restored:', {
            address: restoredAccount.nativeAddress,
            chainId: restoredAccount.chainId,
          });
          
          setAddress(restoredAccount.nativeAddress);
          setIsConnected(true);
          setChainId(restoredAccount.chainId);
          
          // Ensure connection to BSC Testnet if needed
          if (restoredAccount.chainId !== 97) {
            console.log('🔄 Restored wallet is on different chain, switching to BSC Testnet...');
            try {
              await walletManager.requestSwitchChain(97, {
                addChainIfNotExists: true,
                chainConfig: {
                  chainId: 97,
                  chainName: 'BNB Smart Chain Testnet',
                  nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18,
                  },
                  rpcUrls: [
                    'https://data-seed-prebsc-2-s1.binance.org:8545',
                    'https://data-seed-prebsc-1-s2.binance.org:8545',
                    'https://data-seed-prebsc-2-s2.binance.org:8545'
                  ],
                  blockExplorerUrls: ['https://testnet.bscscan.com'],
                }
              });
              
              // Update account information after chain switch
              const updatedAccount = walletManager.getPrimaryAccount();
              if (updatedAccount) {
                setChainId(updatedAccount.chainId);
                console.log('✅ Switched to BSC Testnet, new chainId:', updatedAccount.chainId);
              }
            } catch (switchError) {
              console.warn('⚠️ Failed to switch to BSC Testnet during restore:', switchError);
              // Continue with current chain
            }
          }
        } else {
          console.log('ℹ️ No stored wallet connection found');
          // Check existing connection
          checkConnection();
        }
      } catch (error) {
        console.error('❌ Error restoring wallet connection:', error);
        // Check existing connection as fallback
        checkConnection();
      } finally {
        setIsRestoring(false);
      }
    };

    restoreConnection();
  }, [walletManager, checkConnection]);

  useEffect(() => {
    if (!walletManager) return;

    // Listen to wallet SDK events
    const handleAccountChanged = (account: Account | null) => {
      if (account) {
        console.log('🔔 Account changed:', account.nativeAddress);
        setAddress(account.nativeAddress);
        setIsConnected(true);
        setChainId(account.chainId);
      } else {
        console.log('🔔 Account disconnected');
        setAddress(null);
        setIsConnected(false);
        setChainId(null);
      }
    };

    const handleChainChanged = (chainId: number, account: Account) => {
      console.log('🔔 Chain changed:', chainId);
      setChainId(chainId);
      if (account) {
        setAddress(account.nativeAddress);
        setIsConnected(true);
      }
    };

    const handleDisconnected = () => {
      console.log('🔔 Wallet disconnected');
      setAddress(null);
      setIsConnected(false);
      setChainId(null);
    };

    walletManager.on('accountChanged', handleAccountChanged);
    walletManager.on('chainChanged', handleChainChanged);
    walletManager.on('disconnected', handleDisconnected);

    return () => {
      walletManager.off('accountChanged', handleAccountChanged);
      walletManager.off('chainChanged', handleChainChanged);
      walletManager.off('disconnected', handleDisconnected);
    };
  }, [walletManager]);

  useEffect(() => {
    // Check connection after wallet manager is initialized
    if (walletManager && !isRestoring) {
      checkConnection();
    }
  }, [walletManager, checkConnection, isRestoring]);

  const connect = async () => {
    try {
      console.log('🔌 Starting wallet connection...');
      
      if (!walletManager) {
        console.error('❌ Wallet manager not initialized');
        throw new Error('Wallet manager not initialized');
      }

      // Check if window.ethereum is available
      if (!window.ethereum) {
        const errorMsg = 'No wallet detected. Please install MetaMask or another Web3 wallet.';
        console.error('❌', errorMsg);
        setConnectionError('Please install MetaMask or another Web3 wallet');
        throw new Error(errorMsg);
      }

      console.log('✅ Wallet manager and window.ethereum available');
      
      // Check if wallet is already connected
      const existingAccount = walletManager.getPrimaryAccount();
      if (existingAccount) {
        console.log('ℹ️ Wallet already connected:', existingAccount.nativeAddress);
        setAddress(existingAccount.nativeAddress);
        setIsConnected(true);
        setChainId(existingAccount.chainId);
        return;
      }
      
      // Check if wallet is locked
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        console.log('🔍 Existing accounts:', accounts);
        
        if (accounts.length > 0) {
          console.log('ℹ️ Wallet has accounts but not connected to our app');
        }
      } catch (error) {
        console.warn('⚠️ Could not check existing accounts:', error);
      }
      
      setIsConnecting(true);
      
      // Connect using wallet SDK with BSC Testnet (chainId: 97)
      // Now supports all wallets that provide window.ethereum interface (MetaMask, TP Wallet, etc.)
      console.log('📞 Calling walletManager.connect...');
      
      // Add timeout mechanism to prevent connection hanging
      // Can try multiple wallet types
      const connectPromise = walletManager.connect(WalletType.METAMASK, 97);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Connection timeout, please check if wallet is responding normally'));
        }, 30000); // 30 second timeout
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      console.log('✅ walletManager.connect completed');
      
      // Get account info
      const account = walletManager.getPrimaryAccount();
      console.log('🔍 Primary account:', account);
      
      if (account) {
        console.log('✅ Account found:', {
          address: account.nativeAddress,
          chainId: account.chainId,
        });
        
        setAddress(account.nativeAddress);
        setIsConnected(true);
        setChainId(account.chainId);
        
        // Ensure connection to BSC Testnet
        if (account.chainId !== 97) {
          console.log('🔄 Switching to BSC Testnet...');
          try {
            await walletManager.requestSwitchChain(97, {
              addChainIfNotExists: true,
              chainConfig: {
                chainId: 97,
                chainName: 'BNB Smart Chain Testnet',
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'BNB',
                  decimals: 18,
                },
                rpcUrls: [
                  'https://data-seed-prebsc-2-s1.binance.org:8545',
                  'https://data-seed-prebsc-1-s2.binance.org:8545',
                  'https://data-seed-prebsc-2-s2.binance.org:8545'
                ],
                blockExplorerUrls: ['https://testnet.bscscan.com'],
              }
            });
            
            // Update account information
            const updatedAccount = walletManager.getPrimaryAccount();
            if (updatedAccount) {
              setChainId(updatedAccount.chainId);
              console.log('✅ Switched to BSC Testnet, new chainId:', updatedAccount.chainId);
            }
          } catch (switchError) {
            console.warn('⚠️ Failed to switch to BSC Testnet:', switchError);
            // Continue using current chain but log warning
          }
        } else {
          console.log('✅ Already on BSC Testnet');
        }
        
        console.log('🎉 Wallet connected successfully!');
      } else {
        console.error('❌ No account found after connection');
        throw new Error('No account found after connection');
      }
    } catch (error: unknown) {
      console.error('❌ Error connecting wallet:', error);
      const errorObj = error as { message?: string; code?: number; name?: string; stack?: string };
      console.error('❌ Error details:', {
        message: errorObj.message,
        code: errorObj.code,
        name: errorObj.name,
        stack: errorObj.stack,
      });
      
      // Set user-friendly error message
      let errorMessage = 'Failed to connect wallet';
      if (errorObj.code === 4001) {
        errorMessage = 'User rejected connection request';
      } else if (errorObj.code === -32002) {
        errorMessage = 'Connection request already in progress';
      } else if (errorObj.message?.includes('User rejected')) {
        errorMessage = 'User rejected connection request';
      } else if (errorObj.message?.includes('Already processing')) {
        errorMessage = 'Connection request already in progress, please wait';
      } else if (errorObj.message?.includes('连接超时')) {
        errorMessage = 'Connection timeout, please check if wallet is responding normally. If wallet popup does not appear, try refreshing the page';
      } else if (errorObj.message?.includes('timeout')) {
        errorMessage = 'Connection timeout, please check if wallet is responding normally';
      }
      
      setConnectionError(errorMessage);
      
      // Reset connection state on error
      setAddress(null);
      setIsConnected(false);
      setChainId(null);
      
      throw error;
    } finally {
      setIsConnecting(false);
      console.log('🔌 Connection attempt finished');
    }
  };

  const disconnect = () => {
    if (walletManager) {
      walletManager.disconnect();
    }
    setAddress(null);
    setIsConnected(false);
    setChainId(null);
  };

  const switchToBSC = async () => {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x61' }], // BSC Testnet
      });
    } catch (error: unknown) {
      const errorObj = error as { code?: number };
      if (errorObj.code === 4902) {
        // Chain not added, add it
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x61',
            chainName: 'BSC Testnet',
            nativeCurrency: {
              name: 'BNB',
              symbol: 'BNB',
              decimals: 18,
            },
            rpcUrls: [
              'https://data-seed-prebsc-2-s1.binance.org:8545/',
              'https://data-seed-prebsc-1-s2.binance.org:8545/',
              'https://data-seed-prebsc-2-s2.binance.org:8545/'
            ],
            blockExplorerUrls: ['https://testnet.bscscan.com/'],
          }],
        });
      } else {
        console.error('Error switching to BSC Testnet:', errorObj);
        throw error;
      }
    }
  };

  return (
    <WalletContext.Provider value={{
      address,
      account: address, // Alias for address
      isConnected,
      isConnecting,
      isRestoring,
      connect,
      disconnect,
      chainId,
      switchToBSC,
      walletManager,
      hasWallet,
      connectionError,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
