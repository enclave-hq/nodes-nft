"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatAddress, cn } from "@/lib/utils";
import { Wallet, Menu, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from '@/lib/i18n/provider';
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const t = useTranslations('navbar');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
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
    <nav className="bg-black">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/ENCLAVAE3.svg"
                alt="Enclave Logo"
                width={96}
                height={96}
                className="h-24 w-24 pointer-events-none"
                onDragStart={(e) => e.preventDefault()}
                style={{ WebkitUserDrag: 'none' } as React.CSSProperties}
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <Link
              href="/"
              className="text-sm font-medium text-gray-300 hover:text-white"
            >
              {t('home')}
            </Link>
            <Link
              href="/marketplace"
              className="text-sm font-medium text-gray-300 hover:text-white"
            >
              {t('marketplace')}
            </Link>
            <Link
              href="/my-nfts"
              className="text-sm font-medium text-gray-300 hover:text-white"
            >
              {t('myNfts')}
            </Link>
            <Link
              href="/mint"
              className="text-sm font-medium text-gray-300 hover:text-white"
            >
              {t('mint')}
            </Link>
            
            {/* Language Switcher */}
            <LanguageSwitcher />
          </div>

          {/* Wallet Info & Connect Button */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <button
              onClick={isConnected ? disconnect : connect}
              disabled={isConnecting}
              className={cn(
                "inline-flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isConnected
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-[#B1C72E] text-black hover:bg-[#9db026]",
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
              <div className="rounded-lg bg-red-900/30 px-3 py-2 text-xs font-medium text-red-400">
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
                  className="inline-flex items-center rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Web3
                </button>
                
                {/* Floating Dropdown */}
                {web3DropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-gray-900 shadow-lg ring-1 ring-gray-800 z-50">
                    <div className="p-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">$E余额:</span>
                          <span className="font-medium text-white">{web3Data.balances.e}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">USDT余额:</span>
                          <span className="font-medium text-white">{web3Data.balances.usdt}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">USDT授权:</span>
                          <span className="font-medium text-[#B1C72E]">
                            {web3Data.loading.allowances ? '...' : web3Data.allowances.usdt}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">BNB余额:</span>
                          <span className="font-medium text-white">{web3Data.balances.bnb}</span>
                        </div>
                        {account && (
                          <div className="pt-2 border-t border-gray-800">
                            <div className="text-xs text-gray-400 break-all">
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
              className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-gray-800"
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
        <div className="border-t border-gray-800 md:hidden">
          <div className="space-y-1 px-4 pb-3 pt-2">
            <Link
              href="/"
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium hover:bg-gray-800",
                pathname === "/" ? "text-[#B1C72E]" : "text-white"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('home')}
            </Link>
            <Link
              href="/marketplace"
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium hover:bg-gray-800",
                pathname === "/marketplace" || pathname?.startsWith("/marketplace") ? "text-[#B1C72E]" : "text-white"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('marketplace')}
            </Link>
            <Link
              href="/my-nfts"
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium hover:bg-gray-800",
                pathname === "/my-nfts" || pathname?.startsWith("/my-nfts") ? "text-[#B1C72E]" : "text-white"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('myNfts')}
            </Link>
            <Link
              href="/mint"
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium hover:bg-gray-800",
                pathname === "/mint" || pathname?.startsWith("/mint") ? "text-[#B1C72E]" : "text-white"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('mint')}
            </Link>
            
            {/* Mobile Language Switcher */}
            <div className="pt-2">
              <LanguageSwitcher />
            </div>

            <div className="border-t border-gray-800 pt-4">
              {isConnected && (
                <div className="mb-3 rounded-lg bg-gray-900 p-3">
                  {account && (
                    <div className="text-xs text-gray-400">
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
                    ? "bg-gray-800 text-white hover:bg-gray-700"
                    : hasWallet
                    ? "bg-[#B1C72E] text-black hover:bg-[#9db026]"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed",
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
                <div className="mt-2 rounded-lg bg-red-900/30 p-2 text-center text-xs font-medium text-red-400">
                  {connectionError}
                </div>
              )}

              {/* Network warning */}
              {isConnected && !isCorrectNetwork && (
                <div className="mt-2 rounded-lg bg-red-900/30 p-2 text-center text-xs font-medium text-red-400">
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

