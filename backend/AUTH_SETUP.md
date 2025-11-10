# 管理员认证设置指南

## 概述

管理端现在使用**用户名+密码+TOTP验证码**的登录方式，替代了之前的钱包地址登录。

## 数据库迁移

### 1. 更新 Prisma Schema

Schema 已经更新，需要运行迁移：

```bash
cd backend
npm run migration:generate
npm run migration:run
```

### 2. 创建管理员账户

使用提供的脚本创建第一个管理员：

```bash
npm run create-admin <username> <password>
```

例如：
```bash
npm run create-admin admin mySecurePassword123
```

**注意**：
- 用户名至少 3 个字符
- 密码至少 8 个字符
- 建议使用强密码

## 安装依赖

确保已安装所有必要的依赖：

```bash
cd backend
npm install
```

新增的依赖：
- `bcrypt` - 密码哈希
- `speakeasy` - TOTP 生成和验证
- `qrcode` - QR 码生成（用于 TOTP 设置）

## 登录流程

### 1. 基本登录（无 TOTP）

如果管理员未启用 TOTP，只需输入用户名和密码即可登录。

### 2. 启用 TOTP（推荐）

1. 调用 `/admin/auth/totp/setup` API，传入用户名和密码
2. 获取 TOTP secret 和 QR 码
3. 使用身份验证器应用（如 Google Authenticator、Authy）扫描 QR 码
4. 输入验证码，调用 `/admin/auth/totp/enable` 启用 TOTP

### 3. 登录（已启用 TOTP）

如果管理员已启用 TOTP，登录时需要：
1. 用户名
2. 密码
3. TOTP 验证码（6 位数字）

## API 端点

### 登录
```
POST /admin/auth/login
Body: {
  "username": "admin",
  "password": "password",
  "totpCode": "123456" // 可选，如果启用了 TOTP 则必需
}
```

### 设置 TOTP
```
POST /admin/auth/totp/setup
Body: {
  "username": "admin",
  "password": "password"
}
Response: {
  "secret": "base32_secret",
  "qrCode": "data:image/png;base64,...",
  "otpauthUrl": "otpauth://totp/..."
}
```

### 启用 TOTP
```
POST /admin/auth/totp/enable
Body: {
  "username": "admin",
  "password": "password",
  "totpCode": "123456",
  "secret": "base32_secret"
}
```

### 禁用 TOTP
```
POST /admin/auth/totp/disable
Body: {
  "username": "admin",
  "password": "password"
}
```

## 前端使用

所有管理端页面（`/admin/*`）现在使用统一的 `AdminLogin` 组件：

- `/admin/stats` - 数据统计
- `/admin/users` - 用户管理
- `/admin/batches` - 批次管理
- `/admin/whitelist` - 白名单管理
- `/admin/nfts` - NFT 追溯
- `/admin/invite-codes` - 邀请码管理

登录页面会自动显示 TOTP 输入框（如果启用了 TOTP）。

## 安全建议

1. ✅ **启用 TOTP**：强烈建议所有管理员启用 TOTP 双因素认证
2. ✅ **强密码**：使用至少 12 位字符的强密码
3. ✅ **定期更换密码**：建议每 3-6 个月更换一次密码
4. ✅ **保护 TOTP Secret**：不要分享 TOTP secret 或 QR 码
5. ✅ **JWT Secret**：确保 `JWT_SECRET` 环境变量使用强随机字符串

## 迁移现有管理员

如果之前有基于钱包地址的管理员，需要：

1. 创建新的用户名密码账户
2. 可选：将旧的钱包地址关联到新账户（`address` 字段已保留为可选）

## 故障排除

### 登录失败
- 检查用户名和密码是否正确
- 如果启用了 TOTP，确保验证码正确且未过期（30 秒有效期）
- 检查数据库连接是否正常

### TOTP 验证失败
- 确保系统时间同步（TOTP 依赖时间）
- 检查验证码是否在有效时间窗口内（允许 ±2 个时间步）
- 确认 TOTP secret 正确

### 数据库错误
- 确保已运行 Prisma 迁移
- 检查 `DATABASE_URL` 环境变量
- 运行 `npm run prisma:generate` 重新生成 Prisma Client

