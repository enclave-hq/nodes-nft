"use client";

import { useState } from "react";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { useActiveBatch } from "@/lib/hooks/useBatches";
import { useWallet } from "@/lib/providers/WalletProvider";
import { AlertTriangle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhitelistModal } from "@/components/WhitelistModal";
import { useTranslations } from "@/lib/i18n/provider";

/**
 * Mint Status Banner - Displays minting status at the top of the page
 * Shows three states:
 * 1. Not whitelisted: Please apply for whitelist first
 * 2. Has mintable quota: This batch can mint: xxxx
 * 3. No mintable quota: Please wait for the next batch to open for minting
 */
export function MintStatusBanner() {
  const t = useTranslations('mintStatus');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();
  const { batch: activeBatch } = useActiveBatch();
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    return (
      <>
        <div className="mb-4 sm:mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-3 sm:p-4">
          <div className="flex items-center justify-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm sm:text-base font-medium text-yellow-900">
              {t('applyWhitelistFirst')}{' '}
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-yellow-700 underline hover:text-yellow-800 font-semibold mx-1 cursor-pointer"
              >
                {t('applyWhitelist')}
              </button>
            </span>
          </div>
        </div>
        <WhitelistModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </>
    );
  }

  // State 2: Has mintable quota
  if (activeBatch && remainingMintCount > 0) {
    return (
      <div className="mb-4 sm:mb-6 rounded-lg bg-blue-50 border border-blue-200 p-3 sm:p-4">
        <div className="flex items-center justify-center space-x-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <span className="text-sm sm:text-base font-medium text-blue-900">
            {t('batchMintable')} <span className="font-bold">{remainingMintCount}</span>
          </span>
        </div>
      </div>
    );
  }

  // State 3: No mintable quota
  return (
    <div className="mb-4 sm:mb-6 rounded-lg bg-gray-50 border border-gray-200 p-3 sm:p-4">
      <div className="flex items-center justify-center space-x-2">
        <AlertTriangle className="h-5 w-5 text-gray-600" />
        <span className="text-sm sm:text-base font-medium text-gray-900">
          {t('waitForNextBatch')}
        </span>
      </div>
    </div>
  );
}




