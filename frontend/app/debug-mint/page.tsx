"use client";

import { useState } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { CONTRACT_ADDRESSES, GAS_CONFIG } from "@/lib/contracts/config";
import { NFT_MANAGER_ABI, ERC20_ABI } from "@/lib/contracts/abis";

export default function NFTMintDebugger() {
  const { address, walletManager, isConnected } = useWallet();
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testMintConditions = async () => {
    if (!isConnected || !address || !walletManager) {
      addLog("❌ 钱包未连接");
      return;
    }

    setIsTesting(true);
    addLog("🔍 开始检查NFT铸造条件...");

    try {
      // 检查1: 合约地址
      addLog(`📋 合约地址信息:`);
      addLog(`- NFT管理器: ${CONTRACT_ADDRESSES.nftManager}`);
      addLog(`- USDT合约: ${CONTRACT_ADDRESSES.usdt}`);
      addLog(`- 用户地址: ${address}`);

      // 检查2: USDT余额
      addLog("🔍 检查USDT余额...");
      const usdtBalance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'balanceOf',
        [address]
      );
      addLog(`✅ USDT余额: ${usdtBalance.toString()}`);

      // 检查3: USDT授权
      addLog("🔍 检查USDT授权...");
      const allowance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      );
      addLog(`✅ USDT授权: ${allowance.toString()}`);

      // 检查4: NFT管理器状态
      addLog("🔍 检查NFT管理器状态...");
      try {
        const nextOrderId = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as any[],
          'nextOrderId',
          []
        );
        addLog(`✅ 下一个订单ID: ${nextOrderId.toString()}`);
      } catch (error: any) {
        addLog(`❌ 无法读取nextOrderId: ${error.message}`);
      }

      // 检查6: NFT配置（所有NFT统一配置）
      addLog("🔍 检查NFT配置...");
      addLog(`- 所有NFT统一配置，每个NFT包含 2000 $E`);

      // 检查7: 检查Gas配置
      addLog("🔍 检查Gas配置...");
      addLog(`- mintNFT gas limit: ${GAS_CONFIG.gasLimits.mintNFT}`);

    } catch (error: any) {
      addLog(`❌ 检查失败: ${error.message}`);
      addLog(`❌ 错误详情: ${JSON.stringify(error, null, 2)}`);
    } finally {
      setIsTesting(false);
      addLog("🏁 条件检查完成");
    }
  };

  const testMintNFT = async () => {
    if (!isConnected || !address || !walletManager) {
      addLog("❌ 钱包未连接");
      return;
    }

    setIsTesting(true);
    addLog(`🔍 开始测试铸造NFT...`);

    try {
      // 获取激活批次价格
      addLog("🔍 获取激活批次信息...");
      const activeBatchId = await walletManager.readContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as any[],
        'getActiveBatch',
        []
      ) as bigint;
      
      if (activeBatchId === 0n) {
        addLog("❌ 没有激活的批次");
        setIsTesting(false);
        return;
      }
      
      const batchData = await walletManager.readContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as any[],
        'batches',
        [activeBatchId]
      ) as [bigint, bigint, bigint, bigint, boolean, bigint];
      
      const [, , , mintPriceWei, , ] = batchData;
      addLog(`✅ 批次ID: ${activeBatchId.toString()}`);
      addLog(`✅ 铸造价格: ${mintPriceWei.toString()} wei`);
      
      const mintPrice = Number(mintPriceWei) / 1e18;
      addLog(`📋 铸造信息:`);
      addLog(`- Mint价格: ${mintPrice.toFixed(2)} USDT`);
      addLog(`- Mint价格(wei): ${mintPriceWei.toString()}`);

      // 检查授权是否足够
      addLog("🔍 检查授权是否足够...");
      const allowance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as any[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      );

      if (BigInt(allowance.toString()) < mintPriceWei) {
        addLog(`❌ 授权不足，需要先授权USDT`);
        addLog(`- 当前授权: ${allowance.toString()}`);
        addLog(`- 需要授权: ${mintPriceWei.toString()}`);
        return;
      }

      addLog("✅ 授权检查通过");

      // 尝试铸造NFT
      addLog("🎨 开始铸造NFT...");
      addLog(`📋 铸造参数:`);
      addLog(`- 合约地址: ${CONTRACT_ADDRESSES.nftManager}`);
      addLog(`- 批次ID: ${activeBatchId.toString()}`);
      addLog(`- Gas limit: 500000`);
      addLog(`- 用户地址: ${address}`);
      
      const mintTxHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as any[],
        'mintNFT',
        [], // No parameters - price comes from active batch
        {
          gas: 500000, // 增加gas limit
          // gasPrice: 让Wallet SDK自动获取
        }
      );

      addLog(`✅ NFT铸造交易哈希: ${mintTxHash}`);
      addLog(`🔗 交易链接: https://testnet.bscscan.com/tx/${mintTxHash}`);

      // 等待确认
      addLog("⏳ 等待NFT铸造确认...");
      const receipt = await walletManager.waitForTransaction(mintTxHash);
      
      addLog(`✅ NFT铸造确认完成:`);
      addLog(`📋 交易详情:`);
      addLog(`- 状态: ${receipt.status}`);
      addLog(`- Gas使用: ${receipt.gasUsed?.toString()}`);
      addLog(`- Gas价格: ${(receipt as any).gasPrice?.toString()}`);
      addLog(`- 区块号: ${receipt.blockNumber?.toString()}`);
      addLog(`- 区块哈希: ${receipt.blockHash}`);
      addLog(`- 交易索引: ${(receipt as any).transactionIndex?.toString()}`);

      if (receipt.status === 'success' || (receipt as any).status === '0x1') {
        addLog("🎉 NFT铸造成功！");
        
        // 分析交易日志
        if (receipt.logs && receipt.logs.length > 0) {
          addLog(`📋 交易事件日志 (${receipt.logs.length}个事件):`);
          receipt.logs.forEach((log, index) => {
            addLog(`- 事件${index}: ${JSON.stringify({
              address: log.address,
              topics: log.topics,
              data: log.data,
            })}`);
          });
        } else {
          addLog("⚠️ 没有交易事件日志");
        }
      } else {
        addLog("❌ NFT铸造失败");
        addLog(`- 失败状态: ${receipt.status}`);
      }

    } catch (error: any) {
      addLog(`❌ NFT铸造失败: ${error.message}`);
      addLog(`❌ 错误详情: ${JSON.stringify(error, null, 2)}`);
      
      // 检查是否是特定的revert原因
      if (error.message.includes('Transaction reverted')) {
        addLog("🔍 交易被revert，可能的原因:");
        addLog("- 合约逻辑检查失败");
        addLog("- 用户余额不足");
        addLog("- 授权金额不足");
        addLog("- 合约状态不正确");
        addLog("- Gas limit不足");
      }
    } finally {
      setIsTesting(false);
      addLog("🏁 NFT铸造测试完成");
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">NFT铸造调试工具</h1>
        
        {!isConnected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">请先连接钱包</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试操作</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testMintConditions}
              disabled={isTesting || !isConnected}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isTesting ? '检查中...' : '检查铸造条件'}
            </button>
            <button
              onClick={() => testMintNFT()}
              disabled={isTesting || !isConnected}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isTesting ? '铸造中...' : '铸造NFT'}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
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
