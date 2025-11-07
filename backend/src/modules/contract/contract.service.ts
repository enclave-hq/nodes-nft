import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Contract Service
 * Handles all smart contract interactions using ethers.js
 * No wallet SDK needed - backend uses private key directly
 */
@Injectable()
export class ContractService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private nftManagerContract: ethers.Contract;
  private nftManagerAddress: string;
  private nftManagerABI: any[];

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const adminPrivateKey = this.configService.get<string>('ADMIN_PRIVATE_KEY');
    this.nftManagerAddress = this.configService.get<string>('NFT_MANAGER_ADDRESS') || '';

    // Check if configuration is valid
    if (!rpcUrl || !adminPrivateKey || !this.nftManagerAddress) {
      console.warn('⚠️ Contract service not fully configured. Some features may not work.');
      console.warn('   Required: RPC_URL, ADMIN_PRIVATE_KEY, NFT_MANAGER_ADDRESS');
      return;
    }

    // Validate private key format (should not be placeholder)
    const isPlaceholder = 
      adminPrivateKey.includes('your-admin-private-key') ||
      adminPrivateKey.includes('0xyour-admin') ||
      adminPrivateKey.length < 64; // Minimum valid private key length

    if (isPlaceholder) {
      console.warn('⚠️ ADMIN_PRIVATE_KEY appears to be a placeholder. Contract operations will fail.');
      console.warn('   Please set a valid private key in your .env file.');
      return;
    }

    // Validate private key format with ethers
    try {
      // Remove '0x' prefix if present for validation
      const cleanKey = adminPrivateKey.startsWith('0x') 
        ? adminPrivateKey.slice(2) 
        : adminPrivateKey;
      
      if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
        throw new Error('Invalid private key format');
      }
    } catch (error) {
      console.warn('⚠️ Invalid ADMIN_PRIVATE_KEY format. Contract operations will fail.');
      console.warn('   Private key should be 64 hex characters (with or without 0x prefix).');
      return;
    }

    // Initialize provider and signer
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(adminPrivateKey, this.provider);
    } catch (error) {
      console.warn('⚠️ Failed to initialize contract service:', error.message);
      return;
    }

    // Load ABI (you should place NFT_MANAGER_ABI.json in the project)
    // Try multiple possible paths
    const possiblePaths = [
      join(process.cwd(), 'abis', 'NFTManager.json'),
      join(process.cwd(), 'src', 'abis', 'NFTManager.json'),
      join(__dirname, '..', '..', '..', 'abis', 'NFTManager.json'),
    ];

    let abiLoaded = false;
    for (const abiPath of possiblePaths) {
      try {
        const abiFile = readFileSync(abiPath, 'utf-8');
        const abiData = JSON.parse(abiFile);
        // Handle both { abi: [...] } and direct array formats
        this.nftManagerABI = abiData.abi || abiData;
        abiLoaded = true;
        console.log(`✅ Loaded ABI from: ${abiPath}`);
        break;
      } catch (error) {
        // Continue to next path
      }
    }

    if (!abiLoaded) {
      console.warn('⚠️ NFTManager ABI not found. Contract calls will fail.');
      console.warn('   Please place NFTManager.json in one of:');
      possiblePaths.forEach((path) => console.warn(`   - ${path}`));
      this.nftManagerABI = [];
    }

    // Initialize contract instance
    if (this.nftManagerABI.length > 0) {
      this.nftManagerContract = new ethers.Contract(
        this.nftManagerAddress,
        this.nftManagerABI,
        this.signer,
      );

      console.log('✅ Contract service initialized');
      console.log(`   NFT Manager: ${this.nftManagerAddress}`);
      console.log(`   Signer: ${this.signer.address}`);
    } else {
      console.warn('⚠️ Contract instance not created (ABI not loaded)');
    }
  }

  /**
   * Check if contract service is initialized
   */
  private isInitialized(): boolean {
    return !!this.provider && !!this.signer && !!this.nftManagerContract;
  }

  /**
   * Read contract state (view function)
   */
  async readContract<T = any>(
    functionName: string,
    args: any[] = [],
  ): Promise<T> {
    if (!this.isInitialized()) {
      throw new Error('Contract service not initialized. Please check your configuration.');
    }
    try {
      return await this.nftManagerContract[functionName](...args);
    } catch (error) {
      console.error(`Error reading contract ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Write contract (transaction)
   */
  async writeContract(
    functionName: string,
    args: any[] = [],
    options?: {
      gasLimit?: bigint;
      gasPrice?: bigint;
    },
  ): Promise<string> {
    if (!this.isInitialized()) {
      throw new Error('Contract service not initialized. Please check your configuration.');
    }
    try {
      const tx = await this.nftManagerContract[functionName](...args, {
        gasLimit: options?.gasLimit,
        gasPrice: options?.gasPrice,
      });
      
      console.log(`📝 Transaction sent: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error(`Error writing contract ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string, confirmations: number = 1) {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Check if address is whitelisted
   * Uses the isWhitelisted() function from the contract
   */
  async isWhitelisted(address: string): Promise<boolean> {
    try {
      return await this.readContract<boolean>('isWhitelisted', [address]);
    } catch (error) {
      console.error('Error checking whitelist:', error);
      return false;
    }
  }

  /**
   * Add addresses to whitelist
   */
  async addToWhitelist(addresses: string[]): Promise<string> {
    try {
      const txHash = await this.writeContract('addToWhitelist', [addresses]);
      await this.waitForTransaction(txHash);
      return txHash;
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      throw error;
    }
  }

  /**
   * Remove address from whitelist
   */
  async removeFromWhitelist(address: string): Promise<string> {
    try {
      const txHash = await this.writeContract('removeFromWhitelist', [address]);
      await this.waitForTransaction(txHash);
      return txHash;
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      throw error;
    }
  }

  /**
   * Get contract owner
   */
  async getOwner(): Promise<string> {
    try {
      return await this.readContract<string>('owner');
    } catch (error) {
      console.error('Error getting owner:', error);
      throw error;
    }
  }

  /**
   * Create batch
   */
  async createBatch(maxMintable: bigint, mintPrice: bigint): Promise<string> {
    try {
      const txHash = await this.writeContract('createBatch', [maxMintable, mintPrice]);
      await this.waitForTransaction(txHash);
      return txHash;
    } catch (error) {
      console.error('Error creating batch:', error);
      throw error;
    }
  }

  /**
   * Activate batch
   */
  async activateBatch(batchId: bigint): Promise<string> {
    try {
      const txHash = await this.writeContract('activateBatch', [batchId]);
      await this.waitForTransaction(txHash);
      return txHash;
    } catch (error) {
      console.error('Error activating batch:', error);
      throw error;
    }
  }

  /**
   * Get active batch
   */
  async getActiveBatch(): Promise<any> {
    try {
      return await this.readContract('getActiveBatch');
    } catch (error) {
      console.error('Error getting active batch:', error);
      throw error;
    }
  }
}

