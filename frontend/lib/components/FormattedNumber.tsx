"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FormattedNumberProps {
  value: string | number;
  decimals?: number;
  className?: string;
  showFullOnClick?: boolean;
  prefix?: string;
  suffix?: string;
}

export function FormattedNumber({
  value,
  decimals = 2,
  className,
  showFullOnClick = true,
  prefix = "",
  suffix = "",
}: FormattedNumberProps) {
  const [showFull, setShowFull] = useState(false);

  // 转换值为数字
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // 如果值无效，返回0
  if (isNaN(numValue) || numValue === 0) {
    return (
      <span className={className}>
        {prefix}0{suffix}
      </span>
    );
  }

  // 格式化数字
  const formatNumber = (num: number): { value: string; unit: string } => {
    const absNum = Math.abs(num);
    
    if (absNum >= 1e12) {
      return {
        value: (num / 1e12).toFixed(decimals),
        unit: 'T'
      };
    } else if (absNum >= 1e9) {
      return {
        value: (num / 1e9).toFixed(decimals),
        unit: 'B'
      };
    } else if (absNum >= 1e6) {
      return {
        value: (num / 1e6).toFixed(decimals),
        unit: 'M'
      };
    } else if (absNum >= 1e3) {
      return {
        value: (num / 1e3).toFixed(decimals),
        unit: 'K'
      };
    } else {
      return {
        value: num.toFixed(decimals),
        unit: ''
      };
    }
  };

  // 格式化完整数字（带千分位分隔符）
  const formatFullNumber = (num: number): string => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 18,
    });
  };

  const formatted = formatNumber(numValue);
  const fullNumber = formatFullNumber(numValue);

  // 如果显示完整数字或者数字很小不需要格式化
  if (showFull || formatted.unit === '') {
    return (
      <span className={className}>
        {prefix}{fullNumber}{suffix}
      </span>
    );
  }

  // 显示格式化后的数字
  return (
    <span
      className={cn(
        "cursor-pointer hover:text-blue-600 transition-colors",
        className
      )}
      onClick={showFullOnClick ? () => setShowFull(!showFull) : undefined}
      title={showFullOnClick ? `点击查看完整数量: ${fullNumber}` : undefined}
    >
      {prefix}{formatted.value}{formatted.unit}{suffix}
    </span>
  );
}

// 专门用于代币余额的组件
interface TokenBalanceProps {
  value: string | number;
  symbol?: string;
  decimals?: number;
  className?: string;
  showSymbol?: boolean;
}

export function TokenBalance({
  value,
  symbol = "",
  decimals = 2,
  className,
  showSymbol = false,
}: TokenBalanceProps) {
  return (
    <FormattedNumber
      value={value}
      decimals={decimals}
      className={className}
      suffix={showSymbol && symbol ? ` ${symbol}` : ""}
    />
  );
}

// 专门用于NFT数量的组件
interface NFTCountProps {
  count: number;
  className?: string;
}

export function NFTCount({ count, className }: NFTCountProps) {
  return (
    <FormattedNumber
      value={count}
      decimals={0}
      className={className}
      showFullOnClick={false}
    />
  );
}
