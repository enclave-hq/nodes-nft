#!/usr/bin/env node

/**
 * Generate a random JWT secret
 * Usage: node scripts/generate-jwt-secret.js
 */

const crypto = require('crypto');

// Generate 64 bytes (128 hex characters) for a strong secret
const secret = crypto.randomBytes(64).toString('hex');

console.log('Generated JWT_SECRET:');
console.log(`JWT_SECRET="${secret}"`);
console.log('\nAdd this to your .env file.');

