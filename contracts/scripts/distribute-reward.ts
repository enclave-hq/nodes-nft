import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
  
  // 配置参数
  const REWARD_PER_NFT = process.env.REWARD_PER_NFT || "0.2"; // 每个 NFT 的奖励（USDT）
  const TOTAL_AMOUNT = process.env.TOTAL_AMOUNT; // 可选：总金额，如果提供则计算 rewardPerNFT
  const PAY_FOR_NFT_COUNT = process.env.PAY_FOR_NFT_COUNT; // 可选：只按 N 个 NFT 的金额打入（其余视为自己的），实际每 NFT 奖励 = (N/总活跃数)*REWARD_PER_NFT
  
  console.log("💰 分配 USDT 奖励\n");
  console.log("NFT Manager 地址:", NFT_MANAGER_ADDRESS);
  console.log("USDT Token 地址:", USDT_ADDRESS);
  console.log("=".repeat(80));
  console.log("");

  try {
    const [signer] = await ethers.getSigners();
    if (!signer) {
      console.error("❌ 未找到签名账户。请在 contracts/.env 中设置 PRIVATE_KEY（Oracle 账户私钥）。");
      console.log("   示例: PRIVATE_KEY=0x...");
      process.exit(1);
    }

    const adminFacet = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
    const rewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);
    
    console.log("当前签名账户:", signer.address);
    console.log("");

    // 查询当前状态
    console.log("📋 当前状态:");
    console.log("-".repeat(80));
    const oracle = await adminFacet.oracle();
    const totalActiveNFTs = await adminFacet.getTotalActiveNFTs();
    const multisigBps = await rewardFacet.getMultisigRewardBps();
    const currentAccReward = await adminFacet.getAccRewardPerNFT(USDT_ADDRESS);
    
    console.log("   Oracle 地址:", oracle);
    console.log("   总活跃 NFT 数量:", totalActiveNFTs.toString());
    console.log("   多签比例:", multisigBps.toString(), "BPS (", (Number(multisigBps) / 100).toFixed(2), "%)");
    console.log("   当前累计每 NFT 奖励:", ethers.formatUnits(currentAccReward, 18), "USDT");
    console.log("");
    
    // 检查权限
    if (signer.address.toLowerCase() !== oracle.toLowerCase()) {
      console.log("⚠️  警告: 当前账户不是 Oracle，无法执行分配操作");
      console.log("   需要 Oracle 地址:", oracle);
      console.log("   当前账户:", signer.address);
      console.log("");
      console.log("是否继续? (如果使用多签，请确保已准备好多签交易)");
      console.log("");
    }

    // 计算 rewardPerNFT
    let rewardPerNFTWei: bigint;
    if (TOTAL_AMOUNT) {
      // 如果提供了总金额，计算每个 NFT 的奖励
      const totalWei = ethers.parseUnits(TOTAL_AMOUNT, 18);
      const MAX_SUPPLY = await adminFacet.MAX_SUPPLY();
      rewardPerNFTWei = totalWei / BigInt(MAX_SUPPLY);
      console.log("📊 计算参数:");
      console.log("-".repeat(80));
      console.log("   总金额:", TOTAL_AMOUNT, "USDT");
      console.log("   MAX_SUPPLY:", MAX_SUPPLY.toString());
      console.log("   计算出的 rewardPerNFT:", ethers.formatUnits(rewardPerNFTWei, 18), "USDT");
      console.log("");
    } else if (PAY_FOR_NFT_COUNT) {
      // 只按 N 个 NFT 的金额打入（等效「只付 15 份」），实际每 NFT 奖励按比例缩小
      const payCount = BigInt(PAY_FOR_NFT_COUNT);
      const rewardPerNFTFull = ethers.parseUnits(REWARD_PER_NFT, 18);
      rewardPerNFTWei = (rewardPerNFTFull * payCount) / totalActiveNFTs;
      console.log("📊 分配参数 (按等效 NFT 数量):");
      console.log("-".repeat(80));
      console.log("   名义每 NFT 奖励:", REWARD_PER_NFT, "USDT");
      console.log("   只按", PAY_FOR_NFT_COUNT, "个 NFT 的金额打入（总活跃", totalActiveNFTs.toString(), "个）");
      console.log("   实际每 NFT 本轮奖励:", ethers.formatUnits(rewardPerNFTWei, 18), "USDT");
      console.log("");
    } else {
      // 直接使用提供的 rewardPerNFT
      rewardPerNFTWei = ethers.parseUnits(REWARD_PER_NFT, 18);
      console.log("📊 分配参数:");
      console.log("-".repeat(80));
      console.log("   每个 NFT 奖励:", REWARD_PER_NFT, "USDT");
      console.log("");
    }

    // 计算实际需要打入的金额
    console.log("📊 计算实际需要打入的金额:");
    console.log("-".repeat(80));
    const calculationResult = await rewardFacet.calculateRequiredAmountForDistribution(
      USDT_ADDRESS,
      rewardPerNFTWei
    );
    
    const requiredAmount = calculationResult.requiredAmount;
    const nftAmount = calculationResult.nftAmount;
    const multisigAmount = calculationResult.multisigAmount;
    
    console.log("   每个 NFT 奖励:", ethers.formatUnits(rewardPerNFTWei, 18), "USDT");
    console.log("   活跃 NFT 数量:", totalActiveNFTs.toString());
    console.log("   NFT 总奖励:", ethers.formatUnits(nftAmount, 18), "USDT");
    console.log("   多签奖励:", ethers.formatUnits(multisigAmount, 18), "USDT");
    console.log("   实际需要打入:", ethers.formatUnits(requiredAmount, 18), "USDT");
    console.log("");

    // 检查 Oracle 账户的 USDT 余额
    console.log("📋 检查 Oracle 账户余额:");
    console.log("-".repeat(80));
    const usdtToken = await ethers.getContractAt("IERC20", USDT_ADDRESS);
    const oracleBalance = await usdtToken.balanceOf(signer.address);
    let decimals = 18;
    try {
      decimals = await usdtToken.decimals();
    } catch (e) {
      decimals = 18;
    }
    console.log("   Oracle 账户:", signer.address);
    console.log("   USDT 余额:", ethers.formatUnits(oracleBalance, decimals), "USDT");
    console.log("   需要金额:", ethers.formatUnits(requiredAmount, decimals), "USDT");
    
    if (oracleBalance < requiredAmount) {
      console.log("");
      console.log("   ❌ 余额不足！");
      console.log("   缺少:", ethers.formatUnits(requiredAmount - oracleBalance, decimals), "USDT");
      console.log("");
      console.log("💡 请先向 Oracle 账户转入足够的 USDT");
      process.exit(1);
    }
    console.log("   ✅ 余额充足");
    console.log("");

    // 检查 USDT 授权
    console.log("📋 检查 USDT 授权:");
    console.log("-".repeat(80));
    const allowance = await usdtToken.allowance(signer.address, NFT_MANAGER_ADDRESS);
    console.log("   当前授权:", ethers.formatUnits(allowance, decimals), "USDT");
    
    if (allowance < requiredAmount) {
      console.log("   ⚠️  授权不足，需要先授权");
      console.log("");
      console.log("   执行授权...");
      const approveTx = await usdtToken.approve(NFT_MANAGER_ADDRESS, requiredAmount);
      console.log("   ✅ 授权交易已发送:", approveTx.hash);
      console.log("   等待确认...");
      await approveTx.wait();
      console.log("   ✅ 授权已确认");
      console.log("");
    } else {
      console.log("   ✅ 授权充足");
      console.log("");
    }

    // 执行分配
    console.log("📝 执行奖励分配:");
    console.log("-".repeat(80));
    console.log("   Token:", USDT_ADDRESS);
    console.log("   Reward Per NFT:", ethers.formatUnits(rewardPerNFTWei, 18), "USDT");
    console.log("");
    
    const tx = await rewardFacet.distributeReward(USDT_ADDRESS, rewardPerNFTWei);
    console.log("   ✅ 交易已发送:", tx.hash);
    console.log("   等待确认...");
    const receipt = await tx.wait();
    console.log("   ✅ 交易已确认，区块:", receipt?.blockNumber);
    console.log("");

    // 验证结果
    console.log("📋 验证分配结果:");
    console.log("-".repeat(80));
    const newAccReward = await adminFacet.getAccRewardPerNFT(USDT_ADDRESS);
    const newTotalActiveNFTs = await adminFacet.getTotalActiveNFTs();
    console.log("   新的累计每 NFT 奖励:", ethers.formatUnits(newAccReward, 18), "USDT");
    console.log("   总活跃 NFT 数量:", newTotalActiveNFTs.toString());
    console.log("");
    
    if (newAccReward > currentAccReward) {
      console.log("   ✅ 奖励已成功分配");
      const increase = newAccReward - currentAccReward;
      console.log("   每 NFT 增加:", ethers.formatUnits(increase, 18), "USDT");
    } else {
      console.log("   ⚠️  奖励可能未正确分配");
    }
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ 操作完成");
    console.log("=".repeat(80));

  } catch (error: any) {
    console.error("❌ 操作失败:", error.message);
    console.log("");
    console.log("💡 提示: 请确保:");
    console.log("   1. 已连接到正确的网络（BSC Mainnet）");
    console.log("   2. 合约地址正确");
    console.log("   3. 账户有 Oracle 权限");
    console.log("   4. Oracle 账户有足够的 USDT 余额");
    console.log("   5. USDT 已授权给 NFTManager 合约");
    console.log("");
    console.log("使用方法:");
    console.log("  # 方式 1: 指定每个 NFT 的奖励");
    console.log("  REWARD_PER_NFT=0.2 npx hardhat run scripts/distribute-reward.ts --network bscMainnet");
    console.log("");
    console.log("  # 方式 2: 指定总金额（会自动计算每个 NFT 的奖励）");
    console.log("  TOTAL_AMOUNT=1000 npx hardhat run scripts/distribute-reward.ts --network bscMainnet");
    console.log("");
    console.log("  # 方式 3: 只按 N 个 NFT 的金额打入（其余视为自己的，只需约 15*19.37*1.2 USDT）");
    console.log("  PAY_FOR_NFT_COUNT=15 REWARD_PER_NFT=19.37 npx hardhat run scripts/distribute-reward.ts --network bscMainnet");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



