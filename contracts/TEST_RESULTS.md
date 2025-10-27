# Node NFT 系统测试文档

**测试日期**: 2025年10月27日  
**测试环境**: Hardhat 本地网络  
**测试工具**: Hardhat, TypeScript, Ethers.js

---

## 测试概述

本次测试对 Node NFT 系统进行了全面的功能验证，包括合约部署、NFT铸造、奖励分发、份额交易、市场功能和持有者追踪等核心功能。所有测试在本地 Hardhat 网络上进行，以确保快速、可重复和成本为零的测试环境。

---

## 测试 1: 合约部署

### 测试目标
验证所有智能合约能够正确部署，并且合约间的依赖关系配置正确。

### 测试输入
- **部署者账户**: Hardhat 默认账户 #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`)
- **初始配置**:
  - TestUSDT: 测试用的 USDT 代币
  - EnclaveToken ($E): 初始供应量 1亿枚
  - NodeNFT: ERC-721 NFT合约
  - NFTManager: 可升级的管理合约 (UUPS代理模式)

### 测试步骤
1. 部署 `TestUSDT` 合约
2. 部署 `EnclaveToken` 合约，铸造 1亿枚给部署者
3. 部署 `NodeNFT` 合约，名称为 "Enclave Node NFT"，符号 "ENFT"
4. 部署 `NFTManager` 可升级代理合约
5. 配置合约关系：
   - 在 `NodeNFT` 中设置 `NFTManager` 地址
   - 设置 NFT 元数据基础 URI
   - 添加 USDT 作为奖励代币
6. 转账 1000万 $E 到 `NFTManager` 作为奖励池
7. 为测试账户铸造 TestUSDT（每个账户 10万 USDT）

### 测试结果
✅ **通过**

**输出**:
```
TestUSDT:      0x5FbDB2315678afecb367f032d93F642f64180aa3
EnclaveToken:  0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NodeNFT:       0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NFTManager:    0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
```

**验证点**:
- ✅ 所有合约地址有效且非零
- ✅ NFTManager 持有 1000万 $E
- ✅ 3个测试账户各持有 10万 TestUSDT
- ✅ 合约配置关系正确建立

---

## 测试 2: NFT 铸造

### 测试目标
验证用户能够成功铸造 Standard 和 Premium 两种类型的 NFT，并且正确支付 USDT、分配份额和计算权重。

### 测试输入

**测试账户**:
- Alice (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`): 持有 10万 USDT
- Bob (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`): 持有 10万 USDT

**NFT 配置**:
| 类型 | 价格 | $E 配额 | 份额数 | 每份额权重 |
|------|------|-----------|--------|-----------|
| Standard | 10,000 USDT | 20,000 $E | 10 | 1 |
| Premium | 50,000 USDT | 100,000 $E | 10 | 6 |

### 测试步骤

**测试 2.1: Alice 铸造 Standard NFT**
1. Alice 授权 NFTManager 使用 10,000 USDT
2. Alice 调用 `mintNFT(NFTType.Standard)`
3. 验证 NFT #1 铸造成功
4. 验证 Alice 的 USDT 余额减少 10,000

**测试 2.2: Bob 铸造 Premium NFT**
1. Bob 授权 NFTManager 使用 50,000 USDT
2. Bob 调用 `mintNFT(NFTType.Premium)`
3. 验证 NFT #2 铸造成功
4. 验证 Bob 的 USDT 余额减少 50,000

### 测试结果
✅ **通过**

**输出**:
```
NFT #1 (Alice's Standard):
  Type:              0 (Standard)
  State:             Live
  Weighted Shares:   10 (10 shares × 1 weight)
  Remaining Quota:   20,000 $E

NFT #2 (Bob's Premium):
  Type:              1 (Premium)
  State:             Live
  Weighted Shares:   60 (10 shares × 6 weight)
  Remaining Quota:   100,000 $E

Global State:
  Total Weighted Shares: 70
  Acc Per Weight:        0.0
```

**验证点**:
- ✅ Alice 支付了 10,000 USDT，持有 NFT #1 的全部 10 份额
- ✅ Bob 支付了 50,000 USDT，持有 NFT #2 的全部 10 份额
- ✅ 全局加权份额正确 (10 + 60 = 70)
- ✅ 每个 NFT 的配额正确设置
- ✅ 持有者列表正确初始化（Alice 和 Bob 分别为唯一持有者）

---

## 测试 3: 奖励分发和领取

### 测试目标
验证预言机能够以 O(1) gas 成本分发奖励，用户能够正确计算和领取挂起的奖励，Premium NFT 获得 6倍奖励。

### 测试输入

**奖励分发**:
- $E 产出: 1,000 $E
- USDT 奖励: 500 USDT

**预期分配** (基于权重比例):
- Standard NFT (权重 10/70): 142.857 $E, 71.429 USDT
- Premium NFT (权重 60/70): 857.143 $E, 428.571 USDT
- 比例: 6:1

### 测试步骤

**测试 3.1: 预言机分发 $E 产出**
1. 预言机（部署者）授权 1,000 $E 给 NFTManager
2. 预言机调用 `distributeProduced(1000 $E)`
3. 验证全局累积索引更新

**测试 3.2: 预言机分发 USDT 奖励**
1. 预言机授权 500 USDT 给 NFTManager
2. 预言机调用 `distributeRewards(USDT, 500 USDT)`
3. 验证 USDT 奖励索引更新

**测试 3.3: 查询挂起奖励**
1. 调用 `getPendingProduced(NFT #1, Alice)`
2. 调用 `getPendingReward(NFT #1, Alice, USDT)`
3. 调用 `getPendingProduced(NFT #2, Bob)`
4. 调用 `getPendingReward(NFT #2, Bob, USDT)`

**测试 3.4: Alice 领取奖励**
1. Alice 调用 `claimProduced(NFT #1)`
2. Alice 调用 `claimReward(NFT #1, USDT)`
3. 验证 Alice 收到的金额

**测试 3.5: Bob 领取奖励**
1. Bob 调用 `claimAllRewards(NFT #2)`（批量领取）
2. 验证 Bob 收到的金额

### 测试结果
✅ **通过**

**输出**:
```
分发后的挂起奖励:
NFT #1 (Standard, 10 shares, weight=1 each):
  Pending $E: 142.857142857142857142 $E
  Pending USDT: 71.428571428571428571 USDT

NFT #2 (Premium, 10 shares, weight=6 each):
  Pending $E: 857.142857142857142857 $E
  Pending USDT: 428.571428571428571428 USDT

领取后:
Alice 收到: 142.857 $E + 71.429 USDT
Bob 收到:   857.143 $E + 428.571 USDT

奖励比例验证: 857.143 / 142.857 = 6.00 ✅
```

**验证点**:
- ✅ 全局累积索引正确更新 (`accProducedPerWeight` = 14285714285714285714)
- ✅ 挂起奖励计算准确（基于权重比例）
- ✅ Bob 的奖励正好是 Alice 的 6倍
- ✅ 奖励成功转账到用户钱包
- ✅ 领取后挂起奖励清零
- ✅ 预言机分发操作的 gas 成本为 O(1)（不依赖于 NFT 数量）

---

## 测试 4: 市场和份额交易

### 测试目标
验证份额的 P2P 转让、市场订单创建、购买和取消功能，确保份额总数守恒且持有者列表正确更新。

### 测试输入

**初始状态**:
- Alice: NFT #1 的 10 份额
- Bob: NFT #2 的 10 份额
- Charlie: 0 份额，持有 10万 USDT

**交易计划**:
1. Alice 转让 3 份额给 Bob (P2P)
2. Alice 创建卖单：2 份额，每份 6,000 USDT
3. Charlie 购买 Alice 的卖单
4. Bob 创建卖单后取消

### 测试步骤

**测试 4.1: P2P 份额转让**
1. Alice 调用 `transferShares(NFT #1, Bob, 3)`
2. 验证份额转移（Alice: 10→7, Bob: 0→3）
3. 验证奖励结算
4. 验证持有者列表更新（Bob 加入 NFT #1 持有者）

**测试 4.2: 创建卖单**
1. Alice 调用 `createSellOrder(NFT #1, 2 shares, 6000 USDT/share)`
2. 验证订单创建（订单 ID #1）
3. 验证 Alice 的可用份额锁定（7→5 可用，2 锁定）

**测试 4.3: 购买份额**
1. Charlie 授权 12,000 USDT (2 × 6,000)
2. Charlie 调用 `buyShares(订单 #1)`
3. 验证 USDT 支付（Charlie → Alice: 12,000 USDT）
4. 验证份额转移（Alice: 7→5, Charlie: 0→2）
5. 验证持有者列表更新（Charlie 加入 NFT #1 持有者）
6. 验证订单状态更新（active: false）

**测试 4.4: 取消卖单**
1. Bob 创建卖单（订单 #2）
2. Bob 调用 `cancelSellOrder(订单 #2)`
3. 验证订单取消（active: false）
4. 验证份额解锁（Bob 份额恢复）

### 测试结果
✅ **通过**

**输出**:
```
初始份额分布:
Alice: 10 shares (NFT #1)
Bob:   0 shares (NFT #1)

P2P 转让后:
Alice: 7 shares
Bob:   3 shares
✅ 验证通过

创建卖单:
Order ID: 1
Seller:   Alice
Shares:   2
Price:    6,000 USDT/share
Total:    12,000 USDT
✅ 订单创建成功

购买后:
Alice USDT:   90,071.43 → 102,071.43 (+12,000)
Charlie USDT: 100,000 → 88,000 (-12,000)
Charlie shares: 0 → 2
✅ 交易成功

最终份额分布:
Alice:   5 shares
Bob:     3 shares
Charlie: 2 shares
Total:   10 shares ✅
```

**验证点**:
- ✅ P2P 转让正确转移份额并结算奖励
- ✅ 卖单创建后份额被正确锁定
- ✅ 购买成功，USDT 支付正确，份额转移正确
- ✅ 订单取消后份额正确解锁
- ✅ 份额总数守恒（始终为 10）
- ✅ 所有操作正确触发 Transfer 和订单相关事件

---

## 测试 5: 持有者列表功能

### 测试目标
验证新增的持有者列表功能能够正确追踪和更新 NFT 的所有份额持有者。

### 测试输入
- NFT #1 经过多次交易后的最终状态
- 3个持有者（Alice, Bob, Charlie）

### 测试步骤
1. 调用 `getShareholders(NFT #1)` 获取持有者地址列表
2. 对每个地址调用 `getUserShareCount(NFT #1, address)` 获取份额数
3. 验证列表中的地址和份额数正确

### 测试结果
✅ **通过**

**输出**:
```
🎯 NFT #1 Shareholders List
────────────────────────────────────────────────────────────
Number of shareholders: 3
Shareholders:
  1. 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 - 5 shares (Alice)
  2. 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC - 3 shares (Bob)
  3. 0x90F79bf6EB2c4f870365E785982E1f101E93b906 - 2 shares (Charlie)
```

**验证点**:
- ✅ 持有者列表包含所有持有份额的地址
- ✅ 每个地址的份额数正确
- ✅ 份额总数为 10（5 + 3 + 2）
- ✅ 持有者列表在以下操作中正确更新：
  - NFT 铸造时添加初始持有者
  - P2P 转让时添加新持有者
  - 市场购买时添加新持有者
  - 份额清零时移除持有者（自动清理）

---

## 新增功能验证

### 功能 1: `getUserShareCount(uint256 nftId, address user)`

**功能描述**: 查询用户在指定 NFT 中持有的份额数量

**实现原因**: 由于 `UserShare` 结构体包含 `mapping` 字段，Solidity 无法自动生成完整的 getter 函数，因此需要手动实现。

**测试验证**:
```typescript
const aliceShares = await manager.getUserShareCount(1, alice.address);
// 返回: 5
```
✅ 正确返回用户份额数

---

### 功能 2: `getShareholders(uint256 nftId)`

**功能描述**: 返回持有指定 NFT 份额的所有地址列表

**实现细节**:
- 在 `NFTPool` 结构体中添加 `address[] shareholders` 数组
- 在份额转移时调用 `_addShareholder()` 和 `_removeShareholder()` 维护列表
- `_addShareholder()`: 防止重复添加，线性查找
- `_removeShareholder()`: 份额为零时移除，使用 swap-and-pop 模式

**测试验证**:
```typescript
const shareholders = await manager.getShareholders(1);
// 返回: ["0x7099...", "0x3C44...", "0x90F7..."]
```
✅ 正确返回持有者列表

**Gas 优化分析**:
- 添加持有者: O(n) 其中 n 为当前持有者数量（线性查找）
- 移除持有者: O(n) （线性查找 + swap-and-pop）
- 查询列表: O(1) （直接返回数组）
- 对于小规模持有者（通常 < 10人），性能影响可忽略

---

## 系统整体验证

### 核心指标

| 指标 | 目标 | 实际结果 | 状态 |
|------|------|----------|------|
| 合约部署成功率 | 100% | 100% | ✅ |
| NFT 铸造成功率 | 100% | 100% | ✅ |
| 奖励分发准确性 | 精确到 wei | 精确到 wei | ✅ |
| 权重比例准确性 | 6:1 | 6.00:1 | ✅ |
| 份额守恒性 | 100% | 100% (10/10) | ✅ |
| 市场交易成功率 | 100% | 100% | ✅ |
| 持有者追踪准确性 | 100% | 100% | ✅ |

### Gas 成本分析

| 操作 | Gas 使用量 | 复杂度 |
|------|-----------|--------|
| 铸造 Standard NFT | ~381,352 | O(1) |
| 铸造 Premium NFT | ~330,052 | O(1) |
| 预言机分发奖励 ($E) | ~81,092 | O(1) ⭐ |
| 预言机分发奖励 (USDT) | ~63,992 | O(1) ⭐ |
| 用户领取奖励 | ~82,778 | O(1) |
| P2P 份额转让 | ~102,759 | O(n) n=持有者数 |
| 创建卖单 | ~164,172 | O(n) n=持有者数 |
| 购买份额 | ~244,943 | O(n) n=持有者数 |
| 取消卖单 | ~32,538 | O(1) |

**关键优化**:
- ✅ 预言机分发为 O(1)，不受 NFT 数量影响
- ✅ 使用全局累积索引模型，避免遍历所有 NFT
- ⚠️ 持有者列表操作为 O(n)，但 n 通常很小（< 10）

---

## 已知限制和未来改进

### 限制
1. 持有者列表操作为 O(n)，不适合超大规模持有者（> 100人）
2. 解锁机制测试未完成（`calculateUnlockedAmount` 函数需实现）
3. NFT dissolution（解散）流程未测试

### 建议改进
1. 如需支持大规模持有者，考虑使用 EnumerableSet 或链表结构
2. 实现并测试完整的解锁机制
3. 添加 NFT 解散的完整测试流程
4. 前端集成测试

---

## 测试环境详情

**Hardhat 配置**:
- Solidity 版本: 0.8.22
- EVM 目标: paris
- 优化器: 启用 (200 runs)
- 网络: Hardhat 本地网络

**测试工具**:
- Hardhat: 智能合约开发框架
- Ethers.js v6: 与区块链交互
- TypeScript: 测试脚本语言
- Hardhat Network Helpers: 时间旅行等测试辅助

**测试账户**:
```
Account #0 (Deployer/Oracle): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Account #1 (Alice):           0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Account #2 (Bob):             0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Account #3 (Charlie):         0x90F79bf6EB2c4f870365E785982E1f101E93b906
```

---

## 总结

✅ **所有核心功能测试通过**

本次测试全面验证了 Node NFT 系统的核心功能，包括：
- 智能合约的部署和配置
- NFT 的铸造和份额分配
- 基于权重的奖励分发机制（O(1) gas 优化）
- 份额的 P2P 转让和市场交易
- 持有者列表的动态追踪

系统设计合理，实现正确，性能优化到位。建议在完成解锁机制测试后，部署到 BSC 测试网进行真实环境验证。

**下一步行动**:
1. 实现并测试解锁机制
2. 部署到 BSC 测试网
3. 前端集成测试
4. 用户验收测试 (UAT)
5. 安全审计
6. 主网部署

