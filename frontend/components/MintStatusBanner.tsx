"use client";

import { useWeb3Data } from "@/lib/stores/web3Store";
import { useActiveBatch } from "@/lib/hooks/useBatches";
import { useWallet } from "@/lib/providers/WalletProvider";
import { AlertTriangle, Shield } from "lucide-react";
import { useTranslations } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { MintIcon } from "@/components/icons/MintIcon";

/**
 * Mint Status Banner - Displays minting status at the top of the page
 * Shows three states:
 * 1. Not whitelisted: Please apply for whitelist first
 * 2. Has mintable quota: This batch can mint: xxxx
 * 3. No mintable quota: Please wait for the next batch to open for minting
 * 
 * @param variant - 'dark' for black background with white text (default), 'light' for white background with black text and border
 */
export function MintStatusBanner({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const t = useTranslations('mintStatus');
  const tBatch = useTranslations('home.batch');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();
  const { batch: activeBatch } = useActiveBatch();

  // If wallet is not connected, don't display
  if (!isConnected) {
    return null;
  }

  const isWhitelisted = web3Data.whitelist.isWhitelisted;
  
  // Calculate remaining mintable count
  const remainingMintCount = activeBatch 
    ? Number(activeBatch.maxMintable) - Number(activeBatch.currentMinted)
    : 0;

  // State 1: Not whitelisted
  if (!isWhitelisted) {
    return null;
  }

  // State 2: Has mintable quota
  if (activeBatch && remainingMintCount > 0) {
    const isLight = variant === 'light';
    return (
      <div className={cn(
        "rounded-[20px] px-3 sm:px-4 py-2 h-[36px] flex items-center",
        isLight 
          ? "bg-[#FFFFFF] border border-[#000000]/10" 
          : "bg-[#000000]"
      )}>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <MintIcon className={cn(
              "h-4 w-4 flex-shrink-0",
              isLight ? "text-[#000000]" : "text-[#FFFFFF]"
            )} />
            <span className={cn(
              "font-medium whitespace-nowrap leading-none",
              "text-[12px] sm:text-[13px] md:text-sm",
              isLight ? "text-[#000000]" : "text-[#FFFFFF]"
            )}>
              {t('batchMintable')}
            </span>
          </div>
          <span className={cn(
            "font-bold flex-shrink-0 leading-none",
            "text-[12px] sm:text-[13px] md:text-sm",
            isLight ? "text-[#000000]" : "text-[#FFFFFF]"
          )}>
            {remainingMintCount}
          </span>
        </div>
      </div>
    );
  }

  // State 3: No mintable quota
  const isLight = variant === 'light';
  return (
    <div className={cn(
      "rounded-[20px] px-3 sm:px-4 py-2 h-[36px] flex items-center",
      isLight 
        ? "bg-gray-50 border border-gray-200" 
        : "bg-gray-50 border border-gray-200"
    )}>
      <div className="flex items-center justify-center space-x-2">
        <AlertTriangle className="h-4 w-4 text-gray-600" />
        <span className="text-[12px] sm:text-[13px] md:text-sm font-medium text-gray-900 leading-none">
          {tBatch('waitForNextBatch')}
        </span>
      </div>
    </div>
  );
}




