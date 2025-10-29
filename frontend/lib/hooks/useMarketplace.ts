import { useCallback, useState } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { useWeb3Store } from '@/lib/stores/web3Store';
import { CONTRACT_ADDRESSES, GAS_CONFIG } from '@/lib/contracts/config';
import NFT_MANAGER_ABI_DATA from '@/lib/contracts/nft-manager-abi.json';
import NODE_NFT_ABI_DATA from '@/lib/contracts/node-nft-abi.json';
import USDT_ABI_DATA from '@/lib/contracts/usdt-abi.json';

const ABI = NFT_MANAGER_ABI_DATA.abi;
const NODE_NFT_ABI = NODE_NFT_ABI_DATA.abi;
const USDT_ABI = USDT_ABI_DATA.abi;

export interface SellOrder {
  orderId: number;
  nftId: number;
  seller: string;
  shares: number;
  pricePerShare: bigint;
  createdAt: number;
  active: boolean;
}

export interface SellOrderWithDetails extends SellOrder {
  totalPrice: bigint;
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

      // Get order IDs for this NFT
      const nftIdParam = Number(nftId);
      console.log(`📋 Call parameters:`, { nftIdParam, originalId: nftId });
      
      let orderIds: bigint[];
      try {
        orderIds = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          ABI as unknown[],
          'getNFTSellOrders',
          [nftIdParam]
        ) as bigint[];
      } catch (contractError) {
        console.error(`❌ Contract call failed (NFT ${nftIdParam}):`, contractError);
        throw new Error(`Failed to query NFT ${nftIdParam} orders: ${contractError}`);
      }

      console.log('📋 Found order IDs:', orderIds ? orderIds.map(id => id.toString()) : 'No orders');

      if (!orderIds || orderIds.length === 0) {
        setOrders([]);
        return;
      }

      // Fetch details for each order
      const orderPromises = orderIds.map(async (orderId) => {
        const orderData = await walletManager.readContract(
          CONTRACT_ADDRESSES.nftManager,
          ABI as unknown[],
          'sellOrders',
          [orderId]
        ) as [bigint, string, bigint, bigint, bigint, boolean];

        const [nftIdFromContract, seller, shares, pricePerShare, createdAt, active] = orderData;

        return {
          orderId: Number(orderId),
          nftId: Number(nftIdFromContract),
          seller,
          shares: Number(shares),
          pricePerShare,
          createdAt: Number(createdAt),
          active,
          totalPrice: shares * pricePerShare,
          sellerDisplay: formatAddress(seller),
          createdAtDisplay: formatDate(Number(createdAt))
        } as SellOrderWithDetails;
      });

      const orderDetails = await Promise.all(orderPromises);
      
      // Filter only active orders
      const activeOrders = orderDetails.filter(order => order.active);
      
      console.log('✅ 获取到活跃订单:', activeOrders.length);
      setOrders(activeOrders);

    } catch (err) {
      console.error('❌ 查询订单失败:', err);
      setError(err instanceof Error ? err.message : '查询订单失败');
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
 */
export function useAllSellOrders() {
  const { walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [orders, setOrders] = useState<SellOrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchAllOrders = useCallback(async () => {
    if (!walletManager) {
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
      console.log('🔍 查询所有出售订单...');
      
      // Validate contract address
      if (!CONTRACT_ADDRESSES.nftManager) {
        console.error('❌ NFT Manager contract address not configured');
        console.error('❌ 请检查环境变量 NEXT_PUBLIC_NFT_MANAGER_ADDRESS');
        setError('NFT Manager contract address not configured, please check environment variables');
        setOrders([]);
        return;
      }
      console.log('📋 NFT Manager地址:', CONTRACT_ADDRESSES.nftManager);

      // Get NFTs from web3Store - wait for data to be loaded
      if (!web3Store.nfts || web3Store.nfts.length === 0) {
        console.log('📋 Web3Store中暂无NFT数据，等待数据加载...');
        // Wait a bit for web3Store to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check again after waiting
        if (!web3Store.nfts || web3Store.nfts.length === 0) {
          console.log('📋 等待后仍无NFT数据，返回空订单列表');
          setOrders([]);
          return;
        }
      }

      const nfts = web3Store.nfts || [];
      console.log('📋 从web3Store获取到NFT数量:', nfts.length);
      console.log('📋 NFT数据详情:', nfts.map(nft => ({ id: nft.id, type: typeof nft.id })));

      if (nfts.length === 0) {
        console.log('📋 没有找到NFT，返回空订单列表');
        setOrders([]);
        return;
      }

      const allOrderPromises = nfts.map(async (nft: any) => {
        try {
          // Validate NFT data
          if (!nft) {
            console.warn(`⚠️ NFT对象为空`);
            return [];
          }
          
          if (typeof nft.id !== 'number' || nft.id <= 0) {
            console.warn(`⚠️ 无效的NFT ID:`, { 
              id: nft.id, 
              type: typeof nft.id, 
              nft: nft 
            });
            return [];
          }
          
          console.log(`🔍 查询NFT ${nft.id} 的订单...`);
          
          // Use the NFT ID from web3Store
          const nftIdParam = Number(nft.id);
          console.log(`📋 调用参数:`, { nftIdParam, originalId: nft.id });
          
          let orderIds: bigint[];
          try {
            console.log(`📋 准备调用合约:`, {
              contractAddress: CONTRACT_ADDRESSES.nftManager,
              functionName: 'getNFTSellOrders',
              params: [nftIdParam],
              abiLength: ABI.length
            });
            
            orderIds = await walletManager.readContract(
              CONTRACT_ADDRESSES.nftManager,
              ABI as unknown[],
              'getNFTSellOrders',
              [nftIdParam]
            ) as bigint[];
          } catch (contractError) {
            console.error(`❌ Contract call failed (NFT ${nftIdParam}):`, contractError);
            console.error(`❌ 错误详情:`, {
              contractAddress: CONTRACT_ADDRESSES.nftManager,
              functionName: 'getNFTSellOrders',
              params: [nftIdParam],
              error: contractError
            });
            throw new Error(`Failed to query NFT ${nftIdParam} orders: ${contractError}`);
          }

          console.log(`📋 NFT ${nft.id} 订单ID:`, orderIds ? orderIds.map(id => id.toString()) : '无订单');

          if (!orderIds || orderIds.length === 0) {
            console.log(`📋 NFT ${nft.id} 没有订单`);
            return [];
          }

          const orderDetails = await Promise.all(
            orderIds.map(async (orderId) => {
              try {
                const orderData = await walletManager.readContract(
                  CONTRACT_ADDRESSES.nftManager,
                  ABI as unknown[],
                  'sellOrders',
                  [orderId]
                ) as [bigint, string, bigint, bigint, bigint, boolean];

                const [nftIdFromContract, seller, shares, pricePerShare, createdAt, active] = orderData;

                return {
                  orderId: Number(orderId),
                  nftId: Number(nftIdFromContract),
                  seller,
                  shares: Number(shares),
                  pricePerShare,
                  createdAt: Number(createdAt),
                  active,
                  totalPrice: shares * pricePerShare,
                  sellerDisplay: formatAddress(seller),
                  createdAtDisplay: formatDate(Number(createdAt))
                } as SellOrderWithDetails;
              } catch (orderErr) {
                console.warn(`查询订单 ${orderId} 详情失败:`, orderErr);
                return null;
              }
            })
          );

          const validOrders = orderDetails.filter(order => order !== null && order.active);
          console.log(`✅ NFT ${nft.id} 找到 ${validOrders.length} 个活跃订单`);
          return validOrders;
        } catch (err) {
          console.warn(`查询NFT ${nft.id} 订单失败:`, err);
          return [];
        }
      });

      const allOrders = await Promise.all(allOrderPromises);
      const flatOrders = allOrders.flat();
      
      console.log('✅ 获取到所有活跃订单:', flatOrders.length);
      setOrders(flatOrders);

    } catch (err) {
      console.error('❌ 查询所有订单失败:', err);
      setError(err instanceof Error ? err.message : '查询订单失败');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [walletManager, web3Store.nfts]);

  return {
    data: orders,
    isLoading,
    error,
    refetch: fetchAllOrders
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
      console.log('🗑️ 取消出售订单...');
      console.log('📋 订单ID:', params.orderId);

      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        ABI as unknown[],
        'cancelSellOrder',
        [params.orderId],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
        }
      );

      console.log('✅ 取消订单交易哈希:', txHash);
      console.log('⏳ 等待交易确认...');

      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ 订单取消确认完成');

      // 刷新数据
      await web3Store.fetchAllData();

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error: unknown) {
      console.error('❌ 取消订单失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: cancelOrder, isLoading };
}

/**
 * Hook to buy shares from a sell order
 */
export function useBuyShares() {
  const { address, walletManager } = useWallet();
  const web3Store = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const buyShares = useCallback(async (params: { orderId: number }) => {
    if (!address || !walletManager) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      console.log('🛒 购买份额...');
      console.log('📋 订单ID:', params.orderId);

      // First get order details to calculate total price
      const orderData = await walletManager.readContract(
        CONTRACT_ADDRESSES.nftManager,
        ABI as unknown[],
        'sellOrders',
        [params.orderId]
      ) as [bigint, string, bigint, bigint, bigint, boolean];

      const [, , shares, pricePerShare, , active] = orderData;
      
      if (!active) {
        throw new Error('订单已失效');
      }

      const totalPrice = shares * pricePerShare;
      console.log('💰 总价格:', totalPrice.toString(), 'wei');

      // Approve USDT first
      console.log('🔐 授权USDT...');
      const approveTxHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.usdt,
        USDT_ABI as unknown[],
        'approve',
        [CONTRACT_ADDRESSES.nftManager, totalPrice],
        {
          gas: GAS_CONFIG.gasLimits.erc20Approve,
          gasPrice: 'auto', // 使用自动 Gas Price
        }
      );

      await walletManager.waitForTransaction(approveTxHash);
      console.log('✅ USDT授权完成');

      // Buy shares
      const txHash = await walletManager.writeContract(
        CONTRACT_ADDRESSES.nftManager,
        ABI as unknown[],
        'buyShares',
        [params.orderId],
        {
          gas: GAS_CONFIG.gasLimits.buyShares,
          gasPrice: 'auto', // 使用自动 Gas Price
        }
      );

      console.log('✅ 购买份额交易哈希:', txHash);
      console.log('⏳ 等待交易确认...');

      const receipt = await walletManager.waitForTransaction(txHash);
      console.log('✅ 份额购买确认完成');

      // 刷新数据
      await web3Store.fetchAllData();

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error: unknown) {
      console.error('❌ 购买份额失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletManager, web3Store]);

  return { mutateAsync: buyShares, isLoading };
}

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
