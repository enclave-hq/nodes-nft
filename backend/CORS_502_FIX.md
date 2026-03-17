# CORS 和 502 错误修复指南

## 问题描述

当访问 `https://nodes-back.enclave-hq.com/api/admin/invite-codes/requests` 时出现：
1. **502 Bad Gateway** - 后端服务不可用
2. **CORS 错误** - 缺少 `Access-Control-Allow-Origin` 头

## 根本原因

502 错误表明 Nginx 无法连接到后端服务（`http://127.0.0.1:4000`）。当后端不可用时，即使 Nginx 配置了 CORS 头，浏览器也可能因为 502 错误而无法看到这些头。

## 快速修复步骤

### 1. 检查后端服务状态

```bash
# 检查 Docker 容器是否运行
docker ps | grep node-nft-backend

# 如果容器没有运行，查看日志
docker logs node-nft-backend --tail 50

# 检查容器状态
docker inspect node-nft-backend | grep -A 10 "State"
```

### 2. 启动后端服务

```bash
# 如果使用 docker-compose
cd /path/to/node-nft
docker-compose up -d backend

# 或者直接启动容器
docker start node-nft-backend

# 检查服务是否正常启动
docker logs node-nft-backend --tail 20
```

### 3. 验证后端服务监听端口

```bash
# 检查端口 4000 是否被监听
netstat -tlnp | grep 4000
# 或
ss -tlnp | grep 4000

# 测试本地连接
curl http://localhost:4000/api/health
```

### 4. 检查并更新 Nginx 配置

```bash
# 1. 检查当前 Nginx 配置位置
sudo ls -la /etc/nginx/sites-enabled/ | grep nodes-back

# 2. 备份当前配置
sudo cp /etc/nginx/sites-available/nodes-back.enclave-hq.com /etc/nginx/sites-available/nodes-back.enclave-hq.com.backup

# 3. 复制新的配置（使用更新后的 nginx.conf.example）
sudo cp /path/to/node-nft/backend/nginx.conf.example /etc/nginx/sites-available/nodes-back.enclave-hq.com

# 4. 根据实际部署调整 proxy_pass 地址
# 编辑配置文件：
sudo nano /etc/nginx/sites-available/nodes-back.enclave-hq.com
# 
# 如果后端在 Docker 容器中（端口映射到主机）：
#   proxy_pass http://127.0.0.1:4000;
#
# 如果后端在 Docker Compose 网络中（Nginx 也在 Docker 中）：
#   proxy_pass http://backend:4000;
#
# 如果后端在另一台服务器：
#   proxy_pass http://backend-server-ip:4000;

# 5. 测试 Nginx 配置
sudo nginx -t

# 6. 如果测试通过，重新加载 Nginx
sudo systemctl reload nginx
# 或
sudo service nginx reload
```

### 5. 验证修复

```bash
# 测试 OPTIONS 预检请求（应该返回 204 和 CORS 头）
curl -X OPTIONS https://nodes-back.enclave-hq.com/api/admin/invite-codes/requests \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Access-Control-Request-Method: GET" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control)"

# 测试 GET 请求（如果后端运行，应该返回数据；如果后端未运行，应该返回 502 但包含 CORS 头）
curl -X GET https://nodes-back.enclave-hq.com/api/admin/invite-codes/requests \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control)"
```

## 配置要点

### Nginx CORS 配置关键点

1. **必须使用 `always` 参数**：确保在错误响应（502, 503）时也添加 CORS 头
   ```nginx
   add_header 'Access-Control-Allow-Origin' 'https://nodes.enclave-hq.com' always;
   ```

2. **OPTIONS 预检请求处理**：必须在 `proxy_pass` 之前处理 OPTIONS 请求
   ```nginx
   if ($request_method = 'OPTIONS') {
       # ... CORS headers ...
       return 204;
   }
   ```

3. **proxy_pass 地址**：根据实际部署环境调整
   - Docker 容器（端口映射）：`http://127.0.0.1:4000`
   - Docker Compose 网络：`http://backend:4000`
   - 远程服务器：`http://backend-ip:4000`

### 后端 CORS 配置

确保后端 `main.ts` 中包含前端域名：

```typescript
const defaultOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001',
  'https://nodes.enclave-hq.com' // Production frontend domain
];
```

## 常见问题排查

### 问题 1: 后端服务启动失败

**检查：**
```bash
docker logs node-nft-backend --tail 100
```

**可能原因：**
- 数据库连接失败
- 环境变量缺失
- 端口被占用
- 依赖服务未启动

### 问题 2: Nginx 502 但后端正常运行

**检查：**
```bash
# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/nodes-back.enclave-hq.com.error.log

# 检查 proxy_pass 地址是否正确
sudo grep proxy_pass /etc/nginx/sites-available/nodes-back.enclave-hq.com
```

**可能原因：**
- `proxy_pass` 地址错误
- 防火墙阻止连接
- 后端监听地址不是 `0.0.0.0:4000`

### 问题 3: CORS 头存在但浏览器仍报错

**检查：**
- 浏览器开发者工具 Network 标签，查看响应头
- 确认 `Access-Control-Allow-Origin` 值完全匹配前端域名（包括协议和端口）
- 确认请求包含 `Origin` 头

## 生产环境检查清单

- [ ] 后端服务正在运行（`docker ps | grep backend`）
- [ ] 后端监听端口 4000（`netstat -tlnp | grep 4000`）
- [ ] 后端健康检查通过（`curl http://localhost:4000/api/health`）
- [ ] Nginx 配置正确（`sudo nginx -t`）
- [ ] Nginx 配置已重新加载（`sudo systemctl reload nginx`）
- [ ] OPTIONS 预检请求返回 204 和 CORS 头
- [ ] GET 请求返回数据或 502（但包含 CORS 头）
- [ ] 后端日志显示 CORS 允许的源包含 `https://nodes.enclave-hq.com`
- [ ] 防火墙允许端口 4000 和 443

## 紧急修复脚本

如果问题紧急，可以使用以下脚本快速修复：

```bash
#!/bin/bash
# quick-fix-cors-502.sh

echo "🔍 检查后端服务状态..."
if docker ps | grep -q node-nft-backend; then
    echo "✅ 后端容器正在运行"
else
    echo "❌ 后端容器未运行，正在启动..."
    docker start node-nft-backend || docker-compose up -d backend
    sleep 5
fi

echo "🔍 检查后端端口..."
if netstat -tlnp | grep -q ":4000 "; then
    echo "✅ 端口 4000 正在监听"
else
    echo "❌ 端口 4000 未监听，请检查后端日志"
    docker logs node-nft-backend --tail 20
    exit 1
fi

echo "🔍 测试后端健康检查..."
if curl -s http://localhost:4000/api/health > /dev/null; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端健康检查失败"
    exit 1
fi

echo "🔍 检查 Nginx 配置..."
if sudo nginx -t; then
    echo "✅ Nginx 配置正确"
    echo "🔄 重新加载 Nginx..."
    sudo systemctl reload nginx
    echo "✅ 修复完成"
else
    echo "❌ Nginx 配置有错误，请检查配置文件"
    exit 1
fi
```

保存为 `quick-fix-cors-502.sh`，然后运行：
```bash
chmod +x quick-fix-cors-502.sh
./quick-fix-cors-502.sh
```























