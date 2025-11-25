'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  isAuthenticated,
  getBatches,
  createBatch,
  activateBatch,
  syncBatches,
  type Batch
} from '@/lib/api';
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils';

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [maxMintable, setMaxMintable] = useState('');
  const [mintPrice, setMintPrice] = useState('');
  const [referralReward, setReferralReward] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      fetchBatches();
    }
  }, []);

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
    // Default to 10% if not set
    const referralRewardNum = referralReward.trim() 
      ? parseFloat(referralReward) 
      : mintPriceNum * 0.1; // 10% of mint price

    if (isNaN(maxMintableNum) || maxMintableNum <= 0) {
      toast.error('最大铸造数必须是大于0的整数');
      return;
    }

    if (isNaN(mintPriceNum) || mintPriceNum <= 0) {
      toast.error('铸造价格必须是大于0的数字');
      return;
    }

    if (referralReward.trim() && (isNaN(parseFloat(referralReward)) || parseFloat(referralReward) < 0)) {
      toast.error('批次返佣必须是大于等于0的数字');
      return;
    }

    setIsCreating(true);
    try {
      // Convert mintPrice from USDT to wei (BSC USDT has 18 decimals)
      const mintPriceInWei = parseTokenAmount(mintPrice, 18).toString();
      console.log('🔍 Creating batch:', {
        maxMintable,
        mintPriceInput: mintPrice,
        mintPriceInWei,
        mintPriceInUSDT: (Number(mintPriceInWei) / 1e18).toString(),
        referralReward: referralRewardNum,
      });
      await createBatch(
        maxMintable, 
        mintPriceInWei,
        referralRewardNum.toString()
      );
      toast.success('批次创建成功');
      setMaxMintable('');
      setMintPrice('');
      setReferralReward('');
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

  const handleSyncFromChain = async () => {
    setIsSyncing(true);
    try {
      const result = await syncBatches();
      toast.success(result.message);
      // 同步完成后重新获取批次列表
      await fetchBatches();
    } catch (error: any) {
      console.error('Failed to sync batches:', error);
      toast.error(error.message || '同步批次失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const activeBatches = batches.filter(b => b.active);
  const inactiveBatches = batches.filter(b => !b.active);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">批次管理</h1>
          <p className="mt-1 text-sm text-gray-600">创建和管理 NFT 批次</p>
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
            <div className="grid grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  批次返佣 (USDT/每个NFT)
                </label>
                <input
                  type="number"
                  value={referralReward}
                  onChange={(e) => setReferralReward(e.target.value)}
                  placeholder="例如: 10 (可选)"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">每个NFT返回给根推荐者的收益</p>
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

          {/* 操作按钮 */}
          <div className="mb-4 flex justify-end gap-3">
            <button
              onClick={handleSyncFromChain}
              disabled={isSyncing || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="从区块链同步批次数据到数据库"
            >
              {isSyncing ? '同步中...' : '🔄 从链上同步'}
            </button>
            <button
              onClick={fetchBatches}
              disabled={isLoading || isSyncing}
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
                      <th className="border border-gray-300 px-4 py-2 text-left">批次返佣</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">铸造进度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBatches.map((batch) => (
                      <tr key={batch.batchId}>
                        <td className="border border-gray-300 px-4 py-2 font-mono">{batch.batchId}</td>
                        <td className="border border-gray-300 px-4 py-2">{batch.maxMintable}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatTokenAmount(batch.mintPrice, 18, 2)} USDT
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {batch.referralReward 
                            ? `${parseFloat(batch.referralReward).toFixed(2)} USDT`
                            : (() => {
                                // Calculate 10% of mint price as default
                                const mintPriceUSDT = Number(formatTokenAmount(batch.mintPrice, 18, 2));
                                const defaultReward = (mintPriceUSDT * 0.1).toFixed(2);
                                return `${defaultReward} USDT`;
                              })()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(batch.createdAt).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span className="text-sm text-gray-500">已铸造: {batch.currentMinted} / {batch.maxMintable}</span>
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
                      <th className="border border-gray-300 px-4 py-2 text-left">批次返佣</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">铸造进度</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveBatches.map((batch) => (
                      <tr key={batch.batchId}>
                        <td className="border border-gray-300 px-4 py-2 font-mono">{batch.batchId}</td>
                        <td className="border border-gray-300 px-4 py-2">{batch.maxMintable}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatTokenAmount(batch.mintPrice, 18, 2)} USDT
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {batch.referralReward 
                            ? `${parseFloat(batch.referralReward).toFixed(2)} USDT`
                            : (() => {
                                // Calculate 10% of mint price as default
                                const mintPriceUSDT = Number(formatTokenAmount(batch.mintPrice, 18, 2));
                                const defaultReward = (mintPriceUSDT * 0.1).toFixed(2);
                                return `${defaultReward} USDT`;
                              })()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(batch.createdAt).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span className="text-sm text-gray-500">已铸造: {batch.currentMinted} / {batch.maxMintable}</span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <button
                            onClick={() => handleActivateBatch(batch.batchId)}
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
  );
}

