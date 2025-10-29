'use client';

import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useState } from 'react';
import { useWeb3Data } from '@/lib/stores/web3Store';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useUserShare, useTransferShares } from '@/lib/hooks/useNFTManager';
import { useTranslations } from '@/lib/i18n/provider';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NFTTransferPage() {
  const params = useParams();
  const nftId = parseInt(params.id as string);
  const t = useTranslations('myNfts');
  const { isConnected, address, walletManager } = useWallet();
  const web3Data = useWeb3Data();
  const userShareHook = useUserShare(nftId);
  const userShare = userShareHook.data;
  const transferShares = useTransferShares();

  const [recipient, setRecipient] = useState('');
  const [shares, setShares] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Find NFT from web3Data
  const nft = web3Data.nfts.find(n => n.id === nftId);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="py-8">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {t('connectWallet.title')}
              </h1>
              <p className="text-gray-600 mb-6">
                {t('connectWallet.description')}
              </p>
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                连接钱包
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="py-8">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                NFT 未找到
              </h1>
              <p className="text-gray-600 mb-6">
                找不到 ID 为 {nftId} 的 NFT
              </p>
              <Link
                href="/my-nfts"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回我的 NFT
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!userShare || userShare.shares === "0") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="py-8">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                无份额可转让
              </h1>
              <p className="text-gray-600 mb-6">
                您在此 NFT 中没有份额可转让
              </p>
              <Link
                href={`/nfts/${nftId}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回 NFT 详情
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletManager || !address) return;

    setError(null);

    try {
      // Validate inputs
      const sharesToTransfer = parseInt(shares);
      const userSharesCount = parseInt(userShare.shares);

      if (sharesToTransfer <= 0) {
        throw new Error('份额数量必须大于 0');
      }

      if (sharesToTransfer > userSharesCount) {
        throw new Error('份额数量不能超过您持有的数量');
      }

      if (!recipient || recipient.length !== 42 || !recipient.startsWith('0x')) {
        throw new Error('请输入有效的以太坊地址');
      }

      if (recipient.toLowerCase() === address.toLowerCase()) {
        throw new Error('不能转让给自己');
      }

      // Execute transfer
      console.log('Transfer:', {
        nftId,
        recipient,
        shares: sharesToTransfer,
        userShares: userSharesCount
      });

      const txHash = await transferShares.mutateAsync({
        nftId,
        recipient,
        shares: sharesToTransfer
      });

      // Show success message
      toast.success(`转让成功！交易哈希: ${txHash}`);
      
      // Reset form
      setRecipient('');
      setShares('');
      
    } catch (error: any) {
      const errorMessage = error.message || '转让失败';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href={`/nfts/${nftId}`}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回 NFT 详情
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              转让 NFT #{nftId} 份额
            </h1>
          </div>

          {/* NFT Info */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              NFT 信息
            </h2>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500">类型:</span>
                <span className="ml-2 font-medium">{nft.type}</span>
              </div>
              <div>
                <span className="text-gray-500">状态:</span>
                <span className="ml-2 font-medium">{nft.status}</span>
              </div>
              <div>
                <span className="text-gray-500">您持有的份额:</span>
                <span className="ml-2 font-medium">{userShare.shares}</span>
              </div>
              <div>
                <span className="text-gray-500">总份额:</span>
                <span className="ml-2 font-medium">{nft.totalShares}</span>
              </div>
            </div>
          </div>

          {/* Transfer Form */}
          <form onSubmit={handleTransfer} className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              转让份额
            </h2>

            {/* Recipient Address */}
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-2">
                接收者地址
              </label>
              <input
                type="text"
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Shares Amount */}
            <div className="mt-4">
              <label htmlFor="shares" className="block text-sm font-medium text-gray-700 mb-2">
                份额数量
              </label>
              <input
                type="number"
                id="shares"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                min="1"
                max={userShare.shares}
                placeholder="输入份额数量"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                最多可转让 {userShare.shares} 份额
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={transferShares.isLoading || !recipient || !shares}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {transferShares.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    转让中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    确认转让
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Important Notes */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-6">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">重要提示</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• 转让后无法撤销，请谨慎操作</li>
              <li>• 请确保接收者地址正确</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}