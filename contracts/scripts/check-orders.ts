import { ethers } from 'hardhat';

async function main() {
  const NFTManager = await ethers.getContractAt('NFTManager', '0xfbAa2dCE7Ce30A68397170b07c623a89c7805C8C');
  
  console.log('🔍 查询当前订单状态...');
  
  // 查询 nextOrderId
  const nextOrderId = await NFTManager.nextOrderId();
  console.log('📋 当前 nextOrderId:', nextOrderId.toString());
  
  // 查询一些现有的订单
  const maxOrders = Math.min(Number(nextOrderId), 10);
  console.log(`📋 查询前 ${maxOrders} 个订单...`);
  
  for (let i = 1; i < maxOrders; i++) {
    try {
      const order = await NFTManager.sellOrders(i);
      console.log(`📋 Order ${i}:`, {
        nftId: order.nftId.toString(),
        seller: order.seller,
        shares: order.shares.toString(),
        pricePerShare: order.pricePerShare.toString(),
        createdAt: order.createdAt.toString(),
        active: order.active
      });
    } catch (error) {
      console.log(`📋 Order ${i}: 不存在或已删除`);
    }
  }
  
  // 查询用户的NFT订单
  const userAddress = '0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E';
  const nftId = 1;
  
  console.log(`\n🔍 查询用户 ${userAddress} 的NFT ${nftId} 订单...`);
  try {
    const nftOrders = await NFTManager.getNFTSellOrders(nftId);
    console.log('📋 NFT订单IDs:', nftOrders.map(id => id.toString()));
    
    for (const orderId of nftOrders) {
      try {
        const order = await NFTManager.sellOrders(orderId);
        console.log(`📋 Order ${orderId}:`, {
          nftId: order.nftId.toString(),
          seller: order.seller,
          shares: order.shares.toString(),
          pricePerShare: order.pricePerShare.toString(),
          createdAt: order.createdAt.toString(),
          active: order.active
        });
      } catch (error) {
        console.log(`📋 Order ${orderId}: 查询失败`);
      }
    }
  } catch (error) {
    console.error('❌ 查询NFT订单失败:', error);
  }
}

main().catch(console.error);
