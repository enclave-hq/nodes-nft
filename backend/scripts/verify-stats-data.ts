/**
 * Script to verify stats data consistency between contract and database
 * Usage: npm run verify-stats
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying stats data consistency...\n');

  // Initialize provider
  const rpcUrl = process.env.RPC_URL;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;

  if (!rpcUrl || !nftManagerAddress) {
    throw new Error('❌ RPC_URL and NFT_MANAGER_ADDRESS must be set in .env');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Load ABI (simplified)
  const adminFacetABI = [
    'function totalMinted() external view returns (uint256)',
    'function getWhitelistCount() external view returns (uint256)',
    'function getCurrentBatchId() external view returns (uint256)',
    'function getActiveBatch() external view returns (uint256)',
  ];

  const nftManagerFacetABI = [
    'function getAllBatches() external view returns (tuple(uint256 batchId, uint256 maxMintable, uint256 currentMinted, uint256 mintPrice, bool active, uint256 createdAt)[])',
  ];

  const adminFacet = new ethers.Contract(nftManagerAddress, adminFacetABI, provider);
  const nftManagerFacet = new ethers.Contract(nftManagerAddress, nftManagerFacetABI, provider);

  console.log('📊 Contract Data (from chain):');
  console.log('='.repeat(60));

  // Query contract data
  let contractTotalNFTs = 0;
  let contractWhitelistCount = 0;
  let contractTotalBatches = 0;
  let contractActiveBatches = 0;

  try {
    contractTotalNFTs = Number(await adminFacet.totalMinted());
    console.log(`✅ Total NFTs: ${contractTotalNFTs}`);
  } catch (error: any) {
    console.error(`❌ Error querying totalMinted: ${error.message}`);
  }

  try {
    contractWhitelistCount = Number(await adminFacet.getWhitelistCount());
    console.log(`✅ Whitelist Count: ${contractWhitelistCount}`);
  } catch (error: any) {
    console.error(`❌ Error querying getWhitelistCount: ${error.message}`);
  }

  try {
    const batches = await nftManagerFacet.getAllBatches();
    contractTotalBatches = batches.length;
    contractActiveBatches = batches.filter((b: any) => b.active).length;
    console.log(`✅ Total Batches: ${contractTotalBatches}`);
    console.log(`✅ Active Batches: ${contractActiveBatches}`);
  } catch (error: any) {
    console.error(`❌ Error querying getAllBatches: ${error.message}`);
  }

  console.log('\n📊 Database Data:');
  console.log('='.repeat(60));

  // Query database data
  const dbTotalNFTs = await prisma.nftRecord.count();
  const dbWhitelistCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT address) as count FROM whitelist_history WHERE action = 'add'
  `.then((result) => Number(result[0].count));
  const dbTotalBatches = await prisma.batch.count();
  const dbActiveBatches = await prisma.batch.count({ where: { active: true } });

  console.log(`📋 Total NFTs (nft_records): ${dbTotalNFTs}`);
  console.log(`📋 Whitelist Count (whitelist_history): ${dbWhitelistCount}`);
  console.log(`📋 Total Batches (batches): ${dbTotalBatches}`);
  console.log(`📋 Active Batches (batches): ${dbActiveBatches}`);

  console.log('\n🔍 Comparison:');
  console.log('='.repeat(60));

  // Compare
  const issues: string[] = [];

  if (contractTotalNFTs !== dbTotalNFTs) {
    issues.push(`❌ Total NFTs mismatch: Contract=${contractTotalNFTs}, DB=${dbTotalNFTs}`);
  } else {
    console.log(`✅ Total NFTs match: ${contractTotalNFTs}`);
  }

  if (contractWhitelistCount !== dbWhitelistCount) {
    issues.push(`❌ Whitelist Count mismatch: Contract=${contractWhitelistCount}, DB=${dbWhitelistCount}`);
  } else {
    console.log(`✅ Whitelist Count match: ${contractWhitelistCount}`);
  }

  if (contractTotalBatches !== dbTotalBatches) {
    issues.push(`❌ Total Batches mismatch: Contract=${contractTotalBatches}, DB=${dbTotalBatches}`);
  } else {
    console.log(`✅ Total Batches match: ${contractTotalBatches}`);
  }

  if (contractActiveBatches !== dbActiveBatches) {
    issues.push(`❌ Active Batches mismatch: Contract=${contractActiveBatches}, DB=${dbActiveBatches}`);
  } else {
    console.log(`✅ Active Batches match: ${contractActiveBatches}`);
  }

  console.log('\n' + '='.repeat(60));
  if (issues.length > 0) {
    console.log('⚠️  Data Inconsistencies Found:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log('\n💡 Recommendation:');
    console.log('  - Stats API should query from contract (real-time)');
    console.log('  - Database data may be outdated or incomplete');
    console.log('  - Consider implementing cache mechanism');
  } else {
    console.log('✅ All data matches!');
  }
  console.log('='.repeat(60) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

