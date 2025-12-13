import { ethers } from "hardhat";

/**
 * Fund RewardVault by transferring ERC20 (e.g., USDT) to the vault address.
 *
 * Env:
 * - REWARD_TOKEN_ADDRESS: ERC20 token address (USDT)
 * - REWARD_VAULT_ADDRESS: deployed RewardVault address
 * - FUND_AMOUNT: amount in human units (default "1000")
 * - TOKEN_DECIMALS: token decimals (default "18")
 *
 * Usage:
 *   REWARD_TOKEN_ADDRESS=0x... REWARD_VAULT_ADDRESS=0x... FUND_AMOUNT=10000 npx hardhat run scripts/fund-reward-vault.ts --network bscTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const token = process.env.REWARD_TOKEN_ADDRESS;
  const vault = process.env.REWARD_VAULT_ADDRESS;
  const amountStr = process.env.FUND_AMOUNT || "1000";
  const decimals = Number(process.env.TOKEN_DECIMALS || "18");

  if (!token) throw new Error("Missing env REWARD_TOKEN_ADDRESS");
  if (!vault) throw new Error("Missing env REWARD_VAULT_ADDRESS");

  const erc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  const tokenContract = new ethers.Contract(token, erc20Abi, deployer);
  let usedDecimals = decimals;
  try {
    usedDecimals = await tokenContract.decimals();
  } catch {
    // ignore and use env/default
  }

  const amount = ethers.parseUnits(amountStr, usedDecimals);
  console.log("Deployer:", deployer.address);
  console.log("Token:", token);
  console.log("Vault:", vault);
  console.log("Amount:", amountStr, `(decimals=${usedDecimals})`);

  const bal = await tokenContract.balanceOf(deployer.address);
  if (bal < amount) {
    throw new Error(`Insufficient token balance. Have=${bal.toString()} Need=${amount.toString()}`);
  }

  const tx = await tokenContract.transfer(vault, amount);
  console.log("📝 transfer tx:", tx.hash);
  await tx.wait();
  console.log("✅ Funded vault");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


