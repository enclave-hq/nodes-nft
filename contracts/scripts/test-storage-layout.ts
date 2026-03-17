import { createPublicClient, http, keccak256, Address } from 'viem';
import { bsc } from 'viem/chains';
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774" as Address;

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  console.log("🔍 测试存储布局和读取...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  // 计算 base position
  const basePos = keccak256(Buffer.from("nftmanager.standard.storage", "utf-8"));
  const basePosition = BigInt(basePos);
  
  console.log("Base position:", basePos);
  console.log("");

  // 检查多个存储槽
  console.log("检查存储槽 0-10:");
  for (let i = 0; i <= 10; i++) {
    const slot = basePosition + BigInt(i);
    try {
      const value = await publicClient.getStorageAt({
        address: NFT_MANAGER_ADDRESS,
        slot: slot
      });
      
      if (BigInt(value) !== 0n) {
        console.log(`  槽 ${i}: ${value}`);
        
        // 检查是否是地址
        const hex = value.slice(-40);
        if (hex !== "0000000000000000000000000000000000000000") {
          const addr = "0x" + hex;
          console.log(`    可能是地址: ${addr}`);
        }
      }
    } catch (e) {
      console.log(`  槽 ${i}: 读取失败`);
    }
  }
  
  console.log("");
  console.log("📋 nftManagerCut 安全要求:");
  console.log("   1. 只有 contractOwner 可以调用");
  console.log("   2. 检查: LibNFTManager.enforceIsContractOwner()");
  console.log("   3. 要求: msg.sender == nftManagerStorage().contractOwner");
  console.log("");
  console.log("💡 升级交易显示 deployer 地址可以调用 nftManagerCut");
  console.log("   说明 owner 确实是 deployer 地址");
  console.log("   但存储读取返回 0，可能是存储槽计算或读取方式问题");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























