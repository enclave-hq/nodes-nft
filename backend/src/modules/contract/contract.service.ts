import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MetricsService } from '../metrics/metrics.service';

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

  // RewardVault (referral rewards claim)
  private rewardVaultAddress: string | null = null;
  private rewardVaultContract: ethers.Contract | null = null;
  private readonly rewardVaultAbi: any[] = [
    'function getRewardState(address user) view returns (uint256 allocated, uint256 withdrawn, uint256 available)',
    'function getTotalAllocatedBatch(address[] users) view returns (uint256[] totals)',
    'function batchSetTotalAllocated(address[] users, uint256[] newTotals)',
  ];

  constructor(
    private configService: ConfigService,
    private metricsService?: MetricsService,
  ) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const adminPrivateKey = this.configService.get<string>('ADMIN_PRIVATE_KEY');
    this.nftManagerAddress = this.configService.get<string>('NFT_MANAGER_ADDRESS') || '';
    this.rewardVaultAddress = this.configService.get<string>('REWARD_VAULT_ADDRESS') || null;

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
      // Create provider with custom fetch options for timeout
      const fetchRequest = new ethers.FetchRequest(rpcUrl);
      fetchRequest.timeout = 60000; // 60 seconds timeout
      
      this.provider = new ethers.JsonRpcProvider(fetchRequest);
      this.signer = new ethers.Wallet(adminPrivateKey, this.provider);
      
      // Test connection
      try {
        const blockNumber = await this.provider.getBlockNumber();
        console.log(`✅ RPC connection successful (block: ${blockNumber})`);
      } catch (error: any) {
        console.warn('⚠️ RPC connection test failed:', error.message);
        console.warn('   Please check your RPC_URL configuration');
        console.warn(`   RPC_URL: ${rpcUrl ? rpcUrl.substring(0, 50) + '...' : 'not set'}`);
      }
    } catch (error: any) {
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
        // Diamond Pattern ABI is stored as { abi: [...], metadata: {...} }
        this.nftManagerABI = abiData.abi || abiData;
        abiLoaded = true;
        console.log(`✅ Loaded ABI from: ${abiPath}`);
        if (abiData.metadata) {
          console.log(`   📦 Diamond Pattern ABI (${abiData.metadata.totalItems || this.nftManagerABI.length} items)`);
        }
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
      
      // 启动余额监控
      this.startBalanceMonitoring();

      // Initialize RewardVault instance (optional)
      if (this.rewardVaultAddress && /^0x[a-fA-F0-9]{40}$/.test(this.rewardVaultAddress)) {
        try {
          this.rewardVaultContract = new ethers.Contract(
            this.rewardVaultAddress,
            this.rewardVaultAbi,
            this.signer,
          );
          console.log('✅ RewardVault contract initialized');
          console.log(`   RewardVault: ${this.rewardVaultAddress}`);
        } catch (e: any) {
          console.warn('⚠️ Failed to initialize RewardVault contract:', e?.message || e);
          this.rewardVaultContract = null;
        }
      } else {
        console.log('ℹ️ RewardVault not configured (REWARD_VAULT_ADDRESS not set)');
      }
    } else {
      console.warn('⚠️ Contract instance not created (ABI not loaded)');
    }
  }

  /**
   * 启动余额监控（定期更新操作地址余额）
   */
  private startBalanceMonitoring() {
    if (!this.metricsService) {
      return; // Metrics service not available
    }

    const balanceCheckInterval = 60 * 1000; // 60秒检查一次
    
    // 立即执行一次
    this.updateOperatorBalance().catch(err => {
      console.error('❌ Initial balance update failed:', err.message);
    });

    // 定期更新
    setInterval(async () => {
      try {
        await this.updateOperatorBalance();
      } catch (error: any) {
        console.error('❌ Balance monitoring error:', error.message);
      }
    }, balanceCheckInterval);
  }

  /**
   * 更新操作地址余额
   */
  private async updateOperatorBalance() {
    if (!this.metricsService || !this.signer) {
      return;
    }

    try {
      const operatorAddress = await this.signer.getAddress();
      const balance = await this.provider.getBalance(operatorAddress);
      const balanceEth = parseFloat(ethers.formatEther(balance));
      
      // 获取链 ID
      const network = await this.provider.getNetwork();
      const chainId = network.chainId.toString();
      
      this.metricsService.operatorBalance.set(
        { address: operatorAddress, chain: chainId },
        balanceEth
      );
    } catch (error: any) {
      console.error('❌ Failed to update operator balance:', error.message);
    }
  }

  /**
   * Check if contract service is initialized
   */
  private isInitialized(): boolean {
    return !!this.provider && !!this.signer && !!this.nftManagerContract;
  }

  private isRewardVaultInitialized(): boolean {
    return !!this.provider && !!this.signer && !!this.rewardVaultContract;
  }

  /**
   * Read RewardVault state for a user.
   */
  async getRewardVaultState(userAddress: string): Promise<{
    rewardVaultAddress: string;
    allocatedWei: string;
    withdrawnWei: string;
    availableWei: string;
  }> {
    if (!this.isRewardVaultInitialized() || !this.rewardVaultContract || !this.rewardVaultAddress) {
      throw new Error('RewardVault not initialized. Please set REWARD_VAULT_ADDRESS and restart service.');
    }
    const [allocated, withdrawn, available] = await this.rewardVaultContract.getRewardState(userAddress);
    return {
      rewardVaultAddress: this.rewardVaultAddress,
      allocatedWei: allocated.toString(),
      withdrawnWei: withdrawn.toString(),
      availableWei: available.toString(),
    };
  }

  /**
   * Batch read on-chain totals for users.
   */
  async getRewardVaultTotalAllocatedBatch(users: string[]): Promise<string[]> {
    if (!this.isRewardVaultInitialized() || !this.rewardVaultContract) {
      throw new Error('RewardVault not initialized. Please set REWARD_VAULT_ADDRESS and restart service.');
    }
    const totals: bigint[] = await this.rewardVaultContract.getTotalAllocatedBatch(users);
    return totals.map((t) => t.toString());
  }

  /**
   * Batch set latest total allocations (idempotent, only increase allowed by contract).
   */
  async batchSetRewardVaultTotalAllocated(users: string[], newTotalsWei: string[]): Promise<string> {
    if (!this.isRewardVaultInitialized() || !this.rewardVaultContract) {
      throw new Error('RewardVault not initialized. Please set REWARD_VAULT_ADDRESS and restart service.');
    }
    const tx = await this.rewardVaultContract.batchSetTotalAllocated(users, newTotalsWei);
    console.log(`📝 RewardVault batchSetTotalAllocated tx: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Read contract state (view function)
   * With retry mechanism for timeout errors
   */
  async readContract<T = any>(
    functionName: string,
    args: any[] = [],
    retries: number = 3,
  ): Promise<T> {
    if (!this.isInitialized()) {
      throw new Error('Contract service not initialized. Please check your configuration.');
    }
    
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        return await this.nftManagerContract[functionName](...args);
      } catch (error: any) {
        lastError = error;
        
        // Handle BAD_DATA errors (empty response, usually means contract doesn't exist or method doesn't exist)
        if (error.code === 'BAD_DATA' && error.value === '0x') {
          // Check if contract code exists at the address
          try {
            const code = await this.provider.getCode(this.nftManagerAddress);
            if (!code || code === '0x') {
              throw new Error(
                `Contract does not exist at address ${this.nftManagerAddress}. ` +
                `Please verify NFT_MANAGER_ADDRESS is correct and the contract is deployed.`
              );
            }
            
            // Contract exists, but method might not exist or returned empty data
            throw new Error(
              `Contract call to ${functionName}() returned empty data (0x). ` +
              `This may indicate: (1) The method doesn't exist in the contract ABI, ` +
              `(2) The contract is not fully initialized, or (3) RPC node returned invalid data. ` +
              `Contract address: ${this.nftManagerAddress}`
            );
          } catch (checkError: any) {
            // If check fails, throw the original error with additional context
            throw new Error(
              `${checkError.message} Original error: ${error.message}`
            );
          }
        }
        
        // Retry on timeout errors
        if (error.code === 'TIMEOUT' && i < retries - 1) {
          const delay = (i + 1) * 1000; // Exponential backoff: 1s, 2s, 3s
          console.warn(`⚠️ RPC timeout for ${functionName}, retrying in ${delay}ms... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        console.error(`Error reading contract ${functionName}:`, error);
        throw error;
      }
    }
    
    throw lastError;
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
   * Check if transfers are enabled
   */
  async transfersEnabled(): Promise<boolean> {
    return await this.readContract<boolean>('transfersEnabled', []);
  }

  /**
   * Set transfers enabled/disabled (only master can call)
   */
  async setTransfersEnabled(enabled: boolean): Promise<string> {
    console.log(`📝 Setting transfers enabled to: ${enabled}`);
    return await this.writeContract('setTransfersEnabled', [enabled]);
  }

  /**
   * Check if address is whitelisted
   * Uses the isWhitelisted() function from the contract
   */
  async isWhitelisted(address: string): Promise<boolean> {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('isWhitelisted called with invalid address:', address);
      return false;
    }
    
    // Validate address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      console.warn('isWhitelisted called with invalid address format:', address);
      return false;
    }
    
    try {
      return await this.readContract<boolean>('isWhitelisted', [address.trim()]);
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
   * Get active batch ID
   */
  async getActiveBatch(): Promise<bigint> {
    try {
      const batchId = await this.readContract<bigint>('getActiveBatch');
      return batchId;
    } catch (error) {
      console.error('Error getting active batch:', error);
      throw error;
    }
  }

  /**
   * Get current batch ID
   */
  async getCurrentBatchId(): Promise<bigint> {
    try {
      const batchId = await this.readContract<bigint>('getCurrentBatchId');
      return batchId;
    } catch (error) {
      console.error('Error getting current batch ID:', error);
      throw error;
    }
  }

  /**
   * Get batch information
   */
  async getBatch(batchId: bigint): Promise<{
    batchId: bigint;
    maxMintable: bigint;
    currentMinted: bigint;
    mintPrice: bigint;
    active: boolean;
    createdAt: bigint;
  }> {
    try {
      const batch = await this.readContract('batches', [batchId]);
      
      // ethers.js v6 returns a Result object with both array indices and named properties
      // The ABI names are: batchId_, maxMintable, currentMinted, mintPrice, active, createdAt
      // Access by index for reliability: [0]=batchId_, [1]=maxMintable, etc.
      const batchIdResult = batch[0] ?? batch.batchId_ ?? BigInt(0);
      const maxMintable = batch[1] ?? batch.maxMintable ?? BigInt(0);
      const currentMinted = batch[2] ?? batch.currentMinted ?? BigInt(0);
      const mintPrice = batch[3] ?? batch.mintPrice ?? BigInt(0);
      const active = batch[4] ?? batch.active ?? false;
      const createdAt = batch[5] ?? batch.createdAt ?? BigInt(0);
      
      // Validate batch data - if batchId is 0, batch doesn't exist
      // (because valid batch IDs start from 1)
      if (batchIdResult === 0n || batchIdResult === BigInt(0)) {
        throw new Error(`Batch ${batchId} does not exist or has invalid data`);
      }

      return {
        batchId: batchIdResult,
        maxMintable,
        currentMinted,
        mintPrice,
        active,
        createdAt,
      };
    } catch (error) {
      console.error(`Error getting batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Get all batches (iterate through batch IDs)
   */
  async getAllBatches(): Promise<Array<{
    batchId: bigint;
    maxMintable: bigint;
    currentMinted: bigint;
    mintPrice: bigint;
    active: boolean;
    createdAt: bigint;
  }>> {
    try {
      const currentBatchId = await this.getCurrentBatchId();
      const batches: Array<{
        batchId: bigint;
        maxMintable: bigint;
        currentMinted: bigint;
        mintPrice: bigint;
        active: boolean;
        createdAt: bigint;
      }> = [];

      // Iterate through all batch IDs (starting from 1)
      for (let i = 1; i < Number(currentBatchId); i++) {
        try {
          const batch = await this.getBatch(BigInt(i));
          batches.push(batch);
        } catch (error) {
          // Skip if batch doesn't exist
          console.warn(`Batch ${i} does not exist, skipping`);
        }
      }

      return batches;
    } catch (error) {
      console.error('Error getting all batches:', error);
      throw error;
    }
  }

  /**
   * Get whitelist count
   */
  async getWhitelistCount(): Promise<bigint> {
    try {
      return await this.readContract<bigint>('getWhitelistCount');
    } catch (error) {
      console.error('Error getting whitelist count:', error);
      throw error;
    }
  }

  /**
   * Get all whitelisted addresses from contract
   * @returns Array of all whitelisted addresses
   */
  async getAllWhitelistedAddresses(): Promise<string[]> {
    try {
      const addresses = await this.readContract<string[]>('getAllWhitelistedAddresses');
      return addresses.map(addr => addr.toLowerCase());
    } catch (error) {
      console.error('Error getting all whitelisted addresses:', error);
      throw error;
    }
  }

  /**
   * Get Treasury address from NFTManager contract
   */
  async getTreasury(): Promise<string> {
    try {
      return await this.readContract<string>('treasury');
    } catch (error) {
      console.error('Error getting treasury address:', error);
      throw error;
    }
  }

  /**
   * Get USDT token address from NFTManager contract
   */
  async getUsdtToken(): Promise<string> {
    try {
      return await this.readContract<string>('usdtToken');
    } catch (error) {
      console.error('Error getting USDT token address:', error);
      throw error;
    }
  }

  /**
   * Get total minted NFT count
   * @returns Total minted count
   */
  async getTotalMinted(): Promise<number> {
    try {
      const totalMinted = await this.readContract<bigint>('totalMinted', []);
      return Number(totalMinted);
    } catch (error: any) {
      console.error('Error reading contract totalMinted:', error);
      
      // Provide more helpful error message
      if (error.code === 'BAD_DATA' || error.message?.includes('empty data')) {
        throw new Error(
          `Failed to get totalMinted from contract. ` +
          `Please verify: (1) NFT_MANAGER_ADDRESS is correct (${this.nftManagerAddress}), ` +
          `(2) The contract is deployed and initialized, ` +
          `(3) The RPC node is working correctly. ` +
          `Original error: ${error.message}`
        );
      }
      
      throw error;
    }
  }

  /**
   * Get original minter address for an NFT (from chain)
   * @param nftId NFT ID
   * @returns Original minter address, or null if not set (for NFTs minted before upgrade) or if NFT pool not initialized
   */
  async getMinter(nftId: number): Promise<string | null> {
    try {
      const minter = await this.readContract<string>('getMinter', [nftId]);
      
      // Check if minter is zero address (not set)
      if (!minter || minter === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      return minter;
    } catch (error: any) {
      console.error(`Error reading contract getMinter:`, error);
      
      // Handle execution reverted errors (NFT pool may not be initialized yet)
      if (error.code === 'CALL_EXCEPTION' || 
          error.reason === 'require(false)' ||
          error.shortMessage?.includes('execution reverted')) {
        console.log(`⚠️ NFT ${nftId} pool may not be initialized yet, returning null`);
        return null;
      }
      
      // If function doesn't exist (contract not upgraded yet), return null
      if (error.message?.includes('function') || error.message?.includes('not found')) {
        return null;
      }
      
      // For other errors, still return null instead of throwing
      // This allows the callback to proceed with the provided minterAddress
      console.warn(`⚠️ Unexpected error getting minter for NFT ${nftId}, returning null:`, error.message);
      return null;
    }
  }

  /**
   * Get all NFT IDs owned by a user (from chain)
   * @param userAddress User address
   * @returns Array of NFT IDs owned by the user
   */
  async getUserNFTs(userAddress: string): Promise<number[]> {
    try {
      const nftIds = await this.readContract<bigint[]>('getUserNFTs', [userAddress]);
      return nftIds.map(id => Number(id));
    } catch (error: any) {
      console.error(`Error reading contract getUserNFTs for ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get NFTMinted events from Etherscan API V2 (supports BSC with chainid=56)
   * This is faster than scanning chain directly
   * @param fromBlock Starting block number (optional, defaults to 0)
   * @param toBlock Ending block number (optional, defaults to 'latest')
   * @returns Array of NFT mint events with nftId, minter, batchId, mintPrice, timestamp, txHash
   */
  async getNFTMintedEventsFromBSCScan(
    fromBlock?: number,
    toBlock?: number | 'latest',
  ): Promise<Array<{
    nftId: number;
    minter: string;
    batchId: bigint;
    mintPrice: bigint;
    timestamp: bigint;
    txHash: string;
    blockNumber: number;
  }> | null> {
    try {
      const apiKey = this.configService.get<string>('BSCSCAN_API_KEY');
      if (!apiKey) {
        console.log('ℹ️  BSCScan API key not configured, skipping API method');
        return null;
      }

      const contractAddress = this.nftManagerAddress;
      
      // Calculate NFTMinted event signature hash (topic0)
      // Event signature: NFTMinted(uint256,address,uint256,uint256,uint256)
      const eventSignature = 'NFTMinted(uint256,address,uint256,uint256,uint256)';
      const topic0 = ethers.id(eventSignature);

      // Use Etherscan API V2 format (supports BSC with chainid=56)
      // Reference: https://docs.etherscan.io/api-reference/endpoint/getlogs-address-topics
      const baseUrl = 'https://api.etherscan.io/v2/api';
      const chainId = '56'; // BSC chain ID
      
      // Build API URL with V2 format
      const params = new URLSearchParams({
        chainid: chainId,
        module: 'logs',
        action: 'getLogs',
        address: contractAddress,
        topic0: topic0,
        fromBlock: fromBlock?.toString() || '0',
        toBlock: toBlock === 'latest' ? 'latest' : (toBlock?.toString() || 'latest'),
        page: '1',
        offset: '1000', // Max 1000 per request, use pagination if needed
        apikey: apiKey,
      });

      console.log(`📡 Fetching NFTMinted events from Etherscan API V2 (BSC chainid=56)...`);
      console.log(`   Contract: ${contractAddress}`);
      console.log(`   From block: ${fromBlock || 0}, To block: ${toBlock || 'latest'}`);

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

      if (data.status === '0') {
        const errorMsg = data.message || data.result || 'Unknown error';
        
        if (errorMsg.includes('No records found') || errorMsg.includes('No transactions found')) {
          console.log('ℹ️  No NFTMinted events found in Etherscan API');
          return [];
        }
        
        if (errorMsg.includes('Free API access is not supported')) {
          console.log('ℹ️  Free API key does not support BSC chain. Falling back to chain scanning.');
          return null; // Return null to trigger fallback
        }
        
        throw new Error(`Etherscan API error: ${errorMsg}`);
      }

      if (!Array.isArray(data.result)) {
        throw new Error(`Invalid Etherscan API response: ${JSON.stringify(data.result)}`);
      }

      const events = data.result;
      console.log(`   Found ${events.length} events from Etherscan API V2`);

      // Etherscan API V2 returns max 1000 per request (offset limit)
      // If we get exactly 1000, there might be more (need pagination)
      if (events.length === 1000) {
        console.warn('⚠️  Got exactly 1000 events, there might be more. Pagination not yet implemented.');
      }

      // Parse events
      const parsedEvents = events.map((log: any) => {
        // topics[0] = event signature (topic0)
        // topics[1] = nftId (indexed uint256)
        // topics[2] = minter (indexed address) - address is padded to 32 bytes in topic
        // topics[3] = batchId (indexed uint256)
        // data = mintPrice (uint256) + timestamp (uint256)

        const nftId = Number(BigInt(log.topics[1]));
        // Address in topic is padded: 0x0000...0000<address>
        const minter = '0x' + log.topics[2].slice(-40).toLowerCase();
        const batchId = BigInt(log.topics[3]);
        
        // Decode data: mintPrice (uint256) + timestamp (uint256)
        // Each uint256 is 64 hex characters (32 bytes)
        const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
        const mintPrice = BigInt('0x' + dataHex.slice(0, 64));
        const timestamp = BigInt('0x' + dataHex.slice(64, 128));

        // BSCScan API returns blockNumber as decimal string, not hex
        const blockNumber = typeof log.blockNumber === 'string' 
          ? (log.blockNumber.startsWith('0x') ? parseInt(log.blockNumber, 16) : parseInt(log.blockNumber, 10))
          : log.blockNumber;

        return {
          nftId,
          minter: minter.toLowerCase(),
          batchId,
          mintPrice,
          timestamp,
          txHash: log.transactionHash,
          blockNumber,
        };
      });

      console.log(`✅ Successfully parsed ${parsedEvents.length} events from Etherscan API V2`);
      return parsedEvents;
    } catch (error: any) {
      console.error('❌ Error fetching events from Etherscan API V2:', error.message);
      // Return null to indicate API method failed, should fallback to chain scanning
      return null;
    }
  }

  /**
   * Get NFTMinted events using direct RPC eth_getLogs (optimized for DRPC and other high-performance RPC nodes)
   * This method uses eth_getLogs directly, which is faster than queryFilter for large ranges
   * @param fromBlock Starting block number (optional, defaults to 0)
   * @param toBlock Ending block number (optional, defaults to 'latest')
   * @param chunkSize Number of blocks to scan per request (defaults to 5000 to avoid RPC limits)
   * @returns Array of NFT mint events with nftId, minter, batchId, mintPrice, timestamp, txHash
   */
  async getNFTMintedEventsViaRPC(
    fromBlock?: number,
    toBlock?: number | 'latest',
    chunkSize: number = 5000,
  ): Promise<Array<{
    nftId: number;
    minter: string;
    batchId: bigint;
    mintPrice: bigint;
    timestamp: bigint;
    txHash: string;
    blockNumber: number;
  }> | null> {
    try {
      if (!this.provider || !this.nftManagerAddress) {
        throw new Error('Provider or contract address not initialized');
      }

      // Get current block number if toBlock is 'latest'
      let endBlock: number;
      if (toBlock === 'latest' || !toBlock) {
        endBlock = await this.provider.getBlockNumber();
      } else {
        endBlock = toBlock;
      }

      const startBlock = fromBlock || 0;
      const totalBlocks = endBlock - startBlock + 1;

      console.log(`📡 Using RPC eth_getLogs to query NFTMinted events from block ${startBlock} to ${endBlock} (${totalBlocks} blocks)`);

      // Calculate NFTMinted event signature hash (topic0)
      const eventSignature = 'NFTMinted(uint256,address,uint256,uint256,uint256)';
      const topic0 = ethers.id(eventSignature);

      // If the range is small enough, query in one go
      if (totalBlocks <= chunkSize) {
        try {
          const logs = await this.provider.send('eth_getLogs', [{
            address: this.nftManagerAddress,
            topics: [topic0], // Only filter by event signature
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${endBlock.toString(16)}`,
          }]);

          return this.parseEventLogs(logs);
        } catch (error: any) {
          console.error('❌ Error in single RPC call:', error.message);
          return null;
        }
      }

      // For large ranges, use chunked scanning
      console.log(`   Using chunked scanning (${chunkSize} blocks per chunk)`);
      const allEvents: Array<{
        nftId: number;
        minter: string;
        batchId: bigint;
        mintPrice: bigint;
        timestamp: bigint;
        txHash: string;
        blockNumber: number;
      }> = [];

      let currentFrom = startBlock;
      let chunkIndex = 0;

      while (currentFrom <= endBlock) {
        const currentTo = Math.min(currentFrom + chunkSize - 1, endBlock);
        chunkIndex++;

        try {
          console.log(`   Chunk ${chunkIndex}: scanning blocks ${currentFrom} to ${currentTo}...`);
          
          const logs = await this.provider.send('eth_getLogs', [{
            address: this.nftManagerAddress,
            topics: [topic0],
            fromBlock: `0x${currentFrom.toString(16)}`,
            toBlock: `0x${currentTo.toString(16)}`,
          }]);

          const parsedEvents = this.parseEventLogs(logs);
          allEvents.push(...parsedEvents);
          console.log(`   Chunk ${chunkIndex}: found ${parsedEvents.length} events. Total: ${allEvents.length}`);

          // Small delay between chunks to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error: any) {
          console.error(`❌ Error scanning chunk ${chunkIndex} (blocks ${currentFrom}-${currentTo}):`, error.message);
          // If it's a rate limit error, wait longer and retry
          if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
            console.warn('   Rate limit hit, waiting 2 seconds before continuing...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          // For other errors, log and continue to next chunk
        }
        currentFrom = currentTo + 1;
      }

      console.log(`✅ Successfully retrieved ${allEvents.length} events via RPC eth_getLogs`);
      return allEvents;
    } catch (error: any) {
      console.error('❌ Error querying events via RPC:', error.message);
      return null;
    }
  }

  /**
   * Parse event logs from eth_getLogs response
   * @param logs Raw logs from eth_getLogs
   * @returns Parsed event array
   */
  private parseEventLogs(logs: any[]): Array<{
    nftId: number;
    minter: string;
    batchId: bigint;
    mintPrice: bigint;
    timestamp: bigint;
    txHash: string;
    blockNumber: number;
  }> {
    return logs.map((log: any) => {
      // topics[0] = event signature (topic0)
      // topics[1] = nftId (indexed uint256)
      // topics[2] = minter (indexed address) - address is padded to 32 bytes in topic
      // topics[3] = batchId (indexed uint256)
      // data = mintPrice (uint256) + timestamp (uint256)

      const nftId = Number(BigInt(log.topics[1]));
      const minter = '0x' + log.topics[2].slice(-40).toLowerCase();
      const batchId = BigInt(log.topics[3]);

      // Decode data: mintPrice (uint256) + timestamp (uint256)
      const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
      const mintPrice = BigInt('0x' + dataHex.slice(0, 64));
      const timestamp = BigInt('0x' + dataHex.slice(64, 128));

      // RPC returns blockNumber as hex string
      const blockNumber = parseInt(log.blockNumber, 16);

      return {
        nftId,
        minter: minter.toLowerCase(),
        batchId,
        mintPrice,
        timestamp,
        txHash: log.transactionHash,
        blockNumber,
      };
    });
  }

  /**
   * Scan NFTMinted events from chain
   * Uses chunked scanning to avoid RPC rate limits and timeouts
   * @param fromBlock Starting block number (optional, defaults to 0)
   * @param toBlock Ending block number (optional, defaults to 'latest')
   * @param chunkSize Number of blocks to scan per request (defaults to 5000 to avoid RPC limits)
   * @returns Array of NFT mint events with nftId, minter, batchId, mintPrice, timestamp, txHash
   */
  async scanNFTMintedEvents(
    fromBlock?: number,
    toBlock?: number | 'latest',
    chunkSize: number = 5000,
  ): Promise<Array<{
    nftId: number;
    minter: string;
    batchId: bigint;
    mintPrice: bigint;
    timestamp: bigint;
    txHash: string;
    blockNumber: number;
  }>> {
    try {
      if (!this.nftManagerContract) {
        throw new Error('Contract not initialized');
      }

      // Get current block number if toBlock is 'latest'
      let endBlock: number;
      if (toBlock === 'latest' || !toBlock) {
        endBlock = await this.provider.getBlockNumber();
      } else {
        endBlock = toBlock;
      }

      const startBlock = fromBlock || 0;
      const totalBlocks = endBlock - startBlock + 1;

      console.log(`📡 Scanning NFTMinted events from block ${startBlock} to ${endBlock} (${totalBlocks} blocks)`);

      // If the range is small enough, scan in one go
      if (totalBlocks <= chunkSize) {
        const filter = this.nftManagerContract.filters.NFTMinted();
        const events = await this.nftManagerContract.queryFilter(
          filter,
          startBlock,
          endBlock,
        );

        return events.map((event) => {
          // queryFilter returns EventLog which has args property
          if (!('args' in event)) {
            throw new Error('Event log does not have args property');
          }
          const args = event.args as any;
          return {
            nftId: Number(args[0]), // nftId
            minter: args[1].toLowerCase(), // minter
            batchId: args[2], // batchId
            mintPrice: args[3], // mintPrice
            timestamp: args[4], // timestamp
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
          };
        });
      }

      // Otherwise, scan in chunks to avoid RPC limits
      console.log(`   Using chunked scanning (${chunkSize} blocks per chunk)`);
      const allEvents: Array<{
        nftId: number;
        minter: string;
        batchId: bigint;
        mintPrice: bigint;
        timestamp: bigint;
        txHash: string;
        blockNumber: number;
      }> = [];

      const filter = this.nftManagerContract.filters.NFTMinted();
      let currentFrom = startBlock;
      let chunkIndex = 0;

      while (currentFrom <= endBlock) {
        const currentTo = Math.min(currentFrom + chunkSize - 1, endBlock);
        chunkIndex++;

        try {
          console.log(`   Chunk ${chunkIndex}: scanning blocks ${currentFrom} to ${currentTo}...`);
          
          const chunkEvents = await this.nftManagerContract.queryFilter(
            filter,
            currentFrom,
            currentTo,
          );

          const parsedEvents = chunkEvents.map((event) => {
            // queryFilter returns EventLog which has args property
            if (!('args' in event)) {
              throw new Error('Event log does not have args property');
            }
            const args = event.args as any;
            return {
              nftId: Number(args[0]), // nftId
              minter: args[1].toLowerCase(), // minter
              batchId: args[2], // batchId
              mintPrice: args[3], // mintPrice
              timestamp: args[4], // timestamp
              txHash: event.transactionHash,
              blockNumber: event.blockNumber,
            };
          });

          allEvents.push(...parsedEvents);
          console.log(`      Found ${parsedEvents.length} events in this chunk`);

          // Small delay between chunks to avoid rate limiting
          if (currentTo < endBlock) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
          }

          currentFrom = currentTo + 1;
        } catch (error: any) {
          // If a chunk fails, log and continue with next chunk
          console.error(`   ⚠️  Error scanning chunk ${chunkIndex} (blocks ${currentFrom}-${currentTo}):`, error.message);
          
          // If it's a rate limit error, wait longer before retrying
          if (error.message?.includes('rate limit') || error.code === 429) {
            console.log(`   ⏳ Rate limited, waiting 2 seconds before next chunk...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Continue with next chunk
          currentFrom = currentTo + 1;
        }
      }

      console.log(`   ✅ Scanned ${chunkIndex} chunks, found ${allEvents.length} total events`);
      return allEvents;
    } catch (error: any) {
      console.error('Error scanning NFTMinted events:', error);
      throw error;
    }
  }

  /**
   * Get contract deployment block number
   * @returns Block number where the contract was deployed, or null if not found
   */
  async getContractDeploymentBlock(): Promise<number | null> {
    try {
      // Method 1: Try to get from contract creation transaction
      // Query the contract's code at block 0, then binary search for deployment block
      const currentBlock = await this.provider.getBlockNumber();
      
      // Check if contract exists at current block
      const code = await this.provider.getCode(this.nftManagerAddress, currentBlock);
      if (!code || code === '0x') {
        console.warn('Contract does not exist at current block');
        return null;
      }

      // Binary search for deployment block
      let low = 0;
      let high = currentBlock;
      let deploymentBlock: number | null = null;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const codeAtMid = await this.provider.getCode(this.nftManagerAddress, mid);
        
        if (codeAtMid && codeAtMid !== '0x') {
          // Contract exists at this block, deployment block is at or before this
          deploymentBlock = mid;
          high = mid - 1;
        } else {
          // Contract doesn't exist yet, deployment block is after this
          low = mid + 1;
        }
      }

      if (deploymentBlock !== null) {
        console.log(`✅ Found contract deployment block: ${deploymentBlock}`);
      }

      return deploymentBlock;
    } catch (error: any) {
      console.error('Error getting contract deployment block:', error);
      // Fallback: return null, will scan from block 0
      return null;
    }
  }

  /**
   * Get NodeNFT contract address
   * @returns NodeNFT contract address
   */
  async getNodeNFTAddress(): Promise<string> {
    try {
      const address = await this.readContract<string>('nodeNFT', []);
      return address;
    } catch (error: any) {
      console.error('Error getting NodeNFT address:', error);
      throw error;
    }
  }

  /**
   * Get owner of an NFT from NodeNFT contract
   * @param nftId NFT ID
   * @returns Owner address
   */
  async getNFTOwner(nftId: number): Promise<string> {
    try {
      const nodeNFTAddress = await this.getNodeNFTAddress();
      const nodeNFTABI = ['function ownerOf(uint256 tokenId) view returns (address)'];
      const nodeNFT = new ethers.Contract(nodeNFTAddress, nodeNFTABI, this.provider);
      const owner = await nodeNFT.ownerOf(nftId);
      return owner.toLowerCase();
    } catch (error: any) {
      console.error(`Error getting owner for NFT #${nftId}:`, error);
      throw error;
    }
  }

  /**
   * Set minter address for an existing NFT (migration function)
   * This will create the NFT pool if it doesn't exist
   * @param nftId NFT ID
   * @param minterAddress Original minter address
   * @returns Transaction hash
   */
  async setMinter(nftId: number, minterAddress: string): Promise<string> {
    if (!this.isInitialized()) {
      throw new Error('Contract service not initialized. Please check your configuration.');
    }

    try {
      const txHash = await this.writeContract('setMinter', [nftId, minterAddress]);
      console.log(`✅ Set minter for NFT ${nftId}: ${minterAddress}`);
      return txHash;
    } catch (error: any) {
      console.error(`Error setting minter for NFT ${nftId}:`, error);
      throw error;
    }
  }

  /**
   * Batch set minter addresses for multiple NFTs (migration function)
   * This will create NFT pools if they don't exist
   * @param nftIds Array of NFT IDs
   * @param minterAddresses Array of minter addresses (must match length of nftIds)
   * @returns Transaction hash
   */
  async batchSetMinters(nftIds: number[], minterAddresses: string[]): Promise<string> {
    if (!this.isInitialized()) {
      throw new Error('Contract service not initialized. Please check your configuration.');
    }

    if (nftIds.length !== minterAddresses.length) {
      throw new Error('nftIds and minterAddresses arrays must have the same length');
    }

    if (nftIds.length === 0) {
      throw new Error('Arrays cannot be empty');
    }

    try {
      const txHash = await this.writeContract('batchSetMinters', [nftIds, minterAddresses]);
      console.log(`✅ Batch set minter for ${nftIds.length} NFTs`);
      return txHash;
    } catch (error: any) {
      console.error(`Error batch setting minters:`, error);
      throw error;
    }
  }

  /**
   * @param address Address to check balance for
   * @returns Balance in wei
   */
  async getUsdtBalance(address: string): Promise<bigint> {
    try {
      const usdtAddress = await this.getUsdtToken();
      
      // Create ERC20 contract instance
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];
      
      const usdtContract = new ethers.Contract(usdtAddress, erc20Abi, this.provider);
      const balance = await usdtContract.balanceOf(address);
      
      return BigInt(balance.toString());
    } catch (error) {
      console.error('Error getting USDT balance:', error);
      throw error;
    }
  }

  /**
   * Transfer USDT from an address to another
   * 
   * Important: 
   * - If `from` is the signer address: uses transfer() directly
   * - If `from` is not the signer address: uses transferFrom(), which requires:
   *   1. Treasury must have approved this signer address to spend USDT
   *   2. Approval amount must be >= transfer amount
   * 
   * @param from Source address (Treasury address)
   * @param to Destination address
   * @param amount Amount in wei
   * @returns Transaction hash
   */
  async transferUsdt(from: string, to: string, amount: bigint): Promise<string> {
    try {
      const usdtAddress = await this.getUsdtToken();
      
      // Create ERC20 contract instance with signer
      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function transferFrom(address from, address to, uint256 amount) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function balanceOf(address owner) view returns (uint256)',
      ];
      
      const usdtContract = new ethers.Contract(usdtAddress, erc20Abi, this.signer);
      const signerAddress = await this.signer.getAddress();
      
      // Case 1: Treasury is the signer address - can transfer directly
      if (from.toLowerCase() === signerAddress.toLowerCase()) {
        console.log(`✅ Treasury is signer address, using transfer()`);
        const tx = await usdtContract.transfer(to, amount);
        const receipt = await tx.wait();
        return receipt.hash;
      }
      
      // Case 2: Treasury is a different address - need to use transferFrom
      console.log(`⚠️  Treasury (${from}) is not signer (${signerAddress}), checking allowance...`);
      
      // Check allowance
      const allowance = await usdtContract.allowance(from, signerAddress);
      const allowanceBigInt = BigInt(allowance.toString());
      
      console.log(`   Allowance: ${allowanceBigInt.toString()}, Required: ${amount.toString()}`);
      
      if (allowanceBigInt < amount) {
        throw new Error(
          `Insufficient allowance. Treasury needs to approve this signer address (${signerAddress}) to spend USDT. ` +
          `Current allowance: ${(Number(allowanceBigInt) / 1e18).toFixed(2)} USDT, ` +
          `Required: ${(Number(amount) / 1e18).toFixed(2)} USDT`
        );
      }
      
      // Use transferFrom
      console.log(`✅ Sufficient allowance, using transferFrom()`);
      const tx = await usdtContract.transferFrom(from, to, amount);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      console.error('Error transferring USDT:', error);
      throw error;
    }
  }
}

