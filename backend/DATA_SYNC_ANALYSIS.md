# 后端数据与合约数据对应关系分析

## 📊 数据对应关系（已更新）

### 设计原则

**✅ 正确做法：**
- **合约是唯一数据源**：所有状态数据（批次、白名单、NFT数量）直接从合约读取
- **数据库只存储**：
  - 历史记录（用于查询和分析）
  - 不在链上的数据（如邀请码）
  - 元数据（如邀请码关联、NFT追溯信息等）

**❌ 错误做法：**
- 在数据库中维护状态数据的副本
- 依赖数据库作为数据源进行查询

---

### 1. Batch（批次）数据

#### 合约端（NFTManager.sol）
```solidity
// 合约状态（可直接查询）
mapping(uint256 => Batch) public batches;
uint256 public currentBatchId;

// 查询函数
function getCurrentBatchId() external view returns (uint256);
function getActiveBatch() external view returns (uint256);
function batches(uint256) external view returns (Batch memory);
```

#### 后端实现

**查询批次：**
```typescript
// ✅ 直接从合约读取
async findAll() {
  const contractBatches = await this.contractService.getAllBatches();
  return contractBatches; // 返回合约真实状态
}
```

**创建批次：**
```typescript
// 1. 调用合约创建
const txHash = await this.contractService.createBatch(maxMintable, mintPrice);

// 2. 从合约读取创建后的状态
const contractBatch = await this.contractService.getBatch(batchId);

// 3. 保存到数据库作为历史记录（不是数据源）
await this.prisma.batch.create({ ... });
```

**数据一致性：**
- ✅ **查询时**：直接从合约读取，保证数据准确
- ✅ **创建/激活后**：从合约读取状态，保存到数据库作为历史记录
- ✅ **数据库作用**：历史记录、审计日志、快速索引

---

### 2. Whitelist（白名单）数据

#### 合约端（NFTManager.sol）
```solidity
// 合约状态（可直接查询）
mapping(address => bool) public whitelist;
uint256 public whitelistCount;

// 查询函数
function isWhitelisted(address user) external view returns (bool);
function getWhitelistCount() external view returns (uint256);
```

#### 后端实现

**查询白名单状态：**
```typescript
// ✅ 直接从合约读取
async checkWhitelistStatus(address: string): Promise<boolean> {
  return await this.contractService.isWhitelisted(address);
}
```

**获取白名单列表：**
```typescript
// ⚠️ 合约不支持枚举，使用数据库历史记录作为索引
// 但每个地址都验证合约状态
async getWhitelist(page, limit) {
  // 1. 从数据库历史记录获取地址列表（作为索引）
  const historyRecords = await this.prisma.whitelistHistory.findMany(...);
  
  // 2. 验证每个地址的合约状态（过滤已移除的地址）
  const verifiedAddresses = [];
  for (const record of historyRecords) {
    const isWhitelisted = await this.contractService.isWhitelisted(record.address);
    if (isWhitelisted) {
      verifiedAddresses.push(record.address);
    }
  }
  
  return verifiedAddresses;
}
```

**数据一致性：**
- ✅ **状态查询**：直接从合约读取
- ✅ **列表查询**：使用数据库历史记录作为索引，但验证合约状态
- ✅ **数据库作用**：历史记录、快速索引（因为合约不支持枚举）

---

### 3. NFT 数据

#### 合约端（NFTManager.sol + NodeNFT.sol）
```solidity
// 合约状态（可直接查询）
uint256 public totalMinted;
mapping(uint256 => NFTPool) public nftPools;
mapping(address => uint256[]) public userNFTList;

// 查询函数
function totalMinted() external view returns (uint256);
function getUserNFTs(address user) external view returns (uint256[]);
function getNFTPool(uint256 nftId) external view returns (...);
```

#### 后端实现

**查询NFT数量：**
```typescript
// ✅ 直接从合约读取
async getTotalMinted(): Promise<bigint> {
  return await this.contractService.getTotalMinted();
}
```

**查询用户NFT：**
```typescript
// ✅ 直接从合约读取
async getUserNFTs(address: string): Promise<bigint[]> {
  return await this.contractService.readContract('getUserNFTs', [address]);
}
```

**数据库作用：**
- ✅ **NftRecord表**：存储元数据（邀请码关联、追溯信息等），不存储状态
- ✅ **历史记录**：记录铸造事件、交易历史等

---

### 4. InviteCode（邀请码）数据

#### 合约端
- ❌ **不在合约上**：邀请码完全由后端管理，不在链上

#### 后端数据库（InviteCode 表）
```prisma
model InviteCode {
  id                    Int      @id @default(autoincrement())
  code                  String   @unique @db.VarChar(50)
  applicantAddress      String   @db.VarChar(42)
  // ... 其他字段
}
```

#### ✅ 数据一致性
- ✅ **完全后端管理**：邀请码不在链上，所以没有一致性问题
- ✅ **数据库是唯一数据源**：所有邀请码数据都在数据库中

---

## 🔍 当前数据同步机制（已更新）

### 1. 查询操作（Contract ← Backend）

**所有状态查询都直接从合约读取：**

```typescript
// 批次查询
const batches = await this.contractService.getAllBatches();

// 白名单状态查询
const isWhitelisted = await this.contractService.isWhitelisted(address);

// NFT数量查询
const totalMinted = await this.contractService.getTotalMinted();
```

**优点：**
- ✅ 数据始终准确，反映合约真实状态
- ✅ 不需要同步机制
- ✅ 不会出现数据不一致

### 2. 写入操作（Backend → Contract → Database）

**写入流程：**
1. 调用合约方法
2. 等待交易确认
3. 从合约读取最新状态
4. 保存到数据库作为历史记录

```typescript
// 创建批次
const txHash = await this.contractService.createBatch(...);
const contractBatch = await this.contractService.getBatch(batchId);
await this.prisma.batch.create({ ... }); // 历史记录
```

**优点：**
- ✅ 数据库记录与合约状态一致
- ✅ 有交易哈希，可以追溯
- ✅ 数据库作为历史记录和审计日志

---

## ✅ 数据一致性保证

### 1. 查询时实时验证

所有查询操作都直接从合约读取，不依赖数据库：

```typescript
// ✅ 正确：从合约读取
async getBatch(batchId: bigint) {
  return await this.contractService.getBatch(batchId);
}

// ❌ 错误：从数据库读取
async getBatch(batchId: bigint) {
  return await this.prisma.batch.findFirst({ where: { batchId } });
}
```

### 2. 数据库只存储历史记录

数据库不维护状态数据，只存储：
- 历史记录（用于查询和分析）
- 元数据（邀请码关联、NFT追溯信息等）
- 审计日志（操作记录、交易哈希等）

### 3. 合约是唯一数据源

所有状态数据都以合约为准：
- 批次信息 → `batches(batchId)`
- 白名单状态 → `whitelist(address)`
- NFT数量 → `totalMinted`
- 用户NFT列表 → `getUserNFTs(address)`

---

## 📋 数据对应关系总结（已更新）

| 数据类型 | 合约状态 | 后端数据库 | 查询方式 | 一致性保证 |
|---------|---------|-----------|---------|-----------|
| **Batch** | ✅ 有 | ✅ 历史记录 | ✅ 从合约读取 | ✅ 实时准确 |
| **Whitelist** | ✅ 有 | ✅ 历史记录 | ✅ 从合约读取 | ✅ 实时准确 |
| **NFT** | ✅ 有 | ✅ 元数据 | ✅ 从合约读取 | ✅ 实时准确 |
| **InviteCode** | ❌ 无 | ✅ 唯一数据源 | ✅ 从数据库读取 | ✅ 无风险 |

---

## 🎯 实现要点

### 1. ContractService 扩展

添加了以下查询方法：
- `getAllBatches()` - 获取所有批次
- `getBatch(batchId)` - 获取单个批次
- `getCurrentBatchId()` - 获取当前批次ID
- `getTotalMinted()` - 获取总铸造数
- `getWhitelistCount()` - 获取白名单数量

### 2. 服务层更新

- **BatchesService**：查询时从合约读取，创建/激活后从合约读取状态
- **WhitelistService**：状态查询从合约读取，列表查询使用数据库索引但验证合约状态
- **NftsService**：所有查询从合约读取

### 3. 数据库作用

- ✅ **历史记录**：记录所有操作历史
- ✅ **元数据**：存储不在链上的数据（邀请码关联等）
- ✅ **审计日志**：记录操作者、交易哈希等
- ✅ **快速索引**：为不支持枚举的合约数据提供索引（如白名单列表）

---

## ✅ 总结

**核心原则：合约是唯一数据源，数据库只存储历史记录和元数据。**

这样设计的好处：
1. ✅ **数据始终准确**：查询时直接从合约读取
2. ✅ **无需同步机制**：不需要事件监听或定期同步
3. ✅ **简单可靠**：减少数据不一致的风险
4. ✅ **审计友好**：数据库保留完整的历史记录
