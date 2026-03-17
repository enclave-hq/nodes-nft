import { ethers, upgrades } from "hardhat";

/**
 * Inspect RewardVault proxy (UUPS): prints proxy/impl and calls version() if available.
 *
 * Env:
 * - REWARD_VAULT_ADDRESS: RewardVault proxy address
 *
 * Usage:
 *   REWARD_VAULT_ADDRESS=0x... npx hardhat run scripts/inspect-reward-vault.ts --network bscMainnet
 */
async function main() {
  const proxy = process.env.REWARD_VAULT_ADDRESS;
  if (!proxy) throw new Error("Missing env REWARD_VAULT_ADDRESS (proxy address)");

  const [signer] = await ethers.getSigners();
  console.log("Signer :", signer.address);
  console.log("Proxy  :", proxy);

  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  console.log("Impl   :", impl);

  const RewardVault = await ethers.getContractFactory("RewardVault");
  const vault = RewardVault.attach(proxy);

  // Best-effort: version() only exists after upgrade to v2.0.0
  try {
    const v = await vault.version();
    console.log("Version:", v);
  } catch (e: any) {
    console.log("Version: (not available before upgrade)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
























