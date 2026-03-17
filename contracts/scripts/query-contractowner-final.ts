import { createPublicClient, http, Address, getAddress, keccak256, toHex } from 'viem';
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

  console.log("🔍 查询 NFTManager 的 contractOwner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  // 方法 1: 尝试通过 OwnerFacet 查询（如果已添加）
  console.log("📋 方法 1: 通过 OwnerFacet 查询...");
  try {
    const owner = await publicClient.readContract({
      address: NFT_MANAGER_ADDRESS,
      abi: [{
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [{ type: 'address', name: '' }],
        stateMutability: 'view'
      }],
      functionName: 'owner'
    });
    console.log(`   ✅ contractOwner: ${owner}`);
    console.log("");
    return;
  } catch (error: any) {
    console.log(`   ⚠️  owner() 调用失败: ${error.message}`);
    console.log("");
  }

  // 方法 2: 尝试通过 contractOwner() 函数查询
  console.log("📋 方法 2: 通过 contractOwner() 函数查询...");
  try {
    const contractOwner = await publicClient.readContract({
      address: NFT_MANAGER_ADDRESS,
      abi: [{
        type: 'function',
        name: 'contractOwner',
        inputs: [],
        outputs: [{ type: 'address', name: '' }],
        stateMutability: 'view'
      }],
      functionName: 'contractOwner'
    });
    console.log(`   ✅ contractOwner: ${contractOwner}`);
    console.log("");
    return;
  } catch (error: any) {
    console.log(`   ⚠️  contractOwner() 调用失败: ${error.message}`);
    console.log("");
  }

  // 方法 3: 查看最近的 nftManagerCut 交易
  console.log("📋 方法 3: 查看最近的 nftManagerCut 交易...");
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock - 5000n; // 最近 5000 个区块
    
    console.log(`   查询范围: 区块 ${fromBlock} 到 ${currentBlock}`);
    
    // 查询 NFTManagerCut 事件
    const logs = await publicClient.getLogs({
      address: NFT_MANAGER_ADDRESS,
      event: {
        type: 'event',
        name: 'NFTManagerCut',
        inputs: [
          { type: 'tuple[]', name: '_nftManagerCut', components: [], indexed: false },
          { type: 'address', name: '_init', indexed: false },
          { type: 'bytes', name: '_calldata', indexed: false }
        ]
      },
      fromBlock: fromBlock,
      toBlock: currentBlock
    });
    
    if (logs.length > 0) {
      console.log(`   ✅ 找到 ${logs.length} 个 nftManagerCut 交易`);
      
      // 获取最近的交易
      const latestLog = logs[logs.length - 1];
      const tx = await publicClient.getTransaction({ hash: latestLog.transactionHash });
      
      console.log(`   最近的交易哈希: ${latestLog.transactionHash}`);
      console.log(`   区块号: ${latestLog.blockNumber}`);
      console.log(`   调用者 (From): ${tx.from}`);
      console.log("");
      console.log(`   ✅ contractOwner 应该是: ${tx.from}`);
      console.log("");
      console.log("   💡 说明: 只有 contractOwner 可以调用 nftManagerCut");
      console.log("");
      return;
    } else {
      console.log("   ⚠️  未找到 nftManagerCut 交易（可能需要查看更早的区块）");
      console.log("");
    }
  } catch (error: any) {
    console.log(`   ⚠️  查询失败: ${error.message}`);
    console.log("");
  }

  // 方法 4: 直接读取存储槽
  console.log("📋 方法 4: 直接读取存储槽...");
  try {
    const NFT_MANAGER_STORAGE_POSITION = keccak256(toHex("nftmanager.standard.storage"));
    const basePosition = BigInt(NFT_MANAGER_STORAGE_POSITION);
    const ownerSlot = basePosition + 1n; // contractOwner 在槽 1
    
    console.log(`   存储位置: ${NFT_MANAGER_STORAGE_POSITION}`);
    console.log(`   Owner 槽: ${ownerSlot}`);
    
    const ownerValue = await publicClient.getStorageAt({
      address: NFT_MANAGER_ADDRESS,
      slot: ownerSlot
    });
    
    if (ownerValue && ownerValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const owner = `0x${ownerValue.slice(26)}` as Address;
      console.log(`   ✅ contractOwner: ${owner}`);
      console.log("");
      return;
    } else {
      console.log("   ⚠️  存储槽返回 0（可能是计算错误或合约未初始化）");
      console.log("");
    }
  } catch (error: any) {
    console.log(`   ⚠️  读取存储槽失败: ${error.message}`);
    console.log("");
  }

  // 方法 5: 查看部署交易
  console.log("📋 方法 5: 查看部署交易...");
  console.log("   BSCScan 链接:");
  console.log(`   https://bscscan.com/address/${NFT_MANAGER_ADDRESS}#code`);
  console.log(`   https://bscscan.com/address/${NFT_MANAGER_ADDRESS}#internaltx`);
  console.log("");
  console.log("   需要查看:");
  console.log("     1. 部署交易的 From 地址（应该是 contractOwner）");
  console.log("     2. 构造函数参数中的 _contractOwner");
  console.log("");

  console.log("❌ 无法通过以上方法确定 contractOwner");
  console.log("   建议:");
  console.log("     1. 查看 BSCScan 上的部署交易");
  console.log("     2. 查看最近的 nftManagerCut 交易（调用者就是 contractOwner）");
  console.log("     3. 或者先添加 OwnerFacet，然后通过 owner() 函数查询");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























