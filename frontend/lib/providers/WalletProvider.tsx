"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { BrowserProvider, JsonRpcSigner, ethers } from "ethers";
import { NETWORK_CONFIG } from "@/lib/contracts/config";

/**
 * Wallet context type
 */
interface WalletContextType {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Wallet Provider Component
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize provider and check connection
   */
  useEffect(() => {
    const init = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        const browserProvider = new BrowserProvider(window.ethereum);
        setProvider(browserProvider);

        // Check if already connected
        try {
          const accounts = await browserProvider.listAccounts();
          if (accounts.length > 0) {
            const account = await accounts[0].getAddress();
            const network = await browserProvider.getNetwork();
            const signer = await browserProvider.getSigner();

            setAccount(account);
            setChainId(Number(network.chainId));
            setSigner(signer);
          }
        } catch (err) {
          console.error("Failed to check wallet connection:", err);
        }
      }
    };

    init();
  }, []);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // Disconnected
        setAccount(null);
        setSigner(null);
      } else if (accounts[0] !== account) {
        // Account changed
        setAccount(accounts[0]);
        // Update signer
        if (provider) {
          provider.getSigner().then(setSigner);
        }
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
      // Reload page on chain change (recommended by MetaMask)
      window.location.reload();
    };

    const handleDisconnect = () => {
      setAccount(null);
      setSigner(null);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
        window.ethereum.removeListener("disconnect", handleDisconnect);
      }
    };
  }, [account, provider]);

  /**
   * Connect wallet
   */
  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      
      // Request account access
      await browserProvider.send("eth_requestAccounts", []);
      
      const signer = await browserProvider.getSigner();
      const account = await signer.getAddress();
      const network = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(signer);
      setAccount(account);
      setChainId(Number(network.chainId));

      // Check if on correct network
      if (Number(network.chainId) !== NETWORK_CONFIG.chainId) {
        await switchNetwork();
      }
    } catch (err: any) {
      console.error("Failed to connect wallet:", err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnect = () => {
    setAccount(null);
    setSigner(null);
    setError(null);
  };

  /**
   * Switch to correct network
   */
  const switchNetwork = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed");
      return;
    }

    try {
      const chainIdHex = `0x${NETWORK_CONFIG.chainId.toString(16)}`;
      
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (err: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (err.code === 4902) {
        try {
          const chainIdHex = `0x${NETWORK_CONFIG.chainId.toString(16)}`;
          const networkName = NETWORK_CONFIG.isTestnet ? "BSC Testnet" : "BSC Mainnet";
          const rpcUrl = NETWORK_CONFIG.rpcUrl;
          const blockExplorer = NETWORK_CONFIG.blockExplorer;

          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: networkName,
                nativeCurrency: {
                  name: "BNB",
                  symbol: "BNB",
                  decimals: 18,
                },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: [blockExplorer],
              },
            ],
          });
        } catch (addError: any) {
          console.error("Failed to add network:", addError);
          setError(addError.message || "Failed to add network");
        }
      } else {
        console.error("Failed to switch network:", err);
        setError(err.message || "Failed to switch network");
      }
    }
  };

  const value: WalletContextType = {
    account,
    chainId,
    provider,
    signer,
    isConnected: !!account && !!signer,
    isConnecting,
    error,
    connect,
    disconnect,
    switchNetwork,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/**
 * Hook to use wallet context
 */
export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

/**
 * TypeScript declaration for window.ethereum
 */
declare global {
  interface Window {
    ethereum?: any;
  }
}

