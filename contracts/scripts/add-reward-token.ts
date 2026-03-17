import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

  const [signer] = await ethers.getSigners();
  console.log("签名账户:", signer.address);

  const adminFacet = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
  const rewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);

  // 查看当前 reward tokens
  const currentTokens = await rewardFacet.getRewardTokens();
  console.log("当前 reward tokens:", currentTokens);

  if (currentTokens.map((t: string) => t.toLowerCase()).includes(USDT_ADDRESS.toLowerCase())) {
    console.log("✅ USDT 已在列表中，无需操作");
    return;
  }

  console.log("➕ 添加 USDT 为 reward token ...");
  const tx = await adminFacet.addRewardToken(USDT_ADDRESS);
  console.log("   交易:", tx.hash);
  await tx.wait();
  console.log("   ✅ 完成");

  const newTokens = await rewardFacet.getRewardTokens();
  console.log("更新后 reward tokens:", newTokens);
}

main().then(() => process.exit(0)).catch(e => { console.error("❌", e.message); process.exit(1); });
