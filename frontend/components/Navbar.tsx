"use client";

import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatAddress, cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from '@/lib/i18n/provider';
import { TokenBalance } from "@/lib/components/FormattedNumber";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const tCommon = useTranslations('common');
  const tHome = useTranslations('home.stats');
  const { account, isConnected, isConnecting, connect, disconnect, chainId } = useWallet();
  const web3Data = useWeb3Data();
  const [web3DropdownOpen, setWeb3DropdownOpen] = useState(false);
  const web3DropdownRef = useRef<HTMLDivElement>(null);

  const isCorrectNetwork = chainId === parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "97");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (web3DropdownRef.current && !web3DropdownRef.current.contains(event.target as Node)) {
        setWeb3DropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo_icon.png"
                alt="Enclave Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-gray-900">Enclave</span>
            </Link>
          </div>

          {/* Desktop Navigation - Now in Sidebar */}

          {/* Right Side - Language Switcher & Wallet Info */}
          <div className="hidden lg:flex lg:items-center lg:space-x-4">
            <LanguageSwitcher />
            
            {/* Wallet Info & Connect Button */}
            {isConnected ? (
              <div className="relative" ref={web3DropdownRef}>
                <button
                  onClick={() => setWeb3DropdownOpen(!web3DropdownOpen)}
                  className="inline-flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-gray-100 text-gray-900 hover:bg-gray-200"
                >
                  <Wallet className="h-4 w-4" />
                  <span>{account ? formatAddress(account) : tCommon('connectWallet')}</span>
                </button>
                
                {/* Desktop Dropdown */}
                {web3DropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 z-50">
                    <div className="p-4">
                      {/* Balances Section */}
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{tHome('eclvBalance')}:</span>
                          <span className="text-base font-semibold text-gray-900">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.e || "0"}
                                decimals={0}
                                className="text-base font-semibold text-gray-900"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-500 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{tHome('usdtBalance')}:</span>
                          <span className="text-base font-semibold text-gray-900">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.usdt || "0"}
                                decimals={0}
                                className="text-base font-semibold text-gray-900"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-500 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{tCommon('allowance')}:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {web3Data.loading.allowances ? '...' : (
                              <TokenBalance 
                                value={web3Data.allowances.usdt || "0"}
                                decimals={0}
                                className="text-sm font-medium text-blue-600"
                              />
                            )}
                            {web3Data.errors.allowances && (
                              <span className="text-xs text-red-500 ml-1" title={web3Data.errors.allowances}>⚠</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Wallet Address Section */}
                      {account && (
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center space-x-2">
                            <Wallet className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900 break-all">
                              {formatAddress(account)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Disconnect Button */}
                      <div className="pt-4 border-t border-gray-200 mt-4">
                        <button
                          onClick={async () => {
                            await disconnect();
                            setWeb3DropdownOpen(false);
                          }}
                          className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors"
                        >
                          {tCommon('disconnect')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className={cn(
                  "inline-flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700",
                  isConnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                <Wallet className="h-4 w-4" />
                <span>
                  {isConnecting ? tCommon('loading') : tCommon('connectWallet')}
                </span>
              </button>
            )}

            {isConnected && !isCorrectNetwork && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                Wrong Network
              </div>
            )}
          </div>

                {/* Mobile - Language Switcher & Web3 Info */}
                <div className="flex lg:hidden items-center space-x-2">
                  <LanguageSwitcher />
            {isConnected ? (
              <div className="relative" ref={web3DropdownRef}>
                <button
                  onClick={() => setWeb3DropdownOpen(!web3DropdownOpen)}
                  className="inline-flex items-center rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">{account ? formatAddress(account) : 'Web3'}</span>
                  <span className="sm:hidden">Web3</span>
                </button>
                
                {/* Mobile Dropdown */}
                {web3DropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 z-50">
                    <div className="p-4">
                      {/* Balances Section */}
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{tHome('eclvBalance')}:</span>
                          <span className="text-base font-semibold text-gray-900">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.e || "0"}
                                decimals={0}
                                className="text-base font-semibold text-gray-900"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-500 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{tHome('usdtBalance')}:</span>
                          <span className="text-base font-semibold text-gray-900">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.usdt || "0"}
                                decimals={0}
                                className="text-base font-semibold text-gray-900"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-500 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{tCommon('allowance')}:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {web3Data.loading.allowances ? '...' : (
                              <TokenBalance 
                                value={web3Data.allowances.usdt || "0"}
                                decimals={0}
                                className="text-sm font-medium text-blue-600"
                              />
                            )}
                            {web3Data.errors.allowances && (
                              <span className="text-xs text-red-500 ml-1" title={web3Data.errors.allowances}>⚠</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Wallet Address Section */}
                      {account && (
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center space-x-2">
                            <Wallet className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900 break-all">
                              {formatAddress(account)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Disconnect Button */}
                      <div className="pt-4 border-t border-gray-200 mt-4">
                        <button
                          onClick={async () => {
                            await disconnect();
                            setWeb3DropdownOpen(false);
                          }}
                          className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors"
                        >
                          {tCommon('disconnect')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className={cn(
                  "inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700",
                  isConnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                <Wallet className="h-4 w-4 mr-1" />
                <span>{tCommon('connectWallet')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu - Removed, now in BottomNav */}
    </nav>
  );
}

