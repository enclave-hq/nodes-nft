import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

async function main() {
  console.log('🔍 Diagnosing totalMinted() issue\n');
  console.log('='.repeat(70));

  const rpcUrl = process.env.RPC_URL;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

  if (!rpcUrl || !nftManagerAddress) {
    console.error('❌ Missing RPC_URL or NFT_MANAGER_ADDRESS in .env');
    process.exit(1);
  }

  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`NFT Manager Address: ${nftManagerAddress}\n`);

  // Initialize provider
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 1. Check if contract exists (has code)
  console.log('1️⃣ Checking if contract exists...');
  try {
    const code = await provider.getCode(nftManagerAddress);
    if (!code || code === '0x') {
      console.error(`❌ Contract does not exist at ${nftManagerAddress}`);
      console.error('   This address has no code deployed.');
      process.exit(1);
    }
    console.log(`✅ Contract exists (code length: ${code.length} chars)\n`);
  } catch (error: any) {
    console.error(`❌ Error checking contract code: ${error.message}`);
    process.exit(1);
  }

  // 2. Try to call totalMinted with minimal ABI
  console.log('2️⃣ Testing totalMinted() with minimal ABI...');
  const minimalABI = [
    'function totalMinted() view returns (uint256)',
  ];

  try {
    const contract = new ethers.Contract(nftManagerAddress, minimalABI, provider);
    const totalMinted = await contract.totalMinted();
    console.log(`✅ totalMinted() works! Result: ${totalMinted.toString()}\n`);
  } catch (error: any) {
    console.error(`❌ totalMinted() failed: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Value: ${error.value}`);
    console.error(`   Info: ${JSON.stringify(error.info, null, 2)}\n`);

    // 3. Check if AdminFacet is installed
    console.log('3️⃣ Checking if AdminFacet is installed...');
    try {
      // Try to use Diamond Loupe to check facets
      const loupeABI = [
        'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] facets_)',
        'function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory)',
        'function facetAddresses() external view returns (address[] memory)',
      ];

      const diamond = new ethers.Contract(nftManagerAddress, loupeABI, provider);
      const facets = await diamond.facets();
      console.log(`✅ Found ${facets.length} facets installed`);

      // Check if totalMinted selector exists
      const totalMintedSelector = ethers.id('totalMinted()').slice(0, 10);
      console.log(`   Looking for selector: ${totalMintedSelector}`);

      let found = false;
      for (const facet of facets) {
        if (facet.functionSelectors.includes(totalMintedSelector)) {
          console.log(`✅ Found totalMinted() in facet: ${facet.facetAddress}`);
          found = true;
          break;
        }
      }

      if (!found) {
        console.error(`❌ totalMinted() selector not found in any facet!`);
        console.error('   AdminFacet may not be installed or method is missing.');
      }
    } catch (loupeError: any) {
      console.warn(`⚠️  Could not check facets: ${loupeError.message}`);
    }

    // 4. Try alternative: call NodeNFT directly
    console.log('\n4️⃣ Trying alternative: Get totalMinted from NodeNFT contract...');
    try {
      const nodeNFTABI = [
        'function totalMinted() view returns (uint256)',
        'function nodeNFT() view returns (address)',
      ];

      const manager = new ethers.Contract(nftManagerAddress, nodeNFTABI, provider);
      const nodeNFTAddress = await manager.nodeNFT();
      console.log(`   NodeNFT address: ${nodeNFTAddress}`);

      const nodeNFT = new ethers.Contract(nodeNFTAddress, ['function totalMinted() view returns (uint256)'], provider);
      const nodeNFTTotal = await nodeNFT.totalMinted();
      console.log(`✅ NodeNFT.totalMinted(): ${nodeNFTTotal.toString()}`);
      console.log(`   💡 Consider using NodeNFT contract for totalMinted instead of NFTManager`);
    } catch (nodeError: any) {
      console.warn(`⚠️  Could not get from NodeNFT: ${nodeError.message}`);
    }
  }

  // 5. Check ABI file
  console.log('\n5️⃣ Checking ABI file...');
  const possiblePaths = [
    join(process.cwd(), 'abis', 'NFTManager.json'),
    join(process.cwd(), 'src', 'abis', 'NFTManager.json'),
    join(__dirname, '..', 'abis', 'NFTManager.json'),
  ];

  let abiFound = false;
  for (const abiPath of possiblePaths) {
    try {
      const abiFile = readFileSync(abiPath, 'utf-8');
      const abiData = JSON.parse(abiFile);
      const abi = abiData.abi || abiData;

      const totalMintedInABI = abi.find((item: any) => 
        item.type === 'function' && item.name === 'totalMinted'
      );

      if (totalMintedInABI) {
        console.log(`✅ Found totalMinted in ABI: ${abiPath}`);
        console.log(`   Signature: ${totalMintedInABI.name}() returns (${totalMintedInABI.outputs[0].type})`);
        abiFound = true;
        break;
      }
    } catch (error) {
      // Continue
    }
  }

  if (!abiFound) {
    console.warn(`⚠️  Could not find totalMinted in ABI files`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 Summary:');
  console.log('   If totalMinted() returns 0x, it means:');
  console.log('   1. The method selector is not found in any installed facet');
  console.log('   2. AdminFacet may not be installed in the Diamond');
  console.log('   3. The ABI may be incomplete or outdated');
  console.log('\n   Solution:');
  console.log('   - Verify AdminFacet is installed: npm run verify-diamond');
  console.log('   - Or use NodeNFT.totalMinted() instead');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });



























