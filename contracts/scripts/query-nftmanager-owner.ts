import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";

async function main() {
  console.log("🔍 查询 NFTManager Owner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  // 方法 1: 尝试通过 OwnerFacet 读取（如果已添加）
  console.log("📋 方法 1: 通过 OwnerFacet 读取");
  try {
    const nftManager = await ethers.getContractAt("OwnerFacet", NFT_MANAGER_ADDRESS);
    const owner = await nftManager.owner();
    console.log("   ✅ Owner (通过 OwnerFacet):", owner);
    console.log("");
    return;
  } catch (e: any) {
    console.log("   ❌ OwnerFacet 未添加或调用失败:", e.message);
    console.log("");
  }

  // 方法 2: 尝试通过 AdminFacet 读取（如果 master 是 owner）
  console.log("📋 方法 2: 通过 AdminFacet 读取 master");
  try {
    const nftManager = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
    const master = await nftManager.master();
    console.log("   Master:", master);
    console.log("   ⚠️  Master 不一定是 Owner");
    console.log("");
  } catch (e: any) {
    console.log("   ❌ AdminFacet 调用失败:", e.message);
    console.log("");
  }

  // 方法 3: 查看最近的 nftManagerCut 交易
  console.log("📋 方法 3: 查看最近的 nftManagerCut 交易");
  console.log("   升级交易: 0x11d9281b852f010b3738d42cc478d5bcfd490e609a9290ca450c9e86137b7bb6");
  console.log("   From 地址: 0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6");
  console.log("   💡 这个地址应该是 contractOwner");
  console.log("");

  // 方法 4: 尝试添加 OwnerFacet 然后读取
  console.log("📋 方法 4: 添加 OwnerFacet 然后读取");
  console.log("   ⚠️  需要 owner 权限");
  console.log("   如果目标地址已被盗，无法添加");
  console.log("");

  console.log("💡 结论:");
  console.log("   根据升级交易，contractOwner 应该是:");
  console.log("   0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























