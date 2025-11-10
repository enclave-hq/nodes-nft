'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWallet } from '@/lib/providers/WalletProvider';
import { 
  login, 
  isAuthenticated,
  getOverviewStats,
  getInviteCodeStats,
  type OverviewStats,
  type InviteCodeStats
} from '@/lib/api';

export default function AdminStatsPage() {
  const { address, isConnected, connect } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [inviteCodeStats, setInviteCodeStats] = useState<InviteCodeStats | null>(null);

  useEffect(() => {
    setIsAuthenticatedState(isAuthenticated());
    if (isAuthenticated()) {
      fetchStats();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticatedState && isConnected && address) {
      fetchStats();
    }
  }, [isAuthenticatedState, isConnected, address]);

  const handleLogin = async () => {
    if (!isConnected || !address) {
      toast.error('请先连接钱包');
      return;
    }

    setIsLoading(true);
    try {
      await login(address);
      setIsAuthenticatedState(true);
      toast.success('登录成功');
      await fetchStats();
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || '登录失败，请确认您是合约管理员');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const [overview, inviteCodes] = await Promise.all([
        getOverviewStats(),
        getInviteCodeStats(),
      ]);
      setOverviewStats(overview);
      setInviteCodeStats(inviteCodes);
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      toast.error(error.message || '获取统计数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Show login page if not authenticated
  if (!isAuthenticatedState) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-6">数据统计</h1>
            <p className="text-gray-600 mb-6">
              请先连接钱包并登录以访问管理功能
            </p>
            {!isConnected ? (
              <button
                onClick={() => connect()}
                className="px-6 py-3 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238]"
              >
                连接钱包
              </button>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="px-6 py-3 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
              >
                {isLoading ? '登录中...' : '登录'}
              </button>
            )}
            <p className="text-sm text-gray-500 mt-4">
              只有合约管理员可以访问此页面
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">数据统计</h1>
            <div className="flex gap-2">
              <button
                onClick={fetchStats}
                disabled={isLoading}
                className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
              >
                {isLoading ? '加载中...' : '刷新'}
              </button>
              <div className="text-sm text-gray-600 flex items-center">
                钱包: {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
          </div>

          {/* 总体统计 */}
          {overviewStats && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">总体统计</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-6 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">总用户数</p>
                  <p className="text-3xl font-bold text-blue-600">{overviewStats.totalUsers}</p>
                </div>
                <div className="p-6 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">NFT总数</p>
                  <p className="text-3xl font-bold text-green-600">{overviewStats.totalNFTs}</p>
                </div>
                <div className="p-6 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">邀请码总数</p>
                  <p className="text-3xl font-bold text-purple-600">{overviewStats.totalInviteCodes}</p>
                </div>
                <div className="p-6 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">活跃邀请码</p>
                  <p className="text-3xl font-bold text-orange-600">{overviewStats.activeInviteCodes}</p>
                </div>
                <div className="p-6 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">白名单总数</p>
                  <p className="text-3xl font-bold text-indigo-600">{overviewStats.totalWhitelisted}</p>
                </div>
                <div className="p-6 bg-pink-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">批次总数</p>
                  <p className="text-3xl font-bold text-pink-600">{overviewStats.totalBatches}</p>
                </div>
                <div className="p-6 bg-teal-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">激活批次</p>
                  <p className="text-3xl font-bold text-teal-600">{overviewStats.activeBatches}</p>
                </div>
              </div>
            </div>
          )}

          {/* 邀请码统计 */}
          {inviteCodeStats && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">邀请码统计</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">总数</p>
                  <p className="text-2xl font-bold text-gray-700">{inviteCodeStats.total}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">活跃</p>
                  <p className="text-2xl font-bold text-green-600">{inviteCodeStats.active}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">已使用</p>
                  <p className="text-2xl font-bold text-blue-600">{inviteCodeStats.used}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">待批准</p>
                  <p className="text-2xl font-bold text-yellow-600">{inviteCodeStats.pending}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">已过期</p>
                  <p className="text-2xl font-bold text-red-600">{inviteCodeStats.expired}</p>
                </div>
              </div>

              {/* 按状态分类统计 */}
              {Object.keys(inviteCodeStats.byStatus).length > 0 && (
                <div className="p-6 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-4">按状态分类</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(inviteCodeStats.byStatus).map(([status, count]) => (
                      <div key={status} className="p-3 bg-white rounded border">
                        <p className="text-sm text-gray-600 mb-1 capitalize">{status}</p>
                        <p className="text-xl font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoading && !overviewStats && (
            <div className="text-center py-12">
              <p className="text-gray-500">加载统计数据中...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

