"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { RefreshCw, Loader2, AlertCircle, CheckCircle, Bug } from "lucide-react";

export default function NFTDataDebugPage() {
  const { isConnected, address } = useWallet();
  const web3Data = useWeb3Data();
  
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeNFTData = () => {
    setIsLoading(true);
    
    const nfts = web3Data.nfts || [];
    const analysis = {
      totalNFTs: nfts.length,
      nftDetails: nfts.map((nft: any, index: number) => ({
        index,
        id: nft.id,
        idType: typeof nft.id,
        isValidId: typeof nft.id === 'number' && nft.id > 0,
        rawNft: nft,
        stringified: JSON.stringify(nft, null, 2)
      })),
      web3DataKeys: Object.keys(web3Data),
      nftsArrayType: Array.isArray(nfts),
      nftsLength: nfts.length,
      firstNFT: nfts[0] || null
    };
    
    setDebugInfo(analysis);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isConnected && web3Data.nfts) {
      analyzeNFTData();
    }
  }, [isConnected, web3Data.nfts]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">NFT数据结构调试</h1>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">钱包连接</h3>
                <p className="text-sm text-gray-600">
                  {isConnected ? '已连接' : '未连接'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${web3Data.nfts && web3Data.nfts.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">NFT数据</h3>
                <p className="text-sm text-gray-600">
                  {web3Data.nfts ? `${web3Data.nfts.length} 个NFT` : '加载中...'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${debugInfo ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">调试分析</h3>
                <p className="text-sm text-gray-600">
                  {debugInfo ? '已完成' : '等待中...'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">控制面板</h2>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={analyzeNFTData}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Bug className="h-4 w-4 mr-2" />
              )}
              分析NFT数据
            </button>
            
            <div className="text-sm text-gray-600">
              地址: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '未连接'}
            </div>
          </div>
        </div>

        {/* Debug Information */}
        {debugInfo && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">数据摘要</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">基本信息</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>NFT总数: {debugInfo.totalNFTs}</div>
                    <div>数组类型: {debugInfo.nftsArrayType ? '是' : '否'}</div>
                    <div>数组长度: {debugInfo.nftsLength}</div>
                    <div>Web3Data键: {debugInfo.web3DataKeys.join(', ')}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">第一个NFT</h3>
                  <div className="text-sm text-gray-600">
                    {debugInfo.firstNFT ? (
                      <div className="space-y-1">
                        <div>ID: {debugInfo.firstNFT.id} (类型: {typeof debugInfo.firstNFT.id})</div>
                        <div>类型: {debugInfo.firstNFT.type}</div>
                        <div>状态: {debugInfo.firstNFT.status}</div>
                      </div>
                    ) : (
                      <div>无NFT数据</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* NFT Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">NFT详细信息</h2>
              
              {debugInfo.nftDetails.map((nft: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">
                      NFT #{index}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        nft.isValidId ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {nft.isValidId ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            有效ID
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            无效ID
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">ID值:</span>
                      <span className="ml-1 font-medium">{nft.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID类型:</span>
                      <span className="ml-1 font-medium">{nft.idType}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">类型:</span>
                      <span className="ml-1 font-medium">{nft.rawNft.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">状态:</span>
                      <span className="ml-1 font-medium">{nft.rawNft.status}</span>
                    </div>
                  </div>
                  
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      查看完整JSON数据
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                      {nft.stringified}
                    </pre>
                  </details>
                </div>
              ))}
            </div>

            {/* Raw Web3Data */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">原始Web3Data</h2>
              
              <details>
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 mb-2">
                  查看完整Web3Data对象
                </summary>
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(web3Data, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">分析NFT数据中...</p>
          </div>
        )}

        {/* Empty State */}
        {!debugInfo && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Bug className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">等待数据</h3>
            <p className="text-sm text-gray-500">
              {!isConnected ? '请先连接钱包' : '等待NFT数据加载完成'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}






















