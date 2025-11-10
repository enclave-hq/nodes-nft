'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  isAuthenticated,
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  type WhitelistEntry
} from '@/lib/api';

export default function AdminWhitelistPage() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [newAddresses, setNewAddresses] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchWhitelist();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchWhitelist();
    }
  }, [page, search]);

  const fetchWhitelist = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await getWhitelist(page, limit, search || undefined);
      setWhitelist(response.data || []);
      setTotalPages(response.totalPages || 1);
      setTotal(response.total || 0);
    } catch (error: any) {
      console.error('Failed to fetch whitelist:', error);
      toast.error(error.message || '获取白名单列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToWhitelist = async () => {
    if (!newAddresses.trim()) {
      toast.error('请输入地址');
      return;
    }

    // 解析地址（支持多行或逗号分隔）
    const addresses = newAddresses
      .split(/[,\n]/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0 && addr.startsWith('0x'));

    if (addresses.length === 0) {
      toast.error('请输入有效的地址（以0x开头）');
      return;
    }

    setIsAdding(true);
    try {
      const result = await addToWhitelist(addresses);
      if (result.success) {
        const addedCount = result.added?.length || addresses.length;
        toast.success(`成功添加 ${addedCount} 个地址到白名单`);
        if (result.failed && result.failed.length > 0) {
          toast.error(`失败: ${result.failed.length} 个地址`);
        }
        setNewAddresses('');
        await fetchWhitelist();
      } else {
        toast.error(result.message || '添加失败');
      }
    } catch (error: unknown) {
      console.error('Failed to add to whitelist:', error);
      const message = error instanceof Error ? error.message : '添加白名单失败';
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromWhitelist = async (whitelistAddress: string) => {
    if (!confirm(`确定要从白名单中移除地址 "${whitelistAddress}" 吗？`)) {
      return;
    }

    setIsLoading(true);
    try {
      await removeFromWhitelist(whitelistAddress);
      toast.success('地址已从白名单移除');
      await fetchWhitelist();
    } catch (error: any) {
      console.error('Failed to remove from whitelist:', error);
      toast.error(error.message || '移除失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">白名单管理</h1>
          <p className="mt-1 text-sm text-gray-600">管理用户白名单</p>
        </div>

          {/* 统计信息 */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">白名单总数</p>
                <p className="text-2xl font-bold text-blue-600">{total}</p>
              </div>
              <div className="text-sm text-gray-500">
                第 {page} / {totalPages} 页
              </div>
            </div>
          </div>

          {/* 添加白名单 */}
          <div className="mb-6 p-6 border border-gray-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">添加白名单</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  地址（每行一个或逗号分隔）
                </label>
                <textarea
                  value={newAddresses}
                  onChange={(e) => setNewAddresses(e.target.value)}
                  placeholder="0x1234...&#10;0x5678...&#10;或 0x1234..., 0x5678..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持多行输入或逗号分隔的地址列表
                </p>
              </div>
              <button
                onClick={handleAddToWhitelist}
                disabled={isAdding || !newAddresses.trim()}
                className="px-6 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? '添加中...' : '批量添加'}
              </button>
            </div>
          </div>

          {/* 搜索和刷新 */}
          <div className="mb-4 flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // 重置到第一页
                }}
                placeholder="搜索地址..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            <button
              onClick={fetchWhitelist}
              disabled={isLoading}
              className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              {isLoading ? '加载中...' : '刷新'}
            </button>
          </div>

          {/* 白名单列表 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">地址</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">添加时间</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">添加者</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {whitelist.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      {isLoading ? '加载中...' : search ? '未找到匹配的地址' : '白名单为空'}
                    </td>
                  </tr>
                ) : (
                  whitelist.map((entry) => (
                    <tr key={entry.address}>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                        {entry.address}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {new Date(entry.addedAt).toLocaleString()}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                        {entry.addedBy.slice(0, 6)}...{entry.addedBy.slice(-4)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <button
                          onClick={() => handleRemoveFromWhitelist(entry.address)}
                          disabled={isLoading}
                          className="px-3 py-1 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] disabled:opacity-50 text-sm"
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

