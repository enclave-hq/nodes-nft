import { ethers } from 'hardhat';

async function main() {
  console.log('🧹 清理无效订单...');
  
  const proxyAddress = '0xfbAa2dCE7Ce30A68397170b07c623a89c7805C8C';
  
  // 部署新的实现合约
  console.log('📦 部署新的实现合约...');
  const NFTManagerV4 = await ethers.getContractFactory('NFTManager');
  const newImplementation = await NFTManagerV4.deploy();
  await newImplementation.waitForDeployment();
  
  const newImplementationAddress = await newImplementation.getAddress();
  console.log('✅ 新实现合约地址:', newImplementationAddress);
  
  // 获取代理合约
  const proxy = await ethers.getContractAt('NFTManager', proxyAddress);
  
  // 升级代理
  console.log('⬆️ 升级代理合约...');
  const upgradeTx = await proxy.upgradeToAndCall(newImplementationAddress, '0x');
  await upgradeTx.wait();
  console.log('✅ 代理升级完成');
  
  // 调用清理函数
  console.log('🧹 调用清理函数...');
  const cleanupTx = await proxy.cleanupInvalidOrders();
  await cleanupTx.wait();
  console.log('✅ 无效订单清理完成');
  
  // 验证清理结果
  console.log('🔍 验证清理结果...');
  const testNFTId = 1;
  const nftSellOrders = await proxy.getNFTSellOrders(testNFTId);
  console.log('📋 NFT 1 的订单列表:', nftSellOrders);
  
  // 检查订单状态
  for (const orderId of [2, 3, 5]) {
    const order = await proxy.sellOrders(orderId);
    console.log(`📦 订单 ${orderId} 状态:`, order.active ? '活跃' : '已失效');
  }
  
  console.log('🎉 清理完成！');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
