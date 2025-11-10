"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data, callContractWithFallback } from "@/lib/stores/web3Store";
import { formatTokenAmount, formatUSD, cn, simplifyErrorMessage } from "@/lib/utils";
import { NFT_UNIFIED_CONFIG, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { ArrowRight, Coins, TrendingUp, Shield, Lock, Loader2, AlertCircle, PlusCircle, DollarSign, Zap, ArrowLeftRight, Github, Twitter, Package, RefreshCw } from "lucide-react";
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
  const { isConnected, address, walletManager, connect, isConnecting } = useWallet();
  const web3Data = useWeb3Data();
  const { mintNFT, minting } = useMintNFT();
  const router = useRouter();
  const { batch: activeBatch, loading: batchLoading, refetch: refetchBatch } = useActiveBatch();
  const isWhitelisted = web3Data.whitelist.isWhitelisted;
  const [isWhitelistModalOpen, setIsWhitelistModalOpen] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'step1' | 'step2' | 'step3' | 'step4'>('step1');
  const [activeOrders, setActiveOrders] = useState<number>(0);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);


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
        let total: bigint = BigInt(0);

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
    <div className="min-h-screen bg-[#FFFFFF]">
      <Navbar />

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8" style={{ paddingTop: 'calc(65px + 1.5rem)' }}>
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Image
              src="/enclave-logo-black.png"
              alt="Enclave Logo"
              width={260}
              height={104}
              className="h-[83.2px] w-auto bg-transparent select-none"
              style={{ background: 'transparent', userSelect: 'none' }}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#000000] sm:text-3xl">
            {t('hero.title')}
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-700 max-w-2xl mx-auto">
            {t('hero.subtitle')}
          </p>

          {!isConnected ? (
            <div className="mt-4 flex items-center justify-center gap-x-4">
              <button
                onClick={connect}
                disabled={isConnecting}
                className={cn(
                  "inline-flex items-center space-x-2 rounded-[20px] px-4 py-2 text-sm font-medium transition-colors",
                  "bg-[#CEF248] text-black hover:bg-[#B8D93F]",
                  isConnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                <span>
                  {isConnecting ? tCommon('loading') : t('hero.connectWallet')}
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Not whitelisted: Apply Whitelist and View NFTs buttons in same row */}
              {!isWhitelisted && (
                <div className="mt-4 flex items-center justify-center gap-x-4">
                  <button
                    onClick={() => setIsWhitelistModalOpen(true)}
                    className={cn(
                      "inline-flex items-center justify-center rounded-[20px] px-4 py-2 text-sm font-medium transition-colors",
                      "bg-[#000000] text-white hover:bg-gray-800",
                      "min-w-[140px]"
                    )}
                  >
                    {tWhitelist('applyWhitelist')}
                  </button>
                  <Link
                    href="/my-nfts"
                    className={cn(
                      "inline-flex items-center justify-center space-x-2 rounded-[20px] px-3 sm:px-4 py-2 font-medium transition-colors",
                      "bg-[#CEF248] text-black hover:bg-[#B8D93F]",
                      "min-w-0"
                    )}
                  >
                    <span className="whitespace-nowrap text-[12px] sm:text-[13px] md:text-sm">{t('hero.viewNftsButton')}</span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0" />
                  </Link>
                </div>
              )}
              
              {/* Whitelisted: Mint Status Banner and View NFTs button in same row */}
              {isWhitelisted && (
                <div className="mt-4 flex items-center justify-center gap-x-4">
                  <MintStatusBanner variant="light" />
                  <Link
                    href="/my-nfts"
                    className={cn(
                      "inline-flex items-center justify-center space-x-2 rounded-[20px] px-3 sm:px-4 py-2 font-medium transition-colors",
                      "bg-[#CEF248] text-black hover:bg-[#B8D93F]",
                      "min-w-0"
                    )}
                  >
                    <span className="whitespace-nowrap text-[12px] sm:text-[13px] md:text-sm">{t('hero.viewNftsButton')}</span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats Section */}
        {isConnected && (
          <div className="mt-6 space-y-4">
            
            {/* NFT Stats Card */}
            <div className="rounded-[20px] bg-[#000000] p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow relative">
              {/* Refresh Button - Top Right Corner, Circular */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                <button
                  onClick={async () => {
                    if (isRefreshing) return;
                    setIsRefreshing(true);
                    try {
                      await web3Data.refreshData();
                      toast.success(tCommon('dataRefreshed', { defaultValue: 'Data refreshed' }));
                    } catch (error) {
                      console.error("Failed to refresh data:", error);
                      toast.error(tCommon('refreshFailed', { defaultValue: 'Refresh failed, please try again later' }));
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={!web3Data.isConnected || isRefreshing}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full p-2 bg-[#CEF248] text-black hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-all",
                    "h-8 w-8 sm:h-10 sm:w-10"
                  )}
                  title={tCommon('refreshChainData', { defaultValue: 'Refresh on-chain data' })}
                >
                  <RefreshCw className={cn("h-4 w-4 sm:h-5 sm:w-5", isRefreshing && "animate-spin")} />
                </button>
              </div>
              
              {/* Title and Number - Centered */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="text-2xl sm:text-3xl font-bold text-[#FFFFFF] mb-2">
                  {web3Data.nfts?.length || 0}
                </div>
                <h3 className="text-sm sm:text-base font-medium text-[#FFFFFF] uppercase mb-3">
                  {t('stats.myNfts')}
                </h3>
              </div>
              
              {/* Divider Line */}
              <div className="border-t border-gray-700 mb-0.5"></div>
              
              {/* Three Rows - Label Left, Number Right, Separated by Lines */}
              <div>
                {/* Row 1: 挂单中 */}
                <div className="flex items-center justify-between border-b border-gray-700" style={{ height: '40px' }}>
                  <span className="text-sm sm:text-base font-medium text-[#FFFFFF]">
                    {t('stats.listedShares', { defaultValue: 'Listed Shares' })}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[#FFFFFF]">
                    {loadingOrders ? '...' : (
                      <>
                        {activeOrders} <span className="text-[#CEF248]">NFT</span>
                      </>
                    )}
                  </span>
                </div>
                
                {/* Row 2: $E余额 */}
                <div className="flex items-center justify-between border-b border-gray-700" style={{ height: '40px' }}>
                  <span className="text-sm sm:text-base font-medium text-[#FFFFFF]">
                    {t('stats.eclvBalance')}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[#FFFFFF]">
                    <TokenBalance 
                      value={web3Data.balances.e || "0"}
                      decimals={6}
                      className="text-sm sm:text-base font-bold text-[#FFFFFF]"
                    />
                    <span className="text-[#CEF248]"> $E</span>
                  </span>
                </div>
                
                {/* Row 3: $E锁仓中 */}
                <div className="flex items-center justify-between" style={{ height: '40px' }}>
                  <span className="text-sm sm:text-base font-medium text-[#FFFFFF]">
                    {t('stats.eclvLocked')}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[#FFFFFF]">
                    <TokenBalance 
                      value={stats.totalLocked}
                      decimals={6}
                      className="text-sm sm:text-base font-bold text-[#FFFFFF]"
                    />
                    <span className="text-[#CEF248]"> $E</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Batch Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mx-auto max-w-2xl text-left">
          <h2 className="text-base font-bold tracking-tight text-[#000000]">
            {tBatch('activeBatch')}
          </h2>
        </div>

        <div className="mx-auto mt-4 max-w-2xl">
          {batchLoading ? (
            <div className="rounded-[28px] bg-[#FFFFFF] border border-[#000000]/10 p-4 shadow-xl text-center">
              <Loader2 className="h-6 w-6 animate-spin text-black mx-auto" />
              <p className="mt-2 text-sm text-black">{tBatch('loadingBatchInfo')}</p>
            </div>
          ) : !activeBatch ? (
            <div className="rounded-[28px] bg-[#FFFFFF] border border-[#000000]/10 p-4 shadow-xl text-center">
              <AlertCircle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-black mb-1">{tBatch('noActiveBatch')}</h3>
              <p className="text-sm text-black">{tBatch('noActiveBatchDescription')}</p>
            </div>
          ) : (
            <div className="rounded-[28px] bg-[#FFFFFF] border border-[#000000]/10 p-4 shadow-sm">
              {/* Simplified batch information */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-black">
                    {tBatch('batchId').replace('{id}', String(activeBatch.batchId))}
                  </h3>
                  <p className="text-sm text-black mt-1">
                    {formatUSD(Number(activeBatch.mintPrice) / 1e18)} USDT
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-black">{tBatch('progress')}</p>
                  <p className="text-sm font-semibold text-black">
                    {activeBatch.currentMinted} / {activeBatch.maxMintable}
                  </p>
                </div>
              </div>

              {/* 铸造按钮 */}
              {!isConnected ? (
                <button
                  className="w-full rounded-[20px] bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
                  disabled
                >
                  {tBatch('connectWalletFirst')}
                </button>
              ) : isWhitelisted && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-black">
                    <span>{t('stats.usdtBalance')}</span>
                    <span className="font-medium text-black">
                      {web3Data.balances?.usdt ? parseFloat(web3Data.balances.usdt).toFixed(2) : "0.00"} USDT
                    </span>
                  </div>
                  <button
                    onClick={handleMint}
                    disabled={minting || !activeBatch || (web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0) < Number(activeBatch.mintPrice) / 1e18}
                    className={cn(
                      "w-full rounded-[20px] px-4 py-2 text-sm font-medium transition-all",
                      (web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0) >= Number(activeBatch.mintPrice) / 1e18 && !minting && activeBatch
                        ? "bg-[#CEF248] text-black hover:bg-[#B8D93F]"
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

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-[#FFFFFF]">
        <div className="mx-auto max-w-2xl text-left">
          <h2 className="text-base font-bold tracking-tight text-[#000000]">
            {t('howItWorks.title')}
          </h2>
        </div>

        <div className="mx-auto mt-4 max-w-6xl">
          {/* Buttons - Vertical layout with title and description */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <button
              onClick={() => setActiveFeatureTab('step1')}
              className={cn(
                "w-full px-4 py-3 rounded-[20px] text-left transition-colors border",
                activeFeatureTab === 'step1'
                  ? "bg-[#CEF248] text-black"
                  : "text-black hover:bg-gray-100"
              )}
              style={activeFeatureTab !== 'step1' ? { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)' } : { borderColor: 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="text-sm sm:text-base font-medium">
                {t('howItWorks.step1.title')}
              </div>
              <div className={cn(
                "text-xs sm:text-sm mt-1",
                activeFeatureTab === 'step1' ? "text-gray-700" : "text-gray-600"
              )}>
                {t('howItWorks.step1.description')}
              </div>
            </button>
            <button
              onClick={() => setActiveFeatureTab('step2')}
              className={cn(
                "w-full px-4 py-3 rounded-[20px] text-left transition-colors border",
                activeFeatureTab === 'step2'
                  ? "bg-[#CEF248] text-black"
                  : "text-black hover:bg-gray-100"
              )}
              style={activeFeatureTab !== 'step2' ? { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)' } : { borderColor: 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="text-sm sm:text-base font-medium">
                {t('howItWorks.step2.title')}
              </div>
              <div className={cn(
                "text-xs sm:text-sm mt-1",
                activeFeatureTab === 'step2' ? "text-gray-700" : "text-gray-600"
              )}>
                {t('howItWorks.step2.description')}
              </div>
            </button>
            <button
              onClick={() => setActiveFeatureTab('step3')}
              className={cn(
                "w-full px-4 py-3 rounded-[20px] text-left transition-colors border",
                activeFeatureTab === 'step3'
                  ? "bg-[#CEF248] text-black"
                  : "text-black hover:bg-gray-100"
              )}
              style={activeFeatureTab !== 'step3' ? { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)' } : { borderColor: 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="text-sm sm:text-base font-medium">
                {t('howItWorks.step3.title')}
              </div>
              <div className={cn(
                "text-xs sm:text-sm mt-1",
                activeFeatureTab === 'step3' ? "text-gray-700" : "text-gray-600"
              )}>
                {t('howItWorks.step3.description')}
              </div>
            </button>
            <button
              onClick={() => setActiveFeatureTab('step4')}
              className={cn(
                "w-full px-4 py-3 rounded-[20px] text-left transition-colors border",
                activeFeatureTab === 'step4'
                  ? "bg-[#CEF248] text-black"
                  : "text-black hover:bg-gray-100"
              )}
              style={activeFeatureTab !== 'step4' ? { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)' } : { borderColor: 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="text-sm sm:text-base font-medium">
                {t('howItWorks.step4.title')}
              </div>
              <div className={cn(
                "text-xs sm:text-sm mt-1",
                activeFeatureTab === 'step4' ? "text-gray-700" : "text-gray-600"
              )}>
                {t('howItWorks.step4.description')}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#FFFFFF] py-12" style={{ borderTop: '1px solid rgba(194, 204, 66, 0.5)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm text-gray-700">
              {t('footer.description')}
            </p>
            <div className="mt-6 flex justify-center space-x-6">
              <a 
                href="https://github.com/enclave-hq/nodes-nft" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-700 hover:text-[#000000] text-sm transition-colors"
              >
                <Github className="h-5 w-5" />
                <span>{t('footer.github')}</span>
              </a>
              <a
                href="https://x.com/favorlabs" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-700 hover:text-[#000000] text-sm transition-colors"
              >
                <Twitter className="h-5 w-5" />
                <span>{t('footer.twitter')}</span>
              </a>
            </div>
            <p className="mt-6 text-xs text-gray-600">
              {t('footer.rights')}
            </p>
          </div>
        </div>
      </footer>

      {/* Whitelist Modal */}
      <WhitelistModal 
        isOpen={isWhitelistModalOpen} 
        onClose={() => setIsWhitelistModalOpen(false)} 
      />
    </div>
  );
}
