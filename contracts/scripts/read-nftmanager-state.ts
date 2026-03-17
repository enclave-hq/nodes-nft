/**
 * 读取 NFT Manager Diamond 所有公开数据（用于确认存储布局/状态一致性）
 * Usage: npx hardhat run scripts/read-nftmanager-state.ts --network bscMainnet
 *
 * 升级 RewardFacet 后请再跑一次，对比：
 * - getAccRewardPerNFT(USDT)、globalState 应与升级前一致
 * - calculateRequiredAmountForDistribution(USDT, 18.39) 应为 requiredAmount≈2321, nftAmount≈1857
 * - getMultisigRewardInfo 的 totalWithdrawn 应为合理数值（非数十亿）
 */
import { ethers } from "hardhat";

const NFT_MANAGER = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
const USDT = "0x55d398326f99059fF775485246999027B3197955";

function fmt(s: bigint, decimals = 18) {
  return ethers.formatUnits(s, decimals);
}

async function main() {
  const admin = await ethers.getContractAt("AdminFacet", NFT_MANAGER);
  const reward = await ethers.getContractAt("RewardFacet", NFT_MANAGER);
  const owner = await ethers.getContractAt("OwnerFacet", NFT_MANAGER);
  const loupe = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER);
  const usdt = await ethers.getContractAt("IERC20", USDT);

  console.log("========== OwnerFacet ==========");
  console.log("owner():", await owner.owner());
  console.log("contractOwner():", await owner.contractOwner());

  console.log("\n========== AdminFacet - 角色与合约引用 ==========");
  for (const [name, fn] of [
    ["nodeNFT", () => admin.nodeNFT()],
    ["eclvToken", () => admin.eclvToken()],
    ["usdtToken", () => admin.usdtToken()],
    ["oracle", () => admin.oracle()],
    ["treasury", () => admin.treasury()],
    ["master", () => admin.master()],
    ["multisigner", () => admin.multisigner()],
  ] as const) {
    try { console.log(`${name}():`, await fn()); } catch (e: any) { console.log(`${name}(): ERROR`, e.message?.slice(0, 50)); }
  }

  console.log("\n========== AdminFacet - 常量 ==========");
  for (const [name, fn] of [
    ["MAX_SUPPLY", () => admin.MAX_SUPPLY()],
    ["ECLV_PER_NFT", () => admin.ECLV_PER_NFT()],
    ["UNLOCK_PERIODS", () => admin.UNLOCK_PERIODS()],
    ["UNLOCK_PERCENTAGE", () => admin.UNLOCK_PERCENTAGE()],
    ["totalMinted", () => admin.totalMinted()],
    ["transfersEnabled", () => admin.transfersEnabled()],
    ["tgeTime", () => admin.tgeTime()],
  ] as const) {
    try { const v = await fn(); console.log(`${name}():`, typeof v === "bigint" ? v.toString() : String(v)); } catch (e: any) { console.log(`${name}(): ERROR`); }
  }

  console.log("\n========== AdminFacet - globalState (LibNFTManagerStorage) ==========");
  const gs = await admin.globalState();
  console.log("globalState.accProducedPerNFT:", gs.accProducedPerNFT.toString(), "(", fmt(gs.accProducedPerNFT), ")");
  console.log("globalState.lastUpdateTime:", gs.lastUpdateTime.toString());
  console.log("globalState.totalActiveNFTs:", gs.totalActiveNFTs.toString());

  console.log("\n========== AdminFacet - 与 Reward 相关的全局 ==========");
  try { console.log("getTotalActiveNFTs():", (await admin.getTotalActiveNFTs()).toString()); } catch (e: any) { console.log("getTotalActiveNFTs(): ERROR"); }
  try { console.log("getAccRewardPerNFT(USDT):", fmt(await admin.getAccRewardPerNFT(USDT)), "USDT"); } catch (e: any) { console.log("getAccRewardPerNFT(USDT): ERROR"); }
  try { console.log("getRewardTokenCount():", (await admin.getRewardTokenCount()).toString()); } catch (e: any) { console.log("getRewardTokenCount(): ERROR"); }
  try { console.log("rewardTokens:", await admin.getAllRewardTokens()); } catch (e: any) { try { console.log("rewardTokens:", await reward.getRewardTokens()); } catch { console.log("rewardTokens: ERROR"); } }
  try { console.log("getVaultRewards(USDT):", fmt(await admin.getVaultRewards(USDT))); } catch (e: any) { console.log("getVaultRewards(USDT): ERROR"); }

  console.log("\n========== RewardFacet ==========");
  console.log("getMultisigRewardBps():", (await reward.getMultisigRewardBps()).toString());
  const calc = await reward.calculateRequiredAmountForDistribution(USDT, ethers.parseUnits("18.39", 18));
  console.log("calculateRequiredAmountForDistribution(USDT, 18.39):");
  console.log("  requiredAmount:", fmt(calc.requiredAmount), "nftAmount:", fmt(calc.nftAmount), "multisigAmount:", fmt(calc.multisigAmount));

  console.log("\n========== 合约 USDT 余额 ==========");
  const bal = await usdt.balanceOf(NFT_MANAGER);
  console.log("IERC20(USDT).balanceOf(NFT_MANAGER):", fmt(bal), "USDT");

  console.log("\n========== AdminFacet - getMultisigRewardInfo(USDT) ==========");
  try {
    const multi = await admin.getMultisigRewardInfo(USDT);
    console.log("  totalDistributed:", fmt(multi[0]), "totalWithdrawn:", fmt(multi[1]), "available:", fmt(multi[2]));
  } catch (e: any) {
    console.log("  error:", e.message?.slice(0, 80));
  }

  console.log("\n========== 抽样 NFT (1, 21, 22, 50, 101) ==========");
  for (const id of [1, 21, 22, 50, 101]) {
    try {
      const pool = await admin.getNFTPool(id);
      const pendingReward = await admin.getPendingReward(id, USDT);
      const rewardWithdrawn = await admin.getRewardWithdrawn(id, USDT);
      const allocated = await reward.getAllocatedReward(id, USDT);
      const pendingProduced = await admin.getPendingProduced(id);
      console.log(`NFT #${id}: status=${pool.status} accProducedPerNFT-related: producedWithdrawn in pool`);
      console.log(`  getPendingReward(USDT)=${fmt(pendingReward)} getRewardWithdrawn(USDT)=${fmt(rewardWithdrawn)} getAllocatedReward(USDT)=${fmt(allocated)} getPendingProduced=${fmt(pendingProduced)}`);
    } catch (e: any) {
      console.log(`NFT #${id}: ${e.message?.slice(0, 60)}`);
    }
  }

  console.log("\n========== Loupe (facet 列表) ==========");
  const facets = await loupe.facets();
  for (const f of facets) {
    console.log("facet:", f.facetAddress, "selectors:", f.functionSelectors?.length ?? 0);
  }

  console.log("\n========== 结束 ==========");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
