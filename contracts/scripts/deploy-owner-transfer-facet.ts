import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("📦 部署 OwnerTransferFacet 合约...");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("未找到部署者账户，请设置 PRIVATE_KEY 环境变量");
  }

  console.log("🔐 部署者地址:", deployer.address);

  // 部署 OwnerTransferFacet
  const OwnerTransferFacet = await ethers.getContractFactory("OwnerTransferFacet");
  const ownerTransferFacet = await OwnerTransferFacet.deploy();

  await ownerTransferFacet.waitForDeployment();
  const facetAddress = await ownerTransferFacet.getAddress();

  console.log("✅ OwnerTransferFacet 已部署");
  console.log("📍 地址:", facetAddress);

  const network = await ethers.provider.getNetwork();
  console.log("\n📝 部署信息:");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Contract:", facetAddress);

  // 生成 BSCScan 链接
  if (network.chainId === 56n) {
    console.log("\n🔗 BSCScan 链接:");
    console.log(`https://bscscan.com/address/${facetAddress}`);
  }

  console.log("\n⚠️  重要:");
  console.log("1. 保存合约地址，用于 EIP-7702 恢复");
  console.log("2. 如果使用预部署的 Facet，需要修改 EIP7702RecoveryProxy 使用预部署地址");
  console.log("3. 或者保持当前方式（运行时创建），无需部署");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

