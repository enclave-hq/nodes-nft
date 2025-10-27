import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useContracts } from "./useContracts";

/**
 * Hook to get NFT sell orders
 */
export function useNFTSellOrders(nftId: number | undefined) {
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["nftSellOrders", nftId],
    queryFn: async () => {
      if (!nftManager || nftId === undefined) return [];
      const orderIds = await nftManager.getNFTSellOrders(nftId);
      
      // Fetch all order details
      const orders = await Promise.all(
        orderIds.map(async (orderId: bigint) => {
          const order = await nftManager.sellOrders(orderId);
          return {
            orderId: Number(orderId),
            nftId: Number(order.nftId),
            seller: order.seller,
            shares: Number(order.shares),
            pricePerShare: order.pricePerShare,
            createdAt: Number(order.createdAt),
            active: order.active,
          };
        })
      );

      // Filter only active orders
      return orders.filter(order => order.active);
    },
    enabled: !!nftManager && nftId !== undefined,
  });
}

/**
 * Hook to get all active sell orders (across all NFTs)
 */
export function useAllSellOrders() {
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["allSellOrders"],
    queryFn: async () => {
      if (!nftManager) return [];
      
      // This is a simplified version. In production, you'd want an indexer
      // For now, we'll just return empty array as we don't have a way to
      // enumerate all orders without an indexer
      
      // TODO: Implement proper order enumeration or use an indexer
      return [];
    },
    enabled: !!nftManager,
  });
}

/**
 * Hook to get user's sell orders
 */
export function useUserSellOrders() {
  const { account } = useWallet();
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["userSellOrders", account],
    queryFn: async () => {
      if (!nftManager || !account) return [];
      
      // This would require an indexer in production
      // For now, return empty array
      
      // TODO: Implement with indexer or event logs
      return [];
    },
    enabled: !!nftManager && !!account,
  });
}

/**
 * Hook to create sell order
 */
export function useCreateSellOrder() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nftId,
      shares,
      pricePerShare,
    }: {
      nftId: number;
      shares: number;
      pricePerShare: bigint;
    }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.createSellOrder(nftId, shares, pricePerShare);
      const receipt = await tx.wait();

      // Extract order ID from event
      const createEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = nftManager.interface.parseLog(log);
          return parsed?.name === "SellOrderCreated";
        } catch {
          return false;
        }
      });

      if (!createEvent) {
        throw new Error("Failed to extract order ID from transaction");
      }

      const parsed = nftManager.interface.parseLog(createEvent);
      const orderId = parsed?.args?.orderId;

      return { receipt, orderId: Number(orderId) };
    },
    onSuccess: (_, { nftId }) => {
      queryClient.invalidateQueries({ queryKey: ["nftSellOrders", nftId] });
      queryClient.invalidateQueries({ queryKey: ["allSellOrders"] });
      queryClient.invalidateQueries({ queryKey: ["userSellOrders"] });
    },
  });
}

/**
 * Hook to cancel sell order
 */
export function useCancelSellOrder() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: number }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.cancelSellOrder(orderId);
      return await tx.wait();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nftSellOrders"] });
      queryClient.invalidateQueries({ queryKey: ["allSellOrders"] });
      queryClient.invalidateQueries({ queryKey: ["userSellOrders"] });
    },
  });
}

/**
 * Hook to buy shares from order
 */
export function useBuyShares() {
  const { nftManager, usdt } = useContracts();
  const { account } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: number }) => {
      if (!nftManager || !usdt || !account) {
        throw new Error("Contracts not initialized or wallet not connected");
      }

      // Get order details
      const order = await nftManager.sellOrders(orderId);
      const totalPrice = order.pricePerShare * BigInt(order.shares);

      // Check USDT balance
      const usdtBalance = await usdt.balanceOf(account);
      if (usdtBalance < totalPrice) {
        throw new Error("Insufficient USDT balance");
      }

      // Check and approve USDT
      const usdtAllowance = await usdt.allowance(account, await nftManager.getAddress());
      if (usdtAllowance < totalPrice) {
        const approveTx = await usdt.approve(await nftManager.getAddress(), totalPrice);
        await approveTx.wait();
      }

      // Buy shares
      const tx = await nftManager.buyShares(orderId);
      return await tx.wait();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nftSellOrders"] });
      queryClient.invalidateQueries({ queryKey: ["allSellOrders"] });
      queryClient.invalidateQueries({ queryKey: ["userNFTs"] });
      queryClient.invalidateQueries({ queryKey: ["userShare"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}


