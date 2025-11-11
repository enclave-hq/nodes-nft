"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { useNFTPool, useCreateSellOrder } from "@/lib/hooks/useNFTManager";
import { useNFTSellOrders, useAllSellOrders, useCancelSellOrder, useBuyNFT } from "@/lib/hooks/useMarketplace";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import toast from 'react-hot-toast';
import { formatTokenAmount, formatAddress, formatDate, cn, parseTokenAmount } from "@/lib/utils";
import { NFTStatus, NFT_UNIFIED_CONFIG } from "@/lib/contracts/config";
import { ShoppingCart, Store, Tag, Loader2, X, Plus, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "@/lib/i18n/provider";
import { ListIcon } from "@/components/icons/ListIcon";

function SellOrderCard({ 
  order, 
  onBuy 
}: { 
  order: any;
  onBuy: (orderId: number) => void;
}) {
  const t = useTranslations('marketplace.orderCard');
  const tTypes = useTranslations('nftTypes');
  const { account } = useWallet();
  const { data: pool } = useNFTPool(order.nftId);
  const buyNFT = useBuyNFT();
  const cancelOrder = useCancelSellOrder();

  if (!pool) return null;

  // All NFTs now have the same configuration
  const isOwnOrder = account?.toLowerCase() === order.seller.toLowerCase();
  // Market now uses NFT whole sale, not shares
  // Use order.price from Store (already converted to BigInt in useAllSellOrders)
  const totalPrice = order.price || BigInt(0);

  const handleBuy = async () => {
    if (isOwnOrder) return;
    try {
      await buyNFT.mutateAsync({ orderId: order.orderId });
      onBuy(order.orderId);
    } catch (error) {
      console.error("Failed to buy NFT:", error);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelOrder.mutateAsync({ orderId: order.orderId });
    } catch (error) {
      console.error("Failed to cancel order:", error);
    }
  };

  return (
    <div className="rounded-[20px] bg-[#FFFFFF] border border-[#000000]/30 p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* First Row: NFT ID (left) and Order ID (right) */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#000000]">
          NFT #{order.nftId}
        </h3>
        {isOwnOrder && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#CEF248] text-[#000000]">
            {t('mine')}
          </span>
        )}
      </div>

      {/* Price - Centered in gray card */}
      <div className="mb-4 rounded-lg bg-gray-100 p-3">
        <div className="text-sm font-semibold text-[#000000] text-center">
          {formatTokenAmount(totalPrice, 18, 2)} USDT
        </div>
      </div>

      {/* Seller Info */}
      <div className="mb-2 text-sm flex items-center justify-between whitespace-nowrap">
        <span className="text-[#000000]">{t('seller')}</span>
        <span className="text-[#000000] truncate">{formatAddress(order.seller)}</span>
      </div>

      <div className="border-t border-[#000000]/10 my-2"></div>

      {/* Order ID and Listed Date - Right Aligned */}
      <div className="mb-4 text-xs flex justify-between">
        <span className="text-[#000000]">ID: #{order.orderId}</span>
        <span className="text-[#000000]">{order.createdAtDisplay}</span>
      </div>

      {/* Action Button */}
      <div className="mt-4">
        {isOwnOrder ? (
          <button
            onClick={handleCancel}
            disabled={cancelOrder.isLoading}
            className="w-full rounded-[20px] bg-[#000000] text-[#FFFFFF] px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {cancelOrder.isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('cancelling')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                {t('cancelOrder')}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={handleBuy}
            disabled={buyNFT.isLoading}
            className="w-full rounded-[20px] bg-[#CEF248] px-4 py-2 text-sm font-medium text-black hover:bg-[#B8D93F] disabled:opacity-50"
          >
            {buyNFT.isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('buying')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t('buyNFT')}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CreateOrderModal({
  nftId: initialNftId,
  onClose,
  onOrderCreated,
}: {
  nftId: number;
  onClose: () => void;
  onOrderCreated?: () => void;
}) {
  const t = useTranslations('marketplace.createOrder');
  const [price, setPrice] = useState("");
  const [selectedNftId, setSelectedNftId] = useState<number>(initialNftId);
  const [isNftSelectorOpen, setIsNftSelectorOpen] = useState(false);
  const createOrder = useCreateSellOrder();
  const web3Data = useWeb3Data();
  const allOrders = useAllSellOrders();
  
  // Get NFTs that don't have active orders (can be listed)
  const availableNFTs = useMemo(() => {
    if (!web3Data.nfts || !allOrders.data) return web3Data.nfts || [];
    
    const activeOrderNftIds = new Set(
      allOrders.data
        .filter(order => order.active)
        .map(order => order.nftId)
    );
    
    return web3Data.nfts.filter(nft => !activeOrderNftIds.has(nft.id));
  }, [web3Data.nfts, allOrders.data]);

  // Update selected NFT when initialNftId changes
  useEffect(() => {
    setSelectedNftId(initialNftId);
  }, [initialNftId]);

  const handleCreate = async () => {
    if (!price || !selectedNftId) return;
    
    try {
      const priceBigInt = parseTokenAmount(price, 18);
      
      await createOrder.mutateAsync({
        nftId: selectedNftId,
        price: priceBigInt, // Price for the whole NFT
      });
      
      // Notify parent component to refresh orders
      if (onOrderCreated) {
        onOrderCreated();
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to create order:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] modal-backdrop pointer-events-none" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
      <div className="w-full rounded-t-[28px] bg-[#FFFFFF] border-t border-[#000000]/10 p-4 shadow-xl max-h-[90vh] overflow-y-auto modal-content pointer-events-auto" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-[#000000]">{t('title')}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* NFT Selector */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setIsNftSelectorOpen(!isNftSelectorOpen)}
              className="w-full flex items-center justify-between rounded-lg border border-[#000000]/10 bg-[#FFFFFF] px-3 py-2 text-left hover:bg-gray-50 transition-colors h-[40px]"
            >
              <span className="text-[14px] font-medium text-[#000000]">
                {selectedNftId ? (
                  <>{t('selectedNFT', { id: selectedNftId })}</>
                ) : (
                  <>{t('selectNFT')} {availableNFTs.length > 0 && `(${availableNFTs.length})`}</>
                )}
              </span>
              {isNftSelectorOpen ? (
                <ChevronUp className="h-4 w-4 text-[#000000]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#000000]" />
              )}
            </button>
            
            {isNftSelectorOpen && (
              <div className="mt-2 rounded-lg border border-[#000000]/10 bg-[#FFFFFF] max-h-48 overflow-y-auto">
                {availableNFTs.length === 0 ? (
                  <div className="p-3 text-center text-[14px] text-gray-600">
                    {t('noAvailableNFTs')}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {availableNFTs.map((nft) => (
                      <button
                        key={nft.id}
                        type="button"
                        onClick={() => {
                          setSelectedNftId(nft.id);
                          setIsNftSelectorOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                          selectedNftId === nft.id ? 'bg-[#CEF248]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[14px] font-medium ${
                            selectedNftId === nft.id ? 'text-[#000000]' : 'text-[#000000]'
                          }`}>
                            NFT #{nft.id}
                          </span>
                          {selectedNftId === nft.id && (
                            <span className="text-[12px] text-[#000000]">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Price Input */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-[#000000]">
              {t('setPriceLabel')}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="block w-full px-3 py-2 pr-16 text-sm text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)' }}
                placeholder={t('nftPricePlaceholder')}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-black pointer-events-none">
                USDT
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-[20px] bg-[#000000] px-4 py-2 text-sm font-medium text-[#FFFFFF] hover:bg-gray-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!price || createOrder.isLoading}
            className="flex-1 rounded-[20px] bg-[#CEF248] px-4 py-2 text-sm font-medium text-[#000000] hover:bg-[#B8D93F] disabled:opacity-50"
          >
            {createOrder.isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('creating')}
              </span>
            ) : (
              t('createButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const t = useTranslations('marketplace');
  const tMyNFTs = useTranslations('marketplace.myNFTs');
  const tCommon = useTranslations('common');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();
  const buyNFT = useBuyNFT();
  const allOrders = useAllSellOrders();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOrderNFT, setCreateOrderNFT] = useState<{ nftId: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'my-nfts' | 'orders'>('orders');
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  const handleTabChange = (tab: 'my-nfts' | 'orders') => {
    // Prevent any layout shift by maintaining scroll position
    const currentScrollY = window.scrollY;
    setActiveTab(tab);
    // Restore scroll position after state update to prevent layout shift
    requestAnimationFrame(() => {
      window.scrollTo({ top: currentScrollY, behavior: 'instant' });
    });
  };

  // 计算滑动背景的位置和宽度
  const updateTabSliderPosition = () => {
    const activeIndex = activeTab === 'orders' ? 0 : 1;
    
    if (tabButtonRefs.current[activeIndex] && tabContainerRef.current) {
      const activeButton = tabButtonRefs.current[activeIndex];
      const container = tabContainerRef.current;
      
      const buttonRect = activeButton.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // 增加一些宽度和调整位置，确保完全覆盖按钮区域
      const padding = 2; // 左右各增加2px
      setSliderStyle({
        left: buttonRect.left - containerRect.left - padding,
        width: buttonRect.width + padding * 2,
      });
    }
  };

  // 当 activeTab 改变时更新滑动位置
  useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      // 再延迟一点确保布局完成
      setTimeout(updateTabSliderPosition, 10);
    });
  }, [activeTab]);

  // 组件挂载时初始化滑动位置
  useEffect(() => {
    // 多次尝试以确保 DOM 已渲染
    const timers = [
      setTimeout(updateTabSliderPosition, 0),
      setTimeout(updateTabSliderPosition, 50),
      setTimeout(updateTabSliderPosition, 100),
    ];
    
    // 监听窗口大小改变
    window.addEventListener('resize', updateTabSliderPosition);
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      window.removeEventListener('resize', updateTabSliderPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleBuy = async (orderId: number) => {
    try {
      await buyNFT.mutateAsync({ orderId });
      // Refresh orders after successful purchase
      allOrders.refetch();
    } catch (error) {
      console.error("Failed to buy NFT:", error);
    }
  };

  const handleCreateOrder = (nftId: number) => {
    setCreateOrderNFT({ nftId });
    setShowCreateModal(true);
  };

  const handleOrderCreated = () => {
    // Refresh all orders after creating or canceling an order
    allOrders.refetch();
    // Also refresh web3Data to get updated NFT list
    web3Data.refreshData();
  };

  // Manual refresh only - no auto-refresh to prevent infinite loops
  useEffect(() => {
    if (!isConnected) return;
    
    // Initial fetch with delay to avoid race conditions
    const initialTimeout = setTimeout(() => {
      allOrders.refetch();
    }, 2000); // Increased delay

    return () => {
      clearTimeout(initialTimeout);
    };
  }, [isConnected]); // Only depend on connection status

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8" style={{ paddingTop: 'calc(65px + 1rem)' }}>
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#000000]">{t('title')}</h1>
            <span className="text-sm text-gray-700">-</span>
            <p className="text-sm text-gray-700">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-[20px] bg-[#FFFFFF] border border-[#000000]/10 p-4 text-center">
            <h3 className="text-base font-medium text-[#000000]">
              {t('connectWallet.title')}
            </h3>
            <p className="mt-2 text-sm text-[#000000]">
              {t('connectWallet.description')}
            </p>
          </div>
        ) : (
          <>
            {/* Tabs - Outside the card */}
            <div className="mb-4">
              <nav className="flex items-center gap-4" aria-label={tCommon('tabs')}>
                <div
                  ref={tabContainerRef}
                  className="relative inline-flex items-center rounded-full bg-[#f3f4f6] border border-[#000000]/10 h-10"
                >
                  {/* Sliding Background */}
                  <div
                    className="absolute bg-[#CEF248] transition-all duration-300 ease-in-out"
                    style={{
                      left: `${sliderStyle.left}px`,
                      width: `${sliderStyle.width}px`,
                      height: '40px',
                      borderRadius: '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 0,
                    }}
                  />
                  
                  <button
                    ref={(el) => { tabButtonRefs.current[0] = el; }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('orders');
                    }}
                    className={cn(
                      "inline-flex items-center justify-center space-x-2 rounded-full px-4 text-sm font-medium transition-colors relative z-10 h-10",
                      activeTab === 'orders'
                        ? "text-black"
                        : "text-black hover:text-gray-700"
                    )}
                  >
                    <span>{t('orders.title')}</span>
                    {allOrders.data && allOrders.data.length > 0 && (
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                        activeTab === 'orders'
                          ? "bg-black text-white"
                          : "bg-[#CEF248] text-black"
                      )}>
                        {allOrders.data.length}
                      </span>
                    )}
                  </button>
                  <button
                    ref={(el) => { tabButtonRefs.current[1] = el; }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('my-nfts');
                    }}
                    className={cn(
                      "inline-flex items-center justify-center space-x-2 rounded-full px-4 text-sm font-medium transition-colors relative z-10 h-10",
                      activeTab === 'my-nfts'
                        ? "text-black"
                        : "text-black hover:text-gray-700"
                    )}
                  >
                    <span>{t('sidebar.title')}</span>
                    {web3Data.nfts && web3Data.nfts.length > 0 && (
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                        activeTab === 'my-nfts'
                          ? "bg-black text-white"
                          : "bg-[#CEF248] text-black"
                      )}>
                        {web3Data.nfts.length}
                      </span>
                    )}
                  </button>
                </div>
                {/* Refresh Button */}
                {isConnected && (
                  <div className="ml-auto">
                    <RefreshButton size="sm" />
                  </div>
                )}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'orders' ? (
              /* Active Orders Tab - individual cards */
              <>
                {allOrders.isLoading ? (
                  <div className="flex items-center justify-center rounded-[20px] border border-[#000000]/10 bg-[#FFFFFF] p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#000000]" />
                    <span className="ml-2 text-[#000000]">{tMyNFTs('loadingOrdersError')}</span>
                  </div>
                ) : allOrders.error ? (
                  <div className="rounded-lg border border-red-800 bg-red-900/30 p-6 text-center">
                    <p className="text-red-400">{tMyNFTs('loadOrdersFailed')}: {allOrders.error}</p>
                    <button
                      onClick={() => allOrders.refetch()}
                      className="mt-2 rounded-[20px] bg-[#CEF248] px-4 py-2 text-black hover:bg-[#B8D93F]"
                    >
                      {tMyNFTs('retry')}
                    </button>
                  </div>
                ) : allOrders.data && allOrders.data.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {allOrders.data.map((order) => (
                      <SellOrderCard key={order.orderId} order={order} onBuy={handleBuy} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-[#000000]/10 bg-[#FFFFFF] p-12 text-center">
                    <ShoppingCart className="mx-auto h-12 w-12 text-[#000000]" />
                    <h3 className="mt-4 text-base font-medium text-[#000000]">
                      {t('orders.empty.title')}
                    </h3>
                    <p className="mt-2 text-sm text-[#000000]">
                      {t('orders.empty.description')}
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* My NFTs Tab - without card, directly on page background */
              <MyNFTsSection
                nfts={web3Data.nfts || []}
                onCreateOrder={handleCreateOrder}
                onOrderCreated={handleOrderCreated}
              />
            )}
          </>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && createOrderNFT && (
        <CreateOrderModal
          nftId={createOrderNFT.nftId}
          onClose={() => {
            setShowCreateModal(false);
            setCreateOrderNFT(null);
          }}
          onOrderCreated={() => {
            allOrders.refetch();
            handleOrderCreated();
          }}
        />
      )}
    </div>
  );
}

function MyNFTsSection({
  nfts,
  onCreateOrder,
  onOrderCreated,
}: {
  nfts: Array<{ id: number }>;
  onCreateOrder: (nftId: number) => void;
  onOrderCreated?: () => void;
}) {
  const tMyNFTs = useTranslations('marketplace.myNFTs');
  const allOrders = useAllSellOrders();
  
  // Separate NFTs into two groups: with orders and without orders
  const nftsWithOrders: Array<{ nftId: number; order: any }> = [];
  const nftsWithoutOrders: Array<number> = [];
  
  // Create a map of NFT ID to order for quick lookup
  const orderMap = new Map<number, any>();
  if (allOrders.data && !allOrders.isLoading) {
    allOrders.data.forEach((order) => {
      if (order.active) {
        orderMap.set(order.nftId, order);
      }
    });
  }
  
  // Categorize NFTs (only if orders are loaded)
  // Use a Set to track processed NFT IDs to avoid duplicates
  const processedNftIds = new Set<number>();
  if (!allOrders.isLoading) {
    nfts.forEach((nft) => {
      // Skip if this NFT ID was already processed
      if (processedNftIds.has(nft.id)) {
        return;
      }
      processedNftIds.add(nft.id);
      
      const order = orderMap.get(nft.id);
      if (order) {
        nftsWithOrders.push({ nftId: nft.id, order });
      } else {
        nftsWithoutOrders.push(nft.id);
      }
    });
  }

  if (nfts.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-base font-bold text-white">{tMyNFTs('title')}</h2>
        </div>
        <div className="rounded-[20px] border border-[#000000]/10 bg-[#FFFFFF] p-12 text-center">
          <Tag className="mx-auto h-12 w-12 text-[#000000]" />
          <h3 className="mt-4 text-base font-medium text-[#000000]">
            {tMyNFTs('noNFTs')}
          </h3>
          <p className="mt-2 text-sm text-[#000000]">
            {tMyNFTs('noNFTsDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {allOrders.isLoading ? (
        <div className="rounded-[20px] border border-[#000000]/10 bg-[#FFFFFF] p-12 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-[#000000] animate-spin" />
          <h3 className="mt-4 text-base font-medium text-[#000000]">
            {tMyNFTs('loadingOrders')}
          </h3>
        </div>
      ) : (
        <div>
          {/* Not On Sale Card */}
          {nftsWithoutOrders.length > 0 && (
            <div className="mb-4 rounded-[20px] bg-[#000000] px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-[#FFFFFF]">{tMyNFTs('notOnSale')}</h3>
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#CEF248] text-[#000000] text-xs font-bold">
                    {nftsWithoutOrders.length}
                  </span>
                </div>
                <button
                  onClick={() => onCreateOrder(nftsWithoutOrders[0])}
                  className="rounded-[20px] bg-[#CEF248] px-4 py-2 text-sm font-medium text-[#000000] hover:bg-[#B8D93F] transition-colors flex items-center justify-center"
                >
                  <ListIcon className="h-4 w-4 mr-2" />
                  {tMyNFTs('listForSale')}
                </button>
              </div>
            </div>
          )}

          {/* On Sale Card */}
          {nftsWithOrders.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {nftsWithOrders.map(({ nftId, order }) => (
                <NFTListItem
                  key={`with-order-${nftId}`}
                  nftId={nftId}
                  onCreateOrder={onCreateOrder}
                  onOrderCreated={onOrderCreated}
                />
              ))}
            </div>
          )}

          {/* If all NFTs are listed or none are listed, show message */}
          {nftsWithOrders.length === 0 && nftsWithoutOrders.length === 0 && nfts.length > 0 && (
            <div className="rounded-[28px] border-2 border-dashed border-gray-700 bg-[#000000] p-12 text-center">
              <Tag className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-white">
                {tMyNFTs('noData')}
              </h3>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NFTListItem({
  nftId,
  onCreateOrder,
  onOrderCreated,
}: {
  nftId: number;
  onCreateOrder: (nftId: number) => void;
  onOrderCreated?: () => void;
}) {
  const t = useTranslations('marketplace.orderCard');
  const tMyNFTs = useTranslations('marketplace.myNFTs');
  const tTypes = useTranslations('nftTypes');
  const { data: pool } = useNFTPool(nftId);
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useNFTSellOrders(nftId);
  const cancelOrder = useCancelSellOrder();
  const { account } = useWallet();

  // Auto-fetch orders when component mounts or nftId changes
  useEffect(() => {
    if (pool && nftId) {
      refetchOrders();
    }
  }, [pool, nftId, refetchOrders]);

  // Check if there's an active order
  const activeOrder = orders && orders.length > 0 ? orders[0] : null;

  if (!pool) return null;

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    
    try {
      await cancelOrder.mutateAsync({ orderId: activeOrder.orderId });
      toast.success(tMyNFTs('orderRevoked'));
      // Refresh orders after cancellation
      refetchOrders();
      // Notify parent to refresh all orders
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: unknown) {
      console.error("Failed to cancel order:", error);
      const errorMessage = error instanceof Error ? error.message : tMyNFTs('revokeOrderFailed');
      toast.error(errorMessage);
    }
  };

  // All NFTs now have the same configuration
  return (
    <div className="rounded-[20px] bg-[#FFFFFF] border border-[#000000]/30 p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Order Status */}
      {ordersLoading ? (
        <div className="mt-4 flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : activeOrder ? (
        <div className="space-y-3">
          {/* First Row: NFT ID (left) and Status (right) */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#000000]">
              NFT #{nftId}
            </h3>
            <span className="rounded-full px-2 py-1 text-xs font-medium bg-[#CEF248] text-[#000000]">
              {t('onSale')}
            </span>
          </div>
          
          {/* Second Row: Price in gray card */}
          <div className="rounded-lg bg-gray-100 p-3">
            <div className="text-sm font-semibold text-[#000000] text-center">
              {formatTokenAmount(activeOrder.price, 18, 2)} USDT
            </div>
          </div>
          
          {/* Order ID and Created Time - Same row */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>ID: #{activeOrder.orderId}</span>
            <span>{activeOrder.createdAtDisplay}</span>
          </div>
          
          {/* Cancel Order Button */}
          <button
            onClick={handleCancelOrder}
            disabled={cancelOrder.isLoading}
            className="w-full rounded-[20px] bg-[#000000] px-4 py-2 text-sm font-medium text-[#FFFFFF] hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {cancelOrder.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('revoking')}
              </>
            ) : (
              <>
                {t('revokeListing')}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={() => onCreateOrder(nftId)}
            className="w-full rounded-[20px] bg-[#CEF248] px-4 py-2 text-sm font-medium text-black hover:bg-[#B8D93F] transition-colors flex items-center justify-center"
          >
            <ListIcon className="h-4 w-4 mr-2" />
            {tMyNFTs('listForSale')}
          </button>
        </div>
      )}
    </div>
  );
}

function NFTListItemSimple({
  nftId,
  onCreateOrder,
  onOrderCreated,
}: {
  nftId: number;
  onCreateOrder: (nftId: number) => void;
  onOrderCreated?: () => void;
}) {
  const tMyNFTs = useTranslations('marketplace.myNFTs');
  const { data: pool } = useNFTPool(nftId);
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useNFTSellOrders(nftId);
  const cancelOrder = useCancelSellOrder();

  // Auto-fetch orders when component mounts or nftId changes
  useEffect(() => {
    if (pool && nftId) {
      refetchOrders();
    }
  }, [pool, nftId, refetchOrders]);

  // Check if there's an active order
  const activeOrder = orders && orders.length > 0 ? orders[0] : null;

  if (!pool) return null;

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    
    try {
      await cancelOrder.mutateAsync({ orderId: activeOrder.orderId });
      toast.success(tMyNFTs('orderRevoked'));
      refetchOrders();
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: unknown) {
      console.error("Failed to cancel order:", error);
      const errorMessage = error instanceof Error ? error.message : tMyNFTs('revokeOrderFailed');
      toast.error(errorMessage);
    }
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-[16px] font-semibold text-[#000000]">
            NFT #{nftId}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {ordersLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : activeOrder ? (
            <div className="flex items-center gap-3">
              <span className="text-[14px] text-[#000000]">
                {formatTokenAmount(activeOrder.price, 18, 2)} USDT
              </span>
              <button
                onClick={handleCancelOrder}
                disabled={cancelOrder.isLoading}
                className="rounded-[20px] bg-[#000000] text-[#FFFFFF] px-4 py-2 text-[14px] font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {cancelOrder.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {tMyNFTs('revoking')}
                  </>
                ) : (
                  <>
                    {tMyNFTs('revokeListing')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onCreateOrder(nftId)}
              className="rounded-[20px] bg-[#CEF248] px-4 py-2 text-[14px] font-medium text-[#000000] hover:bg-[#B8D93F] transition-colors flex items-center justify-center"
            >
              <ListIcon className="h-4 w-4 mr-2" />
              {tMyNFTs('listForSale')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersForNFT({ nftId, onBuy }: { nftId: number; onBuy: (orderId: number) => void }) {
  const tMyNFTs = useTranslations('marketplace.myNFTs');
  const { data: orders, isLoading, error, refetch } = useNFTSellOrders(nftId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-[28px] bg-[#000000] p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-300">{tMyNFTs('loadingOrdersError')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/30 p-6 text-center">
        <p className="text-red-400">{tMyNFTs('loadOrdersFailed')}: {error}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 rounded-[20px] bg-[#CEF248] px-4 py-2 text-black hover:bg-[#B8D93F]"
        >
          {tMyNFTs('retry')}
        </button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return null;
  }

  return (
    <>
      {orders.map((order) => (
        <SellOrderCard key={order.orderId} order={order} onBuy={onBuy} />
      ))}
    </>
  );
}


