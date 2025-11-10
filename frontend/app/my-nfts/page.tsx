"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { useNFTPool, useGlobalState, usePendingProduced, usePendingReward, useAccRewardPerNFT, useRewardDebt, useClaimProduced, useClaimReward, useInitiateTermination, useConfirmTermination, useCancelTermination, useWithdrawUnlocked } from "@/lib/hooks/useNFTManager";
import { formatTokenAmount, formatDate, cn } from "@/lib/utils";
import { NFTStatus, NFT_UNIFIED_CONFIG, UNLOCK_CONFIG, TERMINATION_CONFIG, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { Shield, Loader2, Plus, AlertTriangle, Lock, Gift, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { MintStatusBanner } from "@/components/MintStatusBanner";
import { WhitelistModal } from "@/components/WhitelistModal";
import { useState, useEffect, useMemo } from "react";
import toast from 'react-hot-toast';
import { useTranslations } from "@/lib/i18n/provider";
import { useActiveBatch } from "@/lib/hooks/useBatches";
import { useMintNFT } from "@/lib/hooks/useNFTManager";

function NFTCard({ nftId, isExpanded, onToggle }: { nftId: number; isExpanded: boolean; onToggle: () => void }) {
  const t = useTranslations('myNfts.nftCard');
  const tTermination = useTranslations('myNfts.termination');
  const tTime = useTranslations('myNfts.time');
  const tTypes = useTranslations('nftTypes');
  const tCommon = useTranslations('common');
  
  // ALL HOOKS MUST BE CALLED AT THE TOP - BEFORE ANY CONDITIONAL RETURNS
  // Use real contract hooks
  const { data: pool } = useNFTPool(nftId);
  const { data: globalState } = useGlobalState();
  const { data: pendingProduced } = usePendingProduced(nftId);
  const { data: pendingUsdt } = usePendingReward(nftId, CONTRACT_ADDRESSES.usdt);
  const { data: totalUsdtReward } = useAccRewardPerNFT(CONTRACT_ADDRESSES.usdt);
  const { data: usdtRewardDebt } = useRewardDebt(nftId, CONTRACT_ADDRESSES.usdt);
  const claimProduced = useClaimProduced();
  const claimReward = useClaimReward();
  
  // Termination hooks
  const initiateTermination = useInitiateTermination();
  const confirmTermination = useConfirmTermination();
  const cancelTermination = useCancelTermination();
  const withdrawUnlocked = useWithdrawUnlocked();
  
  // State for termination confirmation dialog
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  
  // Calculate termination status - must be called even if pool is null
  const terminationStatus = useMemo(() => {
    if (!pool || pool.status !== NFTStatus.Terminating) {
      return null;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const initiatedAt = parseInt(pool.terminationInitiatedAt);
    if (initiatedAt === 0) return null;
    
    const cooldownEnd = initiatedAt + TERMINATION_CONFIG.cooldown;
    const timeoutEnd = cooldownEnd + TERMINATION_CONFIG.timeout;
    
    if (now < cooldownEnd) {
      return { phase: 'cooldown', timeRemaining: cooldownEnd - now };
    } else if (now < timeoutEnd) {
      return { phase: 'afterCooldown', timeRemaining: timeoutEnd - now };
    } else {
      return { phase: 'timeout', timeRemaining: 0 };
    }
  }, [pool]);

  // Calculate available unlocked amount - must be called even if pool is null
  const availableUnlocked = useMemo(() => {
    if (!pool || pool.status !== NFTStatus.Terminated) return "0";
    const unlocked = BigInt(pool.unlockedAmount || "0");
    const withdrawn = BigInt(pool.unlockedWithdrawn || "0");
    return unlocked > withdrawn ? String(unlocked - withdrawn) : "0";
  }, [pool]);

  // Early return AFTER all hooks have been called
  if (!pool) {
    return (
      <div className="rounded-[20px] bg-[#FFFFFF] border border-[#000000]/10 p-4 shadow-sm cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-center h-16">
          <Loader2 className="h-4 w-4 animate-spin text-[#000000]" />
        </div>
      </div>
    );
  }

  // All NFTs now have the same configuration
  const config = NFT_UNIFIED_CONFIG;
  const isActive = pool.status === NFTStatus.Active;
  const isTerminating = pool.status === NFTStatus.Terminating;
  const isTerminated = pool.status === NFTStatus.Terminated;
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

  const handleInitiateTermination = async () => {
    try {
      await initiateTermination.mutateAsync(nftId);
      toast.success(tTermination('initiated'));
      setShowTerminateDialog(false);
    } catch (error: unknown) {
      console.error("Failed to initiate termination:", error);
      const { simplifyErrorMessage } = await import("@/lib/utils");
      toast.error(simplifyErrorMessage(error, tTermination('initiateFailed')));
    }
  };

  const handleConfirmTermination = async () => {
    try {
      await confirmTermination.mutateAsync(nftId);
      toast.success(tTermination('confirmed'));
    } catch (error: unknown) {
      console.error("Failed to confirm termination:", error);
      const { simplifyErrorMessage } = await import("@/lib/utils");
      toast.error(simplifyErrorMessage(error, tTermination('confirmFailed')));
    }
  };

  const handleCancelTermination = async () => {
    try {
      await cancelTermination.mutateAsync(nftId);
      toast.success(tTermination('cancelled'));
    } catch (error: unknown) {
      console.error("Failed to cancel termination:", error);
      const { simplifyErrorMessage } = await import("@/lib/utils");
      toast.error(simplifyErrorMessage(error, tTermination('cancelFailed')));
    }
  };

  const handleWithdrawUnlocked = async () => {
    try {
      await withdrawUnlocked.mutateAsync(nftId);
      toast.success(tTermination('withdrawn'));
    } catch (error: unknown) {
      console.error("Failed to withdraw unlocked:", error);
      const { simplifyErrorMessage } = await import("@/lib/utils");
      toast.error(simplifyErrorMessage(error, tTermination('withdrawFailed')));
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    if (days > 0) return `${days}${tTime('days')}${hours}${tTime('hours')}`;
    if (hours > 0) return `${hours}${tTime('hours')}${minutes}${tTime('minutes')}`;
    return `${minutes}${tTime('minutes')}`;
  };

  // Collapsed view - only show NFT ID and status
  if (!isExpanded) {
    return (
      <div 
        className="relative rounded-[20px] bg-[#FFFFFF] border border-[#000000]/15 p-4 shadow-sm transition-all hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-[16px] font-bold text-[#000000]">
              NFT #{nftId}
            </h3>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              isActive ? "bg-[#CEF248] text-[#000000]" :
              isTerminating ? "bg-orange-600 text-white" :
              "bg-gray-300 text-[#000000]"
            )}>
              {isActive ? t('live') : isTerminating ? t('terminating') : t('terminated')}
            </span>
          </div>
          
          <button
            onClick={onToggle}
            className="flex items-center space-x-1 text-sm text-[#000000] hover:text-gray-600 transition-colors"
          >
            <span className="text-[14px]">{tCommon('viewDetails')}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded view - show all details
  return (
    <div className="relative rounded-[20px] bg-[#FFFFFF] border border-[#000000]/15 p-4 shadow-sm transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-bold text-[#000000]">
            NFT #{nftId}
          </h3>
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            isActive ? "bg-[#CEF248] text-[#000000]" :
            isTerminating ? "bg-orange-600 text-white" :
            "bg-gray-300 text-[#000000]"
          )}>
            {isActive ? t('live') : isTerminating ? t('terminating') : t('terminated')}
          </span>
        </div>
        
        <button
          onClick={onToggle}
          className="flex items-center space-x-1 text-sm text-[#000000] hover:text-gray-600 transition-colors"
        >
          <span className="text-[14px]">{tCommon('collapse')}</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      {/* $E Locked Section */}
      <div className="space-y-4">
        {/* $E Locked Section */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-100 p-2 rounded-lg text-center">
            <span className="text-sm font-bold text-[#000000] block">
              {formatTokenAmount(pool.remainingMintQuota, 18, 2)}
            </span>
            <span className="text-xs text-[#000000] block">{t('notUnlocked')}</span>
          </div>
          <div className="bg-gray-100 p-2 rounded-lg text-center">
            <span className="text-sm font-bold text-[#000000] block">
              {formatTokenAmount(pool.unlockedWithdrawn, 18, 6)}
            </span>
            <span className="text-xs text-gray-600 block">{t('withdrawnAmount')}</span>
          </div>
          <div className="bg-gray-100 p-2 rounded-lg text-center">
            <span className="text-sm font-bold text-[#000000] block">
              {formatTokenAmount(BigInt(pool.totalEclvLocked) - BigInt(pool.remainingMintQuota), 18, 2)}
            </span>
            <span className="text-xs text-[#000000] block">{t('unlocked')}</span>
          </div>
        </div>

        {/* $E Produced Section */}
        <div className="mb-3 px-3 pt-1 pb-3 bg-gray-100 rounded-lg" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-left">
              <span className="text-xs text-[#000000]">{t('totalProduced')} </span>
              <span className="text-xs text-[#000000]">
                {globalState ? formatTokenAmount(globalState.accProducedPerNFT, 18, 2) : "0"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-600">{t('withdrawnAmount')} </span>
              <span className="text-xs text-[#000000]">
                {pool?.producedDebt ? formatTokenAmount(pool.producedDebt, 18, 6) : "0"}
              </span>
            </div>
          </div>
          <div className="border-t border-[#000000]/10 mt-0 mb-2"></div>
          <div className="flex items-center justify-between">
            <div className="text-left">
              <span className="text-xs text-[#000000]">{t('availableForWithdrawal')} </span>
              <span className="text-[16px] font-bold text-[#000000]">
                {pendingProduced ? formatTokenAmount(pendingProduced, 18, 2) : "0"}
              </span>
            </div>
            <button
              onClick={handleClaimProduced}
              disabled={!pendingProduced || pendingProduced === "0" || pendingProduced === "0.0" || parseFloat(pendingProduced) <= 0 || claimProduced.isLoading}
              className={cn(
                "px-3 py-1.5 rounded-[20px] text-xs font-medium transition-all",
                pendingProduced && pendingProduced !== "0" && (isActive || isTerminating)
                  ? "bg-[#CEF248] text-black hover:bg-[#B8D93F]"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              )}
              title={t('claimProduced')}
            >
              {claimProduced.isLoading ? (
                <span className="flex items-center space-x-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t('claiming')}</span>
                </span>
              ) : (
                t('claimProduced')
              )}
            </button>
          </div>
        </div>

        {/* USDT Section */}
        <div className="mb-3 px-3 pt-1 pb-3 bg-gray-100 rounded-lg" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-left">
              <span className="text-xs text-[#000000]">{t('totalReward')} </span>
              <span className="text-xs text-[#000000]">
                {totalUsdtReward ? formatTokenAmount(totalUsdtReward, 18, 2) : "0"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-600">{t('withdrawnAmount')} </span>
              <span className="text-xs text-[#000000]">
                {usdtRewardDebt ? formatTokenAmount(usdtRewardDebt, 18, 6) : "0"}
              </span>
            </div>
          </div>
          <div className="border-t border-[#000000]/10 mt-0 mb-2"></div>
          <div className="flex items-center justify-between">
            <div className="text-left">
              <span className="text-xs text-[#000000]">{t('availableReward')} </span>
              <span className="text-[16px] font-bold text-[#000000]">
                {pendingUsdt ? formatTokenAmount(pendingUsdt, 18, 2) : "0"}
              </span>
            </div>
            <button
              onClick={handleClaimReward}
              disabled={!pendingUsdt || pendingUsdt === "0" || pendingUsdt === "0.0" || parseFloat(pendingUsdt) <= 0 || claimReward.isLoading}
              className={cn(
                "px-3 py-1.5 rounded-[20px] text-xs font-medium transition-all",
                pendingUsdt && pendingUsdt !== "0" && (isActive || isTerminating)
                  ? "bg-[#CEF248] text-black hover:bg-[#B8D93F]"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              )}
              title={t('claimReward')}
            >
              {claimReward.isLoading ? (
                <span className="flex items-center space-x-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t('claimingReward')}</span>
                </span>
              ) : (
                t('claimReward')
              )}
            </button>
          </div>
        </div>

        {/* Termination Status Section */}
        {isTerminating && terminationStatus && (
          <div className="mb-3 p-3 bg-gray-100 border border-orange-600/50 rounded-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">{tTermination('terminationInProgress')}</span>
            </div>
            
            {terminationStatus.phase === 'cooldown' && (
              <div className="space-y-2">
                <p className="text-xs text-orange-300">
                  {tTermination('cooldownRemaining').replace('{time}', formatTimeRemaining(terminationStatus.timeRemaining))}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancelTermination}
                    disabled={cancelTermination.isLoading}
                    className="flex-1 px-3 py-2 rounded-[20px] bg-[#CEF248] text-black text-xs font-medium hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                  >
                    {cancelTermination.isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{tTermination('processing')}</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        <span>{tTermination('resumeProduction')}</span>
                      </>
                    )}
                  </button>
                  <button
                    disabled
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-300 text-gray-600 text-xs font-medium cursor-not-allowed flex items-center justify-center space-x-1"
                  >
                    <Lock className="h-3 w-3" />
                    <span>{tTermination('confirmDuringCooldown')}</span>
                  </button>
                </div>
              </div>
            )}
            
            {terminationStatus.phase === 'afterCooldown' && (
              <div className="space-y-2">
                <p className="text-xs text-orange-300">
                  {tTermination('autoConfirmCountdown').replace('{time}', formatTimeRemaining(terminationStatus.timeRemaining))}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancelTermination}
                    disabled={cancelTermination.isLoading}
                    className="flex-1 px-3 py-2 rounded-[20px] bg-[#CEF248] text-black text-xs font-medium hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                  >
                    {cancelTermination.isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{tTermination('processing')}</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        <span>{tTermination('resumeProduction')}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleConfirmTermination}
                    disabled={confirmTermination.isLoading}
                    className="flex-1 px-3 py-2 rounded-[20px] bg-[#CEF248] text-black text-xs font-medium hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                  >
                    {confirmTermination.isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{tTermination('processing')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        <span>{tTermination('confirmTermination')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {terminationStatus.phase === 'timeout' && (
              <div className="text-xs text-orange-600">
                <p className="font-medium">{tTermination('autoTerminated')}</p>
                <p className="text-[#000000] mt-1">{tTermination('autoTerminatedDescription')}</p>
              </div>
            )}
          </div>
        )}

        {/* Withdraw Unlocked Section (for Terminated NFTs) */}
        {isTerminated && parseFloat(availableUnlocked) > 0 && (
          <div className="mb-3 p-3 bg-gray-100 border border-gray-300 rounded-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-[#000000]">{tTermination('unlockedWithdrawable')}</p>
                <p className="text-sm font-bold text-[#000000] mt-1">
                  {formatTokenAmount(availableUnlocked, 18, 6)} $E
                </p>
              </div>
              <button
                onClick={handleWithdrawUnlocked}
                disabled={withdrawUnlocked.isLoading || parseFloat(availableUnlocked) <= 0}
                className={cn(
                  "px-4 py-2 rounded-[20px] text-xs font-medium transition-all",
                  parseFloat(availableUnlocked) > 0
                    ? "bg-[#CEF248] text-black hover:bg-[#B8D93F]"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                )}
              >
                {withdrawUnlocked.isLoading ? (
                  <span className="flex items-center space-x-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{tTermination('withdrawing')}</span>
                  </span>
                ) : (
                  tTermination('withdrawUnlockedAmount')
                )}
              </button>
            </div>
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-300" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-[#000000]">
            {formatDate(pool.createdAt)}
          </span>
          
          <div className="flex items-center space-x-2">
            {/* Terminate Button - only show if NFT is active */}
            {isActive && (
              <button
                onClick={() => setShowTerminateDialog(true)}
                disabled={initiateTermination.isLoading}
                className="px-3 py-1.5 rounded-[20px] bg-[#000000] text-[#FFFFFF] text-xs font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 transition-colors"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>{tTermination('terminate')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Termination Confirmation Dialog */}
        {showTerminateDialog && (
          <div className="fixed inset-0 z-[60] modal-backdrop pointer-events-none" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
            <div className="bg-[#FFFFFF] rounded-t-[28px] p-4 w-full max-h-[59.5vh] overflow-y-auto modal-content pointer-events-auto" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
              <h3 className="text-lg font-bold text-[#000000] mb-3">{tTermination('confirmTermination')} NFT</h3>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-700">
                  {tTermination('terminationWarning')}
                </p>
                <div className="bg-yellow-50 border border-yellow-600/50 rounded-lg p-2.5">
                  <p className="text-xs text-yellow-700 font-medium mb-1">{tTermination('terminationProcess')}</p>
                  <ul className="text-xs text-yellow-800 space-y-0.5 list-disc list-inside">
                    <li>{tTermination('cooldownInfo')}</li>
                    <li>{tTermination('cooldownCancel')}</li>
                    <li>{tTermination('autoTerminationInfo')}</li>
                    <li>{tTermination('withdrawAfterTermination')}</li>
                  </ul>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowTerminateDialog(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 bg-gray-100 text-sm font-medium text-[#000000] hover:bg-gray-200"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleInitiateTermination}
                  disabled={initiateTermination.isLoading}
                  className="flex-1 px-4 py-2 rounded-[20px] bg-[#CEF248] text-black text-sm font-medium hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {initiateTermination.isLoading ? (
                    <span className="flex items-center justify-center space-x-1">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{tCommon('loading')}</span>
                    </span>
                  ) : (
                    tTermination('confirmTermination')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NFTList({ nfts }: { nfts: Array<{ id: number }> }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (nftId: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nftId)) {
        newSet.delete(nftId);
      } else {
        newSet.add(nftId);
      }
      return newSet;
    });
  };

  // Remove duplicates by id, keeping the first occurrence
  const uniqueNFTs = nfts.filter((nft: { id: number }, index: number, self: Array<{ id: number }>) => 
    index === self.findIndex((n: { id: number }) => n.id === nft.id)
  );

  return (
    <div className="space-y-3">
      {uniqueNFTs.map((nft: { id: number }) => (
        <NFTCard 
          key={nft.id} 
          nftId={nft.id}
          isExpanded={expandedIds.has(nft.id)}
          onToggle={() => toggleExpand(nft.id)}
        />
      ))}
    </div>
  );
}

export default function MyNFTsPage() {
  const tMyNFTs = useTranslations('myNfts');
  const tBatch = useTranslations('home.batch');
  const tMint = useTranslations('home.mint');
  const tWhitelist = useTranslations('whitelist');
  const tMarketplace = useTranslations('marketplace');
  const tCommon = useTranslations('common');
  const { isConnected, address } = useWallet();
  const web3Data = useWeb3Data();
  const { batch: activeBatch, loading: batchLoading } = useActiveBatch();
  const { mintNFT, minting } = useMintNFT();
  const isWhitelisted = web3Data.whitelist.isWhitelisted;
  const whitelistLoading = web3Data.loading.whitelist;
  const [isWhitelistModalOpen, setIsWhitelistModalOpen] = useState(false);


  const handleMint = async () => {
    if (!isConnected || !address) {
      toast.error(tMyNFTs('connectWalletFirst'));
      return;
    }

    if (!isWhitelisted) {
      toast.error(tMyNFTs('whitelistRequired'));
      return;
    }

    if (!activeBatch) {
      toast.error(tBatch('noActiveBatchMint'));
      return;
    }

    if (!canMint) {
      toast.error(tBatch('batchSoldOutMint'));
      return;
    }

    try {
      await mintNFT();
      toast.success(tMint('mintSuccess'));
      // Refresh data after minting
      await web3Data.fetchWhitelist();
      // Refresh NFT list
      window.location.reload();
    } catch (error: any) {
      console.error('Mint error:', error);
      toast.error(error.message || tMyNFTs('mintFailed'));
    }
  };

  // Calculate remaining mint count
  const remainingMintCount = activeBatch 
    ? Number(activeBatch.maxMintable) - Number(activeBatch.currentMinted)
    : 0;
  const canMint = remainingMintCount > 0 && activeBatch?.active === true;

  const handleQuickMint = () => {
    if (!isConnected || !address) {
      toast.error(tMyNFTs('connectWalletFirst'));
      return;
    }

    if (!isWhitelisted) {
      toast.error(tMyNFTs('whitelistRequired'));
      // Scroll to invite code section
      const inviteSection = document.getElementById('invite-code-section');
      if (inviteSection) {
        inviteSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (!activeBatch) {
      toast.error(tBatch('noActiveBatchMint'));
      return;
    }

    if (!canMint) {
      toast.error(tBatch('batchSoldOutMint'));
      return;
    }

    handleMint();
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Navbar />

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8" style={{ paddingTop: 'calc(65px + 1rem)' }}>
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <h1 className="text-base font-bold text-[#000000]">{tMyNFTs('title')}</h1>
              <span className="text-sm text-gray-700">-</span>
              <p className="text-sm text-gray-700">
                {tMyNFTs('subtitle')}
              </p>
            </div>
            
            {/* Mint Status Banner and Action Buttons - Same row */}
            {isConnected && (
              <div className="flex items-center justify-between gap-4">
                <MintStatusBanner />
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Mint Button */}
                  <button
                    onClick={handleQuickMint}
                    disabled={!isConnected || !isWhitelisted || !activeBatch || !canMint || minting}
                    className="inline-flex items-center justify-center rounded-[20px] px-4 py-2 bg-[#CEF248] text-black hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                    title={!isConnected ? tMyNFTs('connectWalletFirst') : !isWhitelisted ? tMyNFTs('joinWhitelistFirst') : !activeBatch ? tBatch('noActiveBatch') : !canMint ? tMyNFTs('batchSoldOut') : tMyNFTs('quickMint')}
                  >
                    {minting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>{tCommon('loading')}</span>
                      </>
                    ) : (
                      <span>{tCommon('mint')}</span>
                    )}
                  </button>
                  
                  {/* Refresh Button */}
                  <RefreshButton size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-[20px] bg-[#FFFFFF] border border-[#000000]/10 p-4 text-center">
            <h3 className="text-base font-medium text-[#000000]">
              {tMarketplace('connectWallet.title')}
            </h3>
            <p className="mt-2 text-sm text-[#000000]">
              {tMyNFTs('connectWallet.description')}
            </p>
          </div>
        ) : web3Data.loading.nfts ? (
          /* Loading State */
          <div className="flex items-center justify-center py-6 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
          </div>
        ) : !web3Data.nfts || web3Data.nfts.length === 0 ? (
          /* Empty State with Invite Code and Minting */
          <div className="space-y-6">
            {/* Whitelist Registration Section */}
            {!isWhitelisted && (
              <div id="invite-code-section" className="rounded-[20px] border border-[#000000]/10 bg-[#FFFFFF] p-6 sm:p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 sm:h-10 sm:w-10 text-[#000000]" />
                </div>
                <h3 className="text-base font-bold text-[#000000] mb-2 text-center">
                  {tWhitelist('applyWhitelist')}
                </h3>
                <p className="text-sm sm:text-base text-[#000000] mb-6 text-center">
                  {tWhitelist('enterInviteCode')}
                </p>
                
                <div className="max-w-md mx-auto">
                  <button
                    onClick={() => setIsWhitelistModalOpen(true)}
                    className="w-full px-6 h-10 bg-[#CEF248] text-black rounded-[20px] hover:bg-[#B8D93F] font-semibold flex items-center justify-center space-x-2"
                  >
                    <Gift className="h-4 w-4" />
                    <span>{tWhitelist('applyWhitelist')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Whitelisted User Section - States 2 & 3 */}
            {isWhitelisted && (
              <div className="space-y-6">
                {/* Whitelist Status Card */}
                <div className="rounded-[28px] border-2 border-gray-300 bg-white p-6 sm:p-8">
                  <div className="text-center mb-4">
                    <Shield className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-[#CEF248]" />
                    <h3 className="mt-4 text-xl sm:text-2xl font-bold text-black">
                      {tMyNFTs('whitelisted')}
                    </h3>
                  </div>
                  
                  <div className="text-center">
                    <button
                      onClick={() => setIsWhitelistModalOpen(true)}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-[#CEF248] border-2 border-transparent text-black rounded-[20px] hover:bg-[#B8D93F] font-semibold transition-colors"
                    >
                      <Gift className="h-4 w-4" />
                      <span>{tMyNFTs('viewMyInviteCodes')}</span>
                    </button>
                  </div>
                </div>

                {/* Batch Info and Mint Section */}
                {batchLoading ? (
                  <div className="rounded-[28px] border-2 border-dashed border-gray-700 bg-[#000000] p-6 sm:p-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400 animate-spin" />
                    <p className="mt-4 text-gray-300">{tMyNFTs('loadingBatchInfo')}</p>
                  </div>
                ) : !activeBatch ? (
                  <div className="rounded-[28px] border-2 border-dashed border-yellow-600/50 bg-[#000000] p-6 sm:p-12 text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-yellow-400" />
                    <h3 className="mt-4 text-lg font-medium text-white">{tBatch('noActiveBatch')}</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      {tMyNFTs('noActiveBatchDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[28px] border-2 border-blue-600/50 bg-[#000000] p-6 sm:p-8">
                    <div className="max-w-2xl mx-auto">
                      {/* Batch Info Card */}
                      <div className="mb-6 rounded-lg bg-gray-800 p-4 sm:p-6 shadow-sm border border-blue-600/30">
                        <h4 className="text-lg font-semibold text-white mb-4">
                          {tMyNFTs('currentBatchInfo')}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">{tMyNFTs('batchId')}:</span>
                            <span className="font-semibold text-white">#{activeBatch.batchId}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">{tMyNFTs('mintPrice')}:</span>
                            <span className="font-semibold text-white">
                              {(Number(activeBatch.mintPrice) / 1e18).toFixed(2)} USDT
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">{tMyNFTs('progress')}:</span>
                            <span className="font-semibold text-white">
                              {activeBatch.currentMinted} / {activeBatch.maxMintable}
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                            <div 
                              className="bg-[#CEF248] h-2 rounded-full transition-all"
                              style={{ 
                                width: `${(Number(activeBatch.currentMinted) / Number(activeBatch.maxMintable)) * 100}%` 
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 text-center mt-1">
                            {((Number(activeBatch.currentMinted) / Number(activeBatch.maxMintable)) * 100).toFixed(1)}% {tMyNFTs('minted')}
                          </p>
                        </div>
                      </div>

                      {/* NFT Info */}
                      <div className="mb-6 rounded-lg bg-gray-800 p-4 text-sm text-gray-300">
                        <p className="mb-2">
                          <span className="font-semibold">{tMyNFTs('eachNFTContains')}:</span> {formatTokenAmount(NFT_UNIFIED_CONFIG.eLockAmount, 0, 0)} {tCommon('shares')} $E
                        </p>
                        <p className="mb-2">
                          <span className="font-semibold">{tMyNFTs('unlockMethod')}:</span> {tMyNFTs('monthsLinearUnlock')}
                        </p>
                      </div>

                      {/* Mint Button */}
                      <button
                        onClick={handleMint}
                        disabled={minting || !activeBatch || !canMint}
                        className="w-full px-6 py-3 bg-[#CEF248] text-black rounded-[20px] hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base flex items-center justify-center space-x-2 transition-all"
                      >
                        {minting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{tMint('minting')}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-5 w-5" />
                            <span>{tMint('mintNFT')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* NFT Grid */
          <>
            <NFTList nfts={web3Data.nfts} />
          </>
        )}
      </div>

      <WhitelistModal 
        isOpen={isWhitelistModalOpen} 
        onClose={() => setIsWhitelistModalOpen(false)} 
      />
    </div>
  );
}



