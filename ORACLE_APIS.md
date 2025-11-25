# NFTManager Oracle APIs 文档

本文档说明 `NFTManager.sol` 合约中需要多签 Oracle 调用的所有 API。

## 概述

`NFTManager` 合约中有 **3个函数** 需要 Oracle 权限（使用 `onlyOracle` 修饰符）：

1. **`distributeProduced`** - 分发 $E 生产奖励
2. **`burnTokensFromSwap`** - 从 Swap 回购销毁代币
3. **`distributeReward`** - 分发奖励代币

---

## 1. distributeProduced - 分发 $E 生产奖励

### 函数签名
```solidity
function distributeProduced(uint256 totalAmount) external onlyOracle nonReentrant
```

### 参数
- `totalAmount` (uint256): 总挖矿数量（wei），从 EnclaveToken 合约挖取

### 功能说明
- **目的**: 分发 $E 代币的生产奖励给所有活跃的 NFT 持有者
- **分配比例**:
  - 80% → NFTManager 合约（按比例分配给所有 Active NFTs）
  - 20% → 直接挖矿到 multisig node 地址
- **前置条件**:
  - `multisigNode` 必须已设置（不能为 address(0)）
  - 必须有至少 1 个 Active NFT（`globalState.totalActiveNFTs > 0`）
  - `totalAmount` 必须 > 0
- **权限要求**:
  - NFTManager 必须被设置为 EnclaveToken 的 oracle 或 owner，才能调用 `mineTokens()`
- **更新机制**:
  - 使用 O(1) 全局索引模型更新 `globalState.accProducedPerNFT`
  - 更新 `globalState.lastUpdateTime`

### 事件
```solidity
event MiningDistributed(uint256 totalAmount, uint256 nftAmount, uint256 multisigAmount);
event ProducedDistributed(uint256 amount, uint256 accProducedPerNFT, uint256 timestamp);
```

### 调用示例
```solidity
// Oracle 调用
nftManager.distributeProduced(1000 * 10**18); // 分发 1000 $E
```

---

## 2. burnTokensFromSwap - 从 Swap 回购销毁代币

### 函数签名
```solidity
function burnTokensFromSwap(uint256 amount, string memory reason) external onlyOracle nonReentrant
```

### 参数
- `amount` (uint256): 要销毁的代币数量（wei）
- `reason` (string): 销毁原因（例如："swap_buyback"）

### 功能说明
- **目的**: 销毁从 Swap 回购的代币（通缩机制）
- **工作流程**:
  1. Oracle 从 Swap 购买代币
  2. Oracle 有两种方式提供代币：
     - **Option 1**: 先将代币转账到 NFTManager，然后调用此函数
     - **Option 2**: 先 approve 代币给 NFTManager，然后调用此函数（NFTManager 会自动 pull）
  3. NFTManager 调用 EnclaveToken 的 `burnFromSwap()` 销毁代币
- **前置条件**:
  - `amount` 必须 > 0
  - NFTManager 必须被设置为 EnclaveToken 的 oracle，才能调用 `burnFromSwap()`
- **代币处理**:
  - 如果 NFTManager 合约余额不足，会从 Oracle 地址 pull 所需代币
  - 使用 `forceApprove` 授权 EnclaveToken 合约销毁代币

### 事件
```solidity
event TokensBurnedFromSwap(uint256 amount, string reason);
```

### 调用示例
```solidity
// Oracle 先购买代币，然后调用
// Option 1: 先转账
eclvToken.transfer(nftManager, amount);
nftManager.burnTokensFromSwap(amount, "swap_buyback");

// Option 2: 先 approve
eclvToken.approve(nftManager, amount);
nftManager.burnTokensFromSwap(amount, "swap_buyback");
```

---

## 3. distributeReward - 分发奖励代币

### 函数签名
```solidity
function distributeReward(address token, uint256 amount) external onlyOracle nonReentrant
```

### 参数
- `token` (address): 奖励代币合约地址（必须是已添加的 reward token）
- `amount` (uint256): 要分发的总数量（wei）

### 功能说明
- **目的**: 分发奖励代币（如 USDT）给所有活跃的 NFT 持有者
- **分配比例**:
  - 80% → NFTManager 合约（按比例分配给所有 Active NFTs）
  - 20% → 累积到 multisig reward（multisig 可以稍后领取）
- **前置条件**:
  - `token` 必须是已添加的 reward token（`isRewardToken[token] == true`）
  - `multisigNode` 必须已设置（不能为 address(0)）
  - 必须有至少 1 个 Active NFT（`globalState.totalActiveNFTs > 0`）
  - `amount` 必须 > 0
- **代币处理**:
  - Oracle 必须先 `approve` 代币给 NFTManager
  - NFTManager 会从 Oracle 地址 `transferFrom` 代币
- **更新机制**:
  - 使用 O(1) 全局索引模型更新 `globalState.accRewardPerNFT[token]`
  - 更新 `multisigRewardDistributed[token]`（multisig 可领取）
  - 更新 `globalState.lastUpdateTime`

### 事件
```solidity
event RewardDistributed(
    address indexed token, 
    uint256 totalAmount, 
    uint256 nftAmount, 
    uint256 multisigAmount, 
    uint256 accRewardPerNFT, 
    uint256 timestamp
);
```

### 调用示例
```solidity
// Oracle 先 approve 代币
IERC20(usdtToken).approve(nftManager, amount);

// 然后调用分发
nftManager.distributeReward(usdtToken, 10000 * 10**18); // 分发 10000 USDT
```

---

## Oracle 权限设置

### 设置 Oracle 地址
```solidity
// 只有 owner 可以设置
nftManager.setOracle(oracleAddress);
```

### 检查当前 Oracle
```solidity
address currentOracle = nftManager.oracle();
```

---

## 多签节点设置

### 设置 Multisig Node 地址
```solidity
// 只有 owner 可以设置
nftManager.setMultisigNode(multisigNodeAddress);
```

### Multisig 领取奖励
```solidity
// Multisig 可以领取累积的奖励（20% 部分）
nftManager.claimMultisigReward(tokenAddress);

// 或一次性领取所有代币的奖励
nftManager.claimAllMultisigRewards();
```

---

## 注意事项

1. **权限要求**:
   - 所有 3 个函数都需要 Oracle 权限（`onlyOracle`）
   - Oracle 地址必须在合约初始化时设置，或通过 `setOracle()` 更新

2. **EnclaveToken 权限**:
   - `distributeProduced` 需要 NFTManager 是 EnclaveToken 的 oracle/owner
   - `burnTokensFromSwap` 需要 NFTManager 是 EnclaveToken 的 oracle

3. **代币授权**:
   - `distributeReward` 需要 Oracle 先 approve 代币给 NFTManager
   - `burnTokensFromSwap` 可以选择转账或 approve

4. **Active NFTs 要求**:
   - `distributeProduced` 和 `distributeReward` 都需要至少 1 个 Active NFT
   - 如果所有 NFT 都是 Terminated，这些函数会 revert

5. **Gas 优化**:
   - 所有分发函数都使用 O(1) 全局索引模型，gas 消耗与 NFT 数量无关
   - 用户领取奖励时才会更新个人状态

---

## 总结

| API | 参数 | 功能 | 分配比例 |
|-----|------|------|----------|
| `distributeProduced` | `totalAmount` | 分发 $E 生产奖励 | 80% NFTs, 20% Multisig |
| `burnTokensFromSwap` | `amount`, `reason` | 销毁回购代币 | 100% 销毁 |
| `distributeReward` | `token`, `amount` | 分发奖励代币 | 80% NFTs, 20% Multisig |

所有 API 都需要：
- ✅ Oracle 权限（`onlyOracle`）
- ✅ 多签节点已设置
- ✅ 至少 1 个 Active NFT（除了 `burnTokensFromSwap`）

