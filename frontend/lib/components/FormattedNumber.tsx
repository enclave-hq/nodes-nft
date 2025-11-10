"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check, X } from "lucide-react";

interface FormattedNumberProps {
  value: string | number;
  decimals?: number;
  className?: string;
  showFullOnClick?: boolean;
  prefix?: string;
  suffix?: string;
}

// Value Dialog Component
function ValueDialog({
  isOpen,
  onClose,
  value,
  label,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {label || '完整数值'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">完整数值:</p>
            <div
              ref={valueRef}
              className="text-lg font-mono font-semibold text-gray-900 break-all"
            >
              {value}
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#E5F240] px-4 py-2.5 text-sm font-medium text-black hover:bg-[#D4E238] transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FormattedNumber({
  value,
  decimals = 6,
  className,
  showFullOnClick = true,
  prefix = "",
  suffix = "",
}: FormattedNumberProps) {
  const [showDialog, setShowDialog] = useState(false);

  // 保存原始值（字符串形式以保持精度）
  const originalValue = typeof value === 'string' ? value : String(value);
  
  // 转换值为数字用于格式化显示
  // 对于非常大的数字，parseFloat可能会丢失精度，所以我们先用字符串判断
  let numValue: number;
  if (typeof value === 'string') {
    // 如果是空字符串或无效值
    if (!value || value.trim() === '' || value === '0') {
      numValue = 0;
    } else {
      numValue = parseFloat(value);
      // 如果parseFloat失败，尝试处理大数字
      if (isNaN(numValue)) {
        // 尝试移除所有非数字字符（除了小数点）
        const cleaned = value.replace(/[^\d.-]/g, '');
        numValue = parseFloat(cleaned) || 0;
      }
    }
  } else if (typeof value === 'bigint') {
    numValue = Number(value);
  } else {
    numValue = value;
  }
  
  // 如果值无效，返回0
  if (isNaN(numValue) || numValue === 0) {
    // 但如果是字符串"0"或有效的0值，也要检查原始值是否可能是有效的
    const strValue = originalValue.trim();
    if (strValue && strValue !== '0' && strValue !== '0.0' && strValue !== '0.00') {
      // 可能是parseFloat精度丢失，尝试直接处理字符串
      // 这种情况下，我们仍然尝试格式化显示
      numValue = parseFloat(strValue) || 0;
    } else {
      return (
        <span className={className}>
          {prefix}0{suffix}
        </span>
      );
    }
  }

  // 格式化数字（K/M + 最多6位小数）
  // 限制小数位数最多为6位
  const maxDecimals = Math.min(decimals, 6);
  
  const formatNumber = (num: number): { value: string; unit: string } => {
    const absNum = Math.abs(num);
    
    if (absNum >= 1e12) {
      return {
        value: (num / 1e12).toFixed(maxDecimals).replace(/\.?0+$/, ''),
        unit: 'T'
      };
    } else if (absNum >= 1e9) {
      return {
        value: (num / 1e9).toFixed(maxDecimals).replace(/\.?0+$/, ''),
        unit: 'B'
      };
    } else if (absNum >= 1e6) {
      return {
        value: (num / 1e6).toFixed(maxDecimals).replace(/\.?0+$/, ''),
        unit: 'M'
      };
    } else if (absNum >= 1e3) {
      return {
        value: (num / 1e3).toFixed(maxDecimals).replace(/\.?0+$/, ''),
        unit: 'K'
      };
    } else {
      // 小于1000的数字，最多显示6位小数
      const formatted = num.toFixed(maxDecimals);
      // 移除末尾的0和小数点（如果小数部分全为0）
      return {
        value: formatted.replace(/\.?0+$/, ''),
        unit: ''
      };
    }
  };

  const formatted = formatNumber(numValue);

  // 显示格式化后的数字
  return (
    <>
      <span
        className={cn(
          showFullOnClick && "cursor-pointer hover:text-blue-600 transition-colors",
          className
        )}
        onClick={showFullOnClick ? () => setShowDialog(true) : undefined}
        title={showFullOnClick ? `点击查看完整数值: ${originalValue}` : undefined}
      >
        {prefix}{formatted.value}{formatted.unit}{suffix}
      </span>

      {showFullOnClick && (
        <ValueDialog
          isOpen={showDialog}
          onClose={() => setShowDialog(false)}
          value={originalValue}
        />
      )}
    </>
  );
}

// 专门用于代币余额的组件
interface TokenBalanceProps {
  value: string | number;
  symbol?: string;
  decimals?: number;
  className?: string;
  showSymbol?: boolean;
  suffix?: string;
}

export function TokenBalance({
  value,
  symbol = "",
  decimals = 6,
  className,
  showSymbol = false,
  suffix = "",
}: TokenBalanceProps) {
  return (
    <FormattedNumber
      value={value}
      decimals={decimals}
      className={className}
      suffix={suffix || (showSymbol && symbol ? ` ${symbol}` : "")}
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
