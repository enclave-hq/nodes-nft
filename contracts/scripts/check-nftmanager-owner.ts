import { createPublicClient, http, Address, keccak256 } from 'viem';
import { bsc } from 'viem/chains';
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774" as Address;
const EXPECTED_OWNER = "0x4561a736b9663948e06371d19541aa1dc5107e1a" as Address;

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  console.log("🔍 检查 NFTManager 的 Owner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log(`   期望 Owner: ${EXPECTED_OWNER}`);
  console.log("");

  try {
    // 存储位置: keccak256("nftmanager.standard.storage")
    // 计算存储槽
    const basePositionHex = keccak256(
      Buffer.from("nftmanager.standard.storage", "utf-8")
    );
    const basePosition = BigInt(basePositionHex);
    
    // NFTManagerStorage 结构体布局：
    // - mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition; // 不占槽
    // - mapping(address => FacetFunctionSelectors) facetFunctionSelectors; // 不占槽
    // - address[] facetAddresses; // 槽 0: 数组长度
    // - mapping(bytes4 => bool) supportedInterfaces; // 不占槽
    // - address contractOwner; // 槽 1
    
    const facetAddressesSlot = basePosition; // 槽 0: 数组长度
    const ownerSlot = basePosition + 1n; // 槽 1: contractOwner
    
    console.log(`   Base position: ${basePosition.toString()}`);
    console.log(`   Base position (hex): 0x${basePosition.toString(16)}`);
    console.log(`   Facet addresses slot: ${facetAddressesSlot.toString()}`);
    console.log(`   Owner slot: ${ownerSlot.toString()}`);
    console.log(`   Owner slot (hex): 0x${ownerSlot.toString(16)}`);
    console.log("");

    // 先读取数组长度（验证存储槽是否正确）
    const arrayLength = await publicClient.getStorageAt({
      address: NFT_MANAGER_ADDRESS,
      slot: facetAddressesSlot
    });
    console.log(`   Facet addresses 数组长度: ${BigInt(arrayLength).toString()}`);
    console.log("");

    // 读取 owner
    const storageValue = await publicClient.getStorageAt({
      address: NFT_MANAGER_ADDRESS,
      slot: ownerSlot
    });
    
    console.log(`   存储值: ${storageValue}`);
    
    // 存储值是 bytes32，最后 20 字节是地址
    const ownerHex = storageValue.slice(-40);
    const owner = ("0x" + ownerHex) as Address;
    
    console.log("");
    console.log(`   当前 Owner: ${owner}`);
    
    if (owner.toLowerCase() === EXPECTED_OWNER.toLowerCase()) {
      console.log("");
      console.log("   ✅ Owner 已成功转移！");
    } else {
      console.log("");
      console.log("   ❌ Owner 尚未转移");
      console.log(`   当前: ${owner}`);
      console.log(`   期望: ${EXPECTED_OWNER}`);
    }
  } catch (error) {
    console.error("   ❌ 读取存储失败:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

