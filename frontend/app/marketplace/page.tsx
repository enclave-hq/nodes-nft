"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useUserNFTs, useNFTPool, useUserShare } from "@/lib/hooks/useNFTManager";
import { useNFTSellOrders, useCreateSellOrder, useCancelSellOrder, useBuyShares } from "@/lib/hooks/useMarketplace";
import { formatTokenAmount, formatAddress, formatDateTime, cn, parseTokenAmount } from "@/lib/utils";
import { NFT_CONFIG, NFTType, NFTStatus } from "@/lib/contracts/config";
import { ShoppingCart, Store, Tag, Loader2, X, Plus, TrendingUp } from "lucide-react";
import { useState } from "react";

function SellOrderCard({ 
  order, 
  onBuy 
}: { 
  order: any;
  onBuy: (orderId: number) => void;
}) {
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
    onBuy(order.orderId);
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
            {config.name} #{order.nftId}
          </h3>
          <p className="text-sm text-gray-500">
            {order.shares} shares available
          </p>
        </div>
        <span className={cn(
          "rounded-full px-2 py-1 text-xs font-medium",
          pool.nftType === NFTType.Premium
            ? "bg-purple-100 text-purple-700"
            : "bg-blue-100 text-blue-700"
        )}>
          {pool.nftType === NFTType.Premium ? "Premium" : "Standard"}
        </span>
      </div>

      {/* Price */}
      <div className="mt-4 rounded-lg bg-gray-50 p-3">
        <p className="text-xs text-gray-500">Price per Share</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {formatTokenAmount(order.pricePerShare, 18, 2)} USDT
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Total: {formatTokenAmount(totalPrice, 18, 2)} USDT
        </p>
      </div>

      {/* Seller Info */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">Seller:</span>
        <span className="font-medium text-gray-900">
          {isOwnOrder ? "You" : formatAddress(order.seller)}
        </span>
      </div>

      {/* Listed Date */}
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-gray-500">Listed:</span>
        <span className="text-gray-900">
          {formatDateTime(order.createdAt)}
        </span>
      </div>

      {/* Action Button */}
      <div className="mt-4">
        {isOwnOrder ? (
          <button
            onClick={handleCancel}
            disabled={cancelOrder.isPending}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {cancelOrder.isPending ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <X className="mr-2 h-4 w-4" />
                Cancel Order
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={handleBuy}
            disabled={buyShares.isPending}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
          >
            {buyShares.isPending ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buying...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Buy Shares
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
  maxShares,
  onClose,
}: {
  nftId: number;
  maxShares: number;
  onClose: () => void;
}) {
  const [shares, setShares] = useState("1");
  const [pricePerShare, setPricePerShare] = useState("");
  const createOrder = useCreateSellOrder();

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
      
      onClose();
    } catch (error) {
      console.error("Failed to create order:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Create Sell Order</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {/* Shares Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Number of Shares
            </label>
            <input
              type="number"
              min="1"
              max={maxShares}
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter number of shares"
            />
            <p className="mt-1 text-xs text-gray-500">
              You own {maxShares} shares
            </p>
          </div>

          {/* Price Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Price per Share (USDT)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pricePerShare}
              onChange={(e) => setPricePerShare(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter price per share"
            />
          </div>

          {/* Total Price Display */}
          {shares && pricePerShare && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-600">Total Value</p>
              <p className="mt-1 text-xl font-bold text-blue-900">
                {(parseFloat(shares) * parseFloat(pricePerShare)).toFixed(2)} USDT
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!shares || !pricePerShare || createOrder.isPending}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
          >
            {createOrder.isPending ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Order"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { isConnected } = useWallet();
  const { data: userNFTs } = useUserNFTs();
  const buyShares = useBuyShares();
  const [selectedNFT, setSelectedNFT] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOrderNFT, setCreateOrderNFT] = useState<{ nftId: number; maxShares: number } | null>(null);

  // Get orders for selected NFT or all NFTs
  const nftIdsToShow = selectedNFT !== null ? [selectedNFT] : (userNFTs || []);
  
  const handleBuy = async (orderId: number) => {
    try {
      await buyShares.mutateAsync({ orderId });
    } catch (error) {
      console.error("Failed to buy shares:", error);
    }
  };

  const handleCreateOrder = (nftId: number, maxShares: number) => {
    setCreateOrderNFT({ nftId, maxShares });
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
          <p className="mt-2 text-gray-600">
            Buy and sell NFT shares with other users
          </p>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Store className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Connect Your Wallet
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Please connect your wallet to access the marketplace
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Sidebar - My NFTs */}
            <div className="lg:col-span-1">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">My NFTs</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create sell orders for your shares
                </p>

                {!userNFTs || userNFTs.length === 0 ? (
                  <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                    <Tag className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">
                      No NFTs to list
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {userNFTs.map((nftId: number) => (
                      <NFTListItem
                        key={nftId}
                        nftId={nftId}
                        onCreateOrder={handleCreateOrder}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Main Content - Orders */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Active Orders
                </h2>
                <button
                  onClick={() => setSelectedNFT(null)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View All
                </button>
              </div>

              {/* Orders Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {nftIdsToShow.map((nftId: number) => (
                  <OrdersForNFT
                    key={nftId}
                    nftId={nftId}
                    onBuy={handleBuy}
                  />
                ))}
              </div>

              {/* Empty State */}
              {nftIdsToShow.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-12 text-center">
                  <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    No Orders Found
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Be the first to create a sell order!
                  </p>
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
  const { data: pool } = useNFTPool(nftId);
  const { data: userShare } = useUserShare(nftId);

  if (!pool || !userShare || userShare.shares === 0) return null;

  const config = NFT_CONFIG[pool.nftType as NFTType];

  return (
    <div className="rounded-lg border border-gray-200 p-3 hover:border-gray-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {config.name} #{nftId}
          </p>
          <p className="text-xs text-gray-500">
            {userShare.shares} shares
          </p>
        </div>
        <button
          onClick={() => onCreateOrder(nftId, userShare.shares)}
          className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OrdersForNFT({ nftId, onBuy }: { nftId: number; onBuy: (orderId: number) => void }) {
  const { data: orders, isLoading } = useNFTSellOrders(nftId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
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

