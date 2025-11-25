# 奖励分配策略分析

## 问题

当 NFT 没有全部铸造完成（总量 5000 个）时，`distributeProduced` 和 `distributeReward` 的分配策略需要明确。

## 两种方案对比

### 方案 1：总是按 5000 个 NFT 分配 + Vault ✅ 推荐

**原理**：无论实际铸造了多少 NFT，都按 5000 个 NFT 来分配奖励。未铸造 NFT 的奖励部分存入 Vault。

**优点**：
- ✅ **可预测**：每个 NFT 的奖励是固定的（按 5000 分配）
- ✅ **公平**：所有 NFT 获得相同的奖励（无论何时铸造）
- ✅ **灵活性**：Vault 中的奖励可以：
  - 等新 NFT 铸造后分配给新 NFT
  - 如果 NFT 永远不铸造，可以用于其他用途（销毁、分配给其他 NFT 等）
- ✅ **简单**：分发逻辑固定，不需要动态计算

**缺点**：
- ❌ 如果只铸造了 1000 个，每个 NFT 获得的奖励会减少（因为按 5000 分配）
- ❌ 需要额外的 Vault 机制

**示例**：
```
分发 1000 $E 奖励（80% = 800 $E）
- 按 5000 分配：每个 NFT = 800 / 5000 = 0.16 $E
- 如果只铸造了 1000 个：实际分配 1000 * 0.16 = 160 $E
- Vault 中保留：4000 * 0.16 = 640 $E
- 当新 NFT 铸造时，可以从 Vault 中领取累积的奖励
```

---

### 方案 2：按当前已铸造数量分配

**原理**：按照当前实际铸造的 NFT 数量来分配奖励。

**优点**：
- ✅ 已铸造的 NFT 获得更多奖励（因为按实际数量分配）
- ✅ 简单：不需要 Vault 机制

**缺点**：
- ❌ **不可预测**：每个 NFT 的奖励取决于当前铸造数量
- ❌ **不公平**：早期 NFT 获得更多奖励，后期 NFT 获得更少奖励
- ❌ **需要修复**：新 NFT 不应该获得旧奖励（需要初始化逻辑）

**示例**：
```
分发 1000 $E 奖励（80% = 800 $E）
- 如果只铸造了 1000 个：每个 NFT = 800 / 1000 = 0.8 $E
- 如果铸造了 2000 个：每个 NFT = 800 / 2000 = 0.4 $E
- 问题：早期 NFT 获得更多奖励，不公平
```

---

## 推荐方案：方案 1（按 5000 分配 + Vault）

### 理由

1. **公平性**：所有 NFT 获得相同的奖励，无论何时铸造
2. **可预测性**：每个 NFT 的奖励是固定的，便于用户理解
3. **灵活性**：Vault 中的奖励可以灵活处理
4. **长期性**：即使 NFT 没有全部铸造，奖励分配也是公平的

### 实现方案

#### 1. 添加 Vault 状态变量

```solidity
/// @notice Vault for unclaimed rewards (for unminted NFTs)
/// @dev Vault stores rewards for NFTs that haven't been minted yet
mapping(address => uint256) public vaultRewards; // token => amount
```

#### 2. 修改分发逻辑

```solidity
function distributeProduced(uint256 totalAmount) external onlyOracle nonReentrant {
    // ... 现有代码 ...
    
    // Calculate distribution: 80% to NFTs, 20% to multisig node
    uint256 nftAmount = (totalAmount * 80) / 100;
    
    // ✅ 修改：按 MAX_SUPPLY (5000) 分配，而不是 totalActiveNFTs
    uint256 rewardPerNFT = nftAmount / MAX_SUPPLY;
    
    // Update global index for all NFTs (including unminted ones)
    globalState.accProducedPerNFT += rewardPerNFT;
    
    // Calculate actual distribution to minted NFTs
    uint256 distributedToNFTs = rewardPerNFT * globalState.totalActiveNFTs;
    
    // Store remaining in vault (for unminted NFTs)
    uint256 vaultAmount = nftAmount - distributedToNFTs;
    if (vaultAmount > 0) {
        // Vault rewards are stored in the contract balance
        // They can be claimed by newly minted NFTs
    }
    
    // ... 其余代码 ...
}
```

#### 3. 新 NFT 铸造时的处理

```solidity
function mintNFT() external nonReentrant returns (uint256) {
    // ... 现有代码 ...
    
    // ✅ 新 NFT 可以领取 Vault 中累积的奖励
    // producedWithdrawn 初始化为当前的 accProducedPerNFT
    // 这样新 NFT 可以领取从它被铸造时开始的所有奖励（包括 Vault 中的）
    pool.producedWithdrawn = globalState.accProducedPerNFT;
    
    // ... 其余代码 ...
}
```

#### 4. Vault 奖励管理

```solidity
/// @notice Get vault balance for a specific token
function getVaultBalance(address token) external view returns (uint256) {
    return vaultRewards[token];
}

/// @notice Owner can manage vault rewards (e.g., burn, redistribute)
function manageVaultRewards(address token, uint256 amount, address to) external onlyOwner {
    require(vaultRewards[token] >= amount, "Insufficient vault balance");
    vaultRewards[token] -= amount;
    
    if (token == address(eclvToken)) {
        eclvToken.transfer(to, amount);
    } else {
        IERC20(token).safeTransfer(to, amount);
    }
}
```

---

## 实现细节

### 修改 `distributeProduced`

```solidity
function distributeProduced(uint256 totalAmount) external onlyOracle nonReentrant {
    require(totalAmount > 0, "Amount must be positive");
    require(multisigNode != address(0), "Multisig node not set");
    require(globalState.totalActiveNFTs > 0, "No active NFTs");
    
    // Calculate distribution: 80% to NFTs, 20% to multisig node
    uint256 nftAmount = (totalAmount * 80) / 100;
    uint256 multisigAmount = totalAmount - nftAmount;
    
    // ✅ 按 MAX_SUPPLY (5000) 分配
    uint256 rewardPerNFT = nftAmount / MAX_SUPPLY;
    
    // Update global index (all NFTs, including unminted ones)
    globalState.accProducedPerNFT += rewardPerNFT;
    
    // Calculate actual distribution to minted NFTs
    uint256 distributedToNFTs = rewardPerNFT * globalState.totalActiveNFTs;
    
    // Mine tokens to NFTManager contract
    if (distributedToNFTs > 0) {
        eclvToken.mineTokens(address(this), distributedToNFTs);
    }
    
    // Calculate vault amount (for unminted NFTs)
    uint256 vaultAmount = nftAmount - distributedToNFTs;
    if (vaultAmount > 0) {
        // Mine to contract (vault)
        eclvToken.mineTokens(address(this), vaultAmount);
        // Vault is stored in contract balance, can be claimed by new NFTs
    }
    
    // Mine tokens directly to multisig node (20%)
    if (multisigAmount > 0) {
        eclvToken.mineTokens(multisigNode, multisigAmount);
    }
    
    globalState.lastUpdateTime = block.timestamp;
    
    emit MiningDistributed(totalAmount, nftAmount, multisigAmount);
    emit ProducedDistributed(nftAmount, globalState.accProducedPerNFT, block.timestamp);
    emit VaultUpdated(address(eclvToken), vaultAmount); // New event
}
```

### 修改 `distributeReward`

```solidity
function distributeReward(address token, uint256 amount) external onlyOracle nonReentrant {
    require(amount > 0, "Amount must be positive");
    require(isRewardToken[token], "Token not supported");
    require(multisigNode != address(0), "Multisig node not set");
    require(globalState.totalActiveNFTs > 0, "No active NFTs");
    
    // Calculate distribution: 80% to NFTs, 20% to multisig node
    uint256 nftAmount = (amount * 80) / 100;
    uint256 multisigAmount = amount - nftAmount;
    
    // Transfer reward token from oracle to this contract
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    
    // Accumulate multisig reward
    multisigRewardDistributed[token] += multisigAmount;
    
    // ✅ 按 MAX_SUPPLY (5000) 分配
    uint256 rewardPerNFT = nftAmount / MAX_SUPPLY;
    
    // Update global index (all NFTs, including unminted ones)
    globalState.accRewardPerNFT[token] += rewardPerNFT;
    
    // Calculate actual distribution to minted NFTs
    uint256 distributedToNFTs = rewardPerNFT * globalState.totalActiveNFTs;
    
    // Vault amount (for unminted NFTs) is stored in contract balance
    // New NFTs can claim from vault when minted
    uint256 vaultAmount = nftAmount - distributedToNFTs;
    
    globalState.lastUpdateTime = block.timestamp;
    
    emit RewardDistributed(token, amount, nftAmount, multisigAmount, globalState.accRewardPerNFT[token], block.timestamp);
    emit VaultUpdated(token, vaultAmount); // New event
}
```

---

## 总结

**推荐使用方案 1（按 5000 分配 + Vault）**，因为：
1. ✅ 公平：所有 NFT 获得相同的奖励
2. ✅ 可预测：每个 NFT 的奖励是固定的
3. ✅ 灵活：Vault 中的奖励可以灵活处理
4. ✅ 长期：即使 NFT 没有全部铸造，奖励分配也是公平的

**需要修改**：
- `distributeProduced`：按 MAX_SUPPLY (5000) 分配
- `distributeReward`：按 MAX_SUPPLY (5000) 分配
- 添加 Vault 相关的事件和查询函数
- 新 NFT 铸造时，`producedWithdrawn` 和 `rewardWithdrawn` 初始化为当前累积值（已修复）

