"use client";

import { useState } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useWeb3Data } from '@/lib/stores/web3Store';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '@/lib/contracts/config';
import { formatAddress, formatTokenAmount } from '@/lib/utils';
import { Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const { account, isConnected, chainId } = useWallet();
  const web3Data = useWeb3Data();

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="ml-2 p-1 hover:bg-gray-100 rounded"
      title="复制到剪贴板"
    >
      {copiedField === field ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 text-gray-400" />
      )}
    </button>
  );

  const InfoRow = ({ label, value, loading = false, copyable = false }: {
    label: string;
    value: string | undefined;
    loading?: boolean;
    copyable?: boolean;
  }) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-gray-600">{label}:</span>
      <div className="flex items-center">
        <span className="text-sm text-gray-900 font-mono">
          {loading ? '...' : value || 'undefined'}
        </span>
        {copyable && value && <CopyButton text={value} field={label} />}
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-md">
        {/* Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-t-lg"
        >
          <div className="flex items-center space-x-2">
            <Bug className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">调试面板</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {/* Content */}
        {isOpen && (
          <div className="p-3 border-t border-gray-200 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {/* Network Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  网络信息
                </h4>
                <div className="space-y-1">
                  <InfoRow 
                    label="Chain ID" 
                    value={chainId?.toString()} 
                  />
                  <InfoRow 
                    label="RPC URL" 
                    value={NETWORK_CONFIG.rpcUrl} 
                    copyable 
                  />
                  <InfoRow 
                    label="Block Explorer" 
                    value={NETWORK_CONFIG.blockExplorer} 
                    copyable 
                  />
                </div>
              </div>

              {/* Contract Addresses */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  合约地址
                </h4>
                <div className="space-y-1">
                  <InfoRow 
                    label="USDT" 
                    value={CONTRACT_ADDRESSES.usdt} 
                    copyable 
                  />
                  <InfoRow 
                    label="NFT Manager" 
                    value={CONTRACT_ADDRESSES.nftManager} 
                    copyable 
                  />
                  <InfoRow 
                    label="Enclave Token" 
                    value={CONTRACT_ADDRESSES.enclaveToken} 
                    copyable 
                  />
                  <InfoRow 
                    label="Node NFT" 
                    value={CONTRACT_ADDRESSES.nodeNFT} 
                    copyable 
                  />
                </div>
              </div>

              {/* Wallet Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  钱包信息
                </h4>
                <div className="space-y-1">
                  <InfoRow 
                    label="连接状态" 
                    value={isConnected ? '已连接' : '未连接'} 
                  />
                  <InfoRow 
                    label="钱包地址" 
                    value={account ? formatAddress(account) : undefined} 
                    copyable 
                  />
                </div>
              </div>

              {/* Balances */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  余额信息
                </h4>
                <div className="space-y-1">
                  <InfoRow 
                    label="$E余额" 
                    value={web3Data.balances.e} 
                    loading={web3Data.loading.balances} 
                  />
                  <InfoRow 
                    label="USDT余额" 
                    value={web3Data.balances.usdt} 
                    loading={web3Data.loading.balances} 
                  />
                  <InfoRow 
                    label="USDT授权" 
                    value={web3Data.allowances.usdt} 
                    loading={web3Data.loading.allowances} 
                  />
                  <InfoRow 
                    label="BNB余额" 
                    value={web3Data.balances.bnb} 
                    loading={web3Data.loading.balances} 
                  />
                </div>
              </div>

              {/* Environment Variables Debug */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  环境变量
                </h4>
                <div className="space-y-1">
                  <InfoRow 
                    label="NEXT_PUBLIC_CHAIN_ID" 
                    value={process.env.NEXT_PUBLIC_CHAIN_ID} 
                  />
                  <InfoRow 
                    label="NEXT_PUBLIC_USDT_ADDRESS" 
                    value={process.env.NEXT_PUBLIC_USDT_ADDRESS} 
                    copyable 
                  />
                  <InfoRow 
                    label="NEXT_PUBLIC_NFT_MANAGER_ADDRESS" 
                    value={process.env.NEXT_PUBLIC_NFT_MANAGER_ADDRESS} 
                    copyable 
                  />
                </div>
              </div>

              {/* Status Indicators */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  状态指示器
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium text-gray-600">合约地址:</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      CONTRACT_ADDRESSES.usdt && CONTRACT_ADDRESSES.nftManager
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    )}>
                      {CONTRACT_ADDRESSES.usdt && CONTRACT_ADDRESSES.nftManager ? "✅ 已配置" : "❌ 未配置"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium text-gray-600">钱包连接:</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      isConnected
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    )}>
                      {isConnected ? "✅ 已连接" : "⚠️ 未连接"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium text-gray-600">网络匹配:</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      chainId === NETWORK_CONFIG.chainId
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    )}>
                      {chainId === NETWORK_CONFIG.chainId ? "✅ 匹配" : "❌ 不匹配"}
                    </span>
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
