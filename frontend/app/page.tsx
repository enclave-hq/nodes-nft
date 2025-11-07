"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data, callContractWithFallback } from "@/lib/stores/web3Store";
import { formatTokenAmount, formatUSD, cn, simplifyErrorMessage } from "@/lib/utils";
import { NFT_UNIFIED_CONFIG, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { ArrowRight, Coins, TrendingUp, Shield, Lock, Loader2, AlertCircle, PlusCircle, DollarSign, Zap, ArrowLeftRight, Github, Twitter, Package } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { MintStatusBanner } from "@/components/MintStatusBanner";
import { WhitelistModal } from "@/components/WhitelistModal";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "@/lib/i18n/provider";
import { TokenBalance, NFTCount } from "@/lib/components/FormattedNumber";
import { useMemo, useEffect, useState } from "react";
import { NFT_MANAGER_ABI } from "@/lib/contracts/abis";
import { useMintNFT } from "@/lib/hooks/useNFTManager";
import { useActiveBatch } from "@/lib/hooks/useBatches";
import { useRouter } from "next/navigation";
import toast from 'react-hot-toast';

export default function Home() {
  const t = useTranslations('home');
  const tBatch = useTranslations('batch');
  const tMint = useTranslations('mint');
  const tWhitelist = useTranslations('whitelist');
  const tCommon = useTranslations('common');
  const { isConnected, address, walletManager } = useWallet();
  const web3Data = useWeb3Data();
  const { mintNFT, minting } = useMintNFT();
  const router = useRouter();
  const { batch: activeBatch, loading: batchLoading, refetch: refetchBatch } = useActiveBatch();
  const isWhitelisted = web3Data.whitelist.isWhitelisted;
  const [isWhitelistModalOpen, setIsWhitelistModalOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState<number>(0);
  const [loadingOrders, setLoadingOrders] = useState(false);


  // Calculate total locked amount
  const stats = useMemo(() => {
    if (!web3Data.nfts || web3Data.nfts.length === 0) {
      return {
        totalLocked: "0",
      };
    }

    let totalLocked = BigInt(0);

    web3Data.nfts.forEach((nft) => {
      // Calculate locked amount from mintPrice (which stores totalEclvLocked)
      // mintPrice is in wei format (18 decimals), convert to human-readable
      const lockedAmountWei = BigInt(nft.mintPrice || "0");
      totalLocked += lockedAmountWei;
    });

    // Convert totalLocked from wei (18 decimals) to human-readable format
    const decimals = 18;
    const divisor = BigInt(10 ** decimals);
    const wholePart = totalLocked / divisor;
    const remainderPart = totalLocked % divisor;
    
    let totalLockedStr: string;
    if (remainderPart === BigInt(0)) {
      totalLockedStr = wholePart.toString();
    } else {
      const remainderStr = remainderPart.toString().padStart(decimals, '0');
      const trimmed = remainderStr.replace(/0+$/, '');
      totalLockedStr = trimmed ? `${wholePart}.${trimmed}` : wholePart.toString();
    }

    return {
      totalLocked: totalLockedStr,
    };
  }, [web3Data.nfts]);

  // Fetch user's order statistics
  useEffect(() => {
    const fetchUserOrders = async () => {
      if (!walletManager || !address || !isConnected) {
        setActiveOrders(0);
        return;
      }

      setLoadingOrders(true);
      try {
        // Get user's orders using getOrdersBySeller
        // Returns: [orders: SellOrder[], total: uint256]
        const result = await callContractWithFallback(
          walletManager,
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getOrdersBySeller',
          [address, 0, 100], // offset: 0, limit: 100
          `getOrdersBySeller(${address})`
        );

        // Handle different return formats
        let ordersArray: any[] = [];
        let total: bigint = 0n;

        if (Array.isArray(result) && result.length >= 2) {
          // Standard format: [orders, total]
          ordersArray = result[0] || [];
          total = BigInt(result[1]?.toString() || '0');
        } else if (result && typeof result === 'object' && 'orders' in result && 'total' in result) {
          // Object format: { orders: [...], total: ... }
          ordersArray = (result as any).orders || [];
          total = BigInt((result as any).total?.toString() || '0');
        } else {
          console.warn('⚠️ Unexpected getOrdersBySeller return format:', result);
          setActiveOrders(0);
          return;
        }
        
        if (!ordersArray || ordersArray.length === 0) {
          setActiveOrders(0);
          return;
        }

        // Count active orders only
        // OrderStatus: 0 = Active, 1 = Cancelled, 2 = Filled
        // SellOrder structure: [orderId, nftId, seller, price, createdAt, status] or { orderId, nftId, seller, price, createdAt, status }
        let activeCount = 0;

        ordersArray.forEach((order: any) => {
          // Handle both array and object formats
          let status: number;
          if (Array.isArray(order)) {
            // Array format: [orderId, nftId, seller, price, createdAt, status]
            status = Number(order[5] || 0);
          } else if (order && typeof order === 'object') {
            // Object format with status property
            status = Number(order.status || 0);
          } else {
            // Fallback
            status = 0;
          }
          
          if (status === 0) {
            activeCount++;
          }
        });

        setActiveOrders(activeCount);
      } catch (error) {
        // Check if it's a wallet not connected error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isWalletNotConnected = errorMessage.includes('WalletNotConnectedError') ||
                                     errorMessage.includes('No wallet is connected') ||
                                     errorMessage.includes('Wallet not connected');

        if (isWalletNotConnected) {
          console.log('⚠️ Wallet not connected, skipping order fetch');
          setActiveOrders(0);
        } else {
          console.error('Error fetching user orders:', error);
          setActiveOrders(0);
        }
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchUserOrders();
  }, [walletManager, address, isConnected]);

  // Handle mint function
  const handleMint = async () => {
    if (!isConnected || !address) {
      toast.error(tCommon('connectWallet') || 'Please connect your wallet');
      return;
    }

    if (!isWhitelisted) {
      toast.error(tMint('whitelistRequired'));
      router.push('/simple-mint');
      return;
    }

    if (!activeBatch) {
      toast.error(tBatch('noActiveBatchMint'));
      return;
    }

    const mintPriceWei = BigInt(activeBatch.mintPrice);
    const mintPrice = Number(mintPriceWei) / 1e18;
    const usdtBalance = web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0;
    
    if (usdtBalance < mintPrice) {
      toast.error(tMint('insufficientUsdt').replace('{amount}', formatUSD(mintPrice)));
      return;
    }

    try {
      const result = await mintNFT();
      console.log("NFT minted successfully:", result);
      toast.success(tMint('mintSuccess'));
      await refetchBatch(); // Refresh batch info
      router.push("/my-nfts");
    } catch (err: unknown) {
      console.error("Failed to mint NFT:", err);
      const errorMessage = simplifyErrorMessage(err, "Failed to mint NFT");
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/LOGO_WITH_BACK.png"
              alt="Enclave Logo"
              width={200}
              height={80}
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mt-4 text-base leading-7 text-gray-600 max-w-2xl mx-auto">
            {t('hero.subtitle')}
          </p>

          <div className="mt-8 flex items-center justify-center gap-x-4">
            {isConnected ? (
              <Link
                href="/my-nfts"
                className="text-sm font-semibold leading-6 text-gray-700 hover:text-gray-900 flex items-center gap-x-1 transition-colors"
              >
                {t('hero.viewNftsButton')} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="text-sm text-gray-500">
                {t('hero.connectWallet')}
              </div>
            )}
          </div>
        </div>

        {/* Stats Section */}
        {isConnected && (
          <div className="mt-12 space-y-4">
            {/* Refresh Button - Top Right */}
            <div className="flex justify-end">
              <RefreshButton size="sm" />
            </div>
            
            {/* Mint Status Banner */}
            <MintStatusBanner />
            
            {/* NFT Stats Card - Three Columns */}
            <div className="rounded-xl bg-white p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-200">
              <div className="grid grid-cols-3 gap-2 sm:gap-6 divide-x divide-gray-200">
                {/* Column 1: My NFTs */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2 sm:mb-3">
                    {t('stats.myNfts')}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {web3Data.nfts?.length || 0}
                  </div>
                </div>

                {/* Column 2: Active Orders */}
                <div className="flex flex-col items-center text-center pl-2 sm:pl-6">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2 sm:mb-3">
                    {t('stats.listedShares', { defaultValue: 'Listed Shares' })}
                  </p>
                  {loadingOrders ? (
                    <div className="text-2xl sm:text-3xl font-bold text-gray-400">...</div>
                  ) : (
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {activeOrders}
                    </div>
                  )}
                </div>

                {/* Column 3: NFTs Without Orders */}
                <div className="flex flex-col items-center text-center pl-2 sm:pl-6">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2 sm:mb-3">
                    {t('stats.notListed', { defaultValue: 'Not Listed' })}
                  </p>
                  {loadingOrders ? (
                    <div className="text-2xl sm:text-3xl font-bold text-gray-400">...</div>
                  ) : (
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {Math.max(0, (web3Data.nfts?.length || 0) - activeOrders)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Second Card - Three Columns */}
            <div className="rounded-xl bg-white p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-200">
              <div className="grid grid-cols-3 gap-2 sm:gap-6 divide-x divide-gray-200">
                {/* Column 1: USDT Balance */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1 sm:mb-2">
                    {t('stats.usdtBalance')}
                  </p>
                  <div className="text-xl sm:text-3xl font-bold text-gray-900">
                    <TokenBalance 
                      value={web3Data.balances.usdt || "0"}
                      decimals={2}
                      className="text-xl sm:text-3xl font-bold text-gray-900"
                    />
                  </div>
                </div>

                {/* Column 2: $E Balance */}
                <div className="flex flex-col items-center text-center pl-2 sm:pl-6">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1 sm:mb-2">
                    {t('stats.eclvBalance')}
                  </p>
                  <div className="text-xl sm:text-3xl font-bold text-gray-900">
                    <TokenBalance 
                      value={web3Data.balances.e || "0"}
                      decimals={2}
                      className="text-xl sm:text-3xl font-bold text-gray-900"
                    />
                  </div>
                </div>

                {/* Column 3: $E Locked */}
                <div className="flex flex-col items-center text-center pl-2 sm:pl-6">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1 sm:mb-2">
                    {t('stats.eclvLocked')}
                  </p>
                  <div className="text-xl sm:text-3xl font-bold text-gray-900">
                    <TokenBalance 
                      value={stats.totalLocked}
                      decimals={2}
                      className="text-xl sm:text-3xl font-bold text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {t('howItWorks.title')}
          </h2>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-6 sm:mt-8 md:mt-10 max-w-6xl">
          {/* Mind Map Layout */}
          <div className="relative flex flex-col items-center justify-center py-4">
            {/* Center Node - Step 1 (Mint) */}
            <div className="relative z-10 flex flex-col items-center text-center mb-6 sm:mb-8">
              <div className="mb-3 sm:mb-4">
                <div className="rounded-full bg-blue-100 p-3 sm:p-4">
                  <PlusCircle className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{t('howItWorks.step1.title')}</h3>
              <p className="mt-2 sm:mt-3 max-w-md text-sm sm:text-base text-gray-600 px-4 sm:px-0">
                {t('howItWorks.step1.description')}
              </p>
            </div>

            {/* Three Processing Steps - Arranged around center */}
            <div className="relative w-full grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {/* Step 2 - Left/Top */}
              <div className="relative flex flex-col items-center text-center p-4 sm:p-5 md:p-6 rounded-2xl bg-purple-50 border-2 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
                {/* Connection Line (Desktop) */}
                <div className="hidden md:block absolute top-0 left-1/2 -translate-y-8 -translate-x-1/2 w-px h-8 bg-gradient-to-t from-purple-300 to-transparent"></div>
                <div className="hidden md:block absolute top-0 left-1/2 -translate-y-8 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-purple-300 via-purple-300 to-transparent"></div>
                
                <div className="mb-3">
                  <div className="rounded-full bg-purple-100 p-2 sm:p-3">
                    <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{t('howItWorks.step2.title')}</h3>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  {t('howItWorks.step2.description')}
                </p>
              </div>

              {/* Step 3 - Center/Bottom */}
              <div className="relative flex flex-col items-center text-center p-4 sm:p-5 md:p-6 rounded-2xl bg-green-50 border-2 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
                {/* Connection Line (Desktop) */}
                <div className="hidden md:block absolute top-0 left-1/2 -translate-y-8 -translate-x-1/2 w-px h-8 bg-gradient-to-t from-green-300 to-transparent"></div>
                
                <div className="mb-3">
                  <div className="rounded-full bg-green-100 p-2 sm:p-3">
                    <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{t('howItWorks.step3.title')}</h3>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  {t('howItWorks.step3.description')}
                </p>
              </div>

              {/* Step 4 - Right/Top */}
              <div className="relative flex flex-col items-center text-center p-4 sm:p-5 md:p-6 rounded-2xl bg-orange-50 border-2 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
                {/* Connection Line (Desktop) */}
                <div className="hidden md:block absolute top-0 left-1/2 -translate-y-8 -translate-x-1/2 w-px h-8 bg-gradient-to-t from-orange-300 to-transparent"></div>
                <div className="hidden md:block absolute top-0 left-1/2 -translate-y-8 -translate-x-1/2 w-20 h-px bg-gradient-to-l from-orange-300 via-orange-300 to-transparent"></div>
                
                <div className="mb-3">
                  <div className="rounded-full bg-orange-100 p-2 sm:p-3">
                    <ArrowLeftRight className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{t('howItWorks.step4.title')}</h3>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  {t('howItWorks.step4.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Batch Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {tBatch('activeBatch')}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {tBatch('activeBatchDescription')}
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl">
          {batchLoading ? (
            <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-900/5 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
              <p className="mt-4 text-gray-600">{tBatch('loadingBatchInfo')}</p>
            </div>
          ) : !activeBatch ? (
            <div className="rounded-2xl bg-yellow-50 p-8 shadow-xl ring-1 ring-yellow-200 text-center">
              <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">{tBatch('noActiveBatch')}</h3>
              <p className="text-gray-600">{tBatch('noActiveBatchDescription')}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-white border border-gray-200 p-6 shadow-sm">
              {/* Simplified batch information */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {tBatch('batchId').replace('{id}', String(activeBatch.batchId))}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatUSD(Number(activeBatch.mintPrice) / 1e18)} USDT
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{tBatch('progress')}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {activeBatch.currentMinted} / {activeBatch.maxMintable}
                  </p>
                </div>
              </div>

              {/* 铸造按钮 */}
              {!isConnected ? (
                <button
                  className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
                  disabled
                >
                  {tBatch('connectWalletFirst')}
                </button>
              ) : !isWhitelisted ? (
                <button
                  onClick={() => setIsWhitelistModalOpen(true)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  {tWhitelist('applyWhitelist')}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{t('stats.usdtBalance')}</span>
                    <span className={cn(
                      "font-medium",
                      (web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0) >= Number(activeBatch.mintPrice) / 1e18
                        ? "text-green-600"
                        : "text-red-600"
                    )}>
                      {web3Data.balances?.usdt || "0"} USDT
                    </span>
                  </div>
                  <button
                    onClick={handleMint}
                    disabled={minting || !activeBatch || (web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0) < Number(activeBatch.mintPrice) / 1e18}
                    className={cn(
                      "w-full rounded-lg px-4 py-2 text-sm font-medium transition-all",
                      (web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0) >= Number(activeBatch.mintPrice) / 1e18 && !minting && activeBatch
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    {minting ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tMint('minting')}
                      </span>
                    ) : (
                      tMint('mintNFT')
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Logo */}
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/logo_icon.png"
                alt="Enclave Logo"
                width={40}
                height={40}
                className="h-10 w-10"
              />
              <span className="ml-3 text-xl font-bold text-gray-900">{t('footer.title')}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {t('footer.description')}
            </p>
            <div className="mt-6 flex justify-center space-x-6">
              <a 
                href="https://github.com/enclave-hq/nodes-nft" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm transition-colors"
              >
                <Github className="h-5 w-5" />
                <span>{t('footer.github')}</span>
              </a>
              <a
                href="https://x.com/favorlabs" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm transition-colors"
              >
                <Twitter className="h-5 w-5" />
                <span>{t('footer.twitter')}</span>
              </a>
            </div>
            <p className="mt-6 text-xs text-gray-500">
              {t('footer.rights')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
