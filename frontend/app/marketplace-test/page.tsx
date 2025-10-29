"use client";

import { useState } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useAllSellOrders, useCreateSellOrder } from "@/lib/hooks/useMarketplace";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatTokenAmount, parseTokenAmount } from "@/lib/utils";
import { Loader2, RefreshCw, Plus, ShoppingCart } from "lucide-react";

export default function MarketplaceTestPage() {
  const { isConnected, address } = useWallet();
  const web3Data = useWeb3Data();
  const allOrders = useAllSellOrders();
  const createOrder = useCreateSellOrder();
  
  const [testNftId, setTestNftId] = useState("1");
  const [testShares, setTestShares] = useState("1");
  const [testPrice, setTestPrice] = useState("1000");

  const handleCreateTestOrder = async () => {
    if (!testNftId || !testShares || !testPrice) return;
    
    try {
      await createOrder.mutateAsync({
        nftId: parseInt(testNftId),
        shares: parseInt(testShares),
        pricePerShare: parseTokenAmount(testPrice, 18),
      });
      
      // Refresh orders
      allOrders.refetch();
      
      alert("测试订单创建成功！");
    } catch (error) {
      console.error("创建测试订单失败:", error);
      alert("创建测试订单失败: " + (error as Error).message);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">请先连接钱包</h1>
          <p className="text-gray-600">连接钱包后才能测试市场功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">NFT市场功能测试</h1>
        
        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">测试控制面板</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NFT ID
              </label>
              <input
                type="number"
                value={testNftId}
                onChange={(e) => setTestNftId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="NFT ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                份额数量
              </label>
              <input
                type="number"
                value={testShares}
                onChange={(e) => setTestShares(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="份额数量"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                每份额价格 (USDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={testPrice}
                onChange={(e) => setTestPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="价格"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleCreateTestOrder}
                disabled={createOrder.isLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              >
                {createOrder.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                创建测试订单
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => allOrders.refetch()}
              disabled={allOrders.isLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center"
            >
              {allOrders.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              刷新订单
            </button>
            
            <div className="text-sm text-gray-600">
              当前地址: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>
        </div>

        {/* Orders Display */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">当前市场订单</h2>
            {allOrders.data && allOrders.data.length > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                {allOrders.data.length} 个活跃订单
              </span>
            )}
          </div>

          {allOrders.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">加载订单中...</span>
            </div>
          ) : allOrders.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-600 mb-4">加载订单失败: {allOrders.error}</p>
              <button
                onClick={() => allOrders.refetch()}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                重试
              </button>
            </div>
          ) : allOrders.data && allOrders.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allOrders.data.map((order) => (
                <div key={order.orderId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">
                      NFT #{order.nftId}
                    </h3>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      订单 #{order.orderId}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">份额数量:</span>
                      <span className="font-medium">{order.shares}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">单价:</span>
                      <span className="font-medium">{formatTokenAmount(order.pricePerShare, 18, 2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">总价:</span>
                      <span className="font-medium">{formatTokenAmount(order.totalPrice, 18, 2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">卖家:</span>
                      <span className="font-medium">{order.sellerDisplay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">创建时间:</span>
                      <span className="font-medium">{order.createdAtDisplay}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      可购买
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">暂无订单</h3>
              <p className="mt-2 text-sm text-gray-500">
                市场上还没有出售订单，您可以创建一个测试订单
              </p>
            </div>
          )}
        </div>

        {/* Debug Info */}
        <div className="bg-gray-100 rounded-lg p-4 mt-8">
          <h3 className="text-sm font-medium text-gray-700 mb-2">调试信息</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>连接状态: {isConnected ? "已连接" : "未连接"}</div>
            <div>NFT数量: {web3Data.nfts?.length || 0}</div>
            <div>订单数量: {allOrders.data?.length || 0}</div>
            <div>加载状态: {allOrders.isLoading ? "加载中" : "已完成"}</div>
            {allOrders.error && <div>错误: {allOrders.error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
