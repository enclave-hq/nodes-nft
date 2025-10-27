import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/providers/WalletProvider";
import { useContracts } from "./useContracts";

/**
 * Hook to get user's token balances
 */
export function useBalances() {
  const { account } = useWallet();
  const { enclaveToken, usdt } = useContracts();

  return useQuery({
    queryKey: ["balances", account],
    queryFn: async () => {
      if (!enclaveToken || !usdt || !account) {
        return {
          eclv: BigInt(0),
          usdt: BigInt(0),
        };
      }

      const [eclvBalance, usdtBalance] = await Promise.all([
        enclaveToken.balanceOf(account),
        usdt.balanceOf(account),
      ]);

      return {
        eclv: eclvBalance,
        usdt: usdtBalance,
      };
    },
    enabled: !!enclaveToken && !!usdt && !!account,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Hook to get user's BNB balance
 */
export function useBNBBalance() {
  const { account, provider } = useWallet();

  return useQuery({
    queryKey: ["bnbBalance", account],
    queryFn: async () => {
      if (!provider || !account) return BigInt(0);
      return await provider.getBalance(account);
    },
    enabled: !!provider && !!account,
    refetchInterval: 10000,
  });
}

