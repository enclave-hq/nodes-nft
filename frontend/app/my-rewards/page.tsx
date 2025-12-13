"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/providers/WalletProvider";
import { CONTRACT_ADDRESSES, GAS_CONFIG, NETWORK_CONFIG } from "@/lib/contracts/config";
import toast from "react-hot-toast";
import { formatAddress } from "@/lib/utils";
import { getMyReferralRecords, type ReferralRecordsResponse } from "@/lib/api/rewards";
import { ethers } from "ethers";
import { ArrowUpToLine } from "lucide-react";

// Wallet SDK expects ABI items (objects with `name`), not "function ..." strings.
const REWARD_VAULT_ABI = [
  {
    type: "function",
    name: "getRewardState",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "allocated", type: "uint256" },
      { name: "withdrawn", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimPartial",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as unknown[];

function isZeroAddress(addr: string) {
  return addr.toLowerCase() === "0x0000000000000000000000000000000000000000";
}

function formatUSDTFromWei(wei: bigint): string {
  // BSC USDT uses 18 decimals in this project
  const v = Number(wei) / 1e18;
  return v.toFixed(2);
}

export default function MyRewardsPage() {
  const { account, isConnected, walletManager } = useWallet();

  const rewardVaultAddress = useMemo(() => CONTRACT_ADDRESSES.rewardVault, []);
  const [vaultState, setVaultState] = useState<{
    allocatedWei: string;
    withdrawnWei: string;
    availableWei: string;
  } | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  const [records, setRecords] = useState<ReferralRecordsResponse | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [claimAmount, setClaimAmount] = useState<string>("");
  const [claimTx, setClaimTx] = useState<{
    status: "idle" | "pending" | "confirmed" | "failed";
    hash?: string;
    message?: string;
  }>({ status: "idle" });

  // Poll chain for pending tx status (handles wallet "cancel"/replacement/dropped cases)
  useEffect(() => {
    if (claimTx.status !== "pending" || !claimTx.hash) return;
    const hash = claimTx.hash;
    let cancelled = false;
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const receipt = await provider.getTransactionReceipt(hash);
        if (cancelled) return;
        if (receipt) {
          const st: any = (receipt as any).status;
          const ok = st === 1 || st === "1" || st === BigInt(1) || st === true;
          if (ok) {
            setClaimTx({ status: "confirmed", hash });
            setClaimAmount("");
            toast.success("领取成功", { id: "claim" });
            await fetchVaultState();
          } else {
            setClaimTx({ status: "failed", hash, message: "交易执行失败" });
            toast.error("交易执行失败", { id: "claim" });
          }
          return;
        }

        // If long pending, mark as failed so user can retry (tx might be dropped/canceled/replaced)
        if (Date.now() - startedAt > 2 * 60 * 1000) {
          setClaimTx({ status: "failed", hash, message: "长时间未确认，可能已取消/替换" });
          toast.error("长时间未确认，可能已取消/替换", { id: "claim" });
        }
      } catch (e: any) {
        if (cancelled) return;
        setClaimTx({ status: "failed", hash, message: e?.message || "查询交易状态失败" });
      }
    };

    const interval = setInterval(tick, 3000);
    // run once immediately
    void tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimTx.status, claimTx.hash]);

  const fetchVaultState = async () => {
    if (!walletManager || !account) return;
    if (isZeroAddress(rewardVaultAddress)) {
      toast.error("RewardVault 未配置，请设置 NEXT_PUBLIC_REWARD_VAULT_ADDRESS");
      return;
    }
    setLoadingState(true);
    try {
      const [allocated, withdrawn, available] = await walletManager.readContract(
        rewardVaultAddress,
        REWARD_VAULT_ABI,
        "getRewardState",
        [account],
      );
      setVaultState({
        allocatedWei: allocated.toString(),
        withdrawnWei: withdrawn.toString(),
        availableWei: available.toString(),
      });
    } catch (e: any) {
      console.error("Failed to fetch RewardVault state:", e);
      toast.error(e?.message || "获取合约返佣状态失败");
    } finally {
      setLoadingState(false);
    }
  };

  const fetchRecords = async () => {
    if (!account) return;
    setRecordsLoading(true);
    try {
      const data = await getMyReferralRecords({ address: account, page, limit: 20, includeSelf: false });
      setRecords(data);
    } catch (e: any) {
      console.error("Failed to fetch referral records:", e);
      toast.error(e?.message || "获取返佣明细失败");
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !account) return;
    fetchVaultState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, account]);

  useEffect(() => {
    if (!isConnected || !account) return;
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, account, page]);

  const onClaim = async () => {
    if (!walletManager || !account) return;
    if (isZeroAddress(rewardVaultAddress)) {
      toast.error("RewardVault 未配置，请设置 NEXT_PUBLIC_REWARD_VAULT_ADDRESS");
      return;
    }
    try {
      setClaimTx({ status: "idle" });
      const availableWei = vaultState ? BigInt(vaultState.availableWei) : BigInt(0);
      if (availableWei <= BigInt(0)) {
        toast.error("暂无可领取金额");
        return;
      }

      const amountStr = (claimAmount || "").trim();
      if (!amountStr) {
        toast.error("请输入领取金额");
        return;
      }

      let amountWei: bigint;
      try {
        amountWei = ethers.parseUnits(amountStr, 18);
      } catch (e) {
        toast.error("领取金额格式不正确");
        return;
      }

      if (amountWei <= BigInt(0)) {
        toast.error("领取金额必须大于 0");
        return;
      }
      if (amountWei > availableWei) {
        toast.error("领取金额不能超过可领取金额");
        return;
      }

      // Disable UI immediately when wallet confirmation starts (before tx hash exists)
      setClaimTx({ status: "pending", message: "等待钱包确认..." });
      toast.loading("提交领取交易...", { id: "claim" });
      const txHash = await walletManager.writeContract(
        rewardVaultAddress,
        REWARD_VAULT_ABI,
        "claimPartial",
        [amountWei.toString()],
        {
          gas: GAS_CONFIG.gasLimits.contractCall,
          gasPrice: "auto",
        },
      );
      setClaimTx({ status: "pending", hash: txHash, message: "等待链上确认..." });
      // Do not rely solely on wallet waitForTransaction; we poll RPC to handle cancel/replacement/dropped cases.
      // fetchVaultState will be triggered by the polling effect on success.
    } catch (e: any) {
      console.error("Claim failed:", e);
      setClaimTx({ status: "failed", message: e?.message || "领取失败" });
      toast.error(e?.message || "领取失败", { id: "claim" });
    }
  };

  if (!isConnected || !account) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-24">
        <h1 className="text-2xl font-bold text-black mb-2">我的返佣</h1>
        <p className="text-gray-600">请先连接钱包后查看返佣信息。</p>
      </div>
    );
  }

  const allocated = vaultState ? BigInt(vaultState.allocatedWei) : BigInt(0);
  const withdrawn = vaultState ? BigInt(vaultState.withdrawnWei) : BigInt(0);
  const available = vaultState ? BigInt(vaultState.availableWei) : BigInt(0);
  const claimTxUrl = claimTx.hash ? `${NETWORK_CONFIG.blockExplorer}/tx/${claimTx.hash}` : null;
  const isClaimBlocked = available === BigInt(0) || claimTx.status === "pending";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">我的返佣</h1>
        <div className="text-sm text-gray-600 mt-1">
          钱包：<span className="font-mono">{formatAddress(account)}</span>
        </div>
      </div>

      {/* Vault summary */}
      {/* Mobile: 2 columns on first row; claim card spans full width */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-500">累计返佣（USDT）</div>
          <div className="text-3xl font-bold text-black mt-2">
            {loadingState ? "..." : formatUSDTFromWei(allocated)}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-500">已提取（USDT）</div>
          <div className="text-3xl font-bold text-black mt-2">
            {loadingState ? "..." : formatUSDTFromWei(withdrawn)}
          </div>
        </div>
        <div className="col-span-2 lg:col-span-1 rounded-xl bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-500">可提取（USDT）</div>
          <div className="flex items-end justify-between mt-2 gap-4">
            <div className="text-3xl font-bold text-[#7C3AED]">
              {loadingState ? "..." : formatUSDTFromWei(available)}
            </div>
          </div>
          <div className="mt-3">
            {/* Row 1: amount + claim button (avoid overflow on small screens) */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  placeholder="输入领取金额（USDT）"
                  className="w-full rounded-lg border border-gray-200 pl-3 pr-12 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10"
                  inputMode="decimal"
                />
                <button
                  type="button"
                  aria-label="全部"
                  title="全部"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-black disabled:opacity-50"
                  onClick={() => setClaimAmount(formatUSDTFromWei(available))}
                  disabled={isClaimBlocked}
                >
                  <ArrowUpToLine className="h-4 w-4" />
                </button>
              </div>
              <button
                className="min-w-[112px] whitespace-nowrap rounded-lg bg-black text-white px-5 py-2 text-sm font-medium disabled:opacity-50"
                disabled={isClaimBlocked}
                onClick={onClaim}
              >
                {claimTx.status === "pending" ? "处理中..." : "领取"}
              </button>
            </div>
          </div>
          {claimTx.status !== "idle" && (
            <div className="mt-3 text-xs">
              <div className="text-gray-700">
                链上状态：
                <span className="ml-1 font-medium">
                  {claimTx.status === "pending" && "等待确认"}
                  {claimTx.status === "confirmed" && "成功"}
                  {claimTx.status === "failed" && "失败"}
                </span>
                {claimTx.message ? <span className="ml-2 text-gray-500">{claimTx.message}</span> : null}
              </div>
              {claimTxUrl && (
                <a
                  className="mt-1 inline-block font-mono text-gray-500 underline break-all whitespace-normal max-w-full"
                  href={claimTxUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {claimTx.hash}
                </a>
              )}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-2">
            数据来自合约 RewardVault（用户自主提取）。
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="font-semibold text-black">返佣明细（直接邀请）</div>
          <div className="text-sm text-gray-500">
            {recordsLoading ? "加载中..." : `共 ${records?.pagination.total ?? 0} 条`}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-5 py-3">NFT</th>
                <th className="text-left px-5 py-3">铸造者</th>
                <th className="text-right px-5 py-3">返佣（USDT）</th>
                <th className="text-left px-5 py-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(records?.records || []).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-gray-800">#{r.nftId}</td>
                  <td className="px-5 py-3 font-mono text-gray-800">{formatAddress(r.minterAddress)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-black">{Number(BigInt(r.referralRewardWei)) / 1e18}</td>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!recordsLoading && (records?.records?.length ?? 0) === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500" colSpan={4}>
                    暂无返佣明细
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records?.pagination.totalPages && records.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200">
            <button
              className="px-3 py-2 rounded-md border border-gray-200 text-sm disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <div className="text-sm text-gray-600">
              第 {page} / {records.pagination.totalPages} 页
            </div>
            <button
              className="px-3 py-2 rounded-md border border-gray-200 text-sm disabled:opacity-50"
              disabled={page >= records.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


