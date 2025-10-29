"use client";

import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatAddress, cn } from "@/lib/utils";
import { Wallet, Menu, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from '@/lib/i18n/provider';
import { LanguageSwitcher } from "./LanguageSwitcher";
import { TokenBalance } from "@/lib/components/FormattedNumber";

export function Navbar() {
  const t = useTranslations('navbar');
  const tCommon = useTranslations('common');
  const { account, isConnected, isConnecting, connect, disconnect, chainId, hasWallet, connectionError } = useWallet();
  const web3Data = useWeb3Data();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <Link
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {t('home')}
            </Link>
            <Link
              href="/marketplace"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {t('marketplace')}
            </Link>
            <Link
              href="/my-nfts"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {t('myNfts')}
            </Link>
            <Link
              href="/mint"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {t('mint')}
            </Link>
            
            {/* Language Switcher */}
            <LanguageSwitcher />
          </div>

          {/* Wallet Info & Connect Button */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {isConnected && (
              <div className="flex items-center space-x-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div className="flex flex-col items-end">
                  <span className="font-medium text-gray-900">
                    {web3Data.balances.e} $E
                  </span>
                  <span className="text-xs text-gray-500">
                    {web3Data.balances.usdt} USDT
                  </span>
                  <span className="text-xs text-blue-600">
                    授权: {web3Data.loading.allowances ? '...' : web3Data.allowances.usdt}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={isConnected ? disconnect : connect}
              disabled={isConnecting}
              className={cn(
                "inline-flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isConnected
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700",
                isConnecting && "opacity-50 cursor-not-allowed"
              )}
            >
              <Wallet className="h-4 w-4" />
              <span>
                {isConnecting
                  ? tCommon('loading')
                  : isConnected && account
                  ? formatAddress(account)
                  : tCommon('connectWallet')}
              </span>
            </button>

            {isConnected && !isCorrectNetwork && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                Wrong Network
              </div>
            )}
          </div>

          {/* Mobile Web3 Info & Menu */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Mobile Web3 Info Dropdown */}
            {isConnected && (
              <div className="relative" ref={web3DropdownRef}>
                <button
                  onClick={() => setWeb3DropdownOpen(!web3DropdownOpen)}
                  className="inline-flex items-center rounded-lg bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Web3
                </button>
                
                {/* Floating Dropdown */}
                {web3DropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 z-50">
                    <div className="p-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">$E余额:</span>
                          <span className="font-medium">{web3Data.balances.e}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">USDT余额:</span>
                          <span className="font-medium">{web3Data.balances.usdt}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">USDT授权:</span>
                          <span className="font-medium text-blue-600">
                            {web3Data.loading.allowances ? '...' : web3Data.allowances.usdt}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">BNB余额:</span>
                          <span className="font-medium">{web3Data.balances.bnb}</span>
                        </div>
                        {account && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-500 break-all">
                              {formatAddress(account)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 md:hidden">
          <div className="space-y-1 px-4 pb-3 pt-2">
            <Link
              href="/"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('home')}
            </Link>
            <Link
              href="/marketplace"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('marketplace')}
            </Link>
            <Link
              href="/my-nfts"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('myNfts')}
            </Link>
            <Link
              href="/mint"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('mint')}
            </Link>
            
            {/* Mobile Language Switcher */}
            <div className="pt-2">
              <LanguageSwitcher />
            </div>

            <div className="border-t border-gray-200 pt-4">
              {isConnected && (
                <div className="mb-3 rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-900">
                    <TokenBalance 
                      value={web3Data.balances.e || "0"}
                      decimals={2}
                      className="text-sm font-medium text-gray-900"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    <TokenBalance 
                      value={web3Data.balances.usdt || "0"}
                      decimals={2}
                      className="text-xs text-gray-500"
                    />
                  </div>
                  <div className="text-xs text-blue-600">
                    授权: {web3Data.loading.allowances ? '...' : web3Data.allowances.usdt}
                  </div>
                  {account && (
                    <div className="mt-2 text-xs text-gray-500">
                      {formatAddress(account)}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={async () => {
                  if (isConnected) {
                    await disconnect();
                  } else {
                    await connect();
                  }
                  setMobileMenuOpen(false);
                }}
                disabled={isConnecting || !hasWallet}
                className={cn(
                  "w-full inline-flex items-center justify-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isConnected
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    : hasWallet
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed",
                  (isConnecting || !hasWallet) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Wallet className="h-4 w-4" />
                <span>
                  {isConnecting
                    ? tCommon('loading')
                    : isConnected
                    ? tCommon('disconnect')
                    : hasWallet
                    ? tCommon('connectWallet')
                    : '请安装钱包'}
                </span>
              </button>

              {/* Error message */}
              {connectionError && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-center text-xs font-medium text-red-600">
                  {connectionError}
                </div>
              )}

              {/* Network warning */}
              {isConnected && !isCorrectNetwork && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-center text-xs font-medium text-red-600">
                  Wrong Network
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

