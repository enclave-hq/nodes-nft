"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useMintNFT } from "@/lib/hooks/useNFTManager";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatTokenAmount, formatUSD, cn } from "@/lib/utils";
import { NFT_CONFIG, NFTType, UNLOCK_CONFIG } from "@/lib/contracts/config";
import { Shield, Check, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n/provider";
import toast from 'react-hot-toast';
import { GradientButton } from "@/components/ui/gradient-button";

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
  const tNftTypes = useTranslations('home.nftTypes');
  const config = NFT_CONFIG[nftType];
  const isPremium = nftType === NFTType.Premium;
  
  // Convert NFTType enum to string key for translations
  const typeKey = nftType === NFTType.Standard ? 'standard' : 'premium';

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "relative w-full rounded-2xl border p-8 text-left transition-all overflow-hidden",
        isPremium
          ? selected
            ? "border-[#B1C72E]"
            : "border-gray-700/50"
          : selected
            ? "border-[#b1c62f]"
            : "border-[#b1c62f]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {isPremium ? (
        // Premium NFT - matches homepage premium style
        <>
          <div className={cn(
            "absolute inset-0",
            selected ? "bg-[#B1C72E]" : "bg-[#252532] opacity-20"
          )}></div>
          <div className="relative z-10">
            {/* Title with Selection Indicator */}
            <div className="flex items-center justify-between">
              <h3 className={cn(
                "text-2xl font-bold",
                selected ? "text-black" : "text-white"
              )}>
                {tNftTypes(`${typeKey}.name`)}
              </h3>
              {selected && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black">
                  <Check className="h-5 w-5 text-[#B1C72E]" />
                </div>
              )}
            </div>

            {/* Price */}
            <p className="mt-4 flex items-baseline gap-x-2">
              <span className={cn(
                "text-5xl font-bold tracking-tight",
                selected ? "text-black" : "text-white"
              )}>
                {formatUSD(parseFloat(config.mintPrice))}
              </span>
              <span className={cn(
                "text-sm font-semibold leading-6",
                selected ? "text-black/70" : "text-gray-300"
              )}>USDT</span>
            </p>

            {/* Features */}
            <ul className="mt-8 space-y-3 text-sm leading-6">
              <li className="flex gap-x-3">
                <span className={selected ? "text-black" : "text-white"}>✓</span>
                <span className={selected ? "text-black/80" : "text-gray-300"}>
                  {tNftTypes(`${typeKey}.features.quota`, { amount: formatTokenAmount(config.eLockAmount, 0, 0) })}
                </span>
              </li>
              <li className="flex gap-x-3">
                <span className={selected ? "text-black" : "text-white"}>✓</span>
                <span className={selected ? "text-black/80" : "text-gray-300"}>
                  {tNftTypes(`${typeKey}.features.shares`, { count: config.sharesPerNFT })}
                </span>
              </li>
              <li className="flex gap-x-3">
                <span className={selected ? "text-black" : "text-white"}>✓</span>
                <span className={selected ? "text-black/80" : "text-gray-300"}>
                  {tNftTypes(`${typeKey}.features.weight`)}
                </span>
              </li>
              <li className="flex gap-x-3">
                <span className={selected ? "text-black" : "text-white"}>✓</span>
                <span className={selected ? "text-black/80" : "text-gray-300"}>
                  {tNftTypes(`${typeKey}.features.unlock`)}
                </span>
              </li>
            </ul>
          </div>
        </>
      ) : (
        // Standard NFT - matches homepage standard style
        <>
          <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
          <div className="relative z-10">
            {/* Title with Selection Indicator */}
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#B1C72E]">
                {tNftTypes(`${typeKey}.name`)}
              </h3>
              {selected && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B1C72E]">
                  <Check className="h-5 w-5 text-black" />
                </div>
              )}
            </div>

            {/* Price */}
            <p className="mt-4 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-[#B1C72E]">
                {formatUSD(parseFloat(config.mintPrice))}
              </span>
              <span className="text-sm font-semibold leading-6 text-[#B1C72E]">USDT</span>
            </p>

            {/* Features */}
            <ul className="mt-8 space-y-3 text-sm leading-6 text-[#B1C72E]">
              <li className="flex gap-x-3">
                <span className="text-[#B1C72E]">✓</span>
                {tNftTypes(`${typeKey}.features.quota`, { amount: formatTokenAmount(config.eLockAmount, 0, 0) })}
              </li>
              <li className="flex gap-x-3">
                <span className="text-[#B1C72E]">✓</span>
                {tNftTypes(`${typeKey}.features.shares`, { count: config.sharesPerNFT })}
              </li>
              <li className="flex gap-x-3">
                <span className="text-[#B1C72E]">✓</span>
                {tNftTypes(`${typeKey}.features.weight`)}
              </li>
              <li className="flex gap-x-3">
                <span className="text-[#B1C72E]">✓</span>
                {tNftTypes(`${typeKey}.features.unlock`)}
              </li>
            </ul>
          </div>
        </>
      )}
    </button>
  );
}

function MintContent() {
  const t = useTranslations('mint');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected, address } = useWallet();
  const web3Data = useWeb3Data();
  const { mintNFT, minting, error } = useMintNFT();

  // Get default type from URL params
  const defaultType = searchParams.get("type");
  const [selectedType, setSelectedType] = useState<NFTType>(
    defaultType === "premium" ? NFTType.Premium : NFTType.Standard
  );

  const config = NFT_CONFIG[selectedType];
  
  // Simple numeric comparison (both values are already in USDT units)
  const mintPrice = parseFloat(config.mintPrice); // 10000 USDT
  const usdtBalance = web3Data.balances ? parseFloat(web3Data.balances.usdt) : 0; // 10100000.0 USDT
  
  // Check if user has enough USDT balance (only requirement)
  const hasEnoughUSDT = usdtBalance >= mintPrice;
  const canMint = hasEnoughUSDT;

  const handleMint = async () => {
    if (!canMint) return;

    try {
      const result = await mintNFT(selectedType, address || "");
      console.log("NFT minted successfully:", result);
      // Redirect to My NFTs page after successful mint
      router.push("/my-nfts");
    } catch (error: any) {
      console.error("Failed to mint NFT:", error);
      toast.error(error.message || "Failed to mint NFT");
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="mt-2 text-gray-300">
            {t('subtitle')}
          </p>
        </div>

        {!isConnected ? (
          /* Not Connected State */
          <div className="rounded-2xl border border-gray-700/50 p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <Shield className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-white">
                {t('connectWallet.title')}
              </h3>
              <p className="mt-2 text-sm text-gray-300">
                {t('connectWallet.description')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* NFT Type Selection */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">
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
            </div>

            {/* Summary & Action */}
            <div>
              {/* Mint Button - outside and above the summary card */}
              <div className="mb-4">
                <GradientButton
                  onClick={handleMint}
                  disabled={!canMint || minting}
                  variant="green"
                  className={cn(
                    "w-full text-black py-4",
                    (!canMint || minting) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {minting ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('minting')}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      {t('mintButton')} {config.name}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </span>
                  )}
                </GradientButton>

                {minting && (
                  <p className="mt-2 text-center text-xs text-gray-400">
                    {t('confirmTransaction')}
                  </p>
                )}
              </div>

              <div className="rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                <div className="relative z-10">
                {/* Requirements */}
                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-300">{t('summary.requiredPayment')}</p>
                    <div className="mt-2 space-y-2">
                      <div className={cn(
                        "flex items-center justify-between rounded-lg border border-gray-700/50 p-3 relative overflow-hidden",
                        hasEnoughUSDT ? "" : ""
                      )}>
                        <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
                        <span className="text-sm text-white relative z-10">
                          {formatTokenAmount(config.mintPrice, 0, 0)} USDT
                        </span>
                        <div className="relative z-10">
                          {hasEnoughUSDT ? (
                            <Check className="h-5 w-5 text-[#B1C72E]" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Your Balance */}
                  {web3Data.balances && (
                    <div>
                      <p className="text-sm font-medium text-gray-300">{t('summary.yourBalance')}</p>
                      <div className="mt-2 space-y-1 text-sm text-gray-300">
                        <div className="flex justify-between">
                          <span>USDT余额:</span>
                          <span className="font-medium text-white">
                            {web3Data.balances.usdt}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>USDT授权:</span>
                          <span className="font-medium text-white">
                            {web3Data.loading.allowances ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              formatTokenAmount(web3Data.allowances.usdt, 18, 2)
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        {t('summary.note')} {formatTokenAmount(config.eLockAmount, 0, 0)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {!canMint && web3Data.balances && (
                  <div className="mt-4 rounded-lg border border-yellow-700/50 p-3 relative overflow-hidden">
                    <div className="absolute inset-0 bg-yellow-900/20 opacity-20"></div>
                    <div className="relative z-10 flex gap-x-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-400" />
                      <div className="text-sm text-yellow-300">
                        <p className="font-medium">{t('summary.insufficientBalance')}</p>
                        <p className="mt-1">
                          {t('summary.needAmount')} {formatTokenAmount(config.mintPrice, 0, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* How it Works */}
            <div className="mt-8 rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white">
                  {t('howItWorks.title')}
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#B1C72E] text-xs font-bold text-black">
                      0
                    </div>
                    <p className="text-sm text-gray-300">
                      {t('howItWorks.step0')}
                    </p>
                  </div>
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#B1C72E] text-xs font-bold text-black">
                      1
                    </div>
                    <p className="text-sm text-gray-300">
                      {t('howItWorks.step1')} {formatUSD(parseFloat(config.mintPrice))} {formatTokenAmount(config.eLockAmount, 0, 0)}
                    </p>
                  </div>
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#B1C72E] text-xs font-bold text-black">
                      2
                    </div>
                    <p className="text-sm text-gray-300">
                      {t('howItWorks.step2')}
                    </p>
                  </div>
                  <div className="flex gap-x-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#B1C72E] text-xs font-bold text-black">
                      3
                    </div>
                    <p className="text-sm text-gray-300">
                      {t('howItWorks.step3')}
                    </p>
                  </div>
                </div>
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
      <div className="min-h-screen bg-black">
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

