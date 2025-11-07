/**
 * Calculate test user private keys and addresses
 * 
 * This script calculates the private keys and addresses for test users
 * using the same algorithm as test-complete-automated.ts
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';

// Generate test user private keys from seed (same as test-complete-automated.ts)
function generateTestUserKeys(seed: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const hash = crypto.createHash('sha256').update(`${seed}${i}`).digest('hex');
    keys.push(`0x${hash}`);
  }
  return keys;
}

// Test user private keys (generated from seed: 19751216)
const TEST_USER_SEED = '19751216';
const TEST_USER_KEYS = generateTestUserKeys(TEST_USER_SEED, 5);

console.log('Test User Private Keys (generated from seed: 19751216):');
console.log('='.repeat(70));

TEST_USER_KEYS.forEach((key, i) => {
  const wallet = new ethers.Wallet(key);
  console.log(`User ${i + 1}:`);
  console.log(`  Private Key: ${key}`);
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Generation:  SHA256('${TEST_USER_SEED}${i}')`);
  console.log('');
});

console.log('='.repeat(70));
console.log('Note: These are deterministic test keys generated from seed.');
console.log('They are safe to use in test environments but should NEVER be used in production.');
console.log('='.repeat(70));

