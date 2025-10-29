"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { formatTokenAmount, formatUSD } from "@/lib/utils";
import { NFT_CONFIG, NFTType } from "@/lib/contracts/config";
import { ArrowRight, Coins, TrendingUp, Users, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "@/lib/i18n/provider";
import { TokenBalance, NFTCount } from "@/lib/components/FormattedNumber";

export default function Home() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { isConnected } = useWallet();
  const web3Data = useWeb3Data();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          <div className="flex justify-center mb-8">
        <Image
              src="/LOGO_WITH_BACK.png"
              alt="Enclave Logo"
              width={200}
              height={80}
              className="h-20 w-auto"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            {t('hero.title')}
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
            {t('hero.subtitle')}
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            {isConnected ? (
              <>
                <Link
                  href="/mint"
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {t('hero.mintButton')}
                </Link>
                <Link
                  href="/my-nfts"
                  className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
                >
                  {t('hero.viewNftsButton')} <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <div className="text-sm text-gray-500">
                {t('hero.connectWallet')}
              </div>
            )}
          </div>
        </div>

        {/* Stats Section */}
        {isConnected && (
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('stats.myNfts')}</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    <NFTCount 
                      count={web3Data.nfts?.length || 0}
                      className="text-3xl font-semibold text-gray-900"
                    />
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('stats.eclvBalance')}</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    <TokenBalance 
                      value={web3Data.balances.e || "0"}
                      decimals={2}
                      className="text-3xl font-semibold text-gray-900"
                    />
                  </p>
                </div>
                <div className="rounded-full bg-purple-100 p-3">
                  <Coins className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('stats.usdtBalance')}</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    <TokenBalance 
                      value={web3Data.balances.usdt || "0"}
                      decimals={2}
                      className="text-3xl font-semibold text-gray-900"
                    />
                  </p>
                </div>
                <div className="rounded-full bg-green-100 p-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t('howItWorks.title')}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          {/* Step 1 - Top Row */}
          <div className="flex flex-col items-center mb-12">
            <div className="flex flex-col items-center text-center max-w-md">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-white text-3xl font-bold shadow-lg">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">{t('howItWorks.step1.title')}</h3>
              <p className="mt-3 text-base text-gray-600">
                {t('howItWorks.step1.description')}
              </p>
            </div>
            
            {/* Down Arrow */}
            <div className="mt-8 mb-4">
              <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* Steps 2, 3, 4 - Bottom Row (Parallel) */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-white text-2xl font-bold shadow-md">
                2
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">{t('howItWorks.step2.title')}</h3>
              <p className="mt-2 text-sm text-gray-600">
                {t('howItWorks.step2.description')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-green-50 border-2 border-green-200">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white text-2xl font-bold shadow-md">
                3
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">{t('howItWorks.step3.title')}</h3>
              <p className="mt-2 text-sm text-gray-600">
                {t('howItWorks.step3.description')}
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center p-6 rounded-xl bg-orange-50 border-2 border-orange-200">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-600 text-white text-2xl font-bold shadow-md">
                4
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">{t('howItWorks.step4.title')}</h3>
              <p className="mt-2 text-sm text-gray-600">
                {t('howItWorks.step4.description')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NFT Types Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t('nftTypes.title')}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {t('nftTypes.subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Standard NFT */}
          <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-900/5">
            <h3 className="text-2xl font-bold text-gray-900">
              {t('nftTypes.standard.name')}
            </h3>
            <p className="mt-4 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-gray-900">
                {formatUSD(parseFloat(NFT_CONFIG[NFTType.Standard].mintPrice))}
              </span>
              <span className="text-sm font-semibold leading-6 text-gray-600">USDT</span>
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                {t('nftTypes.standard.lock')} {formatTokenAmount(NFT_CONFIG[NFTType.Standard].eLockAmount, 0, 0)}
              </li>
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                {t('nftTypes.standard.shares')}
              </li>
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                {t('nftTypes.standard.weight')}
              </li>
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                {t('nftTypes.standard.unlock')}
              </li>
            </ul>
            <Link
              href="/mint?type=standard"
              className="mt-8 block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              {t('nftTypes.standard.mintButton')}
            </Link>
          </div>

          {/* Premium NFT */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-8 shadow-xl ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                {t('nftTypes.premium.name')}
              </h3>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                {t('nftTypes.premium.badge')}
              </span>
            </div>
            <p className="mt-4 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-white">
                {formatUSD(parseFloat(NFT_CONFIG[NFTType.Premium].mintPrice))}
              </span>
              <span className="text-sm font-semibold leading-6 text-purple-200">USDT</span>
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-6 text-purple-100">
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
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
            <Link
              href="/mint?type=premium"
              className="mt-8 block rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-purple-600 shadow-sm hover:bg-purple-50"
            >
              {t('nftTypes.premium.mintButton')}
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t('footer.title')}</h3>
            <p className="mt-2 text-sm text-gray-400">
              {t('footer.description')}
            </p>
            <div className="mt-6 flex justify-center space-x-6">
              <a 
                href="https://github.com/enclave-hq/nodes-nft" 
            target="_blank"
            rel="noopener noreferrer"
                className="text-gray-400 hover:text-white text-sm"
              >
                {t('footer.github')}
          </a>
          <a
                href="https://x.com/favorlabs" 
            target="_blank"
            rel="noopener noreferrer"
                className="text-gray-400 hover:text-white text-sm"
          >
                {t('footer.twitter')}
          </a>
            </div>
            <p className="mt-6 text-xs text-gray-500">
              {t('footer.rights')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
