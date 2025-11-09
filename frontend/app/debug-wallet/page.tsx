"use client";

import { useWallet } from "@/lib/providers/WalletProvider";
import { useState } from "react";

export default function WalletDebugPage() {
  const { 
    address, 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect, 
    chainId, 
    hasWallet, 
    connectionError,
    walletManager 
  } = useWallet();
  
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleConnect = async () => {
    addLog("开始连接钱包...");
    try {
      await connect();
      addLog("钱包连接成功！");
    } catch (error) {
      addLog(`连接失败: ${error}`);
    }
  };

  const handleDisconnect = () => {
    addLog("断开钱包连接...");
    disconnect();
    addLog("钱包已断开");
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">钱包连接调试页面</h1>
        
        {/* 钱包状态 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">钱包状态</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">钱包可用:</span>
              <span className={`ml-2 ${hasWallet ? 'text-green-600' : 'text-red-600'}`}>
                {hasWallet ? '是' : '否'}
              </span>
            </div>
            <div>
              <span className="font-medium">连接状态:</span>
              <span className={`ml-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>
            <div>
              <span className="font-medium">连接中:</span>
              <span className={`ml-2 ${isConnecting ? 'text-yellow-600' : 'text-gray-600'}`}>
                {isConnecting ? '是' : '否'}
              </span>
            </div>
            <div>
              <span className="font-medium">链ID:</span>
              <span className="ml-2">{chainId || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium">地址:</span>
              <span className="ml-2 font-mono text-sm">{address || 'N/A'}</span>
            </div>
            {connectionError && (
              <div className="col-span-2">
                <span className="font-medium text-red-600">错误:</span>
                <span className="ml-2 text-red-600">{connectionError}</span>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">操作</h2>
          <div className="flex gap-4">
            <button
              onClick={handleConnect}
              disabled={isConnecting || !hasWallet || isConnected}
              className="px-4 py-2 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isConnecting ? '连接中...' : '连接钱包'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={!isConnected}
              className="px-4 py-2 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              断开连接
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-[#E5F240] text-black rounded hover:bg-[#D4E238]"
            >
              清除日志
            </button>
          </div>
        </div>

        {/* 日志 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">日志</h2>
          <div className="bg-gray-100 rounded p-4 h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">暂无日志</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-sm font-mono mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 调试信息 */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">调试信息</h2>
          <div className="bg-gray-100 rounded p-4">
            <pre className="text-sm">
              {JSON.stringify({
                windowEthereum: typeof window !== 'undefined' ? !!window.ethereum : false,
                walletManagerExists: !!walletManager,
                userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
                timestamp: new Date().toISOString(),
              }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
