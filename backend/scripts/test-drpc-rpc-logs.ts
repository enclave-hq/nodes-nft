import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

async function testDRPCRPCLogs() {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NFT_MANAGER_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    console.error('❌ Missing RPC_URL or NFT_MANAGER_ADDRESS in .env');
    process.exit(1);
  }

  console.log('🔍 Testing RPC eth_getLogs for NFTMinted events...\n');
  console.log('RPC URL:', rpcUrl.includes('drpc') ? rpcUrl.substring(0, 30) + '...' : rpcUrl);
  console.log('Contract Address:', contractAddress);
  console.log('');

  // Calculate NFTMinted event signature hash (topic0)
  const eventSignature = 'NFTMinted(uint256,address,uint256,uint256,uint256)';
  const topic0 = ethers.id(eventSignature);
  console.log('NFTMinted event topic0:', topic0);
  console.log('');

  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test connection
    console.log('📡 Testing RPC connection...');
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ RPC connection successful (block: ${blockNumber})\n`);

    // Get current block and calculate a reasonable range
    // Public RPC nodes often have limits (e.g., 10,000 blocks max)
    // DRPC and other premium RPC nodes support much larger ranges
    const toBlock = blockNumber;
    const fromBlock = Math.max(0, toBlock - 5000); // Start with 5000 blocks to avoid limits

    console.log(`📡 Querying NFTMinted events using eth_getLogs...`);
    console.log(`   From block: ${fromBlock}, To block: ${toBlock}`);
    console.log('');

    const startTime = Date.now();

    // Use eth_getLogs directly
    const logs = await provider.send('eth_getLogs', [{
      address: contractAddress,
      topics: [topic0], // Only filter by event signature
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    }]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Query completed in ${duration}ms`);
    console.log(`   Found ${logs.length} events\n`);

    if (logs.length === 0) {
      console.log('ℹ️  No events found in the specified block range');
      return;
    }

    // Parse first event as example
    console.log('📋 First event example:');
    const firstLog = logs[0];
    console.log('  Block Number:', parseInt(firstLog.blockNumber, 16));
    console.log('  Transaction Hash:', firstLog.transactionHash);
    console.log('  Topics:', firstLog.topics.length);
    console.log('  Data length:', firstLog.data.length);
    console.log('');

    // Parse first event
    console.log('🔍 Parsing first event...');
    const nftId = Number(BigInt(firstLog.topics[1]));
    const minter = '0x' + firstLog.topics[2].slice(-40).toLowerCase();
    const batchId = BigInt(firstLog.topics[3]);

    const dataHex = firstLog.data.startsWith('0x') ? firstLog.data.slice(2) : firstLog.data;
    const mintPrice = BigInt('0x' + dataHex.slice(0, 64));
    const timestamp = BigInt('0x' + dataHex.slice(64, 128));

    const blockNumber_parsed = parseInt(firstLog.blockNumber, 16);

    console.log('  Parsed NFT ID:', nftId);
    console.log('  Parsed Minter:', minter);
    console.log('  Parsed Batch ID:', batchId.toString());
    console.log('  Parsed Mint Price (wei):', mintPrice.toString());
    console.log('  Parsed Mint Price (USDT):', (Number(mintPrice) / 1e18).toFixed(2));
    console.log('  Parsed Timestamp:', timestamp.toString());
    console.log('  Parsed Block Number:', blockNumber_parsed);
    console.log('  Transaction Hash:', firstLog.transactionHash);
    console.log('');

    // Show block range
    const blockNumbers = logs.map((log: any) => parseInt(log.blockNumber, 16));
    const minBlock = Math.min(...blockNumbers);
    const maxBlock = Math.max(...blockNumbers);

    // Get unique NFT IDs
    const uniqueNFTIds = new Set(logs.map((log: any) => Number(BigInt(log.topics[1]))));

    console.log('📊 Summary:');
    console.log(`  Total events: ${logs.length}`);
    console.log(`  Block range: ${minBlock} to ${maxBlock} (${maxBlock - minBlock + 1} blocks)`);
    console.log(`  Unique NFTs: ${uniqueNFTIds.size}`);
    console.log(`  Query time: ${duration}ms`);
    console.log(`  Events per second: ${(logs.length / (duration / 1000)).toFixed(2)}`);
    console.log('');
    console.log('✅ RPC eth_getLogs test successful!');
    console.log('');
    console.log('💡 Tip: To use DRPC, set RPC_URL in .env to your DRPC endpoint:');
    console.log('   RPC_URL=https://lb.drpc.org/ogrpc?network=bsc&dkey=YOUR_DRPC_KEY');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message?.includes('limit exceeded') || error.message?.includes('query returned more than')) {
      console.error('⚠️  Query range too large for this RPC node.');
      console.error('   Public RPC nodes often limit queries to 10,000 blocks or less.');
      console.error('   💡 Solution: Use DRPC or other premium RPC nodes that support larger ranges.');
      console.error('');
      console.error('   To use DRPC:');
      console.error('   1. Sign up at https://drpc.org');
      console.error('   2. Get your API key');
      console.error('   3. Set RPC_URL in .env:');
      console.error('      RPC_URL=https://lb.drpc.org/ogrpc?network=bsc&dkey=YOUR_DRPC_KEY');
      console.error('');
      console.error('   The system will automatically use chunked scanning for large ranges.');
    } else if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
      console.error('⚠️  Rate limit hit. Consider using DRPC or other high-performance RPC nodes.');
    } else if (error.message?.includes('timeout')) {
      console.error('⚠️  Request timeout. The RPC node may be slow or overloaded.');
      console.error('   💡 Solution: Use DRPC for faster and more reliable queries.');
    } else if (error.message?.includes('invalid response')) {
      console.error('⚠️  Invalid RPC response. Check your RPC_URL configuration.');
    }
    
    console.error('');
    process.exit(1);
  }
}

testDRPCRPCLogs().catch(console.error);

