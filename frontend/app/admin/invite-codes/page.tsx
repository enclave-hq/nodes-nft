'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWallet } from '@/lib/providers/WalletProvider';
import { 
  login, 
  isAuthenticated,
  getInviteCodes,
  approveInviteCodeRequest,
  type InviteCode 
} from '@/lib/api';

export default function AdminInviteCodesPage() {
  const { address, isConnected, connect } = useWallet();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setIsAuthenticatedState(isAuthenticated());
    if (isAuthenticated()) {
      fetchInviteCodes();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticatedState && isConnected && address) {
      fetchInviteCodes();
    }
  }, [isAuthenticatedState, isConnected, address, page]);

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
      await fetchInviteCodes();
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || '登录失败，请确认您是合约管理员');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInviteCodes = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await getInviteCodes(page, limit);
      setInviteCodes(response.data || []);
      setTotalPages(response.totalPages || 1);
    } catch (error: any) {
      console.error('Failed to fetch invite codes:', error);
      toast.error(error.message || '获取邀请码列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    if (!confirm('确定要批准这个邀请码申请吗？')) {
      return;
    }

    setIsLoading(true);
    try {
      await approveInviteCodeRequest(requestId);
      toast.success('邀请码申请已批准');
      await fetchInviteCodes();
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      toast.error(error.message || '批准申请失败');
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
          <h1 className="text-3xl font-bold mb-6">邀请码管理</h1>
            <p className="text-gray-600 mb-6">
              请先连接钱包并登录以访问管理功能
            </p>
            {!isConnected ? (
              <button
                onClick={() => connect()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                连接钱包
              </button>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">邀请码管理</h1>
            <div className="text-sm text-gray-600">
              钱包: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>

          {/* 邀请码列表 */}
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold">邀请码列表</h2>
            <button
              onClick={fetchInviteCodes}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '加载中...' : '刷新'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">邀请码</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">所有者</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">使用次数</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">状态</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      {isLoading ? '加载中...' : '暂无邀请码'}
                    </td>
                  </tr>
                ) : (
                  inviteCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="border border-gray-300 px-4 py-2">{code.id}</td>
                      <td className="border border-gray-300 px-4 py-2 font-mono">{code.code}</td>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                        {code.ownerAddress.slice(0, 6)}...{code.ownerAddress.slice(-4)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {code.currentUses} {code.maxUses ? `/ ${code.maxUses}` : ''}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          code.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : code.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {code.status === 'active' ? '有效' : code.status === 'pending' ? '待批准' : '已撤销'}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {new Date(code.createdAt).toLocaleString()}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {code.status === 'pending' && (
                          <button
                            onClick={() => handleApproveRequest(code.id)}
                            disabled={isLoading}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            批准
                          </button>
                        )}
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
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-4 py-2">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





