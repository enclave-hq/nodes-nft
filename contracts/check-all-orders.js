const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 查询所有 Sell Orders...");
  
  // 获取合约实例
  const nftManagerAddress = "0xfbAa2dCE7Ce30A68397170b07c623a89c7805C8C";
  const nftManager = await ethers.getContractAt("NFTManager", nftManagerAddress);
  
  try {
    // 获取 nextOrderId
    const nextOrderId = await nftManager.nextOrderId();
    console.log(`📋 Next Order ID: ${nextOrderId.toString()}`);
    
    if (nextOrderId.toString() === "0") {
      console.log("❌ 没有订单");
      return;
    }
    
    console.log(`\n📋 查询订单 1 到 ${nextOrderId - 1}:`);
    console.log("=" .repeat(80));
    
    // 查询所有订单
    for (let i = 1; i < nextOrderId; i++) {
      try {
        const order = await nftManager.sellOrders(i);
        const [nftId, seller, shares, pricePerShare, createdAt, active] = order;
        
        console.log(`\n📦 Order ID: ${i}`);
        console.log(`   NFT ID: ${nftId.toString()}`);
        console.log(`   Seller: ${seller}`);
        console.log(`   Shares: ${shares.toString()}`);
        console.log(`   Price per Share: ${ethers.formatEther(pricePerShare)} USDT`);
        console.log(`   Created At: ${new Date(Number(createdAt) * 1000).toLocaleString()}`);
        console.log(`   Active: ${active}`);
        console.log(`   Total Price: ${ethers.formatEther(shares * pricePerShare)} USDT`);
        
        if (active) {
          console.log(`   🟢 状态: 活跃`);
        } else {
          console.log(`   🔴 状态: 已失效`);
        }
        
      } catch (error) {
        console.log(`\n❌ Order ID ${i}: 查询失败 - ${error.message}`);
      }
    }
    
    console.log("\n" + "=" .repeat(80));
    console.log("✅ 查询完成");
    
  } catch (error) {
    console.error("❌ 查询失败:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
