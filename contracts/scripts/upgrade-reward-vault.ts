import { ethers, upgrades } from "hardhat";

/**
 * Upgrade RewardVault UUPS proxy to a new implementation.
 *
 * Env:
 * - REWARD_VAULT_ADDRESS: RewardVault proxy address
 *
 * Usage:
 *   REWARD_VAULT_ADDRESS=0x... npx hardhat run scripts/upgrade-reward-vault.ts --network bscMainnet
 */
async function main() {
  const proxy = process.env.REWARD_VAULT_ADDRESS;
  if (!proxy) throw new Error("Missing env REWARD_VAULT_ADDRESS (proxy address)");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Proxy   :", proxy);

  const RewardVault = await ethers.getContractFactory("RewardVault");
  const upgraded = await upgrades.upgradeProxy(proxy, RewardVault, { kind: "uups" });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxy);
  console.log("✅ RewardVault upgraded:");
  console.log("   Proxy:", proxy);
  console.log("   Impl :", implAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
























