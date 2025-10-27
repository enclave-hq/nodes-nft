"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useUserNFTs } from "@/lib/hooks/useNFTManager";
import { useBalances } from "@/lib/hooks/useBalances";
import { formatTokenAmount, formatUSD } from "@/lib/utils";
import { NFT_CONFIG, NFTType } from "@/lib/contracts/config";
import { ArrowRight, Coins, TrendingUp, Users, Shield } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/provider";

export default function Home() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { isConnected } = useWallet();
  const { data: nftIds } = useUserNFTs();
  const { data: balances } = useBalances();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            <span className="block">Decentralized Node</span>
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              NFT Platform
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
            Own a piece of the network. Earn passive rewards through ECLV token distribution
            and transaction fees. Join the future of decentralized infrastructure.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            {isConnected ? (
              <>
                <Link
                  href="/mint"
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Mint Node NFT
                </Link>
                <Link
                  href="/my-nfts"
                  className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
                >
                  View My NFTs <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <div className="text-sm text-gray-500">
                Connect your wallet to get started
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
                  <p className="text-sm font-medium text-gray-600">My NFTs</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {nftIds?.length || 0}
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
                  <p className="text-sm font-medium text-gray-600">ECLV Balance</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {balances ? formatTokenAmount(balances.eclv, 18, 2) : "0"}
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
                  <p className="text-sm font-medium text-gray-600">USDT Balance</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {balances ? formatTokenAmount(balances.usdt, 18, 2) : "0"}
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
            How It Works
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Simple, transparent, and profitable. Join the decentralized node network.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Mint NFT</h3>
              <p className="mt-2 text-sm text-gray-600">
                Purchase a Standard or Premium node NFT with USDT and lock ECLV tokens
              </p>
              {/* Arrow */}
              <ArrowRight className="hidden lg:block absolute -right-4 top-6 h-8 w-8 text-gray-300" />
            </div>

            {/* Step 2 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Earn Rewards</h3>
              <p className="mt-2 text-sm text-gray-600">
                Receive daily ECLV production and USDT rewards distributed by the oracle
              </p>
              <ArrowRight className="hidden lg:block absolute -right-4 top-6 h-8 w-8 text-gray-300" />
            </div>

            {/* Step 3 */}
            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Claim & Unlock</h3>
              <p className="mt-2 text-sm text-gray-600">
                Claim rewards anytime. After 1 year, 4% of locked ECLV unlocks monthly
              </p>
              <ArrowRight className="hidden lg:block absolute -right-4 top-6 h-8 w-8 text-gray-300" />
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-600 text-white text-2xl font-bold">
                4
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Trade Shares</h3>
              <p className="mt-2 text-sm text-gray-600">
                Transfer shares P2P or list on the marketplace for other users to buy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NFT Types Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Node NFT Types
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Choose the node that fits your investment strategy
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Standard NFT */}
          <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-900/5">
            <h3 className="text-2xl font-bold text-gray-900">
              {NFT_CONFIG[NFTType.Standard].name}
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
                Lock {formatTokenAmount(NFT_CONFIG[NFTType.Standard].eclvLockAmount, 0, 0)} ECLV
              </li>
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                10 shares per NFT
              </li>
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                1x reward weight
              </li>
              <li className="flex gap-x-3">
                <span className="text-blue-600">✓</span>
                25-month unlock schedule
              </li>
            </ul>
            <Link
              href="/mint?type=standard"
              className="mt-8 block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Mint Standard
            </Link>
          </div>

          {/* Premium NFT */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-8 shadow-xl ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                {NFT_CONFIG[NFTType.Premium].name}
              </h3>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                BEST VALUE
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
                Lock {formatTokenAmount(NFT_CONFIG[NFTType.Premium].eclvLockAmount, 0, 0)} ECLV
              </li>
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
                10 shares per NFT
              </li>
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
                6x reward weight (6x more rewards!)
              </li>
              <li className="flex gap-x-3">
                <span className="text-white">✓</span>
                25-month unlock schedule
              </li>
            </ul>
            <Link
              href="/mint?type=premium"
              className="mt-8 block rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-purple-600 shadow-sm hover:bg-purple-50"
            >
              Mint Premium
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Enclave Node NFT</h3>
            <p className="mt-2 text-sm text-gray-400">
              Decentralized infrastructure, transparent rewards
            </p>
            <div className="mt-6 flex justify-center space-x-6">
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Docs
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                GitHub
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
