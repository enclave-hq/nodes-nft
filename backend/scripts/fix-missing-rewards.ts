import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

// Configuration
const REFERRAL_REWARD_USDT = '100'; // 100 USDT reward per NFT
const MINT_PRICE_USDT = '1000'; // 1000 USDT mint price
const BATCH_ID = 1;

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Starting fix for missing referral rewards...');

    // 1. Check and create/update Batch 1
    let batch = await prisma.batch.findFirst({
      where: { batchId: BigInt(BATCH_ID) },
    });

    if (!batch) {
      console.log(`⚠️ Batch ${BATCH_ID} not found. Creating default batch...`);
      batch = await prisma.batch.create({
        data: {
          batchId: BigInt(BATCH_ID),
          maxMintable: BigInt(10000),
          mintPrice: ethers.parseUnits(MINT_PRICE_USDT, 18).toString(), // 1000 USDT
          referralReward: REFERRAL_REWARD_USDT, // 100 USDT
          currentMinted: BigInt(0),
          active: true,
        },
      });
      console.log(`✅ Created Batch ${BATCH_ID} with reward ${REFERRAL_REWARD_USDT} USDT`);
    } else {
      // Ensure referral reward is set
      if (!batch.referralReward) {
        console.log(`⚠️ Batch ${BATCH_ID} exists but has no referral reward. Updating...`);
        await prisma.batch.update({
          where: { id: batch.id },
          data: { referralReward: REFERRAL_REWARD_USDT },
        });
        console.log(`✅ Updated Batch ${BATCH_ID} reward to ${REFERRAL_REWARD_USDT} USDT`);
      }
    }

    // 2. Get all RevenueRecords
    const revenueRecords = await prisma.revenueRecord.findMany();
    console.log(`📊 Found ${revenueRecords.length} revenue records.`);

    // 3. Process each record
    for (const record of revenueRecords) {
      const nftId = record.nftId;
      console.log(`\n🔍 Processing NFT #${nftId}...`);

      // Fix batchId if needed (if it's 0 or invalid, set to 1)
      // Note: BigInt comparison
      if (!record.batchId || record.batchId.toString() === '0') {
        console.log(`   ⚠️ Fixing invalid batchId for NFT #${nftId}...`);
        await prisma.revenueRecord.update({
          where: { id: record.id },
          data: { batchId: BigInt(BATCH_ID) },
        });
        console.log(`   ✅ batchId updated to ${BATCH_ID}`);
      }

      // Check if ReferralRewardRecord exists
      const existingReward = await prisma.referralRewardRecord.findUnique({
        where: { nftId },
      });

      if (existingReward) {
        console.log(`   ✅ Referral reward record already exists.`);
        continue;
      }

      console.log(`   ⚠️ Missing referral reward. Calculating...`);

      // Trace invite chain to find root referrer
      // Logic copied from RevenueService.traceRootReferrer
      let rootReferrerAddress: string | null = null;
      let rootInviteCodeId: number | null = null;

      // Find invite code usage
      const usage = await prisma.inviteCodeUsage.findFirst({
        where: { userAddress: record.minterAddress.toLowerCase() },
        include: { inviteCode: true },
        orderBy: { createdAt: 'desc' },
      });

      if (usage && usage.inviteCode) {
        let currentInviteCode = usage.inviteCode;
        // Trace up
        while (currentInviteCode.parentInviteCodeId) {
          const parent = await prisma.inviteCode.findUnique({
            where: { id: currentInviteCode.parentInviteCodeId },
            include: { parentInviteCode: true },
          });
          if (!parent) break;
          currentInviteCode = parent;
        }
        
        // Get root info
        const rootId = currentInviteCode.rootInviteCodeId || currentInviteCode.id;
        const rootCode = await prisma.inviteCode.findUnique({ where: { id: rootId } });
        
        if (rootCode) {
          rootReferrerAddress = rootCode.applicantAddress;
          rootInviteCodeId = rootCode.id;
        }
      }

      // Determine final referrer (Self-referral if no root found)
      const finalRootReferrerAddress = rootReferrerAddress 
        ? rootReferrerAddress.toLowerCase() 
        : record.minterAddress.toLowerCase();
        
      const finalRootInviteCodeId = rootReferrerAddress 
        ? rootInviteCodeId 
        : null;

      console.log(`   📍 Root Referrer: ${finalRootReferrerAddress} (Self: ${!rootReferrerAddress})`);

      // Create reward record
      await prisma.referralRewardRecord.create({
        data: {
          nftId,
          batchId: BigInt(BATCH_ID),
          minterAddress: record.minterAddress.toLowerCase(),
          rootReferrerAddress: finalRootReferrerAddress,
          rootInviteCodeId: finalRootInviteCodeId,
          referralReward: REFERRAL_REWARD_USDT,
          referralRewardWei: ethers.parseUnits(REFERRAL_REWARD_USDT, 18).toString(),
          mintTxHash: record.mintTxHash,
        },
      });

      console.log(`   ✅ Created referral reward record!`);
    }

    console.log('\n✨ All done! Please refresh the dashboard.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();















