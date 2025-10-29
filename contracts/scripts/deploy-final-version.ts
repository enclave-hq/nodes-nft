import { ethers } from 'hardhat';

async function main() {
  console.log('🔄 部署最终版本（移除清理函数）...');
  
  const proxyAddress = '0xfbAa2dCE7Ce30A68397170b07c623a89c7805C8C';
  
  // 部署最终实现合约
  console.log('📦 部署最终实现合约...');
  const NFTManagerFinal = await ethers.getContractFactory('NFTManager');
  const finalImplementation = await NFTManagerFinal.deploy();
  await finalImplementation.waitForDeployment();
  
  const finalImplementationAddress = await finalImplementation.getAddress();
  console.log('✅ 最终实现合约地址:', finalImplementationAddress);
  
  // 获取代理合约
  const proxy = await ethers.getContractAt('NFTManager', proxyAddress);
  
  // 升级代理
  console.log('⬆️ 升级代理合约...');
  const upgradeTx = await proxy.upgradeToAndCall(finalImplementationAddress, '0x');
  await upgradeTx.wait();
  console.log('✅ 代理升级完成');
  
  // 验证最终状态
  console.log('🔍 验证最终状态...');
  const testNFTId = 1;
  const nftSellOrders = await proxy.getNFTSellOrders(testNFTId);
  console.log('📋 NFT 1 的订单列表:', nftSellOrders);
  
  console.log('🎉 最终版本部署完成！');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
