"use client";

import Link from "next/link";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useBalances, useBNBBalance } from "@/lib/hooks/useBalances";
import { formatAddress, formatTokenAmount, cn } from "@/lib/utils";
import { Wallet, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslations, useLocale } from '@/lib/i18n/provider';
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const t = useTranslations('navbar');
  const tCommon = useTranslations('common');
  const { account, isConnected, isConnecting, connect, disconnect, chainId } = useWallet();
  const { data: balances } = useBalances();
  const { data: bnbBalance } = useBNBBalance();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCorrectNetwork = chainId === parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "97");

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-lg font-bold text-white">E</span>
              </div>
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
            {isConnected && balances && (
              <div className="flex items-center space-x-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div className="flex flex-col items-end">
                  <span className="font-medium text-gray-900">
                    {formatTokenAmount(balances.eclv, 18, 2)} ECLV
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTokenAmount(balances.usdt, 18, 2)} USDT
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

          {/* Mobile menu button */}
          <div className="flex md:hidden">
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
              {isConnected && balances && (
                <div className="mb-3 rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-900">
                    {formatTokenAmount(balances.eclv, 18, 2)} ECLV
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTokenAmount(balances.usdt, 18, 2)} USDT
                  </div>
                  {account && (
                    <div className="mt-2 text-xs text-gray-500">
                      {formatAddress(account)}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={isConnected ? disconnect : connect}
                disabled={isConnecting}
                className={cn(
                  "w-full inline-flex items-center justify-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
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
                    : isConnected
                    ? tCommon('disconnect')
                    : tCommon('connectWallet')}
                </span>
              </button>

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

