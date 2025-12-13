# 数据库设置指南

## 快速设置

### 方法 1：使用 psql 命令（推荐）

```bash
# 1. 连接到 PostgreSQL（需要输入密码）
psql -U zhuqizhong -h localhost -d postgres

# 2. 在 psql 中执行以下 SQL 创建数据库
CREATE DATABASE "node-nft";

# 3. 退出 psql
\q

# 4. 运行 Prisma 迁移创建表结构
cd /Users/qizhongzhu/enclave/node-nft/backend
npx prisma migrate deploy
```

### 方法 2：使用 createdb 命令

```bash
# 创建数据库（需要输入密码）
createdb -U zhuqizhong -h localhost node-nft

# 运行 Prisma 迁移
cd /Users/qizhongzhu/enclave/node-nft/backend
npx prisma migrate deploy
```

### 方法 3：使用环境变量（如果设置了 PGPASSWORD）

```bash
# 设置密码环境变量（临时）
export PGPASSWORD=你的数据库密码

# 创建数据库
createdb -U zhuqizhong -h localhost node-nft

# 运行 Prisma 迁移
cd /Users/qizhongzhu/enclave/node-nft/backend
npx prisma migrate deploy
```

## 验证数据库连接

创建数据库后，验证连接：

```bash
cd /Users/qizhongzhu/enclave/node-nft/backend

# 测试连接
npx prisma db pull --preview-feature

# 或者查看数据库结构
npx prisma studio
```

## 如果数据库已存在

如果数据库已经存在但表结构未创建，直接运行：

```bash
cd /Users/qizhongzhu/enclave/node-nft/backend
npx prisma migrate deploy
```

## 常见问题

### 问题：认证失败

**错误信息**：`Authentication failed against database server`

**解决方案**：
1. 检查 `.env` 文件中的 `DATABASE_URL` 格式是否正确
2. 确认数据库用户名和密码正确
3. 如果数据库有密码，URL 格式应该是：
   ```
   DATABASE_URL="postgresql://用户名:密码@localhost:5432/node-nft?sslmode=disable&TimeZone=Asia/Shanghai"
   ```

### 问题：数据库不存在

**错误信息**：`database "node-nft" does not exist`

**解决方案**：按照上面的方法 1 或 2 创建数据库

### 问题：连接被拒绝

**错误信息**：`connection refused` 或 `No such file or directory`

**解决方案**：
1. 确认 PostgreSQL 服务正在运行
2. 检查端口是否正确（默认 5432）
3. 检查防火墙设置

## 数据库配置说明

当前配置（从 `.env` 文件）：
- **数据库名**: `node-nft`
- **用户名**: `zhuqizhong`
- **主机**: `localhost`
- **端口**: `5432`

如果需要修改，请编辑 `.env` 文件中的 `DATABASE_URL`。












