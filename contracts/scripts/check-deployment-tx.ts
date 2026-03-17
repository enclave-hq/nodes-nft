import { createPublicClient, http, Address } from 'viem';
import { bsc } from 'viem/chains';
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774" as Address;
const EXPECTED_OWNER = "0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6" as Address;

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  console.log("🔍 检查 NFTManager 部署信息...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log(`   期望 Owner (从部署脚本): ${EXPECTED_OWNER}`);
  console.log("");

  // 1. 检查合约代码
  const code = await publicClient.getBytecode({ address: NFT_MANAGER_ADDRESS });
  console.log(`   ✅ 合约代码长度: ${code ? code.length : 0} 字节`);
  console.log("");

  // 2. 尝试模拟调用 nftManagerCut，验证 owner
  console.log("   测试: 尝试模拟调用 nftManagerCut...");
  try {
    await publicClient.simulateContract({
      account: EXPECTED_OWNER,
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
    console.log("   ✅ 模拟调用成功！说明 expectedOwner 是 contractOwner");
    console.log(`   ✅ 确认: contractOwner = ${EXPECTED_OWNER}`);
  } catch (error: any) {
    if (error.message?.includes('Must be contract owner') || error.message?.includes('contract owner')) {
      console.log("   ❌ 模拟调用失败: expectedOwner 不是 contractOwner");
      console.log(`   错误: ${error.message}`);
    } else {
      console.log("   ⚠️  其他错误:", error.message);
    }
  }

  console.log("");
  console.log("📋 结论:");
  console.log("   根据部署脚本，NFTManager 的 constructor 参数是:");
  console.log(`   - _contractOwner: ${EXPECTED_OWNER}`);
  console.log("   所以 contractOwner 应该是这个地址");
  console.log("");
  console.log("💡 如果存储读取返回 0，可能是:");
  console.log("   1. 存储槽计算错误");
  console.log("   2. 需要重新检查存储布局");
  console.log("   3. 或者直接使用 EIP-7702 恢复，因为 owner 确实是目标地址");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























