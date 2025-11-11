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
  const tWhitelist = useTranslations('whitelist');
  const tErrors = useTranslations('errors');
  const { account, isConnected, isConnecting, connect, disconnect, chainId } = useWallet();
  const web3Data = useWeb3Data();
  const [web3DropdownOpen, setWeb3DropdownOpen] = useState(false);
  const web3DropdownRef = useRef<HTMLDivElement>(null);
  // Check if user has applied whitelist or invite code
  const isWhitelisted = web3Data.whitelist.isWhitelisted;
  // 只有已申请成功白名单时才显示"查看邀请码"，否则显示"申请白名单"
  const shouldShowViewInviteCodes = isWhitelisted;

  const isCorrectNetwork = chainId === parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "97");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (web3DropdownRef.current && !web3DropdownRef.current.contains(event.target as Node)) {
        setWeb3DropdownOpen(false);
      }
    }

    // 使用 click 事件而不是 mousedown，避免在按钮点击时立即关闭
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-[100] bg-[#FFFFFF] border-b" 
      style={{ 
        borderColor: 'rgba(0, 0, 0, 0.1)', 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: '65px' }}>
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo_icon.png"
                alt="Enclave Logo"
                width={32}
                height={32}
                className="h-8 w-8 bg-transparent"
                style={{ background: 'transparent' }}
              />
              <span className="text-xl font-bold text-black">Enclave</span>
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
                  className="inline-flex items-center space-x-2 rounded-[20px] px-4 py-2 text-sm font-medium transition-colors bg-[#CEF248] text-black hover:bg-[#B8D93F]"
                >
                  <Wallet className="h-4 w-4" />
                  <span>{account ? formatAddress(account) : tCommon('connectWallet')}</span>
                </button>
                
                {/* Desktop Dropdown */}
                {web3DropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-[#FFFFFF] shadow-lg border border-gray-200 z-50">
                    <div className="p-4">
                      {/* Balances Section */}
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-black">{tHome('eclvBalance')}:</span>
                          <span className="text-base font-semibold text-black">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.e || "0"}
                                decimals={6}
                                className="text-base font-semibold text-black"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-400 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-black">{tHome('usdtBalance')}:</span>
                          <span className="text-base font-semibold text-black">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.usdt || "0"}
                                decimals={6}
                                className="text-base font-semibold text-black"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-400 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-black">{tCommon('allowance')}:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {web3Data.loading.allowances ? '...' : (
                              <TokenBalance 
                                value={web3Data.allowances.usdt || "0"}
                                decimals={6}
                                className="text-sm font-medium text-blue-600"
                              />
                            )}
                            {web3Data.errors.allowances && (
                              <span className="text-xs text-red-400 ml-1" title={web3Data.errors.allowances}>⚠</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Wallet Address Section */}
                      {account && (
                        <div className="pt-4 border-t border-gray-300">
                          <div className="flex items-center justify-between w-full">
                            <Wallet className="h-4 w-4 text-black flex-shrink-0" />
                            <span 
                              className="text-sm font-medium text-black text-right whitespace-nowrap font-mono ml-2" 
                              title={account}
                            >
                              {account ? `${account.slice(0, 10)}...${account.slice(-8)}` : ''}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Invite Code Request Section */}
                      <div className="pt-4 border-t border-gray-300 mt-4">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔍 [Navbar] 查看邀请码按钮点击 (桌面端)');
                            web3Data.setWhitelistModalOpen(true);
                            setWeb3DropdownOpen(false);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          className="w-full rounded-[20px] bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors mb-3"
                          type="button"
                        >
                          {shouldShowViewInviteCodes ? tWhitelist('viewInviteCodes') : tWhitelist('applyWhitelist')}
                        </button>
                      </div>
                      
                      {/* Disconnect Button */}
                      <div className="pt-2">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await disconnect();
                            setWeb3DropdownOpen(false);
                          }}
                          className="w-full rounded-[20px] bg-[#CEF248] px-4 py-2 text-sm font-medium text-black hover:bg-[#B8D93F] transition-colors"
                          type="button"
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
                  "inline-flex items-center space-x-2 rounded-[20px] px-4 py-2 text-sm font-medium transition-colors",
                  "bg-[#CEF248] text-black hover:bg-[#B8D93F]",
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
              <div className="rounded-lg bg-red-900/30 px-3 py-2 text-xs font-medium text-red-400">
                {tErrors('wrongNetwork')}
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
                  className="inline-flex items-center rounded-[20px] bg-[#CEF248] px-3 py-2 text-xs font-medium text-black hover:bg-[#B8D93F]"
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">{account ? formatAddress(account) : 'Web3'}</span>
                  <span className="sm:hidden">Web3</span>
                </button>
                
                {/* Mobile Dropdown */}
                {web3DropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-[#FFFFFF] shadow-lg border border-gray-200 z-50">
                    <div className="p-4">
                      {/* Balances Section */}
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-black">{tHome('eclvBalance')}:</span>
                          <span className="text-base font-semibold text-black">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.e || "0"}
                                decimals={6}
                                className="text-base font-semibold text-black"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-400 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-black">{tHome('usdtBalance')}:</span>
                          <span className="text-base font-semibold text-black">
                            {web3Data.loading.balances ? '...' : (
                              <TokenBalance 
                                value={web3Data.balances.usdt || "0"}
                                decimals={6}
                                className="text-base font-semibold text-black"
                              />
                            )}
                            {web3Data.errors.balances && (
                              <span className="text-xs text-red-400 ml-1" title={web3Data.errors.balances}>⚠</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-black">{tCommon('allowance')}:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {web3Data.loading.allowances ? '...' : (
                              <TokenBalance 
                                value={web3Data.allowances.usdt || "0"}
                                decimals={6}
                                className="text-sm font-medium text-blue-600"
                              />
                            )}
                            {web3Data.errors.allowances && (
                              <span className="text-xs text-red-400 ml-1" title={web3Data.errors.allowances}>⚠</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Wallet Address Section */}
                      {account && (
                        <div className="pt-4 border-t border-gray-300">
                          <div className="flex items-center justify-between w-full mb-2">
                            <Wallet className="h-4 w-4 text-black flex-shrink-0" />
                            <span 
                              className="text-sm font-medium text-black text-right whitespace-nowrap font-mono ml-2" 
                              title={account}
                            >
                              {account ? `${account.slice(0, 10)}...${account.slice(-8)}` : ''}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Invite Code Request Section */}
                      <div className="pt-4 border-t border-gray-300 mt-4">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔍 [Navbar] 查看邀请码按钮点击 (移动端)');
                            web3Data.setWhitelistModalOpen(true);
                            setWeb3DropdownOpen(false);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          className="w-full rounded-[20px] bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors mb-3"
                          type="button"
                        >
                          {shouldShowViewInviteCodes ? tWhitelist('viewInviteCodes') : tWhitelist('applyWhitelist')}
                        </button>
                      </div>
                      
                      {/* Disconnect Button */}
                      <div className="pt-2">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await disconnect();
                            setWeb3DropdownOpen(false);
                          }}
                          className="w-full rounded-[20px] bg-[#CEF248] px-4 py-2 text-sm font-medium text-black hover:bg-[#B8D93F] transition-colors"
                          type="button"
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
                  "inline-flex items-center rounded-[20px] px-3 py-2 text-xs font-medium transition-colors",
                  "bg-[#CEF248] text-black hover:bg-[#B8D93F]",
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

