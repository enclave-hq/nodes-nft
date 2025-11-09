"use client";

import { RefreshCw } from "lucide-react";
import { useWeb3Data } from "@/lib/stores/web3Store";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/provider";

interface RefreshButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button";
  showText?: boolean;
}

/**
 * Refresh button component that refreshes all Web3 data from chain
 */
export function RefreshButton({ 
  className, 
  size = "md",
  variant = "icon",
  showText = false 
}: RefreshButtonProps) {
  const t = useTranslations('common');
  const web3Data = useWeb3Data();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await web3Data.refreshData();
      toast.success(t('dataRefreshed', { defaultValue: 'Data refreshed' }));
    } catch (error) {
      console.error("Failed to refresh data:", error);
      toast.error(t('refreshFailed', { defaultValue: 'Refresh failed, please try again later' }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const buttonSizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  if (variant === "button") {
    return (
      <button
        onClick={handleRefresh}
        disabled={isRefreshing || !web3Data.isConnected}
        className={cn(
          "inline-flex items-center justify-center space-x-2 rounded-[20px] border border-gray-300 bg-[#CEF248] px-3 py-1.5 text-sm font-medium text-black shadow-sm hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-all",
          buttonSizeClasses[size],
          className
        )}
        title={t('refreshChainData', { defaultValue: 'Refresh on-chain data' })}
      >
        <RefreshCw 
          className={cn(
            sizeClasses[size],
            isRefreshing && "animate-spin"
          )} 
        />
        {(showText || variant === "button") && (
          <span>{isRefreshing ? t('refreshing', { defaultValue: 'Refreshing...' }) : t('refresh', { defaultValue: 'Refresh' })}</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing || !web3Data.isConnected}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2 bg-[#CEF248] text-black hover:bg-[#B8D93F] disabled:opacity-50 disabled:cursor-not-allowed transition-all",
        className
      )}
      title={t('refreshChainData', { defaultValue: 'Refresh on-chain data' })}
    >
      <RefreshCw 
        className={cn(
          sizeClasses[size],
          isRefreshing && "animate-spin"
        )} 
      />
    </button>
  );
}

