"use client";

import { RotateCw } from "lucide-react";
import { useWeb3Data } from "@/lib/stores/web3Store";

export function RefreshButton({ size = "default" }: { size?: "default" | "sm" }) {
  const { refreshData, loading } = useWeb3Data();

  const sizeClasses = size === 'sm' 
    ? "h-10 w-10" 
    : "p-2";

  return (
    <button
      onClick={refreshData}
      disabled={loading.nfts || loading.whitelist || loading.usdtBalance}
      className={`inline-flex items-center justify-center rounded-full bg-[#CEF248] text-black hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-all ${sizeClasses}`}
      title="Refresh Data"
    >
      <RotateCw className={`h-4 w-4 ${loading.nfts || loading.whitelist || loading.usdtBalance ? "animate-spin" : ""}`} />
    </button>
  );
}

