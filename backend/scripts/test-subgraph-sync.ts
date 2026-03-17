/**
 * Test script for NFT synchronization from The Graph subgraph
 * 
 * Usage:
 *   npm run test:subgraph-sync
 *   or
 *   npx tsx scripts/test-subgraph-sync.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NftsService } from '../src/modules/nfts/nfts.service';

async function testSubgraphSync() {
  console.log('🧪 Testing NFT sync from The Graph subgraph...\n');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    const nftsService = app.get(NftsService);

    console.log('📡 Starting sync from subgraph...\n');
    const startTime = Date.now();

    // Run sync
    const result = await nftsService.syncNFTsFromSubgraph();

    const duration = Date.now() - startTime;

    console.log('\n📊 Sync Results:');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Total Events: ${result.totalEvents}`);
    console.log(`   Synced: ${result.synced}`);
    console.log(`   Created: ${result.created}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Errors: ${result.errors}`);

    if (result.errors > 0) {
      console.log('\n⚠️  Some errors occurred during sync. Check logs for details.');
    } else {
      console.log('\n✅ Sync completed successfully!');
    }

    await app.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error during sync:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testSubgraphSync();
























