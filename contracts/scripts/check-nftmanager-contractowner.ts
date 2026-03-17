import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
const TARGET_ADDRESS = "0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6";
const EXPECTED_OWNER = "0x4561a736b9663948e06371d19541aa1dc5107e1a";

async function main() {
  console.log("🔍 检查 NFTManager 的 contractOwner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signers available");
  }
  const deployer = signers[0];
  console.log("部署者地址:", await deployer.getAddress());
  console.log("");

  // 方法 1: 尝试通过 OwnerFacet 读取（如果已添加）
  console.log("方法 1: 尝试通过 OwnerFacet 读取...");
  try {
    const nftManager = await ethers.getContractAt("OwnerFacet", NFT_MANAGER_ADDRESS);
    const owner = await nftManager.owner();
    console.log("   ✅ Owner (通过 OwnerFacet):", owner);
    console.log("");
    
    if (owner.toLowerCase() === TARGET_ADDRESS.toLowerCase()) {
      console.log("   ✅ Owner 是目标地址（正确）");
    } else if (owner.toLowerCase() === EXPECTED_OWNER.toLowerCase()) {
      console.log("   ✅ Owner 已经是新地址（已转移）");
    } else {
      console.log("   ⚠️  Owner 是其他地址:", owner);
    }
  } catch (e: any) {
    console.log("   ❌ OwnerFacet 未添加，无法读取");
    console.log("");
  }

  // 方法 2: 通过模拟调用 nftManagerCut 来测试
  console.log("方法 2: 通过模拟调用 nftManagerCut 来测试...");
  try {
    const NFTManagerCutFacet = await ethers.getContractAt(
      "NFTManagerCutFacet",
      NFT_MANAGER_ADDRESS
    );

    // 尝试用一个无效的调用，看看错误信息
    const emptyCut: any[] = [];
    try {
      await NFTManagerCutFacet.connect(deployer).nftManagerCut.staticCall(
        emptyCut,
        ethers.ZeroAddress,
        "0x"
      );
      console.log("   ⚠️  调用成功（不应该）");
    } catch (error: any) {
      if (error.message.includes("Must be contract owner")) {
        console.log("   ✅ 确认: deployer 不是 contractOwner");
        console.log("   💡 说明 contractOwner 不是 deployer 地址");
      } else {
        console.log("   ❌ 其他错误:", error.message);
      }
    }
  } catch (e: any) {
    console.log("   ❌ 无法调用:", e.message);
  }

  console.log("");
  console.log("方法 3: 检查最近的 nftManagerCut 交易...");
  console.log("   升级交易: 0x11d9281b852f010b3738d42cc478d5bcfd490e609a9290ca450c9e86137b7bb6");
  console.log("   From 地址:", TARGET_ADDRESS);
  console.log("   💡 这说明 contractOwner 应该是:", TARGET_ADDRESS);
  console.log("");
  console.log("📋 总结:");
  console.log("   - 根据升级交易，contractOwner 应该是目标地址");
  console.log("   - 但如果检查失败，可能是:");
  console.log("     1. contractOwner 已经被转移了");
  console.log("     2. 或者 msg.sender 不是目标地址（EIP-7702 问题）");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

