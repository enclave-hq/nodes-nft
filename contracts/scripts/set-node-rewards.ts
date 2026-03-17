import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

  const REWARD_PER_NFT = process.env.REWARD_PER_NFT || "18.39";
  const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT || "300";

  console.log("💰 distributeRewardV2 — 记账 + 充值（先到先得）\n");
  console.log("NFT Manager:", NFT_MANAGER_ADDRESS);
  console.log("USDT:", USDT_ADDRESS);
  console.log("=".repeat(80));
  console.log("");

  try {
    const [signer] = await ethers.getSigners();
    if (!signer) {
      console.error("❌ 未找到签名账户");
      process.exit(1);
    }

    const adminFacet = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
    const rewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);
    const usdtToken = await ethers.getContractAt("IERC20", USDT_ADDRESS);

    console.log("签名账户:", signer.address);
    console.log("");

    const oracle = await adminFacet.oracle();
    const totalActiveNFTs = await adminFacet.getTotalActiveNFTs();
    const currentAccReward = await adminFacet.getAccRewardPerNFT(USDT_ADDRESS);
    const contractBalance = await usdtToken.balanceOf(NFT_MANAGER_ADDRESS);
    const oracleBalance = await usdtToken.balanceOf(signer.address);

    console.log("📋 当前状态:");
    console.log("-".repeat(80));
    console.log("   Oracle:", oracle);
    console.log("   活跃 NFT:", totalActiveNFTs.toString());
    console.log("   accRewardPerNFT:", ethers.formatUnits(currentAccReward, 18), "USDT");
    console.log("   合约余额:", ethers.formatUnits(contractBalance, 18), "USDT");
    console.log("   Oracle 余额:", ethers.formatUnits(oracleBalance, 18), "USDT");
    console.log("");

    const rewardPerNFTWei = ethers.parseUnits(REWARD_PER_NFT, 18);
    const depositWei = ethers.parseUnits(DEPOSIT_AMOUNT, 18);

    // 用合约的 calculateRequiredAmountForDistribution 来展示（和 distributeReward 一样的计算）
    const calc = await rewardFacet.calculateRequiredAmountForDistribution(USDT_ADDRESS, rewardPerNFTWei);
    console.log("📊 分配计算（与 distributeReward 相同逻辑）:");
    console.log("-".repeat(80));
    console.log("   rewardPerNFT:", REWARD_PER_NFT, "USDT");
    console.log("   NFT 总奖励:", ethers.formatUnits(calc.nftAmount, 18), "USDT");
    console.log("   多签奖励:", ethers.formatUnits(calc.multisigAmount, 18), "USDT");
    console.log("   理论需要:", ethers.formatUnits(calc.requiredAmount, 18), "USDT");
    console.log("   实际充值:", DEPOSIT_AMOUNT, "USDT（不足部分先到先得）");
    console.log("");

    // ══════════════════════════════════════════
    // STEP 1: distributeRewardV2（记账，不转 USDT）
    // ══════════════════════════════════════════
    console.log("📝 Step 1: distributeRewardV2（记账）...");
    console.log("-".repeat(80));
    const tx1 = await rewardFacet.distributeRewardV2(USDT_ADDRESS, rewardPerNFTWei);
    console.log("   tx:", tx1.hash);
    await tx1.wait();
    console.log("   ✅ 完成");
    console.log("");

    // ══════════════════════════════════════════
    // STEP 2: 转 USDT 到合约（如果 DEPOSIT_AMOUNT > 0）
    // ══════════════════════════════════════════
    if (depositWei > 0n) {
      console.log("📝 Step 2: 转入", DEPOSIT_AMOUNT, "USDT ...");
      console.log("-".repeat(80));
      const tx2 = await usdtToken.transfer(NFT_MANAGER_ADDRESS, depositWei);
      console.log("   tx:", tx2.hash);
      await tx2.wait();
      console.log("   ✅ 完成");
      console.log("");
    } else {
      console.log("📝 Step 2: DEPOSIT_AMOUNT=0，跳过充值");
      console.log("");
    }

    // 验证
    const newAccReward = await adminFacet.getAccRewardPerNFT(USDT_ADDRESS);
    const newBalance = await usdtToken.balanceOf(NFT_MANAGER_ADDRESS);
    console.log("📋 验证:");
    console.log("-".repeat(80));
    console.log("   accRewardPerNFT:", ethers.formatUnits(currentAccReward, 18), "->", ethers.formatUnits(newAccReward, 18), "USDT");
    console.log("   增加:", ethers.formatUnits(newAccReward - currentAccReward, 18), "USDT");
    console.log("   合约余额:", ethers.formatUnits(newBalance, 18), "USDT");
    console.log("");
    console.log("=".repeat(80));
    console.log("✅ 完成。用户通过 claimReward / 提取收益 按钮提取。");
    console.log("=".repeat(80));

  } catch (error: any) {
    console.error("❌ 失败:", error.message);
    console.log("");
    console.log("💡 用法:");
    console.log("  REWARD_PER_NFT=18.39 DEPOSIT_AMOUNT=300 npx hardhat run scripts/set-node-rewards.ts --network bscMainnet");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
