import { useCallback, useState } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useWeb3Store } from '@/lib/stores/web3Store';
import { CONTRACT_ADDRESSES, GAS_CONFIG } from '@/lib/contracts/config';
import { NFT_MANAGER_ABI, ERC20_ABI, NODE_NFT_ABI } from '@/lib/contracts/abis';

// SellOrder structure matches contract: orderId, nftId, seller, price, createdAt, status
export interface SellOrder {
  orderId: number;
  nftId: number;
  seller: string;
  price: bigint; // Price in USDT (wei) for the whole NFT
  createdAt: number;
  active: boolean;
  status?: number; // OrderStatus enum: 0 = Active, 1 = Cancelled, 2 = Filled
}

export interface SellOrderWithDetails extends SellOrder {
  sellerDisplay: string;
  createdAtDisplay: string;
}

/**
 * Hook to get sell orders for a specific NFT
 */
export function useNFTSellOrders(nftId: number) {
  const { walletManager } = useWallet();
  const [orders, setOrders] = useState<SellOrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchOrders = useCallback(async () => {
    if (!walletManager || !nftId || nftId <= 0) {
      setOrders([]);
      return;
    }

    // Prevent too frequent calls (debounce)
    const now = Date.now();
    if (now - lastFetchTime < 2000) { // 2 seconds debounce
      console.log('⏳ Request too frequent, skipping this query');
      return;
    }
    setLastFetchTime(now);

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Querying NFT sell orders...', { nftId, nftIdType: typeof nftId });

      // Validate contract address
      if (!CONTRACT_ADDRESSES.nftManager) {
        console.error('❌ NFT Manager contract address not configured');
        setError('NFT Manager contract address not configured, please check environment variables');
        setOrders([]);
        return;
      }

      // Validate NFT ID
      if (typeof nftId !== 'number' || nftId <= 0) {
        console.warn('⚠️ Invalid NFT ID:', nftId);
        setOrders([]);
        return;
      }

      // Get active order for this NFT using getActiveOrderByNFT
      const nftIdParam = Number(nftId);
      console.log(`📋 Call parameters:`, { nftIdParam, originalId: nftId });
      
      let orderId: bigint;
      try {
        orderId = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getActiveOrderByNFT',
          [nftIdParam]
        ) as bigint;
      } catch (contractError) {
        console.error(`❌ Contract call failed (NFT ${nftIdParam}):`, contractError);
        throw new Error(`Failed to query NFT ${nftIdParam} orders: ${contractError}`);
      }

      console.log('📋 Found order ID:', orderId ? orderId.toString() : 'No order');

      if (!orderId || orderId === BigInt(0)) {
        setOrders([]);
        return;
      }

      // Fetch order details using getOrder
      try {
        const orderData = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          NFT_MANAGER_ABI as unknown[],
          'getOrder',
          [orderId]
        ) as {
          orderId: bigint;
          nftId: bigint;
          seller: string;
          price: bigint;
          createdAt: bigint;
          status: number;
        };

        // OrderStatus enum: 0 = Active, 1 = Cancelled, 2 = Filled
        const isActive = orderData.status === 0;

        if (isActive) {
          setOrders([{
            orderId: Number(orderData.orderId),
            nftId: Number(orderData.nftId),
            seller: orderData.seller,
            price: orderData.price,
            createdAt: Number(orderData.createdAt),
            active: true,
            status: orderData.status,
            sellerDisplay: formatAddress(orderData.seller),
            createdAtDisplay: formatDate(Number(orderData.createdAt))
          } as SellOrderWithDetails]);
        } else {
          setOrders([]);
        }
      } catch (error) {
        console.error(`❌ Failed to get order details:`, error);
        setOrders([]);
      }
    } catch (err) {
      console.error('❌ Failed to query orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to query orders');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [walletManager, nftId]);

  return {
    data: orders,
    isLoading,
    error,
    refetch: fetchOrders
  };
}

/**
 * Hook to get all sell orders across all NFTs
 * Now uses Web3Store for unified data management
 */
export function useAllSellOrders() {
  const web3Store = useWeb3Store();

  // Use data from Web3Store
  const orders = web3Store.sellOrders || [];
  const isLoading = web3Store.loading.sellOrders;
  const error = web3Store.errors.sellOrders;

  // Refresh function that triggers Web3Store fetch
  const refetch = useCallback(async () => {
    await web3Store.fetchSellOrders();
  }, [web3Store]);

  return {
    data: orders.map(order => ({
      ...order,
      price: BigInt(order.price || '0'),
      sellerDisplay: formatAddress(order.seller),
      createdAtDisplay: formatDate(order.createdAt)
    } as SellOrderWithDetails)),
    isLoading,
    error,
    refetch
  };
}

/**
 * Hook to cancel a sell order
 */
export function useCancelSellOrder() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const cancelOrder = useCallback(async (params: { orderId: number }) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      console.log('🗑️ Cancelling sell order...');
      console.log('📋 Order ID:', params.orderId);

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'cancelSellOrder',
        [params.orderId],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
        }
      );

      console.log('✅ Cancel order transaction hash:', txHash);
      console.log('⏳ Waiting for transaction confirmation...');

      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ Order cancellation confirmed');

      // Refresh data
      await web3Store.fetchAllData();

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error: unknown) {
      console.error('❌ Cancel order failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: cancelOrder, isLoading };
}

/**
 * Hook to buy NFT from a sell order
 * Trades whole NFT
 */
export function useBuyNFT() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const buyNFT = useCallback(async (params: { orderId: number }) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      console.log('🛒 Buying NFT...');
      console.log('📋 Order ID:', params.orderId);

      // Step 1: Get order details
      console.log('🔍 Step 1: Getting order details...');
      const orderData = await walletManager.readContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'getOrder',
        [params.orderId]
      ) as {
        orderId: bigint;
        nftId: bigint;
        seller: string;
        price: bigint;
        createdAt: bigint;
        status: number;
      };

      // OrderStatus enum: 0 = Active, 1 = Cancelled, 2 = Filled
      if (orderData.status !== 0) {
        throw new Error('Order is invalid (cancelled or filled)');
      }

      // Check if trying to buy own NFT
      if (orderData.seller.toLowerCase() === address.toLowerCase()) {
        throw new Error('Cannot buy your own NFT');
      }

      const totalPrice = orderData.price;
      console.log('✅ Order details:');
      console.log('- NFT ID:', orderData.nftId.toString());
      console.log('- Seller:', orderData.seller);
      console.log('- Price:', totalPrice.toString(), 'wei');
      console.log('- Price (USDT):', (Number(totalPrice) / 1e18).toFixed(2));

      // Step 2: Check USDT balance
      console.log('🔍 Step 2: Checking USDT balance...');
      const usdtBalance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as unknown[],
        'balanceOf',
        [address]
      ) as bigint;

      console.log('📊 USDT Balance:', usdtBalance.toString(), 'wei');
      console.log('📊 USDT Balance (USDT):', (Number(usdtBalance) / 1e18).toFixed(2));

      if (usdtBalance < totalPrice) {
        throw new Error(`Insufficient USDT balance: Need ${(Number(totalPrice) / 1e18).toFixed(2)} USDT, current balance ${(Number(usdtBalance) / 1e18).toFixed(2)} USDT`);
      }
      console.log('✅ USDT balance sufficient');

      // Step 3: Check NFT ownership and approval
      console.log('🔍 Step 3: Checking NFT ownership and approval status...');
      const nftOwner = await walletManager.readContract(
        CONTRACT_ADDRESSES.nodeNFT,
        NODE_NFT_ABI as unknown[],
        'ownerOf',
        [orderData.nftId]
      ) as string;

      console.log('📊 NFT Owner:', nftOwner);
      console.log('📊 Order Seller:', orderData.seller);

      if (nftOwner.toLowerCase() !== orderData.seller.toLowerCase()) {
        throw new Error('NFT ownership has changed, order is invalid');
      }

      // Check if NFTManager is approved to transfer the NFT
      const nftApproval = await walletManager.readContract(
        CONTRACT_ADDRESSES.nodeNFT,
        NODE_NFT_ABI as unknown[],
        'getApproved',
        [orderData.nftId]
      ) as string;

      const isApprovedForAll = await walletManager.readContract(
        CONTRACT_ADDRESSES.nodeNFT,
        NODE_NFT_ABI as unknown[],
        'isApprovedForAll',
        [orderData.seller, CONTRACT_ADDRESSES.nftManager]
      ) as boolean;

      console.log('📊 NFT approval status:');
      console.log('- Current approval address:', nftApproval);
      console.log('- NFTManager address:', CONTRACT_ADDRESSES.nftManager);
      console.log('- Approved for all:', isApprovedForAll);

      const nftIsApproved = nftApproval.toLowerCase() === CONTRACT_ADDRESSES.nftManager.toLowerCase() || isApprovedForAll;
      if (!nftIsApproved) {
        throw new Error('NFT not approved to NFTManager, please contact seller to approve');
      }
      console.log('✅ NFT approval status is valid');

      // Step 4: Check and handle USDT approval
      console.log('🔍 Step 4: Checking USDT approval status...');
      const currentAllowance = await walletManager.readContract(
        CONTRACT_ADDRESSES.usdt,
        ERC20_ABI as unknown[],
        'allowance',
        [address, CONTRACT_ADDRESSES.nftManager]
      ) as bigint;

      console.log('📊 Current allowance:', currentAllowance.toString(), 'wei');
      console.log('📊 Required allowance:', totalPrice.toString(), 'wei');

      if (currentAllowance < totalPrice) {
        console.log('📝 USDT allowance insufficient, starting approval process...');
        const approveTxHash = await walletManager.writeContract(
          CONTRACT_ADDRESSES.usdt,
          ERC20_ABI as unknown[],
          'approve',
          [CONTRACT_ADDRESSES.nftManager, totalPrice],
          {
            gas: GAS_CONFIG.gasLimits.erc20Approve,
            gasPrice: 'auto',
          }
        );

        console.log('✅ USDT approval transaction submitted:', approveTxHash);
        console.log('⏳ Waiting for approval transaction confirmation...');

        const approveReceipt = await walletManager.waitForTransaction(approveTxHash);
        
        // Check approval transaction status
        const receiptStatus = approveReceipt.status as string | number;
        const statusStr = String(receiptStatus);
        const isSuccess = statusStr === 'success' || statusStr === '0x1' || statusStr === '1' || receiptStatus === 1;
        
        if (!isSuccess) {
          throw new Error(`USDT approval transaction failed, status: ${statusStr}`);
        }
        
        console.log('✅ USDT approval transaction confirmed');

        // Verify approval success
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for state sync
        
        const newAllowance = await walletManager.readContract(
          CONTRACT_ADDRESSES.usdt,
          ERC20_ABI as unknown[],
          'allowance',
          [address, CONTRACT_ADDRESSES.nftManager]
        ) as bigint;

        if (newAllowance < totalPrice) {
          throw new Error('USDT approval failed, please retry');
        }
        console.log('✅ USDT approval verification successful');
      } else {
        console.log('✅ USDT allowance sufficient, skipping approval step');
      }

      // Buy NFT
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        NFT_MANAGER_ABI as unknown[],
        'buyNFT',
        [params.orderId],
        {
          gas: GAS_CONFIG.gasLimits.buyNFT || GAS_CONFIG.gasLimits.contractCall,
          gasPrice: 'auto', // Use automatic Gas Price
        }
      );

      console.log('✅ Buy NFT transaction hash:', txHash);
      console.log('⏳ Waiting for transaction confirmation...');

      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ NFT purchase confirmed');

      // Refresh data
      await web3Store.fetchAllData();

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error: unknown) {
      console.error('❌ Buy NFT failed:', error);
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check common failure reasons
      if (errorMessage.includes('Transaction reverted') || errorMessage.includes('execution reverted')) {
        let detailedError = 'Transaction reverted';
        
        if (errorMessage.includes('Order does not exist')) {
          detailedError = 'Order does not exist';
        } else if (errorMessage.includes('Order not active')) {
          detailedError = 'Order is invalid (cancelled or filled)';
        } else if (errorMessage.includes('Cannot buy own NFT')) {
          detailedError = 'Cannot buy your own NFT';
        } else if (errorMessage.includes('NFT ownership changed')) {
          detailedError = 'NFT ownership has changed, order is invalid';
        } else if (errorMessage.includes('ERC20InsufficientBalance') || errorMessage.includes('insufficient balance')) {
          detailedError = 'Insufficient USDT balance';
        } else if (errorMessage.includes('ERC20InsufficientAllowance') || errorMessage.includes('insufficient allowance')) {
          detailedError = 'USDT allowance insufficient, please approve first';
        } else if (errorMessage.includes('ERC721InsufficientApproval')) {
          detailedError = 'NFT approval insufficient, seller needs to approve NFTManager';
        }
        
        throw new Error(detailedError);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: buyNFT, isLoading };
}

// Backward compatible alias
export const useBuyShares = useBuyNFT;

// Helper functions
function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
