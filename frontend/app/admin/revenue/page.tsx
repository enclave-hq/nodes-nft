"use client";

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  getTotalRevenue,
  getRevenueDetails,
  getTotalReferralRewards,
  getReferralRewardDetails,
  getTreasuryBalance,
  transferUsdt,
  transferReferralReward,
  transferRevenue,
  refreshNftRecords,
  getNftsWithoutReferralRewards,
  createReferralRewardForNft,
  batchCreateReferralRewards,
  getDistributableReferralRewards,
  getRevenueStatistics,
  getReferralRewardStatistics,
  type TotalRevenueResponse,
  type RevenueDetailsResponse,
  type TotalReferralRewardsResponse,
  type ReferralRewardDetailsResponse,
  type TreasuryBalanceResponse,
  type NftsWithoutReferralRewardsResponse,
  type DistributableReferralRewardsResponse,
  type RevenueStatisticsResponse,
  type ReferralRewardStatisticsResponse,
} from '@/lib/api/revenue';

export default function AdminRevenuePage() {
  const [activeTab, setActiveTab] = useState<'revenue' | 'referral' | 'transfer'>('revenue');
  
  // Revenue state
  const [totalRevenue, setTotalRevenue] = useState<TotalRevenueResponse | null>(null);
  const [revenueDetails, setRevenueDetails] = useState<RevenueDetailsResponse | null>(null);
  const [revenuePage, setRevenuePage] = useState(1);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Referral rewards state
  const [totalReferralRewards, setTotalReferralRewards] = useState<TotalReferralRewardsResponse | null>(null);
  const [referralRewardDetails, setReferralRewardDetails] = useState<ReferralRewardDetailsResponse | null>(null);
  const [referralPage, setReferralPage] = useState(1);
  const [referralLoading, setReferralLoading] = useState(false);
  
  // NFTs without referral rewards state
  const [nftsWithoutRewards, setNftsWithoutRewards] = useState<NftsWithoutReferralRewardsResponse | null>(null);
  const [nftsWithoutRewardsPage, setNftsWithoutRewardsPage] = useState(1);
  const [nftsWithoutRewardsLoading, setNftsWithoutRewardsLoading] = useState(false);
  
  // Distributable rewards state
  const [distributableRewards, setDistributableRewards] = useState<DistributableReferralRewardsResponse | null>(null);
  const [distributableRewardsLoading, setDistributableRewardsLoading] = useState(false);

  // Treasury balance state
  const [treasuryBalance, setTreasuryBalance] = useState<TreasuryBalanceResponse | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);

  // Transfer state
  const [transferType, setTransferType] = useState<'referral' | 'revenue'>('referral');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferTotpCode, setTransferTotpCode] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferRootReferrerAddress, setTransferRootReferrerAddress] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Statistics state
  const [revenueStatistics, setRevenueStatistics] = useState<RevenueStatisticsResponse | null>(null);
  const [referralRewardStatistics, setReferralRewardStatistics] = useState<ReferralRewardStatisticsResponse | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  // Fetch total revenue
  const fetchTotalRevenue = async () => {
    try {
      const data = await getTotalRevenue();
      setTotalRevenue(data);
    } catch (error: any) {
      console.error('Failed to fetch total revenue:', error);
      toast.error(error.message || '获取总收入失败');
    }
  };

  // Fetch revenue details
  const fetchRevenueDetails = async (page: number = 1) => {
    setRevenueLoading(true);
    try {
      const data = await getRevenueDetails(page, 20);
      setRevenueDetails(data);
      setRevenuePage(page);
    } catch (error: any) {
      console.error('Failed to fetch revenue details:', error);
      toast.error(error.message || '获取收入明细失败');
    } finally {
      setRevenueLoading(false);
    }
  };

  // Fetch total referral rewards
  const fetchTotalReferralRewards = async () => {
    try {
      const data = await getTotalReferralRewards();
      setTotalReferralRewards(data);
    } catch (error: any) {
      console.error('Failed to fetch total referral rewards:', error);
      toast.error(error.message || '获取总返佣失败');
    }
  };

  // Fetch referral reward details
  const fetchReferralRewardDetails = async (page: number = 1) => {
    setReferralLoading(true);
    try {
      const data = await getReferralRewardDetails(page, 20);
      setReferralRewardDetails(data);
      setReferralPage(page);
    } catch (error: any) {
      console.error('Failed to fetch referral reward details:', error);
      toast.error(error.message || '获取返佣明细失败');
    } finally {
      setReferralLoading(false);
    }
  };

  // Fetch treasury balance
  const fetchTreasuryBalance = async () => {
    setTreasuryLoading(true);
    try {
      const data = await getTreasuryBalance();
      setTreasuryBalance(data);
    } catch (error: any) {
      console.error('Failed to fetch treasury balance:', error);
      toast.error(error.message || '获取Treasury余额失败');
    } finally {
      setTreasuryLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    setStatisticsLoading(true);
    try {
      const [revenueStats, referralStats] = await Promise.all([
        getRevenueStatistics(),
        getReferralRewardStatistics(),
      ]);
      setRevenueStatistics(revenueStats);
      setReferralRewardStatistics(referralStats);
    } catch (error: any) {
      console.error('Failed to fetch statistics:', error);
      toast.error(error.message || '获取统计信息失败');
    } finally {
      setStatisticsLoading(false);
    }
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!transferTo.trim() || !transferAmount.trim() || !transferPassword.trim() || !transferTotpCode.trim()) {
      toast.error('请填写完整信息');
      return;
    }

    if (transferType === 'referral' && !transferRootReferrerAddress.trim()) {
      toast.error('发放返佣需要填写根推荐者地址');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('转账金额必须是大于0的数字');
      return;
    }

    setTransferring(true);
    try {
      let result;
      if (transferType === 'referral') {
        result = await transferReferralReward({
        to: transferTo.trim(),
        amount: transferAmount.trim(),
        password: transferPassword,
        totpCode: transferTotpCode,
          rootReferrerAddress: transferRootReferrerAddress.trim(),
          note: transferNote.trim() || undefined,
        });
      } else {
        result = await transferRevenue({
          to: transferTo.trim(),
          amount: transferAmount.trim(),
          password: transferPassword,
          totpCode: transferTotpCode,
          note: transferNote.trim() || undefined,
      });
      }

      toast.success(`转账成功！交易哈希: ${result.txHash}`);
      
      // Clear form
      setTransferTo('');
      setTransferAmount('');
      setTransferPassword('');
      setTransferTotpCode('');
      setTransferNote('');
      setTransferRootReferrerAddress('');

      // Refresh data
      await fetchTreasuryBalance();
      await fetchStatistics();
      if (transferType === 'referral') {
        await fetchDistributableRewards();
      }
    } catch (error: any) {
      console.error('Failed to transfer USDT:', error);
      toast.error(error.message || '转账失败');
    } finally {
      setTransferring(false);
    }
  };

  // Refresh NFT records
  const handleRefreshNfts = async (fullRefresh: boolean = false) => {
    setRefreshing(true);
    try {
      const result = await refreshNftRecords(fullRefresh);
      toast.success(
        `刷新完成！新增 ${result.newRecords} 条记录，更新 ${result.updatedRecords} 条记录，错误 ${result.errors} 个`
      );
      // Refresh revenue details after refresh
      await fetchTotalRevenue();
      await fetchRevenueDetails(revenuePage);
    } catch (error: any) {
      console.error('Failed to refresh NFTs:', error);
      toast.error(error.message || '刷新NFT记录失败');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch NFTs without referral rewards
  const fetchNftsWithoutRewards = async (page: number = 1) => {
    setNftsWithoutRewardsLoading(true);
    try {
      const data = await getNftsWithoutReferralRewards(page, 20);
      setNftsWithoutRewards(data);
      setNftsWithoutRewardsPage(page);
    } catch (error: any) {
      console.error('Failed to fetch NFTs without referral rewards:', error);
      toast.error(error.message || '获取未返佣NFT列表失败');
    } finally {
      setNftsWithoutRewardsLoading(false);
    }
  };

  // Create referral reward for a specific NFT
  const handleCreateReferralReward = async (nftId: number) => {
    try {
      await createReferralRewardForNft(nftId);
      toast.success(`已为 NFT ${nftId} 创建返佣记录`);
      // Refresh lists
      await fetchNftsWithoutRewards(nftsWithoutRewardsPage);
      await fetchTotalReferralRewards();
      await fetchReferralRewardDetails(referralPage);
      await fetchDistributableRewards();
    } catch (error: any) {
      console.error('Failed to create referral reward:', error);
      toast.error(error.message || '创建返佣记录失败');
    }
  };

  // Batch create referral rewards
  const handleBatchCreateReferralRewards = async () => {
    if (!confirm('确定要批量创建所有未返佣NFT的返佣记录吗？')) {
      return;
    }
    
    try {
      const result = await batchCreateReferralRewards();
      toast.success(
        `批量创建完成！处理 ${result.processed} 个，创建 ${result.created} 个，跳过 ${result.skipped} 个，错误 ${result.errors} 个`
      );
      // Refresh lists
      await fetchNftsWithoutRewards(nftsWithoutRewardsPage);
      await fetchTotalReferralRewards();
      await fetchReferralRewardDetails(referralPage);
      await fetchDistributableRewards();
    } catch (error: any) {
      console.error('Failed to batch create referral rewards:', error);
      toast.error(error.message || '批量创建返佣记录失败');
    }
  };

  // Fetch distributable rewards
  const fetchDistributableRewards = async () => {
    setDistributableRewardsLoading(true);
    try {
      const data = await getDistributableReferralRewards();
      setDistributableRewards(data);
    } catch (error: any) {
      console.error('Failed to fetch distributable rewards:', error);
      toast.error(error.message || '获取可发放返佣失败');
    } finally {
      setDistributableRewardsLoading(false);
    }
  };

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 'revenue') {
      fetchTotalRevenue();
      fetchRevenueDetails(1);
    } else if (activeTab === 'referral') {
      fetchTotalReferralRewards();
      fetchReferralRewardDetails(1);
      fetchNftsWithoutRewards(1);
      fetchDistributableRewards();
    } else if (activeTab === 'transfer') {
      fetchTreasuryBalance();
      fetchStatistics();
      fetchDistributableRewards();
    }
  }, [activeTab]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">收入管理</h1>

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-all ${
              activeTab === 'revenue'
                ? 'bg-white border-t border-x border-gray-200 text-blue-600 border-b-2 border-b-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            收入管理
          </button>
          <button
            onClick={() => setActiveTab('referral')}
            className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-all ${
              activeTab === 'referral'
                ? 'bg-white border-t border-x border-gray-200 text-blue-600 border-b-2 border-b-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            返佣管理
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-all ${
              activeTab === 'transfer'
                ? 'bg-white border-t border-x border-gray-200 text-blue-600 border-b-2 border-b-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            转账操作
          </button>
        </nav>
      </div>

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div>
          {/* Total Revenue Card */}
          {totalRevenue && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-bold mb-6 text-gray-800">总收入统计</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">总收入 (USDT)</p>
                  <p className="text-3xl font-bold text-green-600">{parseFloat(totalRevenue.totalRevenue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">记录数</p>
                  <p className="text-3xl font-bold text-gray-800">{totalRevenue.recordCount.toLocaleString('zh-CN')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Details Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">收入明细</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRefreshNfts(false)}
                  disabled={refreshing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {refreshing ? '刷新中...' : '快速刷新'}
                </button>
                <button
                  onClick={() => handleRefreshNfts(true)}
                  disabled={refreshing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {refreshing ? '刷新中...' : '完全刷新'}
                </button>
              </div>
            </div>
            {revenueLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-500">加载中...</p>
              </div>
            ) : revenueDetails ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NFT ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">批次 ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">铸造者地址</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">铸造价格 (USDT)</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">交易哈希</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {revenueDetails.records.map((record, index) => (
                        <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{record.nftId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.batchId}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">{record.minterAddress}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{parseFloat(record.mintPrice).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                            {record.mintTxHash ? (
                              <a
                                href={`https://testnet.bscscan.com/tx/${record.mintTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {record.mintTxHash.slice(0, 10)}...
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(record.createdAt).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {revenueDetails.pagination.totalPages > 1 && (
                  <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      第 {revenueDetails.pagination.page} / {revenueDetails.pagination.totalPages} 页，共 {revenueDetails.pagination.total} 条记录
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchRevenueDetails(revenuePage - 1)}
                        disabled={revenuePage <= 1}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => fetchRevenueDetails(revenuePage + 1)}
                        disabled={revenuePage >= revenueDetails.pagination.totalPages}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">暂无数据</div>
            )}
          </div>
        </div>
      )}

      {/* Referral Tab */}
      {activeTab === 'referral' && (
        <div>
          {/* Total Referral Rewards Card */}
          {totalReferralRewards && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 mb-6 border border-blue-100">
              <h2 className="text-xl font-bold mb-6 text-gray-800">返佣统计</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">总返佣 (USDT)</p>
                  <p className="text-3xl font-bold text-blue-600">{parseFloat(totalReferralRewards.totalRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">记录数</p>
                  <p className="text-3xl font-bold text-gray-800">{totalReferralRewards.recordCount.toLocaleString('zh-CN')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Distributable Rewards Card */}
          {distributableRewards && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg p-6 mb-6 border border-purple-100">
              <h2 className="text-xl font-bold mb-6 text-gray-800">可发放返佣统计</h2>
              {distributableRewardsLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                </div>
              ) : distributableRewards.rewards.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">根推荐者地址</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">总返佣 (USDT)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">已发放 (USDT)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">可发放 (USDT)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">记录数</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {distributableRewards.rewards.map((reward, index) => (
                        <tr key={reward.rootAddress} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">{reward.rootAddress}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{parseFloat(reward.totalRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{parseFloat(reward.distributedRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-purple-600">{parseFloat(reward.distributableRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{reward.recordCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">暂无可发放返佣</div>
              )}
            </div>
          )}

          {/* NFTs Without Referral Rewards */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">未返佣NFT列表</h2>
              <button
                onClick={handleBatchCreateReferralRewards}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                批量创建返佣记录
              </button>
            </div>
            {nftsWithoutRewardsLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-500">加载中...</p>
              </div>
            ) : nftsWithoutRewards && nftsWithoutRewards.records.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NFT ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">批次 ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">铸造者地址</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">铸造价格 (USDT)</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {nftsWithoutRewards.records.map((record, index) => (
                        <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{record.nftId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.batchId}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">{record.minterAddress}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{parseFloat(record.mintPrice).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleCreateReferralReward(record.nftId)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              创建返佣
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {nftsWithoutRewards.pagination.totalPages > 1 && (
                  <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      第 {nftsWithoutRewards.pagination.page} / {nftsWithoutRewards.pagination.totalPages} 页，共 {nftsWithoutRewards.pagination.total} 条记录
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchNftsWithoutRewards(nftsWithoutRewardsPage - 1)}
                        disabled={nftsWithoutRewardsPage <= 1}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => fetchNftsWithoutRewards(nftsWithoutRewardsPage + 1)}
                        disabled={nftsWithoutRewardsPage >= nftsWithoutRewards.pagination.totalPages}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">暂无未返佣NFT</div>
            )}
          </div>

          {/* Referral Reward Details Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">返佣明细</h2>
            </div>
            {referralLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-500">加载中...</p>
              </div>
            ) : referralRewardDetails ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NFT ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">批次 ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">铸造者地址</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">根推荐者地址</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">根邀请码</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">返佣金额 (USDT)</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {referralRewardDetails.records.map((record, index) => (
                        <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{record.nftId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.batchId}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">{record.minterAddress}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">{record.rootReferrerAddress}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">
                            {record.rootInviteCode ? record.rootInviteCode.code : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">{parseFloat(record.referralReward).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(record.createdAt).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {referralRewardDetails.pagination.totalPages > 1 && (
                  <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      第 {referralRewardDetails.pagination.page} / {referralRewardDetails.pagination.totalPages} 页，共 {referralRewardDetails.pagination.total} 条记录
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchReferralRewardDetails(referralPage - 1)}
                        disabled={referralPage <= 1}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => fetchReferralRewardDetails(referralPage + 1)}
                        disabled={referralPage >= referralRewardDetails.pagination.totalPages}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">暂无数据</div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Tab */}
      {activeTab === 'transfer' && (
        <div>
          {/* Treasury Balance Card */}
          {treasuryBalance && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 mb-6 border border-green-100">
              <h2 className="text-xl font-bold mb-6 text-gray-800">Treasury 余额</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">Treasury 地址</p>
                  <p className="font-mono text-sm text-gray-800 break-all">{treasuryBalance.treasuryAddress}</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-600 mb-2">余额 (USDT)</p>
                  <p className="text-3xl font-bold text-green-600">{parseFloat(treasuryBalance.balance).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Referral Reward Statistics */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-100">
              <h2 className="text-xl font-bold mb-4 text-gray-800">返佣统计</h2>
              {statisticsLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : referralRewardStatistics ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-1">总返佣 (USDT)</p>
                    <p className="text-2xl font-bold text-blue-600">{parseFloat(referralRewardStatistics.totalRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-1">已发放 (USDT)</p>
                    <p className="text-2xl font-bold text-gray-700">{parseFloat(referralRewardStatistics.distributedRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-1">可发放 (USDT)</p>
                    <p className="text-2xl font-bold text-purple-600">{parseFloat(referralRewardStatistics.distributableRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">暂无数据</div>
              )}
            </div>

            {/* Revenue Statistics */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 border border-green-100">
              <h2 className="text-xl font-bold mb-4 text-gray-800">收益统计</h2>
              {statisticsLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                </div>
              ) : revenueStatistics ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-1">总收益 (USDT)</p>
                    <p className="text-2xl font-bold text-green-600">{parseFloat(revenueStatistics.totalRevenue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-1">已提取 (USDT)</p>
                    <p className="text-2xl font-bold text-gray-700">{parseFloat(revenueStatistics.withdrawnRevenue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-1">可提取 (USDT)</p>
                    <p className="text-2xl font-bold text-emerald-600">{parseFloat(revenueStatistics.availableRevenue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">暂无数据</div>
              )}
            </div>
          </div>

          {/* Transfer Type Selection */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">选择转账类型</h2>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setTransferType('referral');
                  setTransferRootReferrerAddress('');
                  setTransferNote('');
                }}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                  transferType === 'referral'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold mb-1">发放返佣</div>
                <div className="text-sm text-gray-600">向推荐者发放返佣奖励</div>
              </button>
              <button
                onClick={() => {
                  setTransferType('revenue');
                  setTransferRootReferrerAddress('');
                  setTransferNote('');
                }}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                  transferType === 'revenue'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold mb-1">提取收益</div>
                <div className="text-sm text-gray-600">提取系统收益</div>
              </button>
            </div>
          </div>

          {/* Transfer Form */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold mb-6 text-gray-800">
              {transferType === 'referral' ? '发放返佣' : '提取收益'}
            </h2>
            <div className="space-y-5 max-w-2xl">
              {transferType === 'referral' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    根推荐者地址 <span className="text-red-500">*</span>
                  </label>
                  {distributableRewards && distributableRewards.rewards.length > 0 ? (
                    <>
                      <select
                        value={transferRootReferrerAddress}
                        onChange={(e) => {
                          setTransferRootReferrerAddress(e.target.value);
                          // Auto-fill amount with distributable amount if available
                          const selectedReward = distributableRewards.rewards.find(
                            (r) => r.rootAddress.toLowerCase() === e.target.value.toLowerCase()
                          );
                          if (selectedReward && !transferAmount) {
                            setTransferAmount(selectedReward.distributableRewards);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      >
                        <option value="">请选择根推荐者地址</option>
                        {distributableRewards.rewards.map((reward) => (
                          <option key={reward.rootAddress} value={reward.rootAddress}>
                            {reward.rootAddress} (可发放: {parseFloat(reward.distributableRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT)
                          </option>
                        ))}
                      </select>
                      {transferRootReferrerAddress && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          {(() => {
                            const selectedReward = distributableRewards.rewards.find(
                              (r) => r.rootAddress.toLowerCase() === transferRootReferrerAddress.toLowerCase()
                            );
                            return selectedReward ? (
                              <div className="text-sm">
                                <p className="text-gray-700">
                                  <span className="font-medium">总返佣:</span> {parseFloat(selectedReward.totalRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                </p>
                                <p className="text-gray-700">
                                  <span className="font-medium">已发放:</span> {parseFloat(selectedReward.distributedRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                </p>
                                <p className="text-purple-600 font-semibold">
                                  <span className="font-medium">可发放:</span> {parseFloat(selectedReward.distributableRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                </p>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={transferRootReferrerAddress}
                        onChange={(e) => setTransferRootReferrerAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">暂无可发放返佣，请手动输入根推荐者地址</p>
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  目标地址 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  转账金额 (USDT) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="例如: 1000"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {transferType === 'referral' && referralRewardStatistics && (
                  <p className="mt-1 text-xs text-gray-500">
                    可发放金额: {parseFloat(referralRewardStatistics.distributableRewards).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </p>
                )}
                {transferType === 'revenue' && revenueStatistics && (
                  <p className="mt-1 text-xs text-gray-500">
                    可提取金额: {parseFloat(revenueStatistics.availableRevenue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  备注 (可选)
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="备注信息"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  管理员密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={transferPassword}
                  onChange={(e) => setTransferPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TOTP 验证码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transferTotpCode}
                  onChange={(e) => setTransferTotpCode(e.target.value)}
                  placeholder="6位数字验证码"
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className={`w-full px-6 py-3 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg ${
                  transferType === 'referral'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                }`}
              >
                {transferring ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    转账中...
                  </span>
                ) : (
                  transferType === 'referral' ? '确认发放返佣' : '确认提取收益'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

