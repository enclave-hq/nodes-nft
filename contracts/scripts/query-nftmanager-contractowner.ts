import { createPublicClient, http, Address, keccak256, toHex, encodeFunctionData } from 'viem';
import { bsc } from 'viem/chains';
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774" as Address;

// ReadContractOwner 合约的 ABI（简化版，只包含我们需要调用的函数）
const READ_OWNER_ABI = [
  {
    type: 'function',
    name: 'readOwner',
    inputs: [{ type: 'address', name: 'nftManager' }],
    outputs: [{ type: 'address', name: 'contractOwner' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'readOwnerInternal',
    inputs: [],
    outputs: [{ type: 'address', name: 'contractOwner' }],
    stateMutability: 'view'
  }
] as const;

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
    // 方法 1: 通过 EIP7702RecoveryProxy 的 readNFTManagerOwner 函数
    // 注意：这需要先部署 ReadContractOwner 合约，或者通过 nftManagerCut 添加一个 Facet
    // 但实际上，最简单的方法是直接通过 delegatecall 调用
    console.log("📋 方法 1: 通过 delegatecall 调用 LibNFTManager.contractOwner()...");
    console.log("   注意：这需要先部署一个读取合约，或者通过 nftManagerCut 添加 Facet");
    console.log("   目前最简单的方法是检查 BSCScan 上的 nftManagerCut 调用");
    console.log("");

    // 方法 2: 直接读取存储槽
    console.log("📋 方法 2: 直接读取存储槽...");
    const basePositionHex = keccak256(
      Buffer.from("nftmanager.standard.storage", "utf-8")
    );
    const basePosition = BigInt(basePositionHex);
    const ownerSlot = basePosition + 1n;
    
    console.log(`   Base position: 0x${basePosition.toString(16)}`);
    console.log(`   Owner slot: 0x${ownerSlot.toString(16)}`);
    console.log("");

    const storageValue = await publicClient.getStorageAt({
      address: NFT_MANAGER_ADDRESS,
      slot: ownerSlot
    });
    
    console.log(`   存储值: ${storageValue}`);
    
    // 存储值是 bytes32，最后 20 字节是地址
    const ownerHex = storageValue.slice(-40);
    const owner = ("0x" + ownerHex) as Address;
    
    console.log("");
    console.log(`   ✅ contractOwner: ${owner}`);
    console.log("");
    
    // 验证是否是零地址
    if (owner === "0x0000000000000000000000000000000000000000") {
      console.log("   ⚠️  警告: contractOwner 是零地址！");
      console.log("   这可能表示:");
      console.log("   1. 存储槽计算错误");
      console.log("   2. 或者合约确实没有设置 owner");
    }
    
    // 方法 3: 读取 facetAddresses 数组长度（验证存储槽是否正确）
    console.log("");
    console.log("📋 方法 3: 验证存储槽（读取 facetAddresses 数组长度）...");
    const facetAddressesSlot = basePosition;
    const arrayLengthValue = await publicClient.getStorageAt({
      address: NFT_MANAGER_ADDRESS,
      slot: facetAddressesSlot
    });
    const arrayLength = BigInt(arrayLengthValue);
    console.log(`   facetAddresses.length: ${arrayLength.toString()}`);
    
    if (arrayLength === 0n) {
      console.log("   ⚠️  警告: facetAddresses 数组长度为 0！");
      console.log("   这可能表示存储槽计算错误，或者合约确实没有 Facet");
    } else {
      console.log(`   ✅ 存储槽计算正确（有 ${arrayLength.toString()} 个 Facet）`);
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

