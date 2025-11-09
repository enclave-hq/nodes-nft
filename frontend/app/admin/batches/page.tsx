'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWallet } from '@/lib/providers/WalletProvider';
import { 
  login, 
  isAuthenticated,
  getBatches,
  createBatch,
  activateBatch,
  type Batch
} from '@/lib/api';

export default function AdminBatchesPage() {
  const { address, isConnected, connect } = useWallet();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [maxMintable, setMaxMintable] = useState('');
  const [mintPrice, setMintPrice] = useState('');

  useEffect(() => {
    setIsAuthenticatedState(isAuthenticated());
    if (isAuthenticated()) {
      fetchBatches();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticatedState && isConnected && address) {
      fetchBatches();
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
      await fetchBatches();
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || '登录失败，请确认您是合约管理员');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatches = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const data = await getBatches();
      // 按创建时间倒序排列
      setBatches(data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error: any) {
      console.error('Failed to fetch batches:', error);
      toast.error(error.message || '获取批次列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!maxMintable.trim() || !mintPrice.trim()) {
      toast.error('请填写完整信息');
      return;
    }

    const maxMintableNum = parseInt(maxMintable);
    const mintPriceNum = parseFloat(mintPrice);

    if (isNaN(maxMintableNum) || maxMintableNum <= 0) {
      toast.error('最大铸造数必须是大于0的整数');
      return;
    }

    if (isNaN(mintPriceNum) || mintPriceNum <= 0) {
      toast.error('铸造价格必须是大于0的数字');
      return;
    }

    setIsCreating(true);
    try {
      await createBatch(maxMintable, mintPrice);
      toast.success('批次创建成功');
      setMaxMintable('');
      setMintPrice('');
      await fetchBatches();
    } catch (error: any) {
      console.error('Failed to create batch:', error);
      toast.error(error.message || '创建批次失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivateBatch = async (batchId: string) => {
    if (!confirm('确定要激活这个批次吗？激活后该批次将可以用于铸造。')) {
      return;
    }

    setIsActivating(true);
    try {
      await activateBatch(batchId);
      toast.success('批次激活成功');
      await fetchBatches();
    } catch (error: any) {
      console.error('Failed to activate batch:', error);
      toast.error(error.message || '激活批次失败');
    } finally {
      setIsActivating(false);
    }
  };

  // Show login page if not authenticated
  if (!isAuthenticatedState) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-6">批次管理</h1>
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

  const activeBatches = batches.filter(b => b.isActive);
  const inactiveBatches = batches.filter(b => !b.isActive);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">批次管理</h1>
            <div className="text-sm text-gray-600">
              钱包: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>

          {/* 统计信息 */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">总批次数</p>
              <p className="text-2xl font-bold text-blue-600">{batches.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">激活批次</p>
              <p className="text-2xl font-bold text-green-600">{activeBatches.length}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">未激活批次</p>
              <p className="text-2xl font-bold text-gray-600">{inactiveBatches.length}</p>
            </div>
          </div>

          {/* 创建批次 */}
          <div className="mb-6 p-6 border border-gray-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">创建新批次</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大铸造数
                </label>
                <input
                  type="number"
                  value={maxMintable}
                  onChange={(e) => setMaxMintable(e.target.value)}
                  placeholder="例如: 1000"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  铸造价格 (USDT)
                </label>
                <input
                  type="number"
                  value={mintPrice}
                  onChange={(e) => setMintPrice(e.target.value)}
                  placeholder="例如: 100"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleCreateBatch}
              disabled={isCreating || !maxMintable.trim() || !mintPrice.trim()}
              className="mt-4 px-6 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? '创建中...' : '创建批次'}
            </button>
          </div>

          {/* 刷新按钮 */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={fetchBatches}
              disabled={isLoading}
              className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              {isLoading ? '加载中...' : '刷新'}
            </button>
          </div>

          {/* 激活的批次 */}
          {activeBatches.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4 text-green-600">激活的批次</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">批次ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">最大铸造数</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">铸造价格</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">状态</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">创建者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBatches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="border border-gray-300 px-4 py-2 font-mono">{batch.id}</td>
                        <td className="border border-gray-300 px-4 py-2">{batch.maxMintable}</td>
                        <td className="border border-gray-300 px-4 py-2">{batch.mintPrice} USDT</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span className="px-2 py-1 rounded text-sm bg-green-100 text-green-800">
                            激活
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(batch.createdAt).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                          {batch.createdBy.slice(0, 6)}...{batch.createdBy.slice(-4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 未激活的批次 */}
          {inactiveBatches.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-600">未激活的批次</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">批次ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">最大铸造数</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">铸造价格</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">状态</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveBatches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="border border-gray-300 px-4 py-2 font-mono">{batch.id}</td>
                        <td className="border border-gray-300 px-4 py-2">{batch.maxMintable}</td>
                        <td className="border border-gray-300 px-4 py-2">{batch.mintPrice} USDT</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                            未激活
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(batch.createdAt).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <button
                            onClick={() => handleActivateBatch(batch.id)}
                            disabled={isActivating}
                            className="px-3 py-1 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] disabled:opacity-50 text-sm"
                          >
                            {isActivating ? '激活中...' : '激活'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {batches.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              暂无批次，请先创建批次
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

