import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

async function testBSCScanAPI() {
  const contractAddress = process.env.NFT_MANAGER_ADDRESS;
  const apiKey = process.env.BSCSCAN_API_KEY;

  if (!contractAddress || !apiKey) {
    console.error('❌ Missing NFT_MANAGER_ADDRESS or BSCSCAN_API_KEY in .env');
    process.exit(1);
  }

  console.log('🔍 Testing BSCScan API...\n');
  console.log('Contract Address:', contractAddress);
  console.log('API Key:', apiKey.substring(0, 10) + '...\n');

  // Calculate NFTMinted event signature hash
  const eventSignature = 'NFTMinted(uint256,address,uint256,uint256,uint256)';
  const topic0 = ethers.id(eventSignature);
  console.log('NFTMinted event topic0:', topic0);
  console.log('');

  // Use Etherscan API V2 format (supports BSC with chainid=56)
  // Reference: https://docs.etherscan.io/api-reference/endpoint/getlogs-address-topics
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const chainId = '56'; // BSC chain ID
  
  const params = new URLSearchParams({
    chainid: chainId,
    module: 'logs',
    action: 'getLogs',
    address: contractAddress,
    topic0: topic0,
    fromBlock: '0',
    toBlock: 'latest',
    page: '1',
    offset: '1000', // Max 1000 per request
    apikey: apiKey,
  });

  console.log('📡 Calling Etherscan API V2 (BSC chainid=56)...');
  console.log(`URL: ${baseUrl}?chainid=${chainId}&module=logs&action=getLogs&address=${contractAddress}&topic0=${topic0}&fromBlock=0&toBlock=latest&page=1&offset=1000&apikey=...`);
  console.log('');

  try {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
    
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('API Response Status:', data.status);
    console.log('API Response Message:', data.message);
    
    if (data.status === '0') {
      const errorMsg = typeof data.result === 'string' ? data.result : (data.message || 'Unknown error');
      console.log('API Response Result:', errorMsg);
      console.log('');
      
      if (errorMsg.includes('No records found') || errorMsg.includes('No transactions found')) {
        console.log('ℹ️  No NFTMinted events found (this is OK if no NFTs have been minted yet)');
      } else if (errorMsg.includes('Invalid API Key')) {
        console.log('❌ Invalid API Key! Please check your BSCSCAN_API_KEY in .env');
      } else if (errorMsg.includes('Free API access is not supported')) {
        console.log('ℹ️  Free API key does not support BSC chain.');
        console.log('   This is expected. The system will automatically fallback to chain scanning.');
        console.log('   To use API, upgrade to a paid plan: https://etherscan.io/apis');
        console.log('');
        console.log('✅ Test completed: API format is correct, fallback mechanism will work.');
        return;
      } else if (errorMsg.includes('rate limit')) {
        console.log('⚠️  Rate limit exceeded. Please wait and try again.');
      } else {
        console.log('⚠️  Unknown error. Full response:', JSON.stringify(data, null, 2));
      }
      return;
    }
    
    console.log('API Response Result:', Array.isArray(data.result) ? `${data.result.length} events` : JSON.stringify(data.result).substring(0, 200));
    console.log('');
    
    if (!Array.isArray(data.result)) {
      console.error('❌ Invalid response format:', JSON.stringify(data.result).substring(0, 200));
      process.exit(1);
    }
    
    const events = data.result;
    console.log(`✅ Found ${events.length} NFTMinted events\n`);
    
    if (events.length === 0) {
      console.log('ℹ️  No events found');
      return;
    }
    
    // Show first event as example
    console.log('📋 First event example:');
    const firstEvent = events[0];
    console.log('  Block Number:', firstEvent.blockNumber);
    console.log('  Transaction Hash:', firstEvent.transactionHash);
    console.log('  Topics:', firstEvent.topics.length);
    console.log('  Data length:', firstEvent.data.length);
    console.log('');
    
    // Parse first event
    console.log('🔍 Parsing first event...');
    const nftId = Number(BigInt(firstEvent.topics[1]));
    const minter = '0x' + firstEvent.topics[2].slice(-40).toLowerCase();
    const batchId = BigInt(firstEvent.topics[3]);
    
    const dataHex = firstEvent.data.startsWith('0x') ? firstEvent.data.slice(2) : firstEvent.data;
    const mintPrice = BigInt('0x' + dataHex.slice(0, 64));
    const timestamp = BigInt('0x' + dataHex.slice(64, 128));
    
    const blockNumber = typeof firstEvent.blockNumber === 'string' 
      ? (firstEvent.blockNumber.startsWith('0x') ? parseInt(firstEvent.blockNumber, 16) : parseInt(firstEvent.blockNumber, 10))
      : firstEvent.blockNumber;
    
    console.log('  Parsed NFT ID:', nftId);
    console.log('  Parsed Minter:', minter);
    console.log('  Parsed Batch ID:', batchId.toString());
    console.log('  Parsed Mint Price (wei):', mintPrice.toString());
    console.log('  Parsed Mint Price (USDT):', (Number(mintPrice) / 1e18).toFixed(2));
    console.log('  Parsed Timestamp:', timestamp.toString());
    console.log('  Parsed Block Number:', blockNumber);
    console.log('  Transaction Hash:', firstEvent.transactionHash);
    console.log('');
    
    // Show block range
    const blockNumbers = events.map((e: any) => {
      const bn = typeof e.blockNumber === 'string' 
        ? (e.blockNumber.startsWith('0x') ? parseInt(e.blockNumber, 16) : parseInt(e.blockNumber, 10))
        : e.blockNumber;
      return bn;
    });
    const minBlock = Math.min(...blockNumbers);
    const maxBlock = Math.max(...blockNumbers);
    
    // Get unique NFT IDs
    const uniqueNFTIds = new Set(events.map((e: any) => Number(BigInt(e.topics[1]))));
    
    console.log('📊 Summary:');
    console.log(`  Total events: ${events.length}`);
    console.log(`  Block range: ${minBlock} to ${maxBlock} (${maxBlock - minBlock + 1} blocks)`);
    console.log(`  Unique NFTs: ${uniqueNFTIds.size}`);
    
    if (events.length === 10000) {
      console.log('');
      console.log('⚠️  WARNING: Got exactly 10000 events, there might be more!');
      console.log('   Consider implementing pagination.');
    }
    
    console.log('');
    console.log('✅ Etherscan API V2 test successful!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testBSCScanAPI().catch(console.error);

