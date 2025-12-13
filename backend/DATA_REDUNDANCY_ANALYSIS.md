# 数据冗余分析

## 数据关系图

```
InviteCodeUsage (使用记录)
  ↓ (userAddress -> inviteCodeId)
InviteCodeRequest.referrerInviteCodeId (推荐人邀请码ID)
  ↓ (referrerInviteCodeId -> InviteCode.id)
InviteCode.parentInviteCodeId (父邀请码ID)
  ↓ (递归计算)
InviteCode.level, rootInviteCodeId, rootApplicantAddress
```

## 冗余字段分析

### 1. `InviteCodeRequest.referrerInviteCodeId`
**是否冗余：是**
- **可以从 `InviteCodeUsage` 表查询**：
  ```sql
  SELECT invite_code_id 
  FROM invite_code_usage 
  WHERE user_address = applicant_address 
  ORDER BY created_at ASC 
  LIMIT 1
  ```
- **建议**：移除该字段，查询时动态获取

### 2. `InviteCode.parentInviteCodeId`
**是否冗余：部分冗余**
- **可以从 `InviteCodeRequest.referrerInviteCodeId` 获取**（而 `referrerInviteCodeId` 可以从 `InviteCodeUsage` 获取）
- **但**：这是核心关系字段，保留可以：
  - 提高查询性能（避免每次都要 JOIN `InviteCodeUsage`）
  - 保持数据一致性（即使 `InviteCodeUsage` 被删除，关系仍然存在）
- **建议**：保留，但可以通过 `InviteCodeUsage` 重建

### 3. `InviteCode.level`
**是否冗余：是**
- **可以从 `parentInviteCode.level + 1` 递归计算**
- **建议**：可以移除，查询时动态计算（但会影响性能）

### 4. `InviteCode.rootInviteCodeId`
**是否冗余：是**
- **可以从 `parentInviteCode.rootInviteCodeId || parentInviteCode.id` 递归计算**
- **建议**：可以移除，查询时动态计算（但会影响性能，因为需要递归查询）

### 5. `InviteCode.rootApplicantAddress`
**是否冗余：是**
- **可以从 `parentInviteCode.rootApplicantAddress || parentInviteCode.applicantAddress` 递归计算**
- **建议**：可以移除，查询时动态计算（但会影响性能）

## 建议方案

### 方案1：完全去冗余（性能较差）
- 移除所有冗余字段
- 查询时动态计算
- **缺点**：每次查询都需要 JOIN 和递归计算，性能差

### 方案2：保留核心关系，移除计算字段（推荐）
- **保留**：`InviteCode.parentInviteCodeId`（核心关系）
- **移除**：`InviteCodeRequest.referrerInviteCodeId`（可以从 `InviteCodeUsage` 查询）
- **移除**：`InviteCode.level`, `rootInviteCodeId`, `rootApplicantAddress`（可以递归计算）
- **优点**：减少冗余，但保留核心关系，性能可接受

### 方案3：保留所有字段作为缓存（当前方案）
- 保留所有字段
- 作为查询缓存，提高性能
- **缺点**：数据冗余，需要维护一致性

## 推荐方案

**推荐方案2**：
1. 移除 `InviteCodeRequest.referrerInviteCodeId`，改为查询时从 `InviteCodeUsage` 获取
2. 保留 `InviteCode.parentInviteCodeId`（核心关系）
3. 移除 `InviteCode.level`, `rootInviteCodeId`, `rootApplicantAddress`，改为查询时递归计算
4. 如果性能有问题，可以考虑添加视图或物化视图











