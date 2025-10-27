# Node NFT 实施计划

## 📋 当前状态

### ✅ 已完成
1. **项目结构创建**
   - 创建了 `contracts/` 和 `frontend/` 目录
   - 设置了 Hardhat 项目配置
   - 创建了 package.json 和配置文件

2. **基础合约**
   - ✅ NodeToken.sol (ERC-20)

### 🔨 进行中

#### 合约开发（contracts/）

**核心合约：**
1. **NodeNFT.sol** (ERC-721) - 待实现
   - 标准 ERC-721 实现
   - 禁止 transfer（除 mint/burn）
   - tokenURI 元数据

2. **NFTManager.sol** (核心逻辑) - 待实现
   - 全局状态管理（GlobalState）
   - NFT 池管理（NFTPool）
   - 用户份额管理（UserShare）
   - O(1) 奖励分发
   - 份额转让
   - 市场功能
   - 解锁机制
   - 状态管理（Live/Dissolved）

3. **NFTManagerProxy.sol** (UUPS代理) - 待实现

**辅助文件：**
- interfaces/ - 接口定义
- libraries/ - 工具库
- mocks/ - 测试用 Mock 合约

#### 测试（test/）
- NodeToken.test.ts
- NodeNFT.test.ts
- NFTManager.test.ts
- Integration.test.ts
- Gas.test.ts

#### 部署脚本（scripts/）
- deploy.ts
- verify.ts
- upgrade.ts

### 📦 前端开发（frontend/）

**技术栈：**
- Next.js 14
- TypeScript
- TailwindCSS
- @enclave-hq/wallet-sdk
- ethers.js v6
- wagmi/viem

**目录结构：**
```
frontend/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # 首页
│   │   ├── dashboard/    # 用户 Dashboard
│   │   ├── market/       # 份额市场
│   │   ├── nft/[id]/     # NFT 详情
│   │   └── layout.tsx    # 根布局
│   │
│   ├── components/       # React 组件
│   │   ├── common/       # 通用组件
│   │   ├── nft/          # NFT 相关
│   │   ├── market/       # 市场相关
│   │   └── wallet/       # 钱包集成
│   │
│   ├── hooks/            # 自定义 Hooks
│   │   ├── useNFTManager.ts
│   │   ├── useUserHoldings.ts
│   │   ├── usePendingRewards.ts
│   │   └── useMarket.ts
│   │
│   ├── lib/              # 工具函数
│   │   ├── contracts/    # 合约交互
│   │   ├── utils/        # 工具函数
│   │   └── constants.ts  # 常量定义
│   │
│   └── types/            # TypeScript 类型
│
├── public/               # 静态资源
└── package.json
```

**核心页面：**
1. 首页 - 项目介绍、数据统计
2. Dashboard - 用户持仓、待领取奖励
3. NFT 详情 - 份额分布、历史记录
4. 市场 - 份额交易、挂单列表
5. 解散提案 - 投票管理

## 🚀 实施步骤

### Phase 1: 核心合约（优先）

#### Step 1.1: 完成基础合约
```bash
cd contracts
# 实现 NodeNFT.sol
# 实现 NFTManager.sol (核心，最复杂)
# 实现代理合约
```

**预计工作量：** 3-5天
- NodeNFT: 半天
- NFTManager: 2-3天（最复杂，~800行代码）
- 代理和接口: 半天

#### Step 1.2: 单元测试
```bash
# 编写全面的单元测试
npx hardhat test
npx hardhat coverage
```

**目标：** 覆盖率 > 90%
**预计工作量：** 2-3天

#### Step 1.3: Gas 优化验证
```bash
REPORT_GAS=true npx hardhat test
```

**验证目标：**
- 预言机分发 < 40k gas
- 用户 Claim < 50k gas
- 批量 Claim (3个) < 120k gas

### Phase 2: 部署与验证

#### Step 2.1: Testnet 部署
```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```

#### Step 2.2: 合约验证
```bash
npx hardhat verify --network bscTestnet <address>
```

#### Step 2.3: 集成测试
- 在 Testnet 上进行完整流程测试
- 验证所有功能正常工作

### Phase 3: 前端开发

#### Step 3.1: 项目初始化
```bash
cd frontend
npm install
```

#### Step 3.2: 钱包集成
- 集成 @enclave-hq/wallet-sdk
- 实现连接、断开、切换网络

#### Step 3.3: 合约交互层
- 创建合约实例
- 封装所有合约调用
- 实现事件监听

#### Step 3.4: UI 组件开发
- Dashboard
- NFT 列表
- 市场界面
- 详情页

#### Step 3.5: 数据索引（可选）
- 使用 TheGraph 或自建索引服务
- 监听合约事件
- 构建用户持仓索引

**预计工作量：** 5-7天

### Phase 4: 测试与优化

#### Step 4.1: E2E 测试
- 完整用户流程测试
- 跨浏览器测试

#### Step 4.2: 性能优化
- 代码分割
- 图片优化
- 缓存策略

#### Step 4.3: 安全审计
- 合约审计（Slither, Mythril）
- 前端安全检查

### Phase 5: 主网部署

#### Step 5.1: 主网部署准备
- 最终审计
- 部署清单确认
- 应急预案准备

#### Step 5.2: 主网部署
```bash
npx hardhat run scripts/deploy.ts --network bscMainnet
npx hardhat verify --network bscMainnet <addresses>
```

#### Step 5.3: 监控与维护
- 设置监控告警
- 准备升级流程
- 建立反馈渠道

## 📝 开发优先级

### P0 (必须)
- [x] NodeToken
- [ ] NodeNFT
- [ ] NFTManager (核心功能)
- [ ] 基础测试
- [ ] 前端 Dashboard
- [ ] 前端 Claim 功能

### P1 (重要)
- [ ] 市场功能（合约 + 前端）
- [ ] 解散提案功能
- [ ] 完整测试覆盖
- [ ] Gas 优化
- [ ] 前端 UI 优化

### P2 (增强)
- [ ] 链下索引服务
- [ ] 高级分析页面
- [ ] 移动端适配
- [ ] 多语言支持

## 🔧 技术挑战

### 合约层面
1. **O(1) 全局索引实现** - 核心算法，需要仔细验证
2. **精度计算** - 18 decimals 精度处理
3. **状态转换** - Live/Dissolved 状态机
4. **Gas 优化** - 达到设计目标

### 前端层面
1. **wallet-sdk 集成** - 多钱包支持
2. **实时数据更新** - WebSocket 或轮询
3. **复杂状态管理** - 多 NFT 持仓状态
4. **性能优化** - 大列表渲染

## 📊 时间估算

### 总体时间线（单人）
- **合约开发**: 5-7天
- **合约测试**: 3-4天
- **前端开发**: 7-10天
- **集成测试**: 2-3天
- **优化部署**: 2-3天
- **总计**: 19-27天 (~3-4周)

### 团队协作（2-3人）
- **合约开发**: 3-4天
- **前端开发**: 5-7天
- **并行测试**: 2-3天
- **总计**: 10-14天 (~2周)

## 🎯 下一步行动

### 立即开始：
1. ✅ 完成 NodeToken.sol
2. 📝 实现 NodeNFT.sol
3. 📝 开始 NFTManager.sol 核心功能
4. 📝 编写基础测试

### 本周目标：
- [ ] 完成所有核心合约
- [ ] 单元测试覆盖率 > 80%
- [ ] Testnet 部署成功

### 下周目标：
- [ ] 前端项目搭建
- [ ] 钱包集成完成
- [ ] Dashboard 基础功能

---

**注意：** 由于合约代码量较大（预计 NFTManager.sol ~800-1000行），建议：
1. 先实现核心功能（铸造、Claim、转让）
2. 逐步添加高级功能（市场、解散）
3. 持续测试和优化

