"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useUserNFTs, useNFTPool, useUserShare, usePendingProduced, usePendingReward, useClaimProduced, useClaimReward, useBatchClaimProduced } from "@/lib/hooks/useNFTManager";
import { formatTokenAmount, formatDate, cn } from "@/lib/utils";
import { NFT_CONFIG, NFTType, NFTStatus, UNLOCK_CONFIG, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { Shield, TrendingUp, Lock, Unlock, Share2, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/provider";

function NFTCard({ nftId }: { nftId: number }) {
  const t = useTranslations('myNfts.nftCard');
  const tStatus = useTranslations('status');
  const tTypes = useTranslations('nftTypes');
  const { account } = useWallet();
  const { data: pool } = useNFTPool(nftId);
  const { data: userShare } = useUserShare(nftId);
  const { data: pendingProduced } = usePendingProduced(nftId);
  const { data: pendingUsdt } = usePendingReward(nftId, CONTRACT_ADDRESSES.usdt);
  const claimProduced = useClaimProduced();
  const claimReward = useClaimReward();

  if (!pool || !userShare) return null;

  const config = NFT_CONFIG[pool.nftType as NFTType];
  const isLive = pool.status === NFTStatus.Live;
  const unlockedPercentage = (pool.unlockedPeriods / UNLOCK_CONFIG.unlockPeriods) * 100;

  const handleClaimProduced = async () => {
    try {
      await claimProduced.mutateAsync({ nftId });
    } catch (error) {
      console.error("Failed to claim produced:", error);
    }
  };

  const handleClaimReward = async () => {
    if (!CONTRACT_ADDRESSES.usdt) return;
    try {
      await claimReward.mutateAsync({ nftId, token: CONTRACT_ADDRESSES.usdt });
    } catch (error) {
      console.error("Failed to claim reward:", error);
    }
  };

  return (
    <div className={cn(
      "rounded-xl border-2 bg-white p-6 shadow-sm transition-all hover:shadow-md",
      isLive ? "border-green-200" : "border-gray-200"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            pool.nftType === NFTType.Premium 
              ? "bg-gradient-to-br from-purple-500 to-purple-700"
              : "bg-gradient-to-br from-blue-500 to-blue-700"
          )}>
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {config.name} #{nftId}
            </h3>
            <p className="text-sm text-gray-500">
              {userShare.shares}/{config.sharesPerNFT} shares
            </p>
          </div>
        </div>
        <span className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          isLive 
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-700"
        )}>
          {isLive ? tStatus('live') : tStatus('dissolved')}
        </span>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">{t('lockedEclv')}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatTokenAmount(pool.totalEclvLocked, 18, 0)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">{t('unlocked')}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {unlockedPercentage.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Pending Rewards */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-purple-50 p-3">
          <div>
            <p className="text-xs text-purple-600">{t('pendingEclv')}</p>
            <p className="mt-1 text-lg font-semibold text-purple-900">
              {pendingProduced ? formatTokenAmount(pendingProduced, 18, 4) : "0"}
            </p>
          </div>
          <button
            onClick={handleClaimProduced}
            disabled={!pendingProduced || pendingProduced === BigInt(0) || claimProduced.isPending}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              pendingProduced && pendingProduced > BigInt(0)
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            {claimProduced.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('claim')
            )}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
          <div>
            <p className="text-xs text-green-600">{t('pendingUsdt')}</p>
            <p className="mt-1 text-lg font-semibold text-green-900">
              {pendingUsdt ? formatTokenAmount(pendingUsdt, 18, 4) : "0"}
            </p>
          </div>
          <button
            onClick={handleClaimReward}
            disabled={!pendingUsdt || pendingUsdt === BigInt(0) || claimReward.isPending}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              pendingUsdt && pendingUsdt > BigInt(0)
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            {claimReward.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('claim')
            )}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex space-x-2">
        <Link
          href={`/nfts/${nftId}`}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Details
        </Link>
        <Link
          href={`/nfts/${nftId}/transfer`}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Transfer
        </Link>
      </div>

      {/* Created Date */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Created: {formatDate(pool.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function MyNFTsPage() {
  const t = useTranslations('myNfts');
  const tCommon = useTranslations('common');
  const { isConnected } = useWallet();
  const { data: nftIds, isLoading } = useUserNFTs();
  const batchClaim = useBatchClaimProduced();
  const [isBatchClaiming, setIsBatchClaiming] = useState(false);

  const handleBatchClaim = async () => {
    if (!nftIds || nftIds.length === 0) return;
    setIsBatchClaiming(true);
    try {
      await batchClaim.mutateAsync({ nftIds });
    } catch (error) {
      console.error("Failed to batch claim:", error);
    } finally {
      setIsBatchClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t('connectWallet.title')}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t('connectWallet.description')}
            </p>
          </div>
        ) : isLoading ? (
          /* Loading State */
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !nftIds || nftIds.length === 0 ? (
          /* Empty State */
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t('empty.title')}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t('empty.description')}
            </p>
            <Link
              href="/mint"
              className="mt-6 inline-flex items-center space-x-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-purple-700"
            >
              <span>{t('empty.cta')}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          /* NFT Grid */
          <>
            {/* Batch Actions */}
            {nftIds.length > 1 && (
              <div className="mb-6 flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t('batchActions.nftsFound', { count: nftIds.length })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('batchActions.claimAll')}
                  </p>
                </div>
                <button
                  onClick={handleBatchClaim}
                  disabled={isBatchClaiming}
                  className="inline-flex items-center space-x-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isBatchClaiming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('batchActions.claiming')}</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4" />
                      <span>{t('batchActions.batchClaim')}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* NFT Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {nftIds.map((nftId: number) => (
                <NFTCard key={nftId} nftId={nftId} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

