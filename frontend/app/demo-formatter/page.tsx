"use client";

import { FormattedNumber, TokenBalance, NFTCount } from "@/lib/components/FormattedNumber";

export default function NumberFormatterDemo() {
  const testValues = [
    { label: "小数字", value: "123.45" },
    { label: "千位数字", value: "1234.56" },
    { label: "万位数字", value: "12345.67" },
    { label: "十万位数字", value: "123456.78" },
    { label: "百万位数字", value: "1234567.89" },
    { label: "千万位数字", value: "12345678.90" },
    { label: "亿位数字", value: "123456789.01" },
    { label: "十亿位数字", value: "1234567890.12" },
    { label: "百亿位数字", value: "12345678901.23" },
    { label: "万亿位数字", value: "123456789012.34" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">数字格式化演示</h1>
        
        {/* 基础格式化演示 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">基础格式化演示</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testValues.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">{item.label}:</span>
                <div className="text-right">
                  <div className="text-sm text-gray-500">原始: {item.value}</div>
                  <div className="font-semibold">
                    <FormattedNumber 
                      value={item.value} 
                      className="text-lg font-semibold text-gray-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 代币余额演示 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">代币余额演示</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 mb-2">$E 余额</h3>
              <TokenBalance 
                value="1000000000"
                symbol="$E"
                decimals={2}
                className="text-2xl font-bold text-blue-600"
              />
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 mb-2">USDT 余额</h3>
              <TokenBalance 
                value="10100000"
                symbol="USDT"
                decimals={2}
                className="text-2xl font-bold text-green-600"
              />
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 mb-2">NFT 数量</h3>
              <NFTCount 
                count={1234}
                className="text-2xl font-bold text-purple-600"
              />
            </div>
          </div>
        </div>

        {/* 点击展开演示 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">点击展开完整数字演示</h2>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">点击下面的数字查看完整值:</p>
              <div className="text-2xl font-bold text-yellow-600">
                <FormattedNumber 
                  value="1234567890.123456789"
                  decimals={2}
                  className="text-2xl font-bold text-yellow-600"
                />
              </div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">另一个大数字:</p>
              <div className="text-2xl font-bold text-red-600">
                <FormattedNumber 
                  value="9876543210.987654321"
                  decimals={3}
                  className="text-2xl font-bold text-red-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">使用说明</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">FormattedNumber 组件</h3>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>自动格式化大数字 (K, M, B, T)</li>
                <li>支持点击展开完整数字</li>
                <li>可自定义小数位数</li>
                <li>支持前缀和后缀</li>
              </ul>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">TokenBalance 组件</h3>
              <ul className="list-disc list-inside space-y-1 text-green-800">
                <li>专门用于代币余额显示</li>
                <li>自动添加代币符号</li>
                <li>支持点击查看完整余额</li>
                <li>适合钱包界面使用</li>
              </ul>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">NFTCount 组件</h3>
              <ul className="list-disc list-inside space-y-1 text-purple-800">
                <li>专门用于NFT数量显示</li>
                <li>整数显示，无小数</li>
                <li>不支持点击展开</li>
                <li>适合计数器使用</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
