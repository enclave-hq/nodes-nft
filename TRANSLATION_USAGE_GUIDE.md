# 🌐 翻译使用指南

## 📍 当前状态

翻译系统已完全配置，但页面内容还需要更新为使用翻译。

### ✅ 已完成
- 翻译文件（en.json, zh.json, ja.json, ko.json）
- i18n 配置（i18n/request.ts）
- 路由中间件（proxy.ts）
- 语言切换器组件（LanguageSwitcher）
- Navbar 导航栏翻译

### ⏳ 待完成
- 主页（Home）内容翻译
- Mint 页面内容翻译
- My NFTs 页面内容翻译
- Marketplace 页面内容翻译

---

## 💡 如何在组件中使用翻译

### 1. 导入 hooks
```typescript
import { useTranslations, useLocale } from 'next-intl';
```

### 2. 在组件中使用
```typescript
export default function MyPage() {
  const t = useTranslations('home');  // 使用 home 命名空间
  const tCommon = useTranslations('common');  // 通用翻译
  const locale = useLocale();  // 当前语言
  
  // 创建本地化路径
  const localizedPath = (path: string) => {
    return locale === 'en' ? path : `/${locale}${path}`;
  };
  
  return (
    <div>
      <h1>{t('hero.title')}</h1>
      <p>{t('hero.subtitle')}</p>
      <button>{tCommon('connectWallet')}</button>
      <Link href={localizedPath('/mint')}>
        {tCommon('mint')}
      </Link>
    </div>
  );
}
```

### 3. 带参数的翻译
```typescript
// 在 messages/en.json 中:
// "welcome": "Hello, {name}!"

t('welcome', { name: 'Alice' })
// → "Hello, Alice!"
```

---

## 📝 更新页面示例

### Home Page (app/[locale]/page.tsx)

#### 需要替换的内容：
```typescript
// ❌ 旧代码
<h1>Decentralized Node NFT Platform</h1>
<p>Own a piece of the network...</p>
<button>Connect Wallet to Get Started</button>

// ✅ 新代码
<h1>{t('hero.title')}</h1>
<p>{t('hero.subtitle')}</p>
<button>{t('hero.cta')}</button>
```

### Mint Page (app/[locale]/mint/page.tsx)

```typescript
// ❌ 旧代码
<h1>Mint Node NFT</h1>
<p>Choose your node type and start earning rewards</p>

// ✅ 新代码
const t = useTranslations('mint');
<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>
```

### My NFTs Page (app/[locale]/my-nfts/page.tsx)

```typescript
// ❌ 旧代码
<h1>My NFTs</h1>
<button>Batch Claim ECLV</button>

// ✅ 新代码
const t = useTranslations('myNfts');
<h1>{t('title')}</h1>
<button>{t('batchActions.batchClaim')}</button>
```

### Marketplace Page (app/[locale]/marketplace/page.tsx)

```typescript
// ❌ 旧代码
<h1>Marketplace</h1>
<button>Buy Shares</button>

// ✅ 新代码
const t = useTranslations('marketplace');
<h1>{t('title')}</h1>
<button>{t('orderCard.buyShares')}</button>
```

---

## 🔍 快速验证

### 1. 检查 Navbar（已完成）
访问 `http://localhost:3000/zh` 
- ✅ 导航链接应该显示：首页、铸造、我的 NFT、市场
- ✅ 右上角有语言切换器

### 2. 检查页面内容（需要更新）
目前页面内容是硬编码的英文，需要按上述方式更新。

---

## 🚀 快速修复脚本

由于页面文件较大，建议逐步更新。可以按以下顺序：

### 优先级 1: Navbar（✅ 已完成）
- 导航链接
- 连接钱包按钮

### 优先级 2: 主要 CTA
- Home 页面 Hero 区域
- Mint 页面标题和按钮
- 空状态提示

### 优先级 3: 详细内容
- 卡片标题和描述
- 表单标签
- 错误消息

---

## 📖 翻译键参考

### Common (通用)
```
common.connectWallet    → "Connect Wallet" / "连接钱包"
common.loading          → "Loading..." / "加载中..."
common.claim            → "Claim" / "领取"
common.buy              → "Buy" / "购买"
```

### Navbar (导航)
```
navbar.home            → "Home" / "首页"
navbar.mint            → "Mint" / "铸造"
navbar.myNfts          → "My NFTs" / "我的 NFT"
navbar.marketplace     → "Marketplace" / "市场"
```

### Home (主页)
```
home.hero.title        → "Enclave Node NFT Platform"
home.hero.subtitle     → "Own, earn, and trade node shares..."
home.hero.cta          → "Get Started" / "立即开始"
```

完整的翻译键请查看 `messages/*.json` 文件。

---

## 🎯 验证翻译是否工作

### 方法 1: 在浏览器中测试
```
1. 启动开发服务器: npm run dev
2. 访问: http://localhost:3000
3. 点击右上角语言切换器
4. 选择"中文"
5. 检查导航栏是否变成中文
```

### 方法 2: 直接访问中文路由
```
访问: http://localhost:3000/zh
导航栏应该显示中文
```

### 方法 3: 检查 Navbar 源代码
```typescript
// frontend/components/Navbar.tsx 第 48 行
{t('home')}  // ← 这应该根据语言显示 "Home" 或 "首页"
```

---

## ⚠️ 常见问题

### Q: 为什么页面内容没有翻译？
A: 只有 Navbar 组件更新了翻译，页面内容（Home, Mint 等）还是硬编码的英文，需要按上述方式更新。

### Q: 如何确认翻译系统工作？
A: 访问 /zh 路由，检查 Navbar 导航链接是否显示中文。

### Q: 语言切换器在哪里？
A: 在页面右上角，Navbar 中，地球图标 🌐。

---

## 📋 下一步行动

建议按以下顺序更新页面：

1. ✅ **Navbar** - 已完成
2. ⏳ **Home Page** - Hero 区域和主要 CTA
3. ⏳ **Mint Page** - 标题、表单标签、按钮
4. ⏳ **My NFTs** - 标题、批量操作、卡片
5. ⏳ **Marketplace** - 标题、订单卡片、表单

每个页面需要：
1. 导入 `useTranslations` 和 `useLocale`
2. 替换硬编码文本为 `t('key')`
3. 更新 Link href 为 `localizedPath('/path')`

---

**提示**: 如果需要帮助更新特定页面，请告诉我！

