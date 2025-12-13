# API 测试指南

## 测试 getUserInviteCodes API

### 1. 基本 GET 请求测试

```bash
# 测试后端服务是否运行
curl -X GET https://nodes-back.enclave-hq.com/api/invite-codes/user/0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638 \
  -H "Content-Type: application/json" \
  -v
```

### 2. 测试 CORS 预检请求（OPTIONS）

```bash
# 测试 OPTIONS 预检请求
curl -X OPTIONS https://nodes-back.enclave-hq.com/api/invite-codes/user/0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638 \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v
```

### 3. 模拟浏览器请求（带 Origin 头）

```bash
# 模拟从前端发起的请求
curl -X GET https://nodes-back.enclave-hq.com/api/invite-codes/user/0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638 \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Content-Type: application/json" \
  -v
```

### 4. 测试健康检查端点

```bash
# 测试后端健康检查
curl -X GET https://nodes-back.enclave-hq.com/api/health \
  -H "Origin: https://nodes.enclave-hq.com" \
  -v
```

### 5. 测试本地后端（如果可以直接访问）

```bash
# 如果后端在本地运行
curl -X GET http://localhost:4000/api/invite-codes/user/0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638 \
  -H "Origin: https://nodes.enclave-hq.com" \
  -v
```

## 预期响应

### 成功响应（有邀请码）

```json
{
  "inviteCodeStatus": "approved",
  "usedInviteCode": {
    "id": 1,
    "code": "ABC123",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "ownedInviteCodes": [
    {
      "id": 1,
      "code": "ABC123",
      "status": "active",
      "maxUses": null,
      "usageCount": 5,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pendingInviteCodes": []
}
```

### 成功响应（没有邀请码）

```json
{
  "inviteCodeStatus": "none",
  "usedInviteCode": null,
  "ownedInviteCodes": [],
  "pendingInviteCodes": []
}
```

### CORS 响应头（应该包含）

```
Access-Control-Allow-Origin: https://nodes.enclave-hq.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
Access-Control-Allow-Headers: Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Cache-Control, Accept
```

## 诊断步骤

### 如果返回 502 Bad Gateway

1. **检查后端服务状态**
   ```bash
   docker ps | grep node-nft-backend
   docker logs node-nft-backend --tail 50
   ```

2. **检查后端是否监听端口**
   ```bash
   netstat -tlnp | grep 4000
   curl http://localhost:4000/api/health
   ```

3. **检查 Nginx 配置**
   ```bash
   sudo nginx -t
   sudo tail -f /var/log/nginx/nodes-back.enclave-hq.com.error.log
   ```

### 如果返回 CORS 错误

1. **检查后端 CORS 配置**
   - 查看后端日志中的 CORS 配置
   - 确认 `https://nodes.enclave-hq.com` 在允许的源列表中

2. **检查 Nginx CORS 配置**
   - 确认 Nginx 配置中包含 CORS 头
   - 参考 `nginx.conf.example` 文件

### 如果返回 404 Not Found

- 检查 API 路径是否正确：`/api/invite-codes/user/:address`
- 检查后端路由配置

### 如果返回 500 Internal Server Error

- 查看后端日志：`docker logs node-nft-backend --tail 100`
- 检查数据库连接
- 检查环境变量配置

## 快速测试脚本

```bash
#!/bin/bash
# test-api.sh

ADDRESS="0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638"
API_URL="https://nodes-back.enclave-hq.com/api/invite-codes/user/${ADDRESS}"

echo "🔍 Testing API: ${API_URL}"
echo ""

echo "1. Testing OPTIONS (CORS preflight)..."
curl -X OPTIONS "${API_URL}" \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Access-Control-Request-Method: GET" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control)"

echo ""
echo "2. Testing GET request..."
curl -X GET "${API_URL}" \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Content-Type: application/json" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control|inviteCodeStatus)"
```



















