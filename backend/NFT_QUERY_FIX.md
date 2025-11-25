# NFT 查询修复说明

## 📋 问题

`getNFTsByUser()` 方法之前从数据库查询 NFT，导致数据不准确：

### 问题原因

1. **数据库中的 `ownerAddress` 可能已过时**
   - NFT 可能已经转移给其他用户
   - 数据库不会自动更新所有者信息
   - 导致查询结果不准确

2. **数据不一致**
   - 合约是唯一真实数据源
   - 数据库只存储元数据（邀请码关联、历史记录等）

## ✅ 修复方案

### 1. 在 `ContractService` 中添加 `getUserNFTs()` 方法

```typescript
/**
 * Get all NFT IDs owned by a user (from chain)
 * @param userAddress User address
 * @returns Array of NFT IDs owned by the user
 */
async getUserNFTs(userAddress: string): Promise<number[]> {
  try {
    const nftIds = await this.readContract<bigint[]>('getUserNFTs', [userAddress]);
    return nftIds.map(id => Number(id));
  } catch (error: any) {
    console.error(`Error reading contract getUserNFTs for ${userAddress}:`, error);
    throw error;
  }
}
```

### 2. 修改 `NftsService.getNFTsByUser()` 方法

**新的查询流程**：

1. **从合约查询 NFT ID 列表**（实时准确）
   ```typescript
   const nftIds = await this.contractService.getUserNFTs(address);
   ```

2. **从数据库查询元数据**（邀请码关联等）
   ```typescript
   const records = await this.prisma.nftRecord.findMany({
     where: { nftId: { in: nftIds } },
     include: { inviteCode: true, rootInviteCode: true },
   });
   ```

3. **合并数据返回完整信息**
   - 使用合约数据作为主要数据源（实时准确）
   - 使用数据库数据补充元数据（邀请码关联等）

4. **错误处理**
   - 如果合约查询失败，回退到数据库查询（虽然可能不准确，但至少能返回数据）

## 🔄 数据流对比

### 修复前（❌ 不准确）

```
用户请求 → 数据库查询 (ownerAddress) → 返回结果
         ↓
    可能已过时的数据
```

### 修复后（✅ 准确）

```
用户请求 → 合约查询 (getUserNFTs) → 获取实时 NFT ID 列表
         ↓
    数据库查询 (元数据) → 合并数据 → 返回完整信息
```

## 📊 数据源说明

| 数据类型 | 数据源 | 说明 |
|---------|--------|------|
| **NFT ID 列表** | 合约 | 实时准确，反映当前所有者 |
| **所有者地址** | 合约 | 实时准确 |
| **邀请码关联** | 数据库 | 元数据，不会变化 |
| **铸造历史** | 数据库 | 历史记录 |
| **追溯信息** | 数据库 | 元数据 |

## ✅ 优势

1. **数据实时准确**
   - 从合约查询，反映链上真实状态
   - 不会出现数据不一致问题

2. **包含完整信息**
   - 状态数据从合约获取（实时）
   - 元数据从数据库获取（补充信息）

3. **容错处理**
   - 如果合约查询失败，会回退到数据库查询
   - 确保服务可用性

## 🧪 测试建议

1. **测试正常流程**
   ```bash
   # 查询用户拥有的 NFT
   GET /admin/nfts/user/0x...
   ```

2. **测试 NFT 转移后**
   - 转移 NFT 给其他用户
   - 查询原用户：应该不包含已转移的 NFT
   - 查询新用户：应该包含新获得的 NFT

3. **测试合约查询失败**
   - 模拟 RPC 连接失败
   - 应该回退到数据库查询

## 📝 相关文件

- `backend/src/modules/contract/contract.service.ts` - 添加 `getUserNFTs()` 方法
- `backend/src/modules/nfts/nfts.service.ts` - 修复 `getNFTsByUser()` 方法
- `backend/src/modules/nfts/nfts.controller.ts` - 控制器（无需修改）

## 🔗 相关文档

- [DATA_SYNC_ANALYSIS.md](./DATA_SYNC_ANALYSIS.md) - 数据同步分析
- [DIAMOND_PATTERN_GUIDE.md](./DIAMOND_PATTERN_GUIDE.md) - Diamond Pattern 使用指南

