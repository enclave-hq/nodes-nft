# 权限管理系统文档

## 概述

`NFTManager` 合约实现了三角色权限管理系统：

1. **master** - 主管理员（等同于原来的 Owner）
2. **oracle_multisig** - Oracle 多签地址（等同于原来的 oracle）
3. **operator** - 操作员（新增，用于提取 Vault 资产）

---

## 角色定义

### 1. Master（主管理员）

**权限**：
- ✅ 所有原来 Owner 的权限
- ✅ 可以设置其他角色（oracle_multisig, operator）
- ✅ 可以升级合约
- ✅ 可以管理所有配置

**设置**：
- 初始化时：`master = owner()`（部署者）
- 只能由 Owner 设置：`setMaster(address)`

**权限范围**：
- 白名单管理（`addToWhitelist`, `removeFromWhitelist`）
- 批次管理（`createBatch`, `activateBatch`, `deactivateBatch`）
- 合约配置（`setOracle`, `setTreasury`, `setNodeNFT`, `setUsdtToken`, `setMultisigNode`）
- 奖励代币管理（`addRewardToken`, `removeRewardToken`）
- 转账控制（`setTransfersEnabled`）
- TGE 设置（`setTgeTime`）
- 市场费率设置（`setMarketFeeRate`）
- Minter 设置（`setMinter`, `batchSetMinters`）
- 合约升级（`_authorizeUpgrade`）

---

### 2. Oracle Multisig（Oracle 多签）

**权限**：
- ✅ 分发 $E 生产奖励（`distributeProduced`）
- ✅ 分发奖励代币（`distributeReward`）
- ✅ 销毁回购代币（`burnTokensFromSwap`）

**设置**：
- 初始化时：`oracleMultisig = oracle`（与 oracle 相同）
- 只能由 Master 或 Owner 设置：`setOracleMultisig(address)`

**权限范围**：
- `distributeProduced(uint256 totalAmount)` - 分发 $E 生产奖励
- `distributeReward(address token, uint256 amount)` - 分发奖励代币
- `burnTokensFromSwap(uint256 amount, string memory reason)` - 销毁回购代币

**注意**：
- `oracle` 和 `oracleMultisig` 都可以调用 Oracle 相关函数
- 如果 `oracle` 和 `oracleMultisig` 不同，两者都可以分发奖励

---

### 3. Operator（操作员）

**权限**：
- ✅ 提取 Vault 资产（`extractVaultRewards`）

**设置**：
- 初始化时：`operator = address(0)`（未设置）
- 只能由 Master 或 Owner 设置：`setOperator(address)`
- 可以设置为 `address(0)` 来禁用操作员

**权限范围**：
- `extractVaultRewards(address token, uint256 amount, address to)` - 提取 Vault 资产

**安全特性**：
- 只能提取 Vault 中的资产（`vaultRewards[token]`）
- 确保提取后，合约余额仍然足够支付所有待领取的奖励
- 通过 `_calculateTotalPendingClaims` 计算所有 Active NFT 的待领取余额总和

---

## 权限设置函数

### setMaster

```solidity
function setMaster(address master_) external onlyOwner
```

- **调用者**：只有 Owner 可以调用
- **功能**：设置 Master 地址
- **限制**：`master_` 不能为 `address(0)`

### setOracleMultisig

```solidity
function setOracleMultisig(address oracleMultisig_) external onlyMaster
```

- **调用者**：Master 或 Owner
- **功能**：设置 Oracle Multisig 地址
- **限制**：`oracleMultisig_` 不能为 `address(0)`

### setOperator

```solidity
function setOperator(address operator_) external onlyMaster
```

- **调用者**：Master 或 Owner
- **功能**：设置 Operator 地址
- **限制**：可以设置为 `address(0)` 来禁用操作员

---

## 权限修饰符

### onlyMaster

```solidity
modifier onlyMaster() {
    require(msg.sender == master || msg.sender == owner(), "Only master or owner");
    _;
}
```

- **允许**：Master 或 Owner
- **用途**：所有原来 `onlyOwner` 的函数

### onlyOracle

```solidity
modifier onlyOracle() {
    require(msg.sender == oracle || msg.sender == oracleMultisig, "Only oracle or oracle multisig");
    _;
}
```

- **允许**：Oracle 或 Oracle Multisig
- **用途**：分发奖励相关函数

### onlyOperator

```solidity
modifier onlyOperator() {
    require(msg.sender == operator, "Only operator");
    _;
}
```

- **允许**：Operator
- **用途**：提取 Vault 资产函数

---

## 事件

```solidity
event MasterSet(address indexed master);
event OracleMultisigSet(address indexed oracleMultisig);
event OperatorSet(address indexed operator);
```

---

## 使用示例

### 初始化

```solidity
// 部署合约时
nftManager.initialize(nodeNFT, eclvToken, usdtToken, oracle, treasury);

// 初始化后：
// - master = owner() (部署者)
// - oracleMultisig = oracle
// - operator = address(0) (未设置)
```

### 设置角色

```solidity
// Owner 设置 Master
nftManager.setMaster(masterAddress);

// Master 设置 Oracle Multisig
nftManager.setOracleMultisig(oracleMultisigAddress);

// Master 设置 Operator
nftManager.setOperator(operatorAddress);

// Master 禁用 Operator
nftManager.setOperator(address(0));
```

### 使用权限

```solidity
// Master 管理白名单
nftManager.addToWhitelist([user1, user2]);

// Oracle Multisig 分发奖励
nftManager.distributeProduced(1000 * 10**18);

// Operator 提取 Vault 资产
nftManager.extractVaultRewards(tokenAddress, amount, recipientAddress);
```

---

## 权限矩阵

| 功能 | Master | Oracle Multisig | Operator | Owner |
|------|--------|-----------------|----------|-------|
| 设置 Master | ❌ | ❌ | ❌ | ✅ |
| 设置 Oracle Multisig | ✅ | ❌ | ❌ | ✅ |
| 设置 Operator | ✅ | ❌ | ❌ | ✅ |
| 白名单管理 | ✅ | ❌ | ❌ | ✅ |
| 批次管理 | ✅ | ❌ | ❌ | ✅ |
| 合约配置 | ✅ | ❌ | ❌ | ✅ |
| 分发奖励 | ❌ | ✅ | ❌ | ❌ |
| 提取 Vault | ❌ | ❌ | ✅ | ❌ |
| 合约升级 | ✅ | ❌ | ❌ | ✅ |

---

## 安全考虑

1. **Master 权限**：
   - Master 拥有所有管理权限
   - 只能由 Owner 设置，防止权限滥用
   - Master 和 Owner 都可以执行管理操作（向后兼容）

2. **Oracle Multisig 权限**：
   - 只能分发奖励，不能提取资产
   - 与 Oracle 地址分离，支持多签控制

3. **Operator 权限**：
   - 只能提取 Vault 资产
   - 有安全检查，确保不会影响待领取的奖励
   - 可以设置为 `address(0)` 来禁用

4. **向后兼容**：
   - Owner 仍然可以执行所有 Master 的操作
   - Oracle 仍然可以分发奖励（如果 `oracleMultisig` 未设置或相同）

---

## 迁移指南

### 从旧版本升级

1. **设置 Master**：
   ```solidity
   nftManager.setMaster(newMasterAddress);
   ```

2. **设置 Oracle Multisig**（如果需要）：
   ```solidity
   nftManager.setOracleMultisig(oracleMultisigAddress);
   ```

3. **设置 Operator**（如果需要）：
   ```solidity
   nftManager.setOperator(operatorAddress);
   ```

### 权限转移

- **转移 Master 权限**：Owner 调用 `setMaster(newMaster)`
- **转移 Oracle Multisig 权限**：Master 调用 `setOracleMultisig(newOracleMultisig)`
- **转移 Operator 权限**：Master 调用 `setOperator(newOperator)`

---

## 总结

权限管理系统提供了三个独立的角色：

1. **Master** - 主管理员，拥有所有管理权限
2. **Oracle Multisig** - Oracle 多签，用于分发奖励
3. **Operator** - 操作员，用于提取 Vault 资产

这种设计实现了职责分离，提高了安全性和灵活性。

