import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Resetting Database for New Contract Deployment\n');
  console.log('='.repeat(70));
  console.log('⚠️  WARNING: This will DELETE all data from the following tables:');
  console.log('   - NFT Records');
  console.log('   - Revenue Records');
  console.log('   - Referral Reward Records');
  console.log('   - Batches');
  console.log('   - Whitelist History');
  console.log('   - Invite Codes');
  console.log('   - Invite Code Requests');
  console.log('   - Invite Code Usage');
  console.log('   - Admin Logs');
  console.log('   - Stats Cache');
  console.log('');
  console.log('⚠️  Admin accounts will be PRESERVED');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Delete in correct order (respecting foreign key constraints)
    console.log('1️⃣  Deleting Referral Reward Records...');
    const referralRewardsDeleted = await prisma.referralRewardRecord.deleteMany();
    console.log(`   ✅ Deleted ${referralRewardsDeleted.count} referral reward records`);

    console.log('\n2️⃣  Deleting Revenue Records...');
    const revenueDeleted = await prisma.revenueRecord.deleteMany();
    console.log(`   ✅ Deleted ${revenueDeleted.count} revenue records`);

    console.log('\n3️⃣  Deleting NFT Records...');
    const nftDeleted = await prisma.nftRecord.deleteMany();
    console.log(`   ✅ Deleted ${nftDeleted.count} NFT records`);

    console.log('\n4️⃣  Deleting Invite Code Usage...');
    const usageDeleted = await prisma.inviteCodeUsage.deleteMany();
    console.log(`   ✅ Deleted ${usageDeleted.count} invite code usage records`);

    console.log('\n5️⃣  Deleting Invite Code Requests...');
    const requestsDeleted = await prisma.inviteCodeRequest.deleteMany();
    console.log(`   ✅ Deleted ${requestsDeleted.count} invite code requests`);

    console.log('\n6️⃣  Deleting Invite Codes...');
    const inviteCodesDeleted = await prisma.inviteCode.deleteMany();
    console.log(`   ✅ Deleted ${inviteCodesDeleted.count} invite codes`);

    console.log('\n7️⃣  Deleting Whitelist History...');
    const whitelistDeleted = await prisma.whitelistHistory.deleteMany();
    console.log(`   ✅ Deleted ${whitelistDeleted.count} whitelist history records`);

    console.log('\n8️⃣  Deleting Batches...');
    const batchesDeleted = await prisma.batch.deleteMany();
    console.log(`   ✅ Deleted ${batchesDeleted.count} batches`);

    console.log('\n9️⃣  Deleting Admin Logs...');
    const adminLogsDeleted = await prisma.adminLog.deleteMany();
    console.log(`   ✅ Deleted ${adminLogsDeleted.count} admin logs`);

    console.log('\n🔟  Deleting Stats Cache...');
    const statsDeleted = await prisma.statsCache.deleteMany();
    console.log(`   ✅ Deleted ${statsDeleted.count} stats cache entries`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Database Reset Complete!');
    console.log('='.repeat(70));
    console.log('\n📊 Summary:');
    console.log(`   Referral Rewards: ${referralRewardsDeleted.count}`);
    console.log(`   Revenue Records: ${revenueDeleted.count}`);
    console.log(`   NFT Records: ${nftDeleted.count}`);
    console.log(`   Invite Code Usage: ${usageDeleted.count}`);
    console.log(`   Invite Code Requests: ${requestsDeleted.count}`);
    console.log(`   Invite Codes: ${inviteCodesDeleted.count}`);
    console.log(`   Whitelist History: ${whitelistDeleted.count}`);
    console.log(`   Batches: ${batchesDeleted.count}`);
    console.log(`   Admin Logs: ${adminLogsDeleted.count}`);
    console.log(`   Stats Cache: ${statsDeleted.count}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Update .env files with new contract addresses');
    console.log('   2. Create new batches in the new NFTManager contract');
    console.log('   3. Add users to whitelist');
    console.log('   4. Create invite codes');
    console.log('');
  } catch (error: any) {
    console.error('\n❌ Error resetting database:');
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Database reset failed:');
    console.error(error);
    process.exit(1);
  });
















