import { createPublicClient, http, Address, getAddress } from 'viem';
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

  try {
    // 方法 1: 通过 owner() 函数查询
    console.log("📋 方法 1: 通过 owner() 函数查询...");
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

    // 方法 2: 通过 contractOwner() 函数查询
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

    console.log("   ❌ 无法通过函数查询，OwnerFacet 可能未添加");
    console.log("   请先运行: npx hardhat run scripts/add-owner-facet-via-eip7702.ts --network bscMainnet");
    
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























