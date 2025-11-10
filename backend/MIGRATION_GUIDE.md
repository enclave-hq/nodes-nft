# 数据库迁移指南

## ⚠️ 重要：不会丢失数据

**不要选择 reset！** 这会删除所有数据。

## 当前情况

- 数据库中的 `admins` 表只有旧字段：`id`, `address`, `createdAt`
- Schema 文件有新字段：`username`, `passwordHash`, `totpSecret`, `totpEnabled`, `updatedAt`
- 需要安全地添加新字段，保留现有数据

## 安全迁移步骤

### 方法 1：使用 Prisma Migrate（推荐）

```bash
cd node-nft/backend

# 1. 标记现有迁移为已应用（已完成）
npx prisma migrate resolve --applied 20251106170418_init

# 2. 创建新迁移来添加字段
npx prisma migrate dev --name update_admins_auth

# 这会：
# - 检测 schema 变化
# - 生成迁移 SQL
# - 应用迁移到数据库
# - 保留所有现有数据
```

### 方法 2：手动 SQL 迁移（如果需要更多控制）

如果 Prisma 生成的迁移不够灵活，可以手动创建：

```sql
-- 1. 添加新字段（先设为可空）
ALTER TABLE "admins" 
ADD COLUMN IF NOT EXISTS "username" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "totpSecret" VARCHAR(32),
ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. 为现有记录设置临时值（如果有数据）
UPDATE "admins" 
SET 
  "username" = COALESCE("username", 'admin_' || SUBSTRING("address" FROM 3 FOR 8)),
  "passwordHash" = COALESCE("passwordHash", '$2b$10$PLACEHOLDER_REQUIRES_RESET'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "username" IS NULL;

-- 3. 设为非空
ALTER TABLE "admins" 
ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "passwordHash" SET NOT NULL;

-- 4. address 改为可空
ALTER TABLE "admins" 
ALTER COLUMN "address" DROP NOT NULL;

-- 5. 添加唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "admins_username_key" ON "admins"("username");
```

### 方法 3：使用 db push（开发环境，不推荐生产）

```bash
# 这会直接同步 schema，不创建迁移文件
npx prisma db push
```

## 迁移后操作

### 1. 检查现有管理员数据

```sql
SELECT id, address, username, "passwordHash" FROM admins;
```

### 2. 为现有管理员创建账户

如果有基于 `address` 的旧管理员，需要：

**选项 A：创建新账户**
```bash
npm run create-admin <new_username> <new_password>
```

**选项 B：更新现有记录**
```sql
-- 更新现有记录的 username 和 passwordHash
UPDATE admins 
SET 
  username = 'your_username',
  passwordHash = '$2b$10$...' -- 使用 bcrypt 哈希的密码
WHERE address = '0x...';
```

### 3. 验证迁移

```bash
# 检查迁移状态
npx prisma migrate status

# 重新生成 Prisma Client
npm run prisma:generate

# 测试连接
npm run start:dev
```

## 注意事项

1. ✅ **备份数据库**（如果可能）
2. ✅ **在测试环境先验证**
3. ✅ **现有管理员需要重新设置密码**
4. ✅ **address 字段保留为可选，用于向后兼容**

## 故障排除

### 如果迁移失败

```bash
# 检查迁移状态
npx prisma migrate status

# 查看迁移历史
ls -la prisma/migrations/

# 如果需要回滚（谨慎使用）
npx prisma migrate resolve --rolled-back <migration_name>
```

### 如果字段冲突

如果某些字段已经存在，迁移会失败。可以：

1. 检查数据库当前结构
2. 修改迁移 SQL 使用 `IF NOT EXISTS`
3. 或者手动调整数据库结构

