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
import { ShoppingCart, Store, Tag, Loader2, X, Plus, TrendingUp, RefreshCw } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            NFT #{order.nftId}
          </h3>
        </div>
        <span className="rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
          NFT
        </span>
      </div>

      {/* Price */}
      <div className="mt-4 rounded-lg bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{t('nftPrice')}</p>
          <span className="text-xs text-gray-500">{t('orderId')}: #{order.orderId}</span>
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {formatTokenAmount(totalPrice, 18, 2)} USDT
        </p>
      </div>

      {/* Seller Info */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">{t('seller')}:</span>
        <span className="font-medium text-gray-900">
          {isOwnOrder ? t('you') : formatAddress(order.seller)}
        </span>
      </div>

      {/* Listed Date */}
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-gray-500">{t('listedTime')}: {order.createdAtDisplay}</span>
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
            disabled={buyNFT.isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
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
  nftId,
  onClose,
  onOrderCreated,
}: {
  nftId: number;
  onClose: () => void;
  onOrderCreated?: () => void;
}) {
  const t = useTranslations('marketplace.createOrder');
  const [price, setPrice] = useState("");
  const createOrder = useCreateSellOrder();

  const handleCreate = async () => {
    if (!price) return;
    
    try {
      const priceBigInt = parseTokenAmount(price, 18);
      
      await createOrder.mutateAsync({
        nftId,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">{t('title')}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {/* Price Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('nftPriceLabel')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t('nftPricePlaceholder')}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('nftPriceNote')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!price || createOrder.isLoading}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="mt-2 text-gray-600">
              {t('subtitle')}
            </p>
          </div>
          {/* Refresh Button */}
          {isConnected && (
            <RefreshButton size="sm" />
          )}
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Store className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t('connectWallet.title')}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t('connectWallet.description')}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow-sm">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={cn(
                    "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === 'orders'
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  {t('orders.title')}
                  {allOrders.data && allOrders.data.length > 0 && (
                    <span className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                      activeTab === 'orders'
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-600"
                    )}>
                      {allOrders.data.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('my-nfts')}
                  className={cn(
                    "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === 'my-nfts'
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  {t('sidebar.title')}
                  {web3Data.nfts && web3Data.nfts.length > 0 && (
                    <span className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                      activeTab === 'my-nfts'
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-600"
                    )}>
                      {web3Data.nfts.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'orders' ? (
                /* Active Orders Tab */
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {t('orders.title')}
                      </h2>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => allOrders.refetch()}
                        disabled={allOrders.isLoading}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center"
                      >
                        {allOrders.isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            {tMyNFTs('refreshing')}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            {tMyNFTs('refreshOrders')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Orders Grid */}
                  {allOrders.isLoading ? (
                    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-600">{tMyNFTs('loadingOrdersError')}</span>
                    </div>
                  ) : allOrders.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                      <p className="text-red-600">{tMyNFTs('loadOrdersFailed')}: {allOrders.error}</p>
                      <button
                        onClick={() => allOrders.refetch()}
                        className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        {tMyNFTs('retry')}
                      </button>
                    </div>
                  ) : allOrders.data && allOrders.data.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {allOrders.data.map((order) => (
                        <SellOrderCard key={order.orderId} order={order} onBuy={handleBuy} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-12 text-center">
                      <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-4 text-lg font-medium text-gray-900">
                        {t('orders.empty.title')}
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        {t('orders.empty.description')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* My NFTs Tab */
                <MyNFTsSection
                  nfts={web3Data.nfts || []}
                  onCreateOrder={handleCreateOrder}
                  onOrderCreated={handleOrderCreated}
                />
              )}
            </div>
          </div>
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
          <h2 className="text-2xl font-bold text-gray-900">{tMyNFTs('title')}</h2>
        </div>
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <Tag className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {tMyNFTs('noNFTs')}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {tMyNFTs('noNFTsDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{tMyNFTs('title')}</h2>
      </div>

      {allOrders.isLoading ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {tMyNFTs('loadingOrders')}
          </h3>
        </div>
      ) : (
        <div className="space-y-6">
          {/* On Sale Card */}
          {nftsWithOrders.length > 0 && (
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50/30 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tMyNFTs('onSale')}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {tMyNFTs('onSaleCount').replace('{count}', String(nftsWithOrders.length))}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {nftsWithOrders.map(({ nftId, order }) => (
                  <NFTListItem
                    key={`with-order-${nftId}`}
                    nftId={nftId}
                    onCreateOrder={onCreateOrder}
                    onOrderCreated={onOrderCreated}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Not On Sale Card */}
          {nftsWithoutOrders.length > 0 && (
            <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tMyNFTs('notOnSale')}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {tMyNFTs('notOnSaleCount').replace('{count}', String(nftsWithoutOrders.length))}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {nftsWithoutOrders.map((nftId) => (
                  <NFTListItem
                    key={`without-order-${nftId}`}
                    nftId={nftId}
                    onCreateOrder={onCreateOrder}
                    onOrderCreated={onOrderCreated}
                  />
                ))}
              </div>
            </div>
          )}

          {/* If all NFTs are listed or none are listed, show message */}
          {nftsWithOrders.length === 0 && nftsWithoutOrders.length === 0 && nfts.length > 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
              <Tag className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              NFT #{nftId}
            </h3>
            <span className="rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
              NFT
            </span>
          </div>
        </div>
      </div>
      
      {/* Order Status */}
      {ordersLoading ? (
        <div className="mt-4 flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : activeOrder ? (
        <div className="mt-4 space-y-3">
          {/* Active Order Info */}
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-orange-800">{t('onSale')}</span>
              <span className="text-xs text-orange-600">{t('orderId')} #{activeOrder.orderId}</span>
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {formatTokenAmount(activeOrder.price, 18, 2)} USDT
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {t('createdTime')}: {activeOrder.createdAtDisplay}
            </div>
          </div>
          
          {/* Cancel Order Button */}
          <button
            onClick={handleCancelOrder}
            disabled={cancelOrder.isLoading}
            className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {cancelOrder.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('revoking')}
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                {t('revokeListing')}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={() => onCreateOrder(nftId)}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-purple-700 transition-colors flex items-center justify-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            {tMyNFTs('listForSale')}
          </button>
        </div>
      )}
    </div>
  );
}

function OrdersForNFT({ nftId, onBuy }: { nftId: number; onBuy: (orderId: number) => void }) {
  const tMyNFTs = useTranslations('marketplace.myNFTs');
  const { data: orders, isLoading, error, refetch } = useNFTSellOrders(nftId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">{tMyNFTs('loadingOrdersError')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{tMyNFTs('loadOrdersFailed')}: {error}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
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

