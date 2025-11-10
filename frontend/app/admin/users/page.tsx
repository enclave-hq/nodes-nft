'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { 
  isAuthenticated,
  getUserChildren,
  getUserDescendants,
  getUserStats,
  type User,
  type UserStats
} from '@/lib/api';

export default function AdminUsersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [children, setChildren] = useState<User[]>([]);
  const [descendants, setDescendants] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'children' | 'descendants'>('stats');

  const handleSearch = async () => {
    if (!searchAddress.trim()) {
      toast.error('请输入用户地址');
      return;
    }

    if (!isAuthenticated()) {
      toast.error('请先登录');
      return;
    }

    setIsLoading(true);
    try {
      // 并行获取所有数据
      const [stats, childrenData, descendantsData] = await Promise.all([
        getUserStats(searchAddress),
        getUserChildren(searchAddress),
        getUserDescendants(searchAddress),
      ]);

      setUserStats(stats);
      setChildren(childrenData);
      setDescendants(descendantsData);
      setActiveTab('stats');
    } catch (error: any) {
      console.error('Failed to fetch user data:', error);
      toast.error(error.message || '获取用户信息失败');
      setUserStats(null);
      setChildren([]);
      setDescendants([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
          <p className="mt-1 text-sm text-gray-600">搜索和管理用户信息</p>
        </div>

          {/* 搜索框 */}
          <div className="mb-6 p-6 border border-gray-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">搜索用户</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="输入用户地址 (0x...)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={isLoading || !searchAddress.trim()}
                className="px-6 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '搜索中...' : '搜索'}
              </button>
            </div>
          </div>

          {/* 用户信息展示 */}
          {userStats && (
            <div className="space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">NFT数量</p>
                  <p className="text-2xl font-bold text-blue-600">{userStats.nftCount}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">直接下级</p>
                  <p className="text-2xl font-bold text-green-600">{userStats.childrenCount}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">所有下级</p>
                  <p className="text-2xl font-bold text-purple-600">{userStats.descendantsCount}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600">最大深度</p>
                  <p className="text-2xl font-bold text-orange-600">{userStats.maxDepth}</p>
                </div>
              </div>

              {/* 邀请码统计 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">总邀请码数</p>
                  <p className="text-2xl font-bold text-gray-600">{userStats.totalInviteCodes}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">活跃邀请码</p>
                  <p className="text-2xl font-bold text-gray-600">{userStats.activeInviteCodes}</p>
                </div>
              </div>

              {/* 标签页 */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'stats'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    统计信息
                  </button>
                  <button
                    onClick={() => setActiveTab('children')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'children'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    直接下级 ({children.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('descendants')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'descendants'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    所有下级 ({descendants.length})
                  </button>
                </nav>
              </div>

              {/* 标签页内容 */}
              <div className="mt-4">
                {activeTab === 'stats' && (
                  <div className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-4">详细信息</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">用户地址:</span>
                          <p className="font-mono mt-1">{userStats.address}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">NFT数量:</span>
                          <p className="mt-1 font-semibold">{userStats.nftCount}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">直接下级:</span>
                          <p className="mt-1 font-semibold">{userStats.childrenCount}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">所有下级:</span>
                          <p className="mt-1 font-semibold">{userStats.descendantsCount}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">最大层级深度:</span>
                          <p className="mt-1 font-semibold">{userStats.maxDepth}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">总邀请码数:</span>
                          <p className="mt-1 font-semibold">{userStats.totalInviteCodes}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">活跃邀请码:</span>
                          <p className="mt-1 font-semibold">{userStats.activeInviteCodes}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'children' && (
                  <div>
                    {children.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        该用户没有直接下级
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-4 py-2 text-left">地址</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">NFT数量</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">下级数量</th>
                            </tr>
                          </thead>
                          <tbody>
                            {children.map((user) => (
                              <tr key={user.address}>
                                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                                  {user.address}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {user.nftCount || 0}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {user.childrenCount || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'descendants' && (
                  <div>
                    {descendants.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        该用户没有下级
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-4 py-2 text-left">地址</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">NFT数量</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">下级数量</th>
                            </tr>
                          </thead>
                          <tbody>
                            {descendants.map((user) => (
                              <tr key={user.address}>
                                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                                  {user.address}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {user.nftCount || 0}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {user.childrenCount || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {!userStats && (
          <div className="text-center py-12 text-gray-500">
            <p>请输入用户地址进行搜索</p>
          </div>
        )}
      </div>
    </div>
  );
}

