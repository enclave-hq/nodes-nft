import { createPublicClient, http, Address, getAddress, encodeFunctionData } from 'viem';
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

  console.log("🔍 检查 OwnerFacet 是否已添加...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  try {
    // 方法 1: 使用 facetAddress 查询（如果 NFTManagerLoupeFacet 有这个方法）
    console.log("📋 方法 1: 查询所有 Facet 地址...");
    try {
      const facetAddresses = await publicClient.readContract({
        address: NFT_MANAGER_ADDRESS,
        abi: [{
          type: 'function',
          name: 'facetAddresses',
          inputs: [],
          outputs: [{ type: 'address[]', name: '' }],
          stateMutability: 'view'
        }],
        functionName: 'facetAddresses'
      });
      console.log(`   ✅ Facet 地址数量: ${facetAddresses.length}`);
      facetAddresses.forEach((addr, idx) => {
        console.log(`      ${idx + 1}. ${addr}`);
      });
      console.log("");
    } catch (error: any) {
      console.log(`   ⚠️  facetAddresses() 调用失败: ${error.message}`);
      console.log("");
    }

    // 方法 2: 使用 facetFunctionSelectors 查询 owner() 函数
    console.log("📋 方法 2: 查询 owner() 函数的 Facet 地址...");
    try {
      // owner() 函数选择器: 0x8da5cb5b
      const ownerSelector = "0x8da5cb5b";
      const facetAddress = await publicClient.readContract({
        address: NFT_MANAGER_ADDRESS,
        abi: [{
          type: 'function',
          name: 'facetAddress',
          inputs: [{ type: 'bytes4', name: 'functionSelector' }],
          outputs: [{ type: 'address', name: '' }],
          stateMutability: 'view'
        }],
        functionName: 'facetAddress',
        args: [ownerSelector as `0x${string}`]
      });
      console.log(`   ✅ owner() 函数的 Facet 地址: ${facetAddress}`);
      if (facetAddress === "0x0000000000000000000000000000000000000000") {
        console.log("   ⚠️  Facet 地址是零地址，说明函数未添加");
      } else {
        console.log("   ✅ owner() 函数已添加！");
      }
      console.log("");
    } catch (error: any) {
      console.log(`   ⚠️  facetAddress() 调用失败: ${error.message}`);
      console.log("");
    }

    // 方法 3: 直接调用 owner() 函数
    console.log("📋 方法 3: 直接调用 owner() 函数...");
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























