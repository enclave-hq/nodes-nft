'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { 
  isAuthenticated,
  traceNFT,
  getNFTsByRootInviteCode,
  getNFTsByUser,
  type NFT,
  type NFTTrace
} from '@/lib/api';

export default function AdminNFTsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState<'nft' | 'user' | 'root'>('nft');
  const [searchValue, setSearchValue] = useState('');
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [nftTrace, setNftTrace] = useState<NFTTrace | null>(null);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error('请输入搜索值');
      return;
    }

    if (!isAuthenticated()) {
      toast.error('请先登录');
      return;
    }

    setIsLoading(true);
    setNfts([]);
    setNftTrace(null);

    try {
      if (searchType === 'nft') {
        const nftId = parseInt(searchValue);
        if (isNaN(nftId)) {
          toast.error('NFT ID必须是数字');
          setIsLoading(false);
          return;
        }
        const trace = await traceNFT(nftId);
        setNftTrace(trace);
      } else if (searchType === 'user') {
        const data = await getNFTsByUser(searchValue);
        setNfts(data);
      } else if (searchType === 'root') {
        const rootId = parseInt(searchValue);
        if (isNaN(rootId)) {
          toast.error('根邀请码ID必须是数字');
          setIsLoading(false);
          return;
        }
        const data = await getNFTsByRootInviteCode(rootId);
        setNfts(data);
      }
    } catch (error: any) {
      console.error('Failed to search:', error);
      // Show more specific error messages
      if (error.statusCode === 404) {
        toast.error(error.message || '未找到相关记录');
      } else if (error.statusCode === 401) {
        toast.error('请先登录');
      } else {
        toast.error(error.message || '搜索失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">NFT追溯</h1>
          <p className="mt-1 text-sm text-gray-600">追溯 NFT 的邀请链和来源</p>
        </div>

          {/* 搜索区域 */}
          <div className="mb-6 p-6 border border-gray-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">搜索NFT</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  搜索类型
                </label>
                <select
                  value={searchType}
                  onChange={(e) => {
                    setSearchType(e.target.value as 'nft' | 'user' | 'root');
                    setSearchValue('');
                    setNfts([]);
                    setNftTrace(null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="nft">按NFT ID追溯</option>
                  <option value="user">按用户地址查询</option>
                  <option value="root">按根邀请码查询</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {searchType === 'nft' ? 'NFT ID' : searchType === 'user' ? '用户地址' : '根邀请码ID'}
                </label>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={
                      searchType === 'nft' 
                        ? '输入NFT ID (数字)' 
                        : searchType === 'user'
                        ? '输入用户地址 (0x...)'
                        : '输入根邀请码ID (数字)'
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isLoading || !searchValue.trim()}
                    className="px-6 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '搜索中...' : '搜索'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* NFT追溯信息 */}
          {nftTrace && (
            <div className="mb-6 space-y-4">
              <h2 className="text-xl font-semibold">NFT追溯信息</h2>
              <div className="p-6 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-4">NFT信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">NFT ID:</span>
                    <p className="font-semibold mt-1">{nftTrace.nft.id}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Token ID:</span>
                    <p className="font-semibold mt-1">{nftTrace.nft.tokenId}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">所有者地址:</span>
                    <p className="font-mono mt-1 text-sm">{nftTrace.nft.ownerAddress}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">邀请码ID:</span>
                    <p className="font-semibold mt-1">{nftTrace.nft.inviteCodeId}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">创建时间:</span>
                    <p className="mt-1">{new Date(nftTrace.nft.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {nftTrace.inviteCodeChain.length > 0 && (
                <div className="p-6 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-4">邀请码链</h3>
                  <div className="space-y-2">
                    {nftTrace.inviteCodeChain.map((code, index) => (
                      <div key={code.id} className="flex items-center gap-4 p-3 bg-white rounded border">
                        <span className="text-gray-500">#{index + 1}</span>
                        <div className="flex-1">
                          <p className="font-mono font-semibold">{code.code}</p>
                          <p className="text-sm text-gray-600 font-mono">
                            {code.ownerAddress}
                          </p>
                        </div>
                        <span className="text-sm text-gray-500">ID: {code.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NFT列表 */}
          {nfts.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                {searchType === 'user' ? '用户的NFT' : '根邀请码产生的NFT'} ({nfts.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">NFT ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Token ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">所有者</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">邀请码ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nfts.map((nft) => (
                      <tr key={nft.id}>
                        <td className="border border-gray-300 px-4 py-2">{nft.id}</td>
                        <td className="border border-gray-300 px-4 py-2 font-mono">{nft.tokenId}</td>
                        <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                          {nft.ownerAddress.slice(0, 10)}...{nft.ownerAddress.slice(-8)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">{nft.inviteCodeId}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(nft.createdAt).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <button
                            onClick={async () => {
                              try {
                                const trace = await traceNFT(nft.id);
                                setNftTrace(trace);
                                setNfts([]);
                                setSearchType('nft');
                                setSearchValue(nft.id.toString());
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              } catch (error: any) {
                                toast.error(error.message || '获取追溯信息失败');
                              }
                            }}
                            className="px-3 py-1 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] text-sm"
                          >
                            追溯
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {!nftTrace && nfts.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            <p>请输入搜索条件进行查询</p>
          </div>
        )}
      </div>
    </div>
  );
}

