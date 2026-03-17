# 移除冗余字段迁移指南

## 概述

根据数据冗余分析，以下字段可以从其他表重建，属于冗余数据：

1. `InviteCodeRequest.referrerInviteCodeId` - 可以从 `InviteCodeUsage` 表查询
2. `InviteCode.level` - 可以从 `parentInviteCodeId` 递归计算
3. `InviteCode.rootInviteCodeId` - 可以从 `parentInviteCodeId` 递归计算
4. `InviteCode.rootApplicantAddress` - 可以从 `parentInviteCodeId` 递归计算

## 代码修改状态

### ✅ 已完成

1. **`createRequest` 方法**：
   - 不再存储 `referrerInviteCodeId`（设为 null）
   - 改为从 `InviteCodeUsage` 表动态获取

2. **`approveRequest` 方法**：
   - 使用 `calculateInviteCodeHierarchy` 动态计算层级信息
   - 虽然仍存储这些字段（向后兼容），但逻辑已改为动态计算

3. **查询方法**：
   - `findAll`: 动态计算 `level`, `rootInviteCodeId`, `rootApplicantAddress`
   - `findOne`: 动态计算层级信息
   - `findAllRequests`: 动态获取 `referrerInviteCodeId`

4. **辅助函数**：
   - `getReferrerInviteCodeId()`: 从 `InviteCodeUsage` 获取推荐人邀请码
   - `calculateInviteCodeHierarchy()`: 递归计算层级信息

### ⚠️ 注意事项

1. **向后兼容**：
   - 目前仍保留字段存储（用于向后兼容）
   - 所有查询逻辑已改为动态计算
   - 字段值可能与动态计算的值不一致（旧数据）

2. **性能考虑**：
   - 动态计算会增加查询时间
   - 如果性能有问题，可以考虑：
     - 添加数据库视图
     - 使用物化视图缓存
     - 在应用层缓存计算结果

3. **其他服务依赖**：
   - `revenue.service.ts` 仍在使用 `rootInviteCodeId` 字段
   - 需要评估是否可以改为动态计算

## 数据库迁移（可选）

如果确定要移除这些字段，可以创建迁移脚本：

```sql
-- 迁移脚本：移除冗余字段
-- 注意：执行前请备份数据库

-- 1. 移除 InviteCodeRequest.referrerInviteCodeId
ALTER TABLE invite_code_requests 
DROP COLUMN IF EXISTS referrer_invite_code_id;

-- 2. 移除 InviteCode 的冗余字段（可选，建议保留作为缓存）
-- ALTER TABLE invite_codes 
-- DROP COLUMN IF EXISTS level,
-- DROP COLUMN IF EXISTS root_invite_code_id,
-- DROP COLUMN IF EXISTS root_applicant_address;
```

## 建议

1. **短期**：保持当前状态（字段保留但逻辑改为动态计算）
2. **中期**：监控性能，如果性能可接受，可以考虑移除字段
3. **长期**：如果性能有问题，考虑使用数据库视图或缓存机制

## 测试建议

1. 测试新申请流程（应该自动检测推荐人）
2. 测试查询性能（动态计算是否影响性能）
3. 测试旧数据兼容性（旧数据是否仍能正常工作）

































