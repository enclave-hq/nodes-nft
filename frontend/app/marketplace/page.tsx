"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { useNFTPool, useUserShare, useCreateSellOrder, useUserSharesInfo } from "@/lib/hooks/useNFTManager";
import { useNFTSellOrders, useAllSellOrders, useCancelSellOrder, useBuyShares } from "@/lib/hooks/useMarketplace";
import { formatTokenAmount, formatAddress, formatDate, cn, parseTokenAmount } from "@/lib/utils";
import { NFT_CONFIG, NFTType, NFTStatus } from "@/lib/contracts/config";
import { ShoppingCart, Store, Tag, Loader2, X, Plus, TrendingUp, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "@/lib/i18n/provider";

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
  const buyShares = useBuyShares();
  const cancelOrder = useCancelSellOrder();

  if (!pool) return null;

  const config = NFT_CONFIG[pool.nftType as NFTType];
  const isOwnOrder = account?.toLowerCase() === order.seller.toLowerCase();
  const totalPrice = order.pricePerShare * BigInt(order.shares);

  const handleBuy = async () => {
    if (isOwnOrder) return;
    try {
      await buyShares.mutateAsync({ orderId: order.orderId });
      onBuy(order.orderId);
    } catch (error) {
      console.error("Failed to buy shares:", error);
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
    <div className="rounded-2xl border border-gray-700/50 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {tTypes(`${pool.nftType === 0 ? 'standard' : 'premium'}.name`)} #{order.nftId}
            </h3>
            <p className="text-sm text-gray-300">
              {t('sharesAvailable', { count: order.shares })}
            </p>
          </div>
          <span className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            pool.nftType === NFTType.Premium
              ? "bg-[#B1C72E]/20 text-[#B1C72E]"
              : "bg-[#B1C72E]/20 text-[#B1C72E]"
          )}>
            {tTypes(`${pool.nftType}.name`)}
          </span>
        </div>

        {/* Price */}
        <div className="mt-4 rounded-lg border border-gray-700/50 p-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
          <div className="relative z-10">
            <p className="text-xs text-gray-400">{t('pricePerShare')}</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatTokenAmount(order.pricePerShare, 18, 2)} USDT
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t('total', { amount: formatTokenAmount(totalPrice, 18, 2) })}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>订单ID: #{order.orderId}</span>
              <span>创建时间: {order.createdAtDisplay}</span>
            </div>
          </div>
        </div>

        {/* Seller Info */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-400">{t('seller')}:</span>
          <span className="font-medium text-white">
            {isOwnOrder ? "You" : formatAddress(order.seller)}
          </span>
        </div>

        {/* Listed Date */}
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-400">{t('listed', { time: formatDate(order.createdAt) })}</span>
        </div>

        {/* Action Button */}
        <div className="mt-4">
          {isOwnOrder ? (
            <button
              onClick={handleCancel}
              disabled={cancelOrder.isLoading}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cancelOrder.isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('cancelling')}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <X className="mr-2 h-4 w-4" />
                  {t('cancelOrder')}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={handleBuy}
              disabled={buyShares.isLoading}
              className="w-full rounded-lg bg-[#b1c62f] px-4 py-2 text-sm font-medium text-black hover:bg-[#9db026] disabled:opacity-50"
            >
              {buyShares.isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('buying')}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t('buyShares')}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateOrderModal({
  nftId,
  maxShares,
  onClose,
  onOrderCreated,
}: {
  nftId: number;
  maxShares: number;
  onClose: () => void;
  onOrderCreated?: () => void;
}) {
  const t = useTranslations('marketplace.createOrder');
  const [shares, setShares] = useState("1");
  const [pricePerShare, setPricePerShare] = useState("");
  const createOrder = useCreateSellOrder();
  const { totalShares, availableShares, listedShares } = useUserSharesInfo(nftId);

  const handleCreate = async () => {
    if (!shares || !pricePerShare) return;
    
    try {
      const sharesNum = parseInt(shares);
      const pricePerShareBigInt = parseTokenAmount(pricePerShare, 18);
      
      await createOrder.mutateAsync({
        nftId,
        shares: sharesNum,
        pricePerShare: pricePerShareBigInt,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#252532] opacity-90"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">{t('title')}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-700/50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {/* Shares Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                {t('sharesLabel')}
              </label>
              <input
                type="number"
                min="1"
                max={availableShares}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700/50 bg-black/50 px-3 py-2 text-white placeholder-gray-500 focus:border-[#b1c62f] focus:outline-none focus:ring-1 focus:ring-[#b1c62f]"
                placeholder={t('sharesPlaceholder')}
              />
              <div className="mt-1 text-xs text-gray-400 space-y-1">
                <p>{t('youOwn', { count: totalShares })}</p>
                {listedShares > 0 && (
                  <p className="text-orange-400">{t('listedShares', { count: listedShares })}</p>
                )}
                <p className="text-[#B1C72E]">{t('availableShares', { count: availableShares })}</p>
              </div>
            </div>

            {/* Price Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300">
                {t('priceLabel')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-700/50 bg-black/50 px-3 py-2 text-white placeholder-gray-500 focus:border-[#b1c62f] focus:outline-none focus:ring-1 focus:ring-[#b1c62f]"
                placeholder={t('pricePlaceholder')}
              />
            </div>

            {/* Total Price Display */}
            {shares && pricePerShare && (
              <div className="rounded-lg border border-gray-700/50 p-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                <div className="relative z-10">
                  <p className="text-sm text-[#B1C72E]">{t('totalValue')}</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {(parseFloat(shares) * parseFloat(pricePerShare)).toFixed(2)} USDT
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-700/50 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700/50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!shares || !pricePerShare || createOrder.isLoading}
              className="flex-1 rounded-lg bg-[#b1c62f] px-4 py-2 text-sm font-medium text-black hover:bg-[#9db026] disabled:opacity-50"
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
    </div>
  );
}

export default function MarketplacePage() {
  const t = useTranslations('marketplace');
  const tCommon = useTranslations('common');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();
  const buyShares = useBuyShares();
  const allOrders = useAllSellOrders();
  
  const [selectedNFT, setSelectedNFT] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOrderNFT, setCreateOrderNFT] = useState<{ nftId: number; maxShares: number } | null>(null);

  // Get orders for selected NFT or all NFTs
  const nftIdsToShow = selectedNFT !== null ? [selectedNFT] : (web3Data.nfts || []).map(nft => nft.id);
  
  const handleBuy = async (orderId: number) => {
    try {
      await buyShares.mutateAsync({ orderId });
      // Refresh orders after successful purchase
      allOrders.refetch();
    } catch (error) {
      console.error("Failed to buy shares:", error);
    }
  };

  const handleCreateOrder = (nftId: number, maxShares: number) => {
    setCreateOrderNFT({ nftId, maxShares });
    setShowCreateModal(true);
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
    <div className="min-h-screen bg-black">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="mt-2 text-gray-300">
            {t('subtitle')}
          </p>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-2xl border border-gray-700/50 p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <Store className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-white">
                {t('connectWallet.title')}
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                {t('connectWallet.description')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Sidebar - My NFTs */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                <div className="relative z-10">
                  <h2 className="text-lg font-semibold text-white">{t('sidebar.title')}</h2>
                  <p className="mt-1 text-sm text-gray-300">
                    {t('sidebar.subtitle')}
                  </p>

                  {!web3Data.nfts || web3Data.nfts.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-gray-700/50 p-6 text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                      <div className="relative z-10">
                        <Tag className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-400">
                          {t('sidebar.empty')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {web3Data.nfts.map((nft: any) => (
                        <NFTListItem
                          key={nft.id}
                          nftId={nft.id}
                          onCreateOrder={handleCreateOrder}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content - Orders */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-semibold text-white">
                    {t('orders.title')}
                  </h2>
                  {allOrders.data && allOrders.data.length > 0 && (
                    <span className="rounded-full bg-[#B1C72E]/20 px-3 py-1 text-sm font-medium text-[#B1C72E]">
                      {allOrders.data.length} 个活跃订单
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => allOrders.refetch()}
                    disabled={allOrders.isLoading}
                    className="rounded-lg border border-gray-700/50 px-3 py-1 text-sm text-gray-300 hover:bg-gray-700/50 disabled:opacity-50 flex items-center"
                  >
                    {allOrders.isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        刷新中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        刷新订单
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedNFT(null)}
                    className="text-sm text-[#B1C72E] hover:text-[#9db026]"
                  >
                    {t('orders.viewAll')}
                  </button>
                </div>
              </div>

              {/* Orders Grid */}
              {allOrders.isLoading ? (
                <div className="flex items-center justify-center rounded-2xl border border-gray-700/50 p-12 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                  <div className="relative z-10 flex items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-300">加载订单中...</span>
                  </div>
                </div>
              ) : allOrders.error ? (
                <div className="rounded-2xl border border-red-700/50 p-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-red-900/20 opacity-20"></div>
                  <div className="relative z-10">
                    <p className="text-red-400">加载订单失败: {allOrders.error}</p>
                    <button
                      onClick={() => allOrders.refetch()}
                      className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      重试
                    </button>
                  </div>
                </div>
              ) : allOrders.data && allOrders.data.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {allOrders.data.map((order) => (
                    <SellOrderCard key={order.orderId} order={order} onBuy={handleBuy} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-700/50 p-12 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                  <div className="relative z-10">
                    <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-4 text-lg font-medium text-white">
                      {t('orders.empty.title')}
                    </h3>
                    <p className="mt-2 text-sm text-gray-400">
                      {t('orders.empty.description')}
                    </p>
                    <div className="mt-4 text-xs text-gray-500">
                      <p>调试信息: NFT数量 {web3Data.nfts?.length || 0}</p>
                      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && createOrderNFT && (
        <CreateOrderModal
          nftId={createOrderNFT.nftId}
          maxShares={createOrderNFT.maxShares}
          onClose={() => {
            setShowCreateModal(false);
            setCreateOrderNFT(null);
          }}
          onOrderCreated={() => {
            allOrders.refetch();
          }}
        />
      )}
    </div>
  );
}

function NFTListItem({
  nftId,
  onCreateOrder,
}: {
  nftId: number;
  onCreateOrder: (nftId: number, maxShares: number) => void;
}) {
  const t = useTranslations('marketplace.nftList');
  const tTypes = useTranslations('nftTypes');
  const { data: pool } = useNFTPool(nftId);
  const { data: userShare } = useUserShare(nftId);
  const { totalShares, availableShares, listedShares } = useUserSharesInfo(nftId);

  if (!pool || !userShare || userShare.shares === "0") return null;

  const config = NFT_CONFIG[pool.nftType as NFTType];

  return (
    <div className="rounded-lg border border-gray-700/50 p-3 relative overflow-hidden hover:border-[#b1c62f] transition-colors">
      <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">
            {pool.nftType === NFTType.Standard ? tTypes('standard.name') : tTypes('premium.name')} #{nftId}
          </p>
          <div className="text-xs text-gray-400 space-y-1 mt-1">
            <p>总份额: {totalShares}</p>
            {listedShares > 0 && (
              <p className="text-orange-400">已挂单: {listedShares}</p>
            )}
            <p className="text-[#B1C72E]">可出售: {availableShares}</p>
          </div>
        </div>
        <button
          onClick={() => onCreateOrder(nftId, availableShares)}
          disabled={availableShares === 0}
          className="rounded-lg bg-[#b1c62f] p-2 text-black hover:bg-[#9db026] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OrdersForNFT({ nftId, onBuy }: { nftId: number; onBuy: (orderId: number) => void }) {
  const { data: orders, isLoading, error, refetch } = useNFTSellOrders(nftId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-700/50 p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
        <div className="relative z-10 flex items-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-300">加载订单中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-700/50 p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-red-900/20 opacity-20"></div>
        <div className="relative z-10">
          <p className="text-red-400">加载订单失败: {error}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            重试
          </button>
        </div>
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

