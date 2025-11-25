# Vault 架构说明

## 当前实现

**Vault 在 NFTManager 合约内部**，不是单独的合约地址。

### 实现方式

1. **记账变量**：
   ```solidity
   mapping(address => uint256) public vaultRewards; // token => accumulated vault amount
   ```
   - 这是一个状态变量，记录每个代币在 Vault 中的数量

2. **代币存储**：
   - 代币实际存储在 **NFTManager 合约的余额**中
   - 通过 `mineTokens(address(this), nftAmount)` 或 `safeTransferFrom` 将代币转入 NFTManager 合约
   - Vault 的代币和已分配但未领取的代币都在同一个合约地址（NFTManager）

3. **工作原理**：
   ```
   NFTManager 合约余额 = 已分配但未领取的代币 + Vault 代币
   vaultRewards[token] = Vault 中的代币数量（记账）
   ```

---

## 两种方案对比

### 方案 1：Vault 在 NFTManager 内部（当前实现）✅

**优点**：
- ✅ **简单**：不需要额外的合约部署
- ✅ **Gas 效率高**：不需要跨合约调用
- ✅ **统一管理**：所有代币在一个合约中，便于管理
- ✅ **安全性**：减少攻击面（只有一个合约）

**缺点**：
- ❌ **混合存储**：Vault 代币和已分配代币在同一个地址，需要记账区分
- ❌ **透明度**：外部无法直接看到 Vault 的独立余额（需要通过 `getVaultBalance()` 查询）

**适用场景**：
- ✅ 推荐用于当前场景
- ✅ Vault 只是记账概念，不需要物理隔离
- ✅ 代币最终都会被 NFT 持有者领取

---

### 方案 2：单独的 Vault 合约

**优点**：
- ✅ **物理隔离**：Vault 代币存储在独立的合约地址
- ✅ **透明度高**：可以直接查询 Vault 合约的余额
- ✅ **职责分离**：NFTManager 负责分发，Vault 负责存储

**缺点**：
- ❌ **复杂度高**：需要部署和管理额外的合约
- ❌ **Gas 成本高**：跨合约调用需要更多 gas
- ❌ **安全性**：增加攻击面（两个合约都需要审计）

**适用场景**：
- ❌ 不推荐用于当前场景
- ✅ 如果 Vault 需要独立的治理机制
- ✅ 如果 Vault 需要支持多种代币的复杂逻辑

---

## 当前实现的工作原理

### 代币流转

```
1. Oracle 调用 distributeProduced(1000 $E)
   ↓
2. 计算：按 5000 分配，每个 NFT = 0.16 $E
   ↓
3. 如果只铸造了 1000 个 NFT：
   - 实际分配：1000 × 0.16 = 160 $E（给已铸造的 NFT）
   - Vault 保留：4000 × 0.16 = 640 $E（给未铸造的 NFT）
   ↓
4. 所有代币（160 + 640 = 800 $E）都挖到 NFTManager 合约
   ↓
5. vaultRewards[address(eclvToken)] += 640 $E（记账）
   ↓
6. NFTManager 合约余额 = 800 $E
   - 其中 160 $E 可以被已铸造的 NFT 领取
   - 其中 640 $E 属于 Vault（等待新 NFT 铸造）
```

### 新 NFT 铸造时

```
1. 用户铸造 NFT #1001
   ↓
2. producedWithdrawn 初始化为当前的 accProducedPerNFT（0.16）
   ↓
3. 新 NFT 可以领取从它被铸造时开始的新奖励
   ↓
4. 如果后续有新的分发，新 NFT 可以领取累积的奖励
   - 这些奖励来自 Vault（通过 accProducedPerNFT 累积）
```

### 查询 Vault 余额

```solidity
// 查询 Vault 中某个代币的余额
uint256 vaultBalance = nftManager.getVaultBalance(tokenAddress);

// 查询 NFTManager 合约的实际余额
uint256 contractBalance = IERC20(tokenAddress).balanceOf(address(nftManager));

// 注意：contractBalance >= vaultBalance
// 因为 contractBalance 还包括已分配但未领取的代币
```

---

## 建议

**推荐使用方案 1（当前实现）**，原因：

1. ✅ **简单高效**：不需要额外的合约部署和维护
2. ✅ **Gas 友好**：所有操作在同一个合约中，gas 成本低
3. ✅ **足够安全**：通过 `vaultRewards` 记账，Owner 可以通过 `manageVaultRewards` 管理
4. ✅ **符合需求**：Vault 只是记账概念，不需要物理隔离

**如果未来需要**：
- 如果 Vault 需要独立的治理机制
- 如果 Vault 需要支持复杂的多签控制
- 如果 Vault 需要与其他协议集成

**可以考虑升级为方案 2**，但当前阶段方案 1 已经足够。

---

## 代码示例

### 当前实现（方案 1）

```solidity
// NFTManager.sol
mapping(address => uint256) public vaultRewards; // 记账变量

function distributeProduced(uint256 totalAmount) external onlyOracle {
    // ... 计算 ...
    uint256 vaultAmount = nftAmount - distributedToNFTs;
    
    // 所有代币都挖到 NFTManager 合约
    eclvToken.mineTokens(address(this), nftAmount);
    
    // 记账：记录 Vault 中的数量
    if (vaultAmount > 0) {
        vaultRewards[address(eclvToken)] += vaultAmount;
    }
}

function getVaultBalance(address token) external view returns (uint256) {
    return vaultRewards[token]; // 返回记账的数量
}
```

### 如果改为方案 2（单独的 Vault 合约）

```solidity
// Vault.sol
contract Vault {
    address public nftManager;
    mapping(address => uint256) public balances;
    
    function deposit(address token, uint256 amount) external {
        require(msg.sender == nftManager, "Only NFTManager");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token] += amount;
    }
}

// NFTManager.sol
Vault public vault;

function distributeProduced(uint256 totalAmount) external onlyOracle {
    // ... 计算 ...
    uint256 vaultAmount = nftAmount - distributedToNFTs;
    
    // 已分配代币挖到 NFTManager
    eclvToken.mineTokens(address(this), distributedToNFTs);
    
    // Vault 代币挖到 Vault 合约
    if (vaultAmount > 0) {
        eclvToken.mineTokens(address(vault), vaultAmount);
        vault.deposit(address(eclvToken), vaultAmount);
    }
}
```

---

## 总结

**当前实现**：Vault 在 NFTManager 合约内部，代币存储在 NFTManager 合约的余额中，通过 `vaultRewards` 记账区分。

**优点**：简单、高效、安全、符合需求。

**建议**：保持当前实现，除非未来有特殊需求。

