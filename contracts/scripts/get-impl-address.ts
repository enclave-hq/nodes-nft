import { ethers, upgrades } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0x247EB977A797C7F8F982325C9aF708DD45619438";
  const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Implementation Address:", implAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



