const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Querying all Sell Orders...");
  
  // Get contract instance
  const nftManagerAddress = "0xfbAa2dCE7Ce30A68397170b07c623a89c7805C8C";
  const nftManager = await ethers.getContractAt("NFTManager", nftManagerAddress);
  
  try {
    // Get nextOrderId
    const nextOrderId = await nftManager.nextOrderId();
    console.log(`📋 Next Order ID: ${nextOrderId.toString()}`);
    
    if (nextOrderId.toString() === "0") {
      console.log("❌ No orders");
      return;
    }
    
    console.log(`\n📋 Querying orders 1 to ${nextOrderId - 1}:`);
    console.log("=" .repeat(80));
    
    // Query all orders
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
          console.log(`   🟢 Status: Active`);
        } else {
          console.log(`   🔴 Status: Inactive`);
        }
        
      } catch (error) {
        console.log(`\n❌ Order ID ${i}: Query failed - ${error.message}`);
      }
    }
    
    console.log("\n" + "=" .repeat(80));
    console.log("✅ Query completed");
    
  } catch (error) {
    console.error("❌ Query failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
