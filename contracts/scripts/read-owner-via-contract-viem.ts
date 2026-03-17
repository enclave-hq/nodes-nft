import { createPublicClient, http, createWalletClient, custom, Address } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774" as Address;

// TestStorageReader ABI (只需要 readOwner 函数)
const TEST_STORAGE_READER_ABI = [
  {
    inputs: [{ name: "nftManager", type: "address" }],
    name: "readOwner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "nftManager", type: "address" }],
    name: "readFacetAddressesLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log("🔍 通过合约读取 NFTManager Owner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  // 需要部署 TestStorageReader 合约
  // 但我们可以先尝试直接读取存储槽（使用合约的方式）
  // 或者，我们可以部署一个简单的合约来读取

  console.log("📋 方案: 部署 TestStorageReader 合约，然后调用它");
  console.log("");

  // 检查是否有私钥用于部署
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log("❌ 需要 PRIVATE_KEY 来部署合约");
    console.log("   或者使用已部署的合约地址");
    console.log("");
    console.log("💡 建议: 先手动部署 TestStorageReader，然后使用其地址");
    return;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("部署者地址:", account.address);
  console.log("");

  const walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: http(rpcUrl)
  });

  // 部署 TestStorageReader
  console.log("1. 部署 TestStorageReader 合约...");
  
  // 读取合约字节码（需要先编译）
  // 这里我们使用一个更简单的方法：直接使用合约地址（如果已部署）
  
  // 或者，我们可以使用 ethers 来部署（但需要配置）
  console.log("   ⚠️  需要先编译合约");
  console.log("   请运行: npx hardhat compile");
  console.log("");
  console.log("💡 或者，使用已部署的合约地址（如果之前部署过）");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























