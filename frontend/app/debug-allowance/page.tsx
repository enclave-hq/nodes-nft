"use client";

import { useState } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { ERC20_ABI } from "@/lib/contracts/abis";

export default function AllowanceDebugger() {
  const { address, walletManager, isConnected } = useWallet();
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testAllowance = async () => {
    if (!isConnected || !address || !walletManager) {
      addLog("❌ 钱包未连接");
      return;
    }

    setIsTesting(true);
    addLog("🔍 开始测试USDT授权...");

    try {
      // 测试1: 检查合约地址
      addLog(`📋 合约地址信息:`);
      addLog(`- USDT合约: ${CONTRACT_ADDRESSES.usdt}`);
      addLog(`- NFT管理器: ${CONTRACT_ADDRESSES.nftManager}`);
      addLog(`- 用户地址: ${address}`);

      // 测试2: 检查USDT余额
      addLog("🔍 检查USDT余额...");
      const balance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'balanceOf',
        [address]
      );
      addLog(`✅ USDT余额: ${balance.toString()}`);

      // 测试3: 检查当前授权
      addLog("🔍 检查当前授权...");
      const allowance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      );
      addLog(`✅ 当前授权: ${allowance.toString()}`);

      // 测试4: 检查授权是否足够
      const mintPrice = "10000000000000000000000"; // 10,000 USDT (18 decimals)
      const mintPriceBigInt = BigInt(mintPrice);
      const allowanceBigInt = BigInt(allowance.toString());
      
      addLog(`🔍 授权比较:`);
      addLog(`- 需要授权: ${mintPriceBigInt.toString()}`);
      addLog(`- 当前授权: ${allowanceBigInt.toString()}`);
      addLog(`- 是否足够: ${allowanceBigInt >= mintPriceBigInt ? '✅ 是' : '❌ 否'}`);

      if (allowanceBigInt < mintPriceBigInt) {
        addLog(`❌ 授权不足，缺少: ${(mintPriceBigInt - allowanceBigInt).toString()}`);
      } else {
        addLog(`✅ 授权充足`);
      }

      // 测试5: 检查USDT合约的decimals
      addLog("🔍 检查USDT decimals...");
      const decimals = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'decimals',
        []
      );
      addLog(`✅ USDT decimals: ${decimals}`);

    } catch (error: any) {
      addLog(`❌ 测试失败: ${error.message}`);
      addLog(`❌ 错误详情: ${JSON.stringify(error, null, 2)}`);
    } finally {
      setIsTesting(false);
      addLog("🏁 测试完成");
    }
  };

  const testApprove = async () => {
    if (!isConnected || !address || !walletManager) {
      addLog("❌ 钱包未连接");
      return;
    }

    setIsTesting(true);
    addLog("🔍 开始测试USDT授权...");

    try {
      const approveAmount = "10000000000000000000000"; // 10,000 USDT
      
      addLog(`📋 授权信息:`);
      addLog(`- 授权金额: ${approveAmount}`);
      addLog(`- 授权给: ${CONTRACT_ADDRESSES.nftManager}`);

      // 执行授权
      addLog("📝 执行USDT授权...");
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'approve',
        [CONTRACT_ADDRESSES.nftManager, approveAmount]
      );

      addLog(`✅ 授权交易哈希: ${txHash}`);

      // 等待确认
      addLog("⏳ 等待授权确认...");
      const receipt = await walletManager.waitForTransaction(txHash);
      
      addLog(`✅ 授权确认完成:`);
      addLog(`- 状态: ${receipt.status}`);
      addLog(`- Gas使用: ${receipt.gasUsed?.toString()}`);
      addLog(`- 区块号: ${receipt.blockNumber?.toString()}`);

      // 等待状态更新
      addLog("⏳ 等待状态更新...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 验证授权
      addLog("🔍 验证授权结果...");
      const newAllowance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      );

      addLog(`✅ 新授权金额: ${newAllowance.toString()}`);
      
      if (BigInt(newAllowance.toString()) >= BigInt(approveAmount)) {
        addLog("✅ 授权成功！");
      } else {
        addLog("❌ 授权失败，金额不匹配");
      }

    } catch (error: any) {
      addLog(`❌ 授权失败: ${error.message}`);
      addLog(`❌ 错误详情: ${JSON.stringify(error, null, 2)}`);
    } finally {
      setIsTesting(false);
      addLog("🏁 授权测试完成");
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">USDT授权调试工具</h1>
        
        {!isConnected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">请先连接钱包</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试操作</h2>
          <div className="flex gap-4">
            <button
              onClick={testAllowance}
              disabled={isTesting || !isConnected}
              className="px-4 py-2 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isTesting ? '测试中...' : '检查授权状态'}
            </button>
            <button
              onClick={testApprove}
              disabled={isTesting || !isConnected}
              className="px-4 py-2 bg-[#E5F240] text-black rounded hover:bg-[#D4E238] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isTesting ? '测试中...' : '测试授权'}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-[#E5F240] text-black rounded hover:bg-[#D4E238]"
            >
              清除日志
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
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
      </div>
    </div>
  );
}
