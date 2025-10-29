"use client";

import { useState } from "react";

export default function WalletConnectionTester() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testBasicConnection = async () => {
    setIsTesting(true);
    addLog("开始基础连接测试...");
    
    try {
      // 测试1: 检查window.ethereum
      addLog("测试1: 检查window.ethereum...");
      if (typeof window === 'undefined') {
        addLog("❌ 服务端环境，无法测试");
        return;
      }
      
      if (!window.ethereum) {
        addLog("❌ window.ethereum 不存在");
        return;
      }
      addLog("✅ window.ethereum 存在");

      // 测试2: 检查钱包是否锁定
      addLog("测试2: 检查钱包状态...");
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        addLog(`✅ 钱包账户: ${accounts.length} 个`);
        if (accounts.length > 0) {
          addLog(`✅ 当前账户: ${accounts[0]}`);
        }
      } catch (error) {
        addLog(`❌ 检查账户失败: ${error}`);
      }

      // 测试3: 检查网络
      addLog("测试3: 检查网络...");
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        addLog(`✅ 当前链ID: ${chainId} (${parseInt(chainId, 16)})`);
      } catch (error) {
        addLog(`❌ 检查网络失败: ${error}`);
      }

      // 测试4: 尝试请求连接
      addLog("测试4: 尝试请求连接...");
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        addLog(`✅ 连接成功: ${accounts[0]}`);
      } catch (error: any) {
        addLog(`❌ 连接失败: ${error.message} (code: ${error.code})`);
      }

    } catch (error: any) {
      addLog(`❌ 测试失败: ${error.message}`);
    } finally {
      setIsTesting(false);
      addLog("测试完成");
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">钱包连接测试工具</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">快速测试</h2>
          <div className="flex gap-4">
            <button
              onClick={testBasicConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isTesting ? '测试中...' : '开始测试'}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              清除日志
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试日志</h2>
          <div className="bg-gray-100 rounded p-4 h-96 overflow-y-auto">
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

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">故障排除指南</h2>
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">1. 钱包弹窗没有出现</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li>检查浏览器是否阻止了弹窗</li>
                <li>确保MetaMask扩展已安装并启用</li>
                <li>尝试刷新页面重新连接</li>
                <li>检查MetaMask是否锁定</li>
              </ul>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">2. 连接超时</h3>
              <ul className="list-disc list-inside text-yellow-800 space-y-1">
                <li>检查网络连接是否正常</li>
                <li>确保MetaMask网络设置正确</li>
                <li>尝试切换到BSC Testnet</li>
                <li>重启MetaMask扩展</li>
              </ul>
            </div>
            
            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">3. 用户拒绝错误</h3>
              <ul className="list-disc list-inside text-red-800 space-y-1">
                <li>在钱包弹窗中点击"连接"或"Approve"</li>
                <li>不要点击"拒绝"或"Cancel"</li>
                <li>确保钱包已解锁</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
