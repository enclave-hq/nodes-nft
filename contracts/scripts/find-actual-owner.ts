import { createPublicClient, http, Address, getAddress, decodeEventLog } from 'viem';
import { bsc } from 'viem/chains';
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = getAddress("0xD9eA9F4B8F24872262568fB2C6133117EC02C774") as Address;

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  console.log("🔍 查找 NFTManager 的实际 contractOwner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  try {
    // 方法 1: 查看最近的 nftManagerCut 交易
    console.log("📋 方法 1: 查看最近的 nftManagerCut 交易...");
    console.log("   查询最近的交易日志...");
    console.log("");
    
    // NFTManagerCut 事件的签名
    // event NFTManagerCut(INFTManagerCut.FacetCut[] _nftManagerCut, address _init, bytes _calldata);
    const nftManagerCutTopic = "0x8faa70878671ccd212d20771b795c50af8fd3ae6af3a072c6079353d54437c45";
    
    // 获取最近的区块
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock - 10000n; // 最近 10000 个区块
    
    console.log(`   查询范围: 区块 ${fromBlock} 到 ${currentBlock}`);
    console.log("");
    
    try {
      const logs = await publicClient.getLogs({
        address: NFT_MANAGER_ADDRESS,
        event: {
          type: 'event',
          name: 'NFTManagerCut',
          inputs: [
            { type: 'tuple[]', name: '_nftManagerCut', components: [] },
            { type: 'address', name: '_init', indexed: false },
            { type: 'bytes', name: '_calldata', indexed: false }
          ]
        },
        fromBlock: fromBlock,
        toBlock: currentBlock
      });
      
      if (logs.length > 0) {
        console.log(`   ✅ 找到 ${logs.length} 个 nftManagerCut 交易`);
        console.log("");
        
        // 获取最近的交易
        const latestLog = logs[logs.length - 1];
        const tx = await publicClient.getTransaction({ hash: latestLog.transactionHash });
        
        console.log("   最近的 nftManagerCut 交易:");
        console.log(`     交易哈希: ${latestLog.transactionHash}`);
        console.log(`     区块号: ${latestLog.blockNumber}`);
        console.log(`     调用者 (From): ${tx.from}`);
        console.log("");
        console.log(`   ✅ contractOwner 应该是: ${tx.from}`);
        console.log("");
        
        // 检查是否是目标地址
        const targetAddress = getAddress("0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6");
        if (tx.from.toLowerCase() === targetAddress.toLowerCase()) {
          console.log(`   ✅ 确认: 目标地址 ${targetAddress} 是 contractOwner！`);
        } else {
          console.log(`   ❌ 目标地址 ${targetAddress} 不是 contractOwner`);
          console.log(`   💡 实际的 contractOwner 是: ${tx.from}`);
        }
      } else {
        console.log("   ⚠️  未找到 nftManagerCut 交易");
        console.log("   可能需要查看更早的区块，或者查看部署交易");
      }
    } catch (error: any) {
      console.log(`   ⚠️  查询日志失败: ${error.message}`);
      console.log("   尝试方法 2...");
    }
    
    console.log("");
    
    // 方法 2: 查看部署交易
    console.log("📋 方法 2: 查看部署交易...");
    console.log("   BSCScan 链接:");
    console.log(`   https://bscscan.com/address/${NFT_MANAGER_ADDRESS}#code`);
    console.log(`   https://bscscan.com/address/${NFT_MANAGER_ADDRESS}#internaltx`);
    console.log("");
    console.log("   需要查看:");
    console.log("     1. 部署交易的 From 地址（应该是 contractOwner）");
    console.log("     2. 构造函数参数中的 _contractOwner");
    console.log("");
    
  } catch (error: any) {
    console.error("   ❌ 查询失败:", error.message);
    console.error(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























