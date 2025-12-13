import { ethers, upgrades } from "hardhat";

/**
 * Deploy RewardVault for referral rewards claim.
 *
 * Env:
 * - REWARD_TOKEN_ADDRESS: ERC20 token address (USDT)
 * - VAULT_ADMIN_ADDRESS: admin (DEFAULT_ADMIN_ROLE + OPERATOR_ROLE). Defaults to deployer.
 *
 * Usage:
 *   REWARD_TOKEN_ADDRESS=0x... npx hardhat run scripts/deploy-reward-vault.ts --network bscTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const rewardToken = process.env.REWARD_TOKEN_ADDRESS;
  const admin = process.env.VAULT_ADMIN_ADDRESS || deployer.address;

  if (!rewardToken) {
    throw new Error("Missing env REWARD_TOKEN_ADDRESS");
  }

  console.log("Deployer:", deployer.address);
  console.log("Reward token:", rewardToken);
  console.log("Vault admin:", admin);

  const RewardVault = await ethers.getContractFactory("RewardVault");
  // Deploy UUPS proxy
  const vault = await upgrades.deployProxy(
    RewardVault,
    [rewardToken, admin],
    { kind: "uups", initializer: "initialize" },
  );
  await vault.waitForDeployment();

  const proxyAddress = await vault.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("✅ RewardVault (UUPS Proxy) deployed:");
  console.log("   Proxy:", proxyAddress);
  console.log("   Impl :", implAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


