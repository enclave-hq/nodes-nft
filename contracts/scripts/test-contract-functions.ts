import { ethers } from 'hardhat';

async function main() {
  console.log('🧪 Testing contract functions...');
  
  const proxyAddress = '0xfbAa2dCE7Ce30A68397170b07c623a89c7805C8C';
  const proxy = await ethers.getContractAt('NFTManager', proxyAddress);
  
  const testUser = '0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E';
  const testNFTId = 1;
  
  try {
    // Test getUserShareCount
    console.log('Testing getUserShareCount...');
    const userShareCount = await proxy.getUserShareCount(testNFTId, testUser);
    console.log('✅ getUserShareCount:', userShareCount.toString());
  } catch (error: any) {
    console.log('❌ getUserShareCount failed:', error.message);
  }
  
  try {
    // Test getNFTSellOrders
    console.log('Testing getNFTSellOrders...');
    const nftSellOrders = await proxy.getNFTSellOrders(testNFTId);
    console.log('✅ getNFTSellOrders:', nftSellOrders);
  } catch (error: any) {
    console.log('❌ getNFTSellOrders failed:', error.message);
  }
  
  try {
    // Test userShares mapping
    console.log('Testing userShares mapping...');
    const userShares = await proxy.userShares(testNFTId, testUser);
    console.log('✅ userShares:', userShares);
  } catch (error: any) {
    console.log('❌ userShares failed:', error.message);
  }
}

main().catch(console.error);
