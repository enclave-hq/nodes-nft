"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useMintNFT } from "@/lib/hooks/useNFTManager";
import { useBalances } from "@/lib/hooks/useBalances";
import { formatTokenAmount, formatUSD, cn } from "@/lib/utils";
import { NFT_CONFIG, NFTType, UNLOCK_CONFIG } from "@/lib/contracts/config";
import { Shield, Check, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n/provider";

function NFTTypeCard({
  nftType,
  selected,
  onSelect,
  disabled,
}: {
  nftType: NFTType;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const t = useTranslations('mint');
  const tHome = useTranslations('home');
  const config = NFT_CONFIG[nftType];
  const isPremium = nftType === NFTType.Premium;
  
  // Convert NFTType enum to string key for translations
  const typeKey = nftType === NFTType.Standard ? 'standard' : 'premium';

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "relative w-full rounded-2xl border-2 p-8 text-left transition-all",
        selected
          ? isPremium
            ? "border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100"
            : "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100"
          : "border-gray-200 bg-white hover:border-gray-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Selection Indicator */}
      {selected && (
        <div className={cn(
          "absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full",
          isPremium ? "bg-purple-600" : "bg-blue-600"
        )}>
          <Check className="h-5 w-5 text-white" />
        </div>
      )}

      {/* Best Value Badge */}
      {isPremium && (
        <div className="absolute left-4 top-4">
          <span className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-3 py-1 text-xs font-semibold text-white">
            {t('bestValue')}
          </span>
        </div>
      )}

      {/* Icon */}
      <div className={cn(
        "flex h-16 w-16 items-center justify-center rounded-xl",
        isPremium
          ? "bg-gradient-to-br from-purple-500 to-purple-700"
          : "bg-gradient-to-br from-blue-500 to-blue-700"
      )}>
        <Shield className="h-8 w-8 text-white" />
      </div>

      {/* Title & Price */}
      <h3 className="mt-6 text-2xl font-bold text-gray-900">
        {config.name}
      </h3>
      <p className="mt-2 flex items-baseline gap-x-2">
        <span className="text-4xl font-bold tracking-tight text-gray-900">
          {formatUSD(parseFloat(config.mintPrice))}
        </span>
        <span className="text-sm font-semibold text-gray-600">USDT</span>
      </p>

      {/* Features */}
      <ul className="mt-6 space-y-3">
        <li className="flex gap-x-3 text-sm">
          <Check className={cn(
            "h-5 w-5 flex-shrink-0",
            isPremium ? "text-purple-600" : "text-blue-600"
          )} />
          <span className="text-gray-700">
            {tHome(`nftTypes.${typeKey}.features.quota`, { amount: formatTokenAmount(config.eclvLockAmount, 0, 0) })}
          </span>
        </li>
        <li className="flex gap-x-3 text-sm">
          <Check className={cn(
            "h-5 w-5 flex-shrink-0",
            isPremium ? "text-purple-600" : "text-blue-600"
          )} />
          <span className="text-gray-700">
            {tHome(`nftTypes.${typeKey}.features.shares`, { count: config.sharesPerNFT })}
          </span>
        </li>
        <li className="flex gap-x-3 text-sm">
          <Check className={cn(
            "h-5 w-5 flex-shrink-0",
            isPremium ? "text-purple-600" : "text-blue-600"
          )} />
          <span className="text-gray-700">
            {tHome(`nftTypes.${typeKey}.weight`)}
          </span>
        </li>
        <li className="flex gap-x-3 text-sm">
          <Check className={cn(
            "h-5 w-5 flex-shrink-0",
            isPremium ? "text-purple-600" : "text-blue-600"
          )} />
          <span className="text-gray-700">
            {tHome(`nftTypes.${typeKey}.unlock`)}
          </span>
        </li>
      </ul>
    </button>
  );
}

function MintContent() {
  const t = useTranslations('mint');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useWallet();
  const { data: balances } = useBalances();
  const mintNFT = useMintNFT();

  // Get default type from URL params
  const defaultType = searchParams.get("type");
  const [selectedType, setSelectedType] = useState<NFTType>(
    defaultType === "premium" ? NFTType.Premium : NFTType.Standard
  );

  const config = NFT_CONFIG[selectedType];
  const mintPriceBigInt = BigInt(config.mintPrice + "000000000000000000"); // Add 18 decimals
  // Note: eclvLockAmount is just a quota, user doesn't need to have ECLV

  // Check if user has enough USDT balance (only requirement)
  const hasEnoughUSDT = balances ? balances.usdt >= mintPriceBigInt : false;
  const canMint = hasEnoughUSDT;

  const handleMint = async () => {
    if (!canMint) return;

    try {
      const result = await mintNFT.mutateAsync({ nftType: selectedType });
      // Redirect to My NFTs page after successful mint
      router.push("/my-nfts");
    } catch (error: any) {
      console.error("Failed to mint NFT:", error);
      alert(error.message || "Failed to mint NFT");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
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
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* NFT Type Selection */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('selectType')}
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <NFTTypeCard
                  nftType={NFTType.Standard}
                  selected={selectedType === NFTType.Standard}
                  onSelect={() => setSelectedType(NFTType.Standard)}
                  disabled={false}
                />
                <NFTTypeCard
                  nftType={NFTType.Premium}
                  selected={selectedType === NFTType.Premium}
                  onSelect={() => setSelectedType(NFTType.Premium)}
                  disabled={false}
                />
              </div>

              {/* How it Works */}
              <div className="mt-8 rounded-lg bg-blue-50 p-6">
                <h3 className="text-lg font-semibold text-blue-900">
                  {t('howItWorks.title')}
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      0
                    </div>
                    <p className="text-sm text-blue-800">
                      {t('howItWorks.step0')}
                    </p>
                  </div>
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      1
                    </div>
                    <p className="text-sm text-blue-800">
                      {t('howItWorks.step1', { 
                        price: formatUSD(parseFloat(config.mintPrice)),
                        amount: formatTokenAmount(config.eclvLockAmount, 0, 0)
                      })}
                    </p>
                  </div>
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      2
                    </div>
                    <p className="text-sm text-blue-800">
                      {t('howItWorks.step2')}
                    </p>
                  </div>
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      3
                    </div>
                    <p className="text-sm text-blue-800">
                      {t('howItWorks.step3')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary & Action */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 rounded-lg bg-white p-6 shadow-lg ring-1 ring-gray-900/5">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('summary.title')}
                </h3>

                {/* Requirements */}
                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('summary.requiredPayment')}</p>
                    <div className="mt-2 space-y-2">
                      <div className={cn(
                        "flex items-center justify-between rounded-lg p-3",
                        hasEnoughUSDT ? "bg-green-50" : "bg-red-50"
                      )}>
                        <span className="text-sm text-gray-700">
                          {formatTokenAmount(config.mintPrice, 0, 0)} USDT
                        </span>
                        {hasEnoughUSDT ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Your Balance */}
                  {balances && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">{t('summary.yourBalance')}</p>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>USDT:</span>
                          <span className="font-medium">
                            {formatTokenAmount(balances.usdt, 18, 2)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {t('summary.note', { amount: formatTokenAmount(config.eclvLockAmount, 0, 0) })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {!canMint && balances && (
                  <div className="mt-4 rounded-lg bg-yellow-50 p-3">
                    <div className="flex gap-x-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">{t('summary.insufficientBalance')}</p>
                        <p className="mt-1">
                          {t('summary.needAmount', { amount: formatTokenAmount(config.mintPrice, 0, 0) })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mint Button */}
                <button
                  onClick={handleMint}
                  disabled={!canMint || mintNFT.isPending}
                  className={cn(
                    "mt-6 w-full rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all",
                    canMint && !mintNFT.isPending
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      : "bg-gray-300 cursor-not-allowed"
                  )}
                >
                  {mintNFT.isPending ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('minting')}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      {t('mintButton', { type: config.name })}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </span>
                  )}
                </button>

                {mintNFT.isPending && (
                  <p className="mt-2 text-center text-xs text-gray-500">
                    {t('confirmTransaction')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    }>
      <MintContent />
    </Suspense>
  );
}

