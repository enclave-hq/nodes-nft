"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatTokenAmount, formatUSD, cn } from "@/lib/utils";
import { NFT_CONFIG, NFTType } from "@/lib/contracts/config";
import { Coins, TrendingUp, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "@/lib/i18n/provider";
import { TokenBalance, NFTCount } from "@/lib/components/FormattedNumber";
import { GradientButton } from "@/components/ui/gradient-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";

export default function Home() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { isConnected, connect, isConnecting } = useWallet();
  const web3Data = useWeb3Data();

  return (
    <div className="min-h-screen bg-black relative">
      {/* Vector SVG in top right corner */}
      <div className="absolute top-0 right-0 z-0 pointer-events-none">
        <Image
          src="/Vector.svg"
          alt="Vector decoration"
          width={800}
          height={800}
          className="opacity-30"
        />
      </div>
      <Navbar />

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-0 sm:pt-0 pb-16 sm:pb-24">
        <div className="text-center">
          {/* Logo */}
          <div className="flex items-center justify-center mb-0 -mt-[32px]">
            <Image
              src="/ENCLAVAE3.svg"
              alt="Enclave Logo"
              width={432}
              height={432}
              className="h-[324px] w-[324px] pointer-events-none"
              onDragStart={(e) => e.preventDefault()}
              style={{ WebkitUserDrag: 'none' } as React.CSSProperties}
            />
          </div>
          
          {/* Content container - moved up 80% */}
          <div className="-mt-[80px]">
            {/* Horizontal line with gradient */}
            <div className="flex justify-center mb-4">
              <div 
                className="h-[0.5px] w-3/4 max-w-2xl" 
                style={{
                  background: 'linear-gradient(to right, white 0%, white 15%, #B1C72E 25%, #B1C72E 100%)'
                }}
              ></div>
            </div>
            
            <p className="mt-3 text-lg leading-relaxed text-gray-300 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>

            <div className="mt-4 flex items-center justify-center gap-x-6 overflow-visible">
            {isConnected ? (
              <>
                <Link
                  href="/mint"
                  className="rounded-lg bg-[#B1C72E] px-6 py-3 text-sm font-semibold text-black shadow-sm hover:bg-[#9db026] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B1C72E]"
                >
                  {t('hero.mintButton')}
                </Link>
                <Link
                  href="/my-nfts"
                  className="text-sm font-semibold leading-6 text-white hover:text-gray-300"
                >
                  {t('hero.viewNftsButton')} <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className={cn(
                  "inline-flex items-center space-x-2 rounded-lg bg-[#b1c62f] px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-[#9db026] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b1c62f] transition-colors",
                  isConnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                <Wallet className="h-4 w-4" />
                <span>
                  {isConnecting
                    ? tCommon('loading')
                    : t('hero.connectWallet')}
                </span>
              </button>
            )}
          </div>
          </div>
        </div>

          {/* Stats Section */}
        {isConnected && (
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">{t('stats.myNfts')}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    <NFTCount 
                      count={web3Data.nfts?.length || 0}
                      className="text-3xl font-semibold text-white"
                    />
                  </p>
                </div>
                <div className="rounded-full border border-[#B1C72E] p-3">
                  <Shield className="h-6 w-6 text-[#B1C72E]" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">{t('stats.eclvBalance')}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    <TokenBalance 
                      value={web3Data.balances.e || "0"}
                      decimals={2}
                      className="text-3xl font-semibold text-white"
                    />
                  </p>
                </div>
                <div className="rounded-full border border-[#B1C72E] p-3">
                  <Coins className="h-6 w-6 text-[#B1C72E]" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-700/50 p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">{t('stats.usdtBalance')}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    <TokenBalance 
                      value={web3Data.balances.usdt || "0"}
                      decimals={2}
                      className="text-3xl font-semibold text-white"
                    />
                  </p>
                </div>
                <div className="rounded-full border border-[#B1C72E] p-3">
                  <TrendingUp className="h-6 w-6 text-[#B1C72E]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-0 pb-24 bg-black relative">
        <div className="max-w-6xl relative pt-0 pb-8">
          {/* Two column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left column - Text content */}
            <div className="text-left relative mt-[10%]" style={{ zIndex: 10 }}>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {t('howItWorks.title')}
              </h2>
              <p className="mt-6 text-base leading-7 text-gray-300">
                {t('howItWorks.subtitle')}
              </p>
            </div>
            
            {/* Right column - Poster images */}
            <div className="relative w-full" style={{ minHeight: '300px' }}>
              {/* Light background */}
              <div className="absolute inset-0" style={{ zIndex: 1 }}>
                <Image
                  src="/Light.svg"
                  alt="Light background"
                  width={600}
                  height={800}
                  className="w-full h-full object-cover brightness-125 contrast-125 pointer-events-none"
                  onDragStart={(e) => e.preventDefault()}
                  style={{ WebkitUserDrag: 'none' } as React.CSSProperties}
                />
              </div>
              {/* bg2 */}
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
                <div 
                  className="rounded-2xl overflow-hidden pointer-events-none" 
                  style={{ transform: 'scaleX(0.4) scaleY(0.8) rotate(90deg)', WebkitUserDrag: 'none' } as React.CSSProperties}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <Image
                    src="/bg2.svg"
                    alt="Background decoration"
                    width={600}
                    height={800}
                    className="opacity-20"
                  />
                </div>
              </div>
              {/* NFT image - on top layer */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center pointer-events-none" style={{ zIndex: 3, WebkitUserDrag: 'none' } as React.CSSProperties} onDragStart={(e) => e.preventDefault()}>
                <Image
                  src="/nftpng.png"
                  alt="NFT decoration"
                  width={300}
                  height={400}
                  className="w-3/4 h-3/4 object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mt-16 space-y-6">
          {/* Step 1 - 铸造 NFT - Horizontal, Full Width */}
          <div className="flex flex-col items-center p-8 rounded-2xl border border-gray-700/50 relative overflow-visible">
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
            />
            <div className="absolute inset-0 bg-[#252532] opacity-20 rounded-2xl"></div>
            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="flex justify-center mb-4">
                <Image
                  src="/铸造.svg"
                  alt="铸造 NFT"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </div>
              <div className="w-full flex justify-center px-4">
                <div className="max-w-2xl text-left">
                  <h3 className="text-xl font-bold text-white mb-2">
                    <span className="text-[#B1C72E]">01.</span> {t('howItWorks.step1.title')}
                  </h3>
                  <p className="text-base text-white leading-relaxed">
                    {t('howItWorks.step1.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Steps 2, 3, 4 - Three cards in a row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 2 - 赚取奖励 */}
            <div className="flex flex-col p-8 rounded-2xl border border-gray-700/50 relative overflow-visible">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="absolute inset-0 bg-[#252532] opacity-20 rounded-2xl"></div>
              <div className="relative z-10 w-full">
                <div className="mb-4 flex justify-start">
                  <Image
                    src="/奖励.svg"
                    alt="赚取奖励"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-left">
                  <span className="text-[#B1C72E]">02.</span> {t('howItWorks.step2.title')}
                </h3>
                <p className="text-base text-white text-left w-full leading-relaxed">
                  {t('howItWorks.step2.description')}
                </p>
              </div>
            </div>

            {/* Step 3 - 解锁代币 */}
            <div className="flex flex-col p-8 rounded-2xl border border-gray-700/50 relative overflow-visible">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="absolute inset-0 bg-[#252532] opacity-20 rounded-2xl"></div>
              <div className="relative z-10 w-full">
                <div className="mb-4 flex justify-start">
                  <Image
                    src="/解锁.svg"
                    alt="解锁代币"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-left">
                  <span className="text-[#B1C72E]">03.</span> {t('howItWorks.step3.title')}
                </h3>
                <p className="text-base text-white text-left w-full leading-relaxed">
                  {t('howItWorks.step3.description')}
                </p>
              </div>
            </div>

            {/* Step 4 - 交易份额 */}
            <div className="flex flex-col p-8 rounded-2xl border border-gray-700/50 relative overflow-visible">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={2}
              />
              <div className="absolute inset-0 bg-[#252532] opacity-20 rounded-2xl"></div>
              <div className="relative z-10 w-full">
                <div className="mb-4 flex justify-start">
                  <Image
                    src="/交易.svg"
                    alt="交易份额"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-left">
                  <span className="text-[#B1C72E]">04.</span> {t('howItWorks.step4.title')}
                </h3>
                <p className="text-base text-white text-left w-full leading-relaxed">
                  {t('howItWorks.step4.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NFT Types Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('nftTypes.title')}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            {t('nftTypes.subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-2 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Standard NFT */}
          <div className="rounded-2xl border border-[#b1c62f] p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-[#B1C72E]">
                {t('nftTypes.standard.name')}
              </h3>
              <p className="mt-4 flex items-baseline gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-[#B1C72E]">
                  {formatUSD(parseFloat(NFT_CONFIG[NFTType.Standard].mintPrice))}
                </span>
                <span className="text-sm font-semibold leading-6 text-[#B1C72E]">USDT</span>
              </p>
              <ul className="mt-8 space-y-3 text-sm leading-6 text-[#B1C72E]">
                <li className="flex gap-x-3">
                  <span className="text-[#B1C72E]">✓</span>
                  {t('nftTypes.standard.lock')} {formatTokenAmount(NFT_CONFIG[NFTType.Standard].eLockAmount, 0, 0)}
                </li>
                <li className="flex gap-x-3">
                  <span className="text-[#B1C72E]">✓</span>
                  {t('nftTypes.standard.shares')}
                </li>
                <li className="flex gap-x-3">
                  <span className="text-[#B1C72E]">✓</span>
                  {t('nftTypes.standard.weight')}
                </li>
                <li className="flex gap-x-3">
                  <span className="text-[#B1C72E]">✓</span>
                  {t('nftTypes.standard.unlock')}
                </li>
              </ul>
              <Link href="/mint?type=standard" className="mt-8 block">
                <GradientButton variant="green" className="w-full text-black">
                  {t('nftTypes.standard.mintButton')}
                </GradientButton>
              </Link>
            </div>
          </div>

          {/* Premium NFT */}
          <div className="rounded-2xl bg-[#B1C72E] p-8 shadow-xl ring-1 ring-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-black">
                {t('nftTypes.premium.name')}
              </h3>
              <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-black">
                {t('nftTypes.premium.badge')}
              </span>
            </div>
            <p className="mt-4 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-black">
                {formatUSD(parseFloat(NFT_CONFIG[NFTType.Premium].mintPrice))}
              </span>
              <span className="text-sm font-semibold leading-6 text-black/70">USDT</span>
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-6 text-black/80">
              <li className="flex gap-x-3">
                <span className="text-black">✓</span>
                {t('nftTypes.premium.lock')} {formatTokenAmount(NFT_CONFIG[NFTType.Premium].eLockAmount, 0, 0)}
              </li>
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
                {t('nftTypes.premium.shares')}
              </li>
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
                {t('nftTypes.premium.weight')}
              </li>
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
                {t('nftTypes.premium.unlock')}
              </li>
            </ul>
              <Link href="/mint?type=premium" className="mt-8 block">
                <GradientButton variant="blackRainbow" className="w-full text-white">
                  {t('nftTypes.premium.mintButton')}
                </GradientButton>
              </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-700/50 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#252532] opacity-20"></div>
            <div className="relative z-10 text-center">
              <h3 className="text-lg font-semibold text-white">{t('footer.title')}</h3>
              <p className="mt-2 text-sm text-white">
                {t('footer.description')}
              </p>
              <div className="mt-6 flex justify-center space-x-6">
                <a 
                  href="https://github.com/enclave-hq/nodes-nft" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-gray-300 text-sm"
                >
                  {t('footer.github')}
                </a>
                <a
                  href="https://x.com/favorlabs" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-gray-300 text-sm"
                >
                  {t('footer.twitter')}
                </a>
              </div>
              <p className="mt-6 text-xs text-white">
                {t('footer.rights')}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
