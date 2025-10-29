'use client';

import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useWeb3Data } from '@/lib/stores/web3Store';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useNFTPool, useUserShare, usePendingProduced, usePendingReward, useClaimProduced, useClaimReward } from '@/lib/hooks/useNFTManager';
import { TokenBalance, NFTCount } from '@/lib/components/FormattedNumber';
import { formatDate } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/provider';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function NFTDetailPage() {
  const params = useParams();
  const nftId = parseInt(params.id as string);
  const t = useTranslations('myNfts');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();

  // NFT hooks
  const poolHook = useNFTPool(nftId);
  const userShareHook = useUserShare(nftId);
  const pendingProducedHook = usePendingProduced(nftId);
  const pendingRewardHook = usePendingReward(nftId, process.env.NEXT_PUBLIC_USDT_ADDRESS!);
  const claimProduced = useClaimProduced();
  const claimReward = useClaimReward();

  const pool = poolHook.data;
  const userShare = userShareHook.data;
  const pendingProduced = pendingProducedHook.data;
  const pendingReward = pendingRewardHook.data;

  // Find NFT from web3Data
  const nft = web3Data.nfts.find(n => n.id === nftId);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {t('connectWallet.title')}
              </h1>
              <p className="text-gray-600 mb-6">
                {t('connectWallet.description')}
              </p>
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                连接钱包
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                NFT 未找到
              </h1>
              <p className="text-gray-600 mb-6">
                找不到 ID 为 {nftId} 的 NFT
              </p>
              <Link
                href="/my-nfts"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回我的 NFT
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleClaimProduced = async () => {
    try {
      await claimProduced.mutateAsync(nftId);
    } catch (error) {
      console.error('Error claiming produced:', error);
    }
  };

  const handleClaimReward = async () => {
    try {
      await claimReward.mutateAsync(nftId, process.env.NEXT_PUBLIC_USDT_ADDRESS!);
    } catch (error) {
      console.error('Error claiming reward:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/my-nfts"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回我的 NFT
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              NFT #{nftId} - {nft.type} 节点
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* NFT Overview */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  NFT 概览
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">类型</p>
                    <p className="font-medium">{nft.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">状态</p>
                    <p className="font-medium">{nft.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">总份额</p>
                    <p className="font-medium">{nft.totalShares}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">创建时间</p>
                    <p className="font-medium">{nft.createdAt ? formatDate(nft.createdAt) : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Pool Information */}
              {pool && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    池信息
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">剩余铸造额度</p>
                      <TokenBalance value={pool.remainingMintQuota} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">已解锁未提取</p>
                      <TokenBalance value={pool.unlockedNotWithdrawn} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">已解锁期数</p>
                      <p className="font-medium">{pool.unlockedPeriods}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">创建时间</p>
                      <p className="font-medium">{pool.createdAt ? formatDate(pool.createdAt) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* User Share Information */}
              {userShare && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    我的份额
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">持有份额</p>
                      <p className="font-medium">{userShare.shares}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">产出债务</p>
                      <TokenBalance value={userShare.debtProduced} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">解散后提取</p>
                      <TokenBalance value={userShare.withdrawnAfterDissolve} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pending Rewards */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  待领取奖励
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">待领取 $E</p>
                    <TokenBalance value={pendingProduced} />
                    <button
                      onClick={handleClaimProduced}
                      disabled={claimProduced.isLoading || pendingProduced === "0" || pendingProduced === "0.0" || parseFloat(pendingProduced) <= 0}
                      className="mt-2 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {claimProduced.isLoading ? '领取中...' : '领取 $E'}
                    </button>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">待领取 USDT</p>
                    <TokenBalance value={pendingReward} />
                    <button
                      onClick={handleClaimReward}
                      disabled={claimReward.isLoading || pendingReward === "0" || pendingReward === "0.0" || parseFloat(pendingReward) <= 0}
                      className="mt-2 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {claimReward.isLoading ? '领取中...' : '领取 USDT'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  操作
                </h2>
                <div className="space-y-3">
                  {userShare && userShare.shares !== "0" && (
                    <Link
                      href={`/nfts/${nftId}/transfer`}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-center inline-block"
                    >
                      转让份额
                    </Link>
                  )}
                  <Link
                    href={`/marketplace?nft=${nftId}`}
                    className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 text-center block"
                  >
                    在市场中查看
                  </Link>
                  <a
                    href={`https://testnet.bscscan.com/address/${process.env.NEXT_PUBLIC_NFT_MANAGER_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 text-center inline-flex items-center justify-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    在 BSCScan 查看
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}