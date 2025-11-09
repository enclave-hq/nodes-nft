# 设计规范规则

## 颜色规范
- **绿色**: `#CEF248`
- **白色**: `#FFFFFF`
- **黑色**: `#000000`

## 样式规范
- **卡片圆角**: `20px` (使用 `rounded-[20px]`)
- **标题文字大小**: `16px` (使用 `text-[16px]`)
- **说明/小字文字大小**: `14px` (使用 `text-[14px]`)
- **描边**: 默认黑色 `#000000`，10% 透明度 (使用 `border border-[#000000]/10`)
- **输入框高度**: 标准高度使用 `py-2` (上下各8px padding，总高度约40-44px)
- **按钮高度**: 标准高度使用 `py-2` (上下各8px padding，总高度约40-44px)，与输入框保持一致
- **输入框样式（标准）**: 
  - 背景色: `rgba(0, 0, 0, 0.1)` (黑色10%透明度)
  - 边框: `border` + `borderColor: 'rgba(0, 0, 0, 0.1)'` (黑色10%透明度)
  - 圆角: `rounded-lg`
  - 文字: `text-sm text-black`
  - Padding: `px-3 py-2`
  - 聚焦: `focus:outline-none focus:ring-2 focus:ring-blue-500`
- **弹窗输入框样式（全局统一）**: 
  - 参考标准: 创建出售订单弹窗中的"输入NFT价格"输入框
  - 类名: `block w-full px-3 py-2 text-sm text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border`
  - 样式: `backgroundColor: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)'`
  - 说明: 所有弹窗中的输入框应使用此样式，宽度可根据需要调整（`w-full` 或其他宽度）

## Tailwind CSS 类名对应
- 绿色背景: `bg-[#CEF248]`
- 白色背景: `bg-[#FFFFFF]` 或 `bg-white`
- 黑色背景: `bg-[#000000]` 或 `bg-black`
- 绿色文字: `text-[#CEF248]`
- 白色文字: `text-[#FFFFFF]` 或 `text-white`
- 黑色文字: `text-[#000000]` 或 `text-black`
- 卡片圆角: `rounded-[20px]`
- 标题: `text-[16px]`
- 说明文字: `text-[14px]`
- **描边（默认）**: `border border-[#000000]/10` (黑色，10% 透明度)
- **输入框（标准）**: 
  - 类名: `px-3 py-2 text-sm text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border`
  - 样式: `backgroundColor: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)'`
  - 高度约40-44px，左右padding 12px
- **弹窗输入框（全局统一）**: 
  - 类名: `block w-full px-3 py-2 text-sm text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border`
  - 样式: `backgroundColor: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(0, 0, 0, 0.1)'`
  - 参考: 创建出售订单弹窗中的"输入NFT价格"输入框
  - 宽度: 可根据需要调整（默认 `w-full`）
- **按钮（标准）**: `py-2 px-4` (高度约40-44px，左右padding 16px)

