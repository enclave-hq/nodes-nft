"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useAllSellOrders } from "@/lib/hooks/useMarketplace";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { RefreshCw, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function DebugPage() {
  const { isConnected, address } = useWallet();
  const web3Data = useWeb3Data();
  const allOrders = useAllSellOrders();
  
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const handleRefresh = () => {
    setRefreshCount(prev => prev + 1);
    setLastRefreshTime(new Date());
    allOrders.refetch();
  };

  useEffect(() => {
    if (isConnected) {
      // Initial load with delay
      const timer = setTimeout(() => {
        handleRefresh();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">市场功能调试页面</h1>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">钱包连接</h3>
                <p className="text-sm text-gray-600">
                  {isConnected ? '已连接' : '未连接'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${web3Data.nfts && web3Data.nfts.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">NFT数据</h3>
                <p className="text-sm text-gray-600">
                  {web3Data.nfts ? `${web3Data.nfts.length} 个NFT` : '加载中...'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${allOrders.isLoading ? 'bg-[#E5F240]' : allOrders.error ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">订单状态</h3>
                <p className="text-sm text-gray-600">
                  {allOrders.isLoading ? '加载中...' : 
                   allOrders.error ? '错误' : 
                   `${allOrders.data?.length || 0} 个订单`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">控制面板</h2>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={allOrders.isLoading}
              className="flex items-center px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              {allOrders.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              手动刷新
            </button>
            
            <div className="text-sm text-gray-600">
              刷新次数: {refreshCount}
            </div>
            
            {lastRefreshTime && (
              <div className="text-sm text-gray-600">
                上次刷新: {lastRefreshTime.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Debug Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">调试信息</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">钱包信息</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>地址: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '未连接'}</div>
                <div>连接状态: {isConnected ? '已连接' : '未连接'}</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">数据状态</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>NFT数量: {web3Data.nfts?.length || 0}</div>
                <div>订单数量: {allOrders.data?.length || 0}</div>
                <div>加载状态: {allOrders.isLoading ? '加载中' : '已完成'}</div>
                <div>错误状态: {allOrders.error ? '有错误' : '正常'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {allOrders.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <h3 className="font-semibold text-red-800">错误信息</h3>
            </div>
            <p className="text-red-700">{allOrders.error}</p>
          </div>
        )}

        {/* Orders Display */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">订单列表</h2>
          
          {allOrders.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">加载订单中...</span>
            </div>
          ) : allOrders.data && allOrders.data.length > 0 ? (
            <div className="space-y-4">
              {allOrders.data.map((order) => (
                <div key={order.orderId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      订单 #{order.orderId} - NFT #{order.nftId}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      活跃
                    </span>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">NFT ID:</span>
                      <span className="ml-1 font-medium">{order.nftId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">价格:</span>
                      <span className="ml-1 font-medium">{order.price.toString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">卖家:</span>
                      <span className="ml-1 font-medium">{order.sellerDisplay}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">时间:</span>
                      <span className="ml-1 font-medium">{order.createdAtDisplay}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                {allOrders.error ? (
                  <AlertCircle className="h-12 w-12 mx-auto" />
                ) : (
                  <CheckCircle className="h-12 w-12 mx-auto" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {allOrders.error ? '加载失败' : '暂无订单'}
              </h3>
              <p className="text-sm text-gray-500">
                {allOrders.error ? '请检查网络连接或重试' : '市场上还没有出售订单'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}















