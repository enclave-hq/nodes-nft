"use client";

import { useState } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { NFT_MANAGER_ABI as ABI } from "@/lib/contracts/abis";
import { Loader2, CheckCircle, AlertCircle, Bug } from "lucide-react";

export default function ContractTestPage() {
  const { walletManager, isConnected } = useWallet();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runContractTests = async () => {
    if (!walletManager || !isConnected) {
      alert('请先连接钱包');
      return;
    }

    setIsLoading(true);
    const results: any[] = [];

    try {
      // Test 1: Contract Address Validation
      results.push({
        test: '合约地址验证',
        status: CONTRACT_ADDRESSES.nftManager ? 'success' : 'error',
        details: CONTRACT_ADDRESSES.nftManager || '未配置',
        error: CONTRACT_ADDRESSES.nftManager ? null : 'NFT Manager合约地址未配置'
      });

      // Test 2: ABI Validation
      results.push({
        test: 'ABI验证',
        status: ABI && ABI.length > 0 ? 'success' : 'error',
        details: `ABI长度: ${ABI?.length || 0}`,
        error: ABI && ABI.length > 0 ? null : 'ABI未加载或为空'
      });

      // Test 3: Function Exists in ABI
      const getNFTSellOrdersFunction = ABI.find((item: any) => 
        item.name === 'getNFTSellOrders' && item.type === 'function'
      );
      results.push({
        test: 'getNFTSellOrders函数存在',
        status: getNFTSellOrdersFunction ? 'success' : 'error',
        details: getNFTSellOrdersFunction ? '函数已找到' : '函数未找到',
        error: getNFTSellOrdersFunction ? null : 'getNFTSellOrders函数在ABI中不存在'
      });

      // Test 4: Simple Contract Call (if function exists)
      if (getNFTSellOrdersFunction && CONTRACT_ADDRESSES.nftManager) {
        try {
          console.log('🧪 测试合约调用...');
          const result = await walletManager.readContract(
            CONTRACT_ADDRESSES.nftManager,
            ABI as unknown[],
            'getNFTSellOrders',
            [1] // Test with NFT ID 1
          );
          
          results.push({
            test: '合约调用测试 (NFT ID: 1)',
            status: 'success',
            details: `返回结果: ${JSON.stringify(result)}`,
            error: null
          });
        } catch (callError) {
          results.push({
            test: '合约调用测试 (NFT ID: 1)',
            status: 'error',
            details: '调用失败',
            error: callError instanceof Error ? callError.message : String(callError)
          });
        }
      }

      // Test 5: Network Connection
      try {
        const account = walletManager.getPrimaryAccount();
        const networkId = account?.chainId;
        if (networkId) {
        results.push({
          test: '网络连接',
          status: 'success',
          details: `链ID: ${networkId}`,
          error: null
        });
        } else {
          results.push({
            test: '网络连接',
            status: 'error',
            details: '无法获取网络信息',
            error: 'No account connected'
          });
        }
      } catch (networkError) {
        results.push({
          test: '网络连接',
          status: 'error',
          details: '无法获取网络信息',
          error: networkError instanceof Error ? networkError.message : String(networkError)
        });
      }

    } catch (error) {
      results.push({
        test: '测试执行',
        status: 'error',
        details: '测试执行失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    setTestResults(results);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">合约连接测试</h1>
        
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
              <div className={`w-3 h-3 rounded-full mr-3 ${CONTRACT_ADDRESSES.nftManager ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">合约地址</h3>
                <p className="text-sm text-gray-600">
                  {CONTRACT_ADDRESSES.nftManager ? '已配置' : '未配置'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${ABI && ABI.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">ABI</h3>
                <p className="text-sm text-gray-600">
                  {ABI && ABI.length > 0 ? `${ABI.length} 个函数` : '未加载'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">测试控制</h2>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={runContractTests}
              disabled={isLoading || !isConnected}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Bug className="h-4 w-4 mr-2" />
              )}
              运行合约测试
            </button>
            
            <div className="text-sm text-gray-600">
              {isConnected ? '钱包已连接，可以测试' : '请先连接钱包'}
            </div>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">测试结果</h2>
            
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {result.test}
                    </h3>
                    <div className="flex items-center">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {result.details}
                  </div>
                  
                  {result.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      <strong>错误:</strong> {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">配置详情</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">合约地址</h3>
              <div className="space-y-1">
                <div>NFT Manager: {CONTRACT_ADDRESSES.nftManager || '未配置'}</div>
                <div>Node NFT: {CONTRACT_ADDRESSES.nodeNFT || '未配置'}</div>
                <div>USDT: {CONTRACT_ADDRESSES.usdt || '未配置'}</div>
                <div>Enclave Token: {CONTRACT_ADDRESSES.enclaveToken || '未配置'}</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">ABI信息</h3>
              <div className="space-y-1">
                <div>ABI长度: {ABI?.length || 0}</div>
                <div>getNFTSellOrders存在: {ABI?.find((item: any) => item.name === 'getNFTSellOrders') ? '是' : '否'}</div>
                <div>函数总数: {ABI?.filter((item: any) => item.type === 'function').length || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">运行合约测试中...</p>
          </div>
        )}
      </div>
    </div>
  );
}











