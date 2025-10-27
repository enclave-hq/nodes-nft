import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useContracts } from "./useContracts";
import { NFTType, TOKEN_DECIMALS } from "@/lib/contracts/config";
import { parseTokenAmount } from "@/lib/utils";

/**
 * Hook to mint NFT
 */
export function useMintNFT() {
  const { account } = useWallet();
  const { nftManager, usdt, enclaveToken } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftType }: { nftType: NFTType }) => {
      if (!nftManager || !usdt || !account) {
        throw new Error("Contracts not initialized or wallet not connected");
      }

      // Get NFT config from contract
      const config = await nftManager.nftConfigs(nftType);
      const mintPrice = config.mintPrice;
      // Note: eclvLockAmount is just a quota, user doesn't need to provide ECLV

      // Check USDT balance only
      const usdtBalance = await usdt.balanceOf(account);

      if (usdtBalance < mintPrice) {
        throw new Error("Insufficient USDT balance");
      }

      // Check and approve USDT only
      const usdtAllowance = await usdt.allowance(account, await nftManager.getAddress());
      if (usdtAllowance < mintPrice) {
        const approveTx = await usdt.approve(await nftManager.getAddress(), mintPrice);
        await approveTx.wait();
      }

      // Mint NFT (only USDT required)
      const tx = await nftManager.mintNFT(nftType);
      const receipt = await tx.wait();

      // Extract NFT ID from event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = nftManager.interface.parseLog(log);
          return parsed?.name === "NFTMinted";
        } catch {
          return false;
        }
      });

      if (!mintEvent) {
        throw new Error("Failed to extract NFT ID from transaction");
      }

      const parsed = nftManager.interface.parseLog(mintEvent);
      const nftId = parsed?.args?.nftId;

      return { receipt, nftId: Number(nftId) };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["userNFTs"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

/**
 * Hook to get user's NFT list
 */
export function useUserNFTs() {
  const { account } = useWallet();
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["userNFTs", account],
    queryFn: async () => {
      if (!nftManager || !account) return [];
      const nftIds = await nftManager.getUserNFTs(account);
      return nftIds.map((id: bigint) => Number(id));
    },
    enabled: !!nftManager && !!account,
  });
}

/**
 * Hook to get NFT pool data
 */
export function useNFTPool(nftId: number | undefined) {
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["nftPool", nftId],
    queryFn: async () => {
      if (!nftManager || nftId === undefined) return null;
      const pool = await nftManager.nftPools(nftId);
      return {
        nftId: Number(pool.nftId),
        nftType: Number(pool.nftType),
        status: Number(pool.status),
        createdAt: Number(pool.createdAt),
        dissolvedAt: Number(pool.dissolvedAt),
        totalEclvLocked: pool.totalEclvLocked,
        remainingMintQuota: pool.remainingMintQuota,
        unlockedNotWithdrawn: pool.unlockedNotWithdrawn,
        lastUnlockTime: Number(pool.lastUnlockTime),
        unlockedPeriods: Number(pool.unlockedPeriods),
        totalShares: Number(pool.totalShares),
        shareWeight: Number(pool.shareWeight),
      };
    },
    enabled: !!nftManager && nftId !== undefined,
  });
}

/**
 * Hook to get user's share in an NFT
 */
export function useUserShare(nftId: number | undefined) {
  const { account } = useWallet();
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["userShare", nftId, account],
    queryFn: async () => {
      if (!nftManager || !account || nftId === undefined) return null;
      const share = await nftManager.userShares(nftId, account);
      return {
        shares: Number(share.shares),
        producedDebt: share.producedDebt,
        withdrawnAfterDissolve: share.withdrawnAfterDissolve,
      };
    },
    enabled: !!nftManager && !!account && nftId !== undefined,
  });
}

/**
 * Hook to get pending ECLV production
 */
export function usePendingProduced(nftId: number | undefined) {
  const { account } = useWallet();
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["pendingProduced", nftId, account],
    queryFn: async () => {
      if (!nftManager || !account || nftId === undefined) return BigInt(0);
      return await nftManager.getPendingProduced(nftId, account);
    },
    enabled: !!nftManager && !!account && nftId !== undefined,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Hook to get pending rewards
 */
export function usePendingReward(nftId: number | undefined, token: string | undefined) {
  const { account } = useWallet();
  const { nftManager } = useContracts();

  return useQuery({
    queryKey: ["pendingReward", nftId, account, token],
    queryFn: async () => {
      if (!nftManager || !account || nftId === undefined || !token) return BigInt(0);
      return await nftManager.getPendingReward(nftId, account, token);
    },
    enabled: !!nftManager && !!account && nftId !== undefined && !!token,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Hook to claim ECLV production
 */
export function useClaimProduced() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftId }: { nftId: number }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.claimProduced(nftId);
      return await tx.wait();
    },
    onSuccess: (_, { nftId }) => {
      queryClient.invalidateQueries({ queryKey: ["pendingProduced", nftId] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

/**
 * Hook to claim rewards
 */
export function useClaimReward() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftId, token }: { nftId: number; token: string }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.claimReward(nftId, token);
      return await tx.wait();
    },
    onSuccess: (_, { nftId, token }) => {
      queryClient.invalidateQueries({ queryKey: ["pendingReward", nftId, token] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

/**
 * Hook to batch claim produced
 */
export function useBatchClaimProduced() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftIds }: { nftIds: number[] }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.batchClaimProduced(nftIds);
      return await tx.wait();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingProduced"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

/**
 * Hook to transfer shares
 */
export function useTransferShares() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nftId,
      to,
      shares,
    }: {
      nftId: number;
      to: string;
      shares: number;
    }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.transferShares(nftId, to, shares);
      return await tx.wait();
    },
    onSuccess: (_, { nftId }) => {
      queryClient.invalidateQueries({ queryKey: ["userShare", nftId] });
      queryClient.invalidateQueries({ queryKey: ["nftPool", nftId] });
    },
  });
}

/**
 * Hook to propose dissolution
 */
export function useProposeDissolution() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftId }: { nftId: number }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.proposeDissolution(nftId);
      return await tx.wait();
    },
    onSuccess: (_, { nftId }) => {
      queryClient.invalidateQueries({ queryKey: ["nftPool", nftId] });
      queryClient.invalidateQueries({ queryKey: ["dissolutionProposal", nftId] });
    },
  });
}

/**
 * Hook to approve dissolution
 */
export function useApproveDissolution() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftId }: { nftId: number }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.approveDissolution(nftId);
      return await tx.wait();
    },
    onSuccess: (_, { nftId }) => {
      queryClient.invalidateQueries({ queryKey: ["nftPool", nftId] });
      queryClient.invalidateQueries({ queryKey: ["dissolutionProposal", nftId] });
    },
  });
}

/**
 * Hook to withdraw unlocked tokens (Dissolved state only)
 */
export function useWithdrawUnlocked() {
  const { nftManager } = useContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftId, amount }: { nftId: number; amount: bigint }) => {
      if (!nftManager) throw new Error("Contract not initialized");
      const tx = await nftManager.withdrawUnlocked(nftId, amount);
      return await tx.wait();
    },
    onSuccess: (_, { nftId }) => {
      queryClient.invalidateQueries({ queryKey: ["nftPool", nftId] });
      queryClient.invalidateQueries({ queryKey: ["userShare", nftId] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

