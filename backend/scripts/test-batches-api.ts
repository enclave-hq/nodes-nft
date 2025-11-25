/**
 * Test script to debug batches API
 * Usage: ts-node scripts/test-batches-api.ts
 */

import { PrismaClient } from '@prisma/client';
import { ContractService } from '../src/modules/contract/contract.service';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

const prisma = new PrismaClient();

async function testBatchesAPI() {
  console.log('🔍 Testing Batches API...\n');

  try {
    // Initialize ConfigService
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
    }).compile();
    
    const configService = moduleRef.get<ConfigService>(ConfigService);
    
    // Initialize ContractService
    const contractService = new ContractService(configService);
    await contractService.onModuleInit();

    console.log('✅ ContractService initialized\n');

    // Test 1: getCurrentBatchId
    console.log('1️⃣  Testing getCurrentBatchId()...');
    try {
      const currentBatchId = await contractService.getCurrentBatchId();
      console.log(`✅ Current Batch ID: ${currentBatchId.toString()}\n`);
    } catch (error: any) {
      console.error(`❌ Error getting current batch ID:`, error.message);
      throw error;
    }

    // Test 2: getBatch
    console.log('2️⃣  Testing getBatch(1)...');
    try {
      const batch = await contractService.getBatch(BigInt(1));
      console.log(`✅ Batch 1:`, {
        batchId: batch.batchId.toString(),
        maxMintable: batch.maxMintable.toString(),
        currentMinted: batch.currentMinted.toString(),
        mintPrice: batch.mintPrice.toString(),
        active: batch.active,
      });
      console.log('');
    } catch (error: any) {
      console.error(`❌ Error getting batch 1:`, error.message);
      // This might be OK if batch 1 doesn't exist
    }

    // Test 3: getAllBatches
    console.log('3️⃣  Testing getAllBatches()...');
    try {
      const allBatches = await contractService.getAllBatches();
      console.log(`✅ Found ${allBatches.length} batches\n`);
      allBatches.forEach((batch, index) => {
        console.log(`   Batch ${index + 1}:`, {
          batchId: batch.batchId.toString(),
          maxMintable: batch.maxMintable.toString(),
          active: batch.active,
        });
      });
      console.log('');
    } catch (error: any) {
      console.error(`❌ Error getting all batches:`, error.message);
      console.error(`   Stack:`, error.stack);
      throw error;
    }

    // Test 4: Database query
    console.log('4️⃣  Testing database query...');
    try {
      const dbBatches = await prisma.batch.findMany({
        select: {
          batchId: true,
          referralReward: true,
        },
        take: 5,
      });
      console.log(`✅ Found ${dbBatches.length} batches in database\n`);
    } catch (error: any) {
      console.error(`❌ Error querying database:`, error.message);
      throw error;
    }

    console.log('✅ All tests passed!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBatchesAPI();

