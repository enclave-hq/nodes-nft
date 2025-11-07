import { useState, useEffect } from 'react';

/**
 * Utility functions for formatting
 */
export function formatAddress(address: string, length = 6): string {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  if (!amount) return BigInt(0);
  
  // Convert string to number, then to BigInt with proper decimal handling
  const num = parseFloat(amount);
  const multiplier = BigInt(10 ** decimals);
  return BigInt(Math.floor(num * (10 ** decimals)));
}

export function formatTokenAmount(amount: string | bigint, decimals: number = 18, displayDecimals?: number): string {
  if (!amount) return '0';
  
  // If amount is already a formatted string (contains decimal point), return as is
  if (typeof amount === 'string' && amount.includes('.')) {
    return amount;
  }
  
  const num = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = num / divisor;
  const remainder = num % divisor;
  
  if (remainder === BigInt(0)) {
    return whole.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmed = remainderStr.replace(/0+$/, '');
  
  if (trimmed === '') {
    return whole.toString();
  }
  
  let result = `${whole}.${trimmed}`;
  
  // Apply display decimals limit if specified
  if (displayDecimals !== undefined) {
    const parts = result.split('.');
    if (parts[1] && parts[1].length > displayDecimals) {
      parts[1] = parts[1].substring(0, displayDecimals);
      result = parts.join('.');
    }
  }
  
  return result;
}

export function formatUSD(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date | number | bigint | undefined | null): string {
  // 检查输入是否为 undefined 或 null
  if (date === undefined || date === null) {
    return 'Invalid Date';
  }

  let dateObj: Date;
  
  if (typeof date === 'string') {
    // 检查是否是时间戳字符串（纯数字）
    if (/^\d+$/.test(date)) {
      // 时间戳字符串，转换为毫秒
      dateObj = new Date(Number(date) * 1000);
    } else {
      // ISO 日期字符串
      dateObj = new Date(date);
    }
  } else if (typeof date === 'bigint') {
    // BigInt 类型，转换为毫秒
    dateObj = new Date(Number(date) * 1000);
  } else if (typeof date === 'number') {
    // 数字类型，假设是秒级时间戳
    dateObj = new Date(date * 1000);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return 'Invalid Date';
  }
  
  // 检查日期是否有效
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Simplify error messages for user-facing display
 * Removes technical details and shows friendly messages for common errors
 */
export function simplifyErrorMessage(error: unknown, defaultMessage: string = "Operation failed"): string {
  if (!(error instanceof Error)) {
    return defaultMessage;
  }

  const errMsg = error.message.toLowerCase();
  const errorCode = (error as any)?.code;
  
  // User rejection errors
  if (
    errMsg.includes('user rejected') ||
    errMsg.includes('denied transaction') ||
    errMsg.includes('user denied') ||
    errMsg.includes('rejected the request') ||
    errorCode === 4001
  ) {
    return "User rejected the request.";
  }

  // Return original message if not a user rejection
  return error.message || defaultMessage;
}
