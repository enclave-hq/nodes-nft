"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { useBatchClaimProduced, useNFTPool, useUserShare, usePendingProduced, usePendingReward, useClaimProduced, useClaimReward, useUserSharesInfo, useDissolutionProposal, useProposeDissolution, useApproveDissolution } from "@/lib/hooks/useNFTManager";
import { formatTokenAmount, formatDate, cn } from "@/lib/utils";
import { NFT_CONFIG, NFTType, NFTStatus, UNLOCK_CONFIG, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { Shield, TrendingUp, Lock, Unlock, Share2, Loader2, ArrowRight, Plus, Vote, AlertTriangle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import toast from 'react-hot-toast';
import { useTranslations } from "@/lib/i18n/provider";

function NFTCard({ nftId }: { nftId: number }) {
  const t = useTranslations('myNfts.nftCard');
  const tStatus = useTranslations('status');
  const tTypes = useTranslations('nftTypes');
  const tCommon = useTranslations('common');
  const { account } = useWallet();
  
  // Use real contract hooks
  const { data: pool } = useNFTPool(nftId);
  const { data: userShare } = useUserShare(nftId);
  const { data: pendingProduced } = usePendingProduced(nftId);
  const { data: pendingUsdt } = usePendingReward(nftId, CONTRACT_ADDRESSES.usdt);
  const { totalShares, availableShares, listedShares } = useUserSharesInfo(nftId);
  const claimProduced = useClaimProduced();
  const claimReward = useClaimReward();
  
  // Dissolution proposal hooks
  const { data: dissolutionProposal } = useDissolutionProposal(nftId);
  const proposeDissolution = useProposeDissolution();
  const approveDissolution = useApproveDissolution();

  if (!pool || !userShare) {
    return (
      <div className="rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
        <div className="relative z-10 flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const config = NFT_CONFIG[pool.nftType as NFTType];
  const isLive = pool.status === NFTStatus.Live;
  const unlockedPercentage = (parseInt(pool.unlockedPeriods) / UNLOCK_CONFIG.unlockPeriods) * 100;

  const handleClaimProduced = async () => {
    try {
      await claimProduced.mutateAsync(nftId);
    } catch (error) {
      console.error("Failed to claim produced:", error);
    }
  };

  const handleClaimReward = async () => {
    try {
      await claimReward.mutateAsync(nftId, CONTRACT_ADDRESSES.usdt);
    } catch (error) {
      console.error("Failed to claim reward:", error);
    }
  };

  const handleProposeDissolution = async () => {
    try {
      await proposeDissolution.mutateAsync(nftId);
      toast.success('解散提议已提交！');
    } catch (error: unknown) {
      console.error("Failed to propose dissolution:", error);
      toast.error(error instanceof Error ? error.message : '解散提议失败');
    }
  };

  const handleApproveDissolution = async () => {
    try {
      await approveDissolution.mutateAsync(nftId);
      toast.success('已同意解散提议！');
    } catch (error: unknown) {
      console.error("Failed to approve dissolution:", error);
      toast.error(error instanceof Error ? error.message : '同意解散失败');
    }
  };

  return (
    <div className={cn(
      "rounded-2xl border p-4 sm:p-6 relative overflow-hidden transition-all",
      isLive ? "border-green-700/50" : "border-gray-700/50"
    )}>
      <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-lg border border-[#B1C72E]">
              <Shield className="h-4 w-4 sm:h-6 sm:w-6 text-[#B1C72E]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">
                {pool.nftType === NFTType.Standard ? tTypes('standard.name') : tTypes('premium.name')} #{nftId}
              </h3>
              <div className="text-xs sm:text-sm text-gray-300 space-y-1">
                <p>总份额: {totalShares}/{config.sharesPerNFT}</p>
                {listedShares > 0 && (
                  <p className="text-orange-400">已挂单: {listedShares}</p>
                )}
                <p className="text-[#B1C72E]">可出售: {availableShares}</p>
              </div>
            </div>
          </div>
          <span className={cn(
            "rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium",
            isLive 
              ? "bg-green-900/30 text-green-400 border border-green-700/50"
              : "bg-gray-800/50 text-gray-400 border border-gray-700/50"
          )}>
            {isLive ? tStatus('live') : tStatus('dissolved')}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-lg border border-gray-700/50 p-2 sm:p-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <p className="text-xs text-gray-400">{t('lockedEclv')}</p>
              <p className="mt-1 text-base sm:text-lg font-semibold text-white">
                {formatTokenAmount(pool.unlockedNotWithdrawn, 18, 0)}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-700/50 p-2 sm:p-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <p className="text-xs text-gray-400">{t('unlocked')}</p>
              <p className="mt-1 text-base sm:text-lg font-semibold text-white">
                {unlockedPercentage.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Pending Rewards */}
        <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-purple-700/50 p-2 sm:p-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-purple-900/20 opacity-20"></div>
            <div className="relative z-10 flex items-center justify-between w-full">
              <div>
                <p className="text-xs text-purple-300">{t('pendingEclv')}</p>
                <p className="mt-1 text-sm sm:text-lg font-semibold text-white">
                  {pendingProduced ? formatTokenAmount(pendingProduced, 18, 4) : "0"}
                </p>
              </div>
              <button
                onClick={handleClaimProduced}
                disabled={!pendingProduced || pendingProduced === "0" || pendingProduced === "0.0" || parseFloat(pendingProduced) <= 0 || claimProduced.isLoading}
                className={cn(
                  "rounded-lg px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium transition-colors",
                  pendingProduced && pendingProduced !== "0"
                    ? "bg-[#B1C72E] text-black hover:bg-[#9db026]"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
              >
                {claimProduced.isLoading ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  t('claim')
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-green-700/50 p-2 sm:p-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-green-900/20 opacity-20"></div>
            <div className="relative z-10 flex items-center justify-between w-full">
              <div>
                <p className="text-xs text-green-300">{t('pendingUsdt')}</p>
                <p className="mt-1 text-sm sm:text-lg font-semibold text-white">
                  {pendingUsdt ? formatTokenAmount(pendingUsdt, 18, 4) : "0"}
                </p>
              </div>
              <button
                onClick={handleClaimReward}
                disabled={!pendingUsdt || pendingUsdt === "0" || pendingUsdt === "0.0" || parseFloat(pendingUsdt) <= 0 || claimReward.isLoading}
                className={cn(
                  "rounded-lg px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium transition-colors",
                  pendingUsdt && pendingUsdt !== "0"
                    ? "bg-[#B1C72E] text-black hover:bg-[#9db026]"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
              >
                {claimReward.isLoading ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  t('claim')
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Dissolution Proposal Section */}
        {isLive && dissolutionProposal?.exists && !dissolutionProposal.executed && (
          <div className="mt-3 sm:mt-4 p-3 border border-orange-700/50 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-orange-900/20 opacity-20"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">解散提议进行中</span>
              </div>
              <div className="text-xs text-orange-300 mb-2">
                提议者: {dissolutionProposal.proposer.slice(0, 6)}...{dissolutionProposal.proposer.slice(-4)}
              </div>
              <div className="text-xs text-orange-300 mb-3">
                投票进度: {dissolutionProposal.approvalCount}/{dissolutionProposal.totalShareholderCount}
              </div>
              <button
                onClick={handleApproveDissolution}
                disabled={approveDissolution.isLoading}
                className="w-full rounded-lg bg-[#B1C72E] text-black px-3 py-2 text-xs font-medium hover:bg-[#9db026] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
              >
                {approveDissolution.isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>处理中...</span>
                  </>
                ) : (
                  <>
                    <Vote className="h-3 w-3" />
                    <span>同意解散</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 sm:mt-4 flex space-x-1.5 sm:space-x-2">
          <Link
            href={`/nfts/${nftId}`}
            className="flex-1 rounded-lg border border-gray-700/50 px-3 sm:px-4 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-medium text-white hover:bg-gray-800 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <span className="relative z-10">{tCommon('details')}</span>
          </Link>
          <Link
            href={`/nfts/${nftId}/transfer`}
            className="flex-1 rounded-lg border border-gray-700/50 px-3 sm:px-4 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-medium text-white hover:bg-gray-800 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <span className="relative z-10">{tCommon('transfer')}</span>
          </Link>
          {/* Propose Dissolution Button - only show if NFT is live, no existing proposal, and has started releasing */}
          {isLive && !dissolutionProposal?.exists && unlockedPercentage > 0 && (
            <button
              onClick={handleProposeDissolution}
              disabled={proposeDissolution.isLoading}
              className="flex-1 rounded-lg border border-red-700/50 px-3 sm:px-4 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-medium text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-red-900/20 opacity-20"></div>
              <div className="relative z-10 flex items-center justify-center space-x-1">
                {proposeDissolution.isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>处理中...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    <span>提议解散</span>
                  </>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Created Date */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-700/50">
          <p className="text-xs text-gray-400">
            {t('created')}: {formatDate(pool.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MyNFTsPage() {
  const t = useTranslations('myNfts');
  const tCommon = useTranslations('common');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();
  const batchClaim = useBatchClaimProduced();
  const [isBatchClaiming, setIsBatchClaiming] = useState(false);

  const handleBatchClaim = async () => {
    if (!web3Data.nfts || web3Data.nfts.length === 0) return;
    setIsBatchClaiming(true);
    try {
      const nftIds = web3Data.nfts.map(nft => nft.id);
      await batchClaim.mutateAsync(nftIds);
    } catch (error) {
      console.error("Failed to batch claim:", error);
    } finally {
      setIsBatchClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('title')}</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-300">
              {t('subtitle')}
            </p>
          </div>
          
          {/* Quick Mint Button - Responsive */}
          <Link
            href="/mint"
            className="shrink-0 inline-flex items-center justify-center space-x-1 sm:space-x-2 rounded-lg bg-[#B1C72E] px-2 sm:px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-[#9db026] transition-colors"
            title="快速铸造"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">快速铸造</span>
          </Link>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-2xl border border-gray-700/50 p-6 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <Shield className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
              <h3 className="mt-2 sm:mt-4 text-base sm:text-lg font-medium text-white">
                {t('connectWallet.title')}
              </h3>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-300">
                {t('connectWallet.description')}
              </p>
            </div>
          </div>
        ) : web3Data.loading.nfts ? (
          /* Loading State */
          <div className="flex items-center justify-center py-6 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
          </div>
        ) : !web3Data.nfts || web3Data.nfts.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl border border-gray-700/50 p-6 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <Shield className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
              <h3 className="mt-2 sm:mt-4 text-base sm:text-lg font-medium text-white">
                {t('empty.title')}
              </h3>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-300">
                {t('empty.description')}
              </p>
              <Link
                href="/mint"
                className="mt-4 sm:mt-6 inline-flex items-center space-x-2 rounded-lg bg-[#B1C72E] px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-black shadow-sm hover:bg-[#9db026]"
              >
                <span>{t('empty.cta')}</span>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* NFT Grid */
          <>
            {/* Batch Actions */}
            {web3Data.nfts.length > 1 && (
              <div className="mb-4 sm:mb-6 flex items-center justify-between rounded-2xl border border-gray-700/50 p-3 sm:p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                <div className="relative z-10 flex items-center justify-between w-full">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-white">
                      {t('batchActions.nftsFound')} {web3Data.nfts.length}
                    </p>
                    <p className="text-xs text-gray-300">
                      {t('batchActions.claimAll')}
                    </p>
                  </div>
                  <button
                    onClick={handleBatchClaim}
                    disabled={isBatchClaiming}
                    className="inline-flex items-center space-x-1 sm:space-x-2 rounded-lg bg-[#B1C72E] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-black hover:bg-[#9db026] disabled:opacity-50"
                  >
                    {isBatchClaiming ? (
                      <>
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        <span>{t('batchActions.claiming')}</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>{t('batchActions.batchClaim')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* NFT Cards */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Existing NFT Cards */}
              {web3Data.nfts.map((nft: any) => (
                <NFTCard key={nft.id} nftId={nft.id} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

