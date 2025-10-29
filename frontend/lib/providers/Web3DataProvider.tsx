"use client";

import React from 'react';
import { useWeb3DataManager } from '@/lib/stores/web3Store';

// 全局Web3数据提供者
// 这个组件应该放在应用的根级别，确保只有一个实例
export function Web3DataProvider({ children }: { children: React.ReactNode }) {
  // 这里会触发数据获取逻辑
  useWeb3DataManager();
  
  return <>{children}</>;
}
