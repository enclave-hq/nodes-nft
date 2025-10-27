import { ethers } from "hardhat";

async function main() {
  console.log("🧪 LOCAL TESTING - Marketplace & Share Trading\n");

  const [deployer, alice, bob, charlie] = await ethers.getSigners();

  // Contract addresses
  const USDT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const MANAGER_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  console.log("📝 Using addresses:");
  console.log("USDT:    ", USDT_ADDRESS);
  console.log("Manager: ", MANAGER_ADDRESS);
  console.log();

  console.log("👥 Test accounts:");
  console.log("Alice:   ", alice.address);
  console.log("Bob:     ", bob.address);
  console.log("Charlie: ", charlie.address);
  console.log();

  // Connect to contracts
  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);

  // Test 1: Check Initial Share Distribution
  console.log("🎯 Test 1: Initial Share Distribution");
  console.log("─".repeat(60));

  const nftId1 = 1; // Alice's Standard NFT
  const aliceSharesBefore = await manager.getUserShareCount(nftId1, alice.address);
  console.log("Alice shares in NFT #1:", aliceSharesBefore.toString());
  
  const bobSharesBefore = await manager.getUserShareCount(nftId1, bob.address);
  console.log("Bob shares in NFT #1:  ", bobSharesBefore.toString());
  console.log();

  // Test 2: Alice Transfers 3 Shares to Bob (P2P)
  console.log("🎯 Test 2: P2P Share Transfer (Alice → Bob)");
  console.log("─".repeat(60));

  const transferShares = 3;
  console.log(`Transferring ${transferShares} shares from Alice to Bob...`);

  const tx1 = await manager.connect(alice).transferShares(nftId1, bob.address, transferShares);
  await tx1.wait();
  console.log("✅ Transfer complete!");

  const aliceSharesAfterTransfer = await manager.getUserShareCount(nftId1, alice.address);
  const bobSharesAfterTransfer = await manager.getUserShareCount(nftId1, bob.address);

  console.log("\nAfter transfer:");
  console.log("Alice shares:", aliceSharesAfterTransfer.toString());
  console.log("Bob shares:  ", bobSharesAfterTransfer.toString());
  console.log("Verification:", 
    aliceSharesAfterTransfer === (aliceSharesBefore - BigInt(transferShares)) &&
    bobSharesAfterTransfer === (bobSharesBefore + BigInt(transferShares))
    ? "✅ PASS" : "❌ FAIL"
  );
  console.log();

  // Test 3: Alice Creates a Sell Order
  console.log("🎯 Test 3: Creating Sell Order");
  console.log("─".repeat(60));

  const sellShares = 2;
  const pricePerShare = ethers.parseUnits("6000", 18); // 6000 USDT per share
  const totalPrice = pricePerShare * BigInt(sellShares);

  console.log("Creating order:");
  console.log("  Shares:        ", sellShares);
  console.log("  Price/share:   ", ethers.formatUnits(pricePerShare, 18), "USDT");
  console.log("  Total price:   ", ethers.formatUnits(totalPrice, 18), "USDT");

  const tx2 = await manager.connect(alice).createSellOrder(nftId1, sellShares, pricePerShare);
  const receipt2 = await tx2.wait();

  // Find order ID from event
  const orderEvent = receipt2?.logs
    .map((log: any) => {
      try {
        return manager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event?.name === "SellOrderCreated");

  const orderId = orderEvent?.args?.orderId;
  console.log("✅ Order created! Order ID:", orderId?.toString());

  // Check order details
  const order = await manager.sellOrders(orderId);
  console.log("\nOrder details:");
  console.log("  Seller:     ", order.seller);
  console.log("  NFT ID:     ", order.nftId?.toString() || "N/A");
  console.log("  Shares:     ", order.shareCount?.toString() || "N/A");
  console.log("  Price/share:", order.pricePerShare ? ethers.formatUnits(order.pricePerShare, 18) : "N/A", "USDT");
  console.log("  Active:     ", order.active ? "Yes" : "No");
  console.log();

  // Test 4: Charlie Buys Shares from the Order
  console.log("🎯 Test 4: Buying Shares from Order");
  console.log("─".repeat(60));

  // Give Charlie some USDT
  const charlieUSDTBefore = await usdt.balanceOf(charlie.address);
  if (charlieUSDTBefore < totalPrice) {
    console.log("Minting USDT to Charlie...");
    await usdt.mint(charlie.address, ethers.parseUnits("20000", 18));
  }

  const aliceUSDTBefore = await usdt.balanceOf(alice.address);
  const charlieSharesBefore = await manager.getUserShareCount(nftId1, charlie.address);

  console.log("Before purchase:");
  console.log("  Alice USDT:     ", ethers.formatUnits(aliceUSDTBefore, 18), "USDT");
  console.log("  Charlie USDT:   ", ethers.formatUnits(await usdt.balanceOf(charlie.address), 18), "USDT");
  console.log("  Charlie shares: ", charlieSharesBefore.toString());

  // Approve USDT
  await usdt.connect(charlie).approve(MANAGER_ADDRESS, totalPrice);
  console.log("✅ Charlie approved USDT");

  // Buy shares
  const tx3 = await manager.connect(charlie).buyShares(orderId);
  await tx3.wait();
  console.log("✅ Purchase complete!");

  const aliceUSDTAfter = await usdt.balanceOf(alice.address);
  const charlieUSDTAfter = await usdt.balanceOf(charlie.address);
  const charlieSharesAfter = await manager.getUserShareCount(nftId1, charlie.address);

  console.log("\nAfter purchase:");
  console.log("  Alice USDT:     ", ethers.formatUnits(aliceUSDTAfter, 18), "USDT");
  console.log("  Charlie USDT:   ", ethers.formatUnits(charlieUSDTAfter, 18), "USDT");
  console.log("  Charlie shares: ", charlieSharesAfter.toString());

  console.log("\nPayment verification:");
  console.log("  Alice received:", ethers.formatUnits(aliceUSDTAfter - aliceUSDTBefore, 18), "USDT");
  console.log("  Charlie paid:  ", ethers.formatUnits(charlieUSDTAfter - await usdt.balanceOf(charlie.address), 18), "USDT");
  console.log();

  // Test 5: Bob Creates and Cancels an Order
  console.log("🎯 Test 5: Creating and Canceling Order");
  console.log("─".repeat(60));

  console.log("Bob creating order...");
  const tx4 = await manager.connect(bob).createSellOrder(nftId1, 1, ethers.parseUnits("7000", 18));
  const receipt4 = await tx4.wait();

  const orderEvent2 = receipt4?.logs
    .map((log: any) => {
      try {
        return manager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event?.name === "SellOrderCreated");

  const orderId2 = orderEvent2?.args?.orderId;
  console.log("✅ Order created! Order ID:", orderId2?.toString());

  const bobSharesBeforeCancel = await manager.getUserShareCount(nftId1, bob.address);
  console.log("Bob shares before cancel:", bobSharesBeforeCancel.toString());

  // Cancel order
  console.log("\nCanceling order...");
  const tx5 = await manager.connect(bob).cancelSellOrder(orderId2);
  await tx5.wait();
  console.log("✅ Order canceled!");

  const order2 = await manager.sellOrders(orderId2);
  console.log("Order active:", order2.active ? "Yes" : "No ✅");

  const bobSharesAfterCancel = await manager.getUserShareCount(nftId1, bob.address);
  console.log("Bob shares after cancel: ", bobSharesAfterCancel.toString());
  console.log("Shares returned:", bobSharesAfterCancel === bobSharesBeforeCancel ? "✅ PASS" : "❌ FAIL");
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Final Share Distribution for NFT #1");
  console.log("=".repeat(60));

  const aliceSharesFinal = await manager.getUserShareCount(nftId1, alice.address);
  const bobSharesFinal = await manager.getUserShareCount(nftId1, bob.address);
  const charlieSharesFinal = await manager.getUserShareCount(nftId1, charlie.address);

  console.log("Alice:   ", aliceSharesFinal.toString(), "shares");
  console.log("Bob:     ", bobSharesFinal.toString(), "shares");
  console.log("Charlie: ", charlieSharesFinal.toString(), "shares");
  console.log("Total:   ", (aliceSharesFinal + bobSharesFinal + charlieSharesFinal).toString(), "shares");
  console.log("\nVerification:", 
    (aliceSharesFinal + bobSharesFinal + charlieSharesFinal) === 10n
    ? "✅ PASS (Total = 10)" : "❌ FAIL"
  );

  // Test 6: Check Shareholders List
  console.log("\n🎯 Test 6: NFT #1 Shareholders List");
  console.log("─".repeat(60));
  const shareholders = await manager.getShareholders(nftId1);
  console.log("Number of shareholders:", shareholders.length);
  console.log("Shareholders:");
  for (let i = 0; i < shareholders.length; i++) {
    const addr = shareholders[i];
    const shares = await manager.getUserShareCount(nftId1, addr);
    console.log(`  ${i + 1}. ${addr} - ${shares.toString()} shares`);
  }

  console.log("\n✅ Marketplace tests complete!");
  console.log("\n💡 Next steps:");
  console.log("  npx hardhat run scripts/local-05-test-unlock.ts --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });

