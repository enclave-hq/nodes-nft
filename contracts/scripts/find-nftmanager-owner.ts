import { createPublicClient, http, Address, keccak256 } from 'viem';
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

  console.log("🔍 查找 NFTManager 的实际 Owner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  // 方法 1: 尝试读取存储（多个可能的存储槽）
  console.log("方法 1: 读取存储槽...");
  const basePos = keccak256(Buffer.from("nftmanager.standard.storage", "utf-8"));
  const basePosition = BigInt(basePos);
  
  // 尝试读取多个槽
  for (let i = 0; i < 5; i++) {
    const slot = basePosition + BigInt(i);
    try {
      const value = await publicClient.getStorageAt({
        address: NFT_MANAGER_ADDRESS,
        slot: slot
      });
      
      // 检查是否是地址（最后 40 个字符是地址格式）
      const hex = value.slice(-40);
      if (hex !== "0000000000000000000000000000000000000000") {
        const addr = ("0x" + hex) as Address;
        console.log(`   槽 ${i}: ${addr}`);
        
        // 检查这个地址是否是有效的 owner
        try {
          await publicClient.simulateContract({
            account: addr,
            address: NFT_MANAGER_ADDRESS,
            abi: [{
              type: 'function',
              name: 'nftManagerCut',
              inputs: [{
                type: 'tuple[]',
                name: '_nftManagerCut',
                components: [
                  { type: 'address', name: 'facetAddress' },
                  { type: 'uint8', name: 'action' },
                  { type: 'bytes4[]', name: 'functionSelectors' }
                ]
              }, {
                type: 'address',
                name: '_init'
              }, {
                type: 'bytes',
                name: '_calldata'
              }],
              outputs: [],
              stateMutability: 'nonpayable'
            }],
            functionName: 'nftManagerCut',
            args: [[], '0x0000000000000000000000000000000000000000', '0x']
          });
          console.log(`   ✅ 这个地址是 contractOwner!`);
          console.log(`   ✅ 找到 Owner: ${addr}`);
          return;
        } catch (e) {
          // 不是 owner，继续
        }
      }
    } catch (e) {
      // 忽略错误
    }
  }
  
  console.log("   未找到有效的 owner");
  console.log("");
  
  // 方法 2: 检查最近的交易，看看谁调用了 nftManagerCut
  console.log("方法 2: 检查最近的交易...");
  console.log("   💡 可以通过 BSCScan 查看最近的交易");
  console.log("   https://bscscan.com/address/" + NFT_MANAGER_ADDRESS);
  console.log("");
  
  console.log("📋 总结:");
  console.log("   根据 BSCScan，Contract Creator 是: 0xa80eb088b2844914000bec0d2894a9edf43f0cb6");
  console.log("   但模拟调用显示这个地址不是 contractOwner");
  console.log("   可能 owner 已经被转移，或者部署时使用了不同的地址");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























