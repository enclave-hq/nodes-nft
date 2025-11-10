'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/providers/WalletProvider';
import { WhitelistModal } from '@/components/WhitelistModal';

export default function SimpleMintPage() {
  const { isConnected } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 如果未连接钱包，显示提示
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">白名单管理</h1>
            <p className="text-gray-600 mb-6">请先连接钱包以继续</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">白名单管理</h1>
            <p className="text-gray-600 mb-6">管理您的白名单状态和邀请码</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] transition-colors font-semibold"
            >
              打开白名单管理
            </button>
          </div>
        </div>
      </div>

      <WhitelistModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
