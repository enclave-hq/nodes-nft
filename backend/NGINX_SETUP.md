# Nginx 配置指南 - nodes-back.enclave-hq.com

## 问题诊断

如果遇到 **502 Bad Gateway** 错误，说明 Nginx 无法连接到后端服务。

### 1. 检查后端服务状态

```bash
# 检查 Docker 容器是否运行
docker ps | grep node-nft-backend

# 检查后端日志
docker logs node-nft-backend

# 或者如果使用 docker-compose
docker-compose ps
docker-compose logs backend
```

### 2. 检查后端服务是否监听端口 4000

```bash
# 在服务器上检查端口
netstat -tlnp | grep 4000
# 或
ss -tlnp | grep 4000

# 测试本地连接
curl http://localhost:4000/api/health
```

### 3. 检查 Nginx 配置

```bash
# 检查 Nginx 配置语法
sudo nginx -t

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/nodes-back.enclave-hq.com.error.log

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/nodes-back.enclave-hq.com.access.log
```

## Nginx 配置步骤

### 1. 复制配置文件

```bash
# 复制示例配置
sudo cp node-nft/backend/nginx.conf.example /etc/nginx/sites-available/nodes-back.enclave-hq.com

# 创建符号链接
sudo ln -s /etc/nginx/sites-available/nodes-back.enclave-hq.com /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t
```

### 2. 根据实际部署调整 proxy_pass

**如果后端在 Docker 容器中（端口映射到主机）：**
```nginx
proxy_pass http://127.0.0.1:4000;
```

**如果后端在 Docker Compose 网络中：**
```nginx
# 需要 Nginx 也在 Docker 网络中，或使用主机端口
proxy_pass http://127.0.0.1:4000;
```

**如果后端在另一台服务器：**
```nginx
proxy_pass http://backend-server-ip:4000;
```

### 3. 配置 SSL 证书

```bash
# 使用 Certbot 获取 SSL 证书
sudo certbot --nginx -d nodes-back.enclave-hq.com
```

### 4. 重启 Nginx

```bash
sudo systemctl reload nginx
# 或
sudo service nginx reload
```

## 常见问题

### 问题 1: 502 Bad Gateway

**原因：**
- 后端服务没有运行
- 端口配置错误
- proxy_pass 地址错误

**解决：**
1. 检查后端服务：`docker ps | grep backend`
2. 检查端口：`netstat -tlnp | grep 4000`
3. 检查 Nginx 配置中的 `proxy_pass` 地址

### 问题 2: CORS 错误

**原因：**
- Nginx 没有正确传递 CORS 头
- 后端 CORS 配置不正确

**解决：**
1. 确保 Nginx 配置中包含 CORS 头（见 nginx.conf.example）
2. 确保后端代码包含 `https://nodes.enclave-hq.com` 在允许的源列表中
3. 检查后端日志中的 CORS 配置

### 问题 3: 连接超时

**原因：**
- 后端响应时间过长
- 超时设置太短

**解决：**
增加 Nginx 超时设置：
```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
```

## 验证配置

### 1. 测试后端健康检查

```bash
# 直接访问后端
curl http://localhost:4000/api/health

# 通过 Nginx 访问
curl https://nodes-back.enclave-hq.com/api/health
```

### 2. 测试 CORS

```bash
# 测试 OPTIONS 预检请求
curl -X OPTIONS https://nodes-back.enclave-hq.com/api/invite-codes/user/0x123 \
  -H "Origin: https://nodes.enclave-hq.com" \
  -H "Access-Control-Request-Method: GET" \
  -v

# 应该返回 204 或 200，并包含 CORS 头
```

### 3. 检查响应头

```bash
curl -I https://nodes-back.enclave-hq.com/api/health \
  -H "Origin: https://nodes.enclave-hq.com"

# 应该看到：
# Access-Control-Allow-Origin: https://nodes.enclave-hq.com
# Access-Control-Allow-Credentials: true
```

## 快速修复步骤

如果遇到 502 错误，按以下步骤操作：

1. **检查后端服务**
   ```bash
   docker ps | grep backend
   docker logs node-nft-backend --tail 50
   ```

2. **重启后端服务**
   ```bash
   docker restart node-nft-backend
   # 或
   docker-compose restart backend
   ```

3. **检查 Nginx 配置**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **查看错误日志**
   ```bash
   sudo tail -f /var/log/nginx/nodes-back.enclave-hq.com.error.log
   ```

## 生产环境检查清单

- [ ] 后端服务正在运行（`docker ps`）
- [ ] 后端监听端口 4000（`netstat -tlnp | grep 4000`）
- [ ] Nginx 配置正确（`sudo nginx -t`）
- [ ] SSL 证书有效（`sudo certbot certificates`）
- [ ] CORS 配置正确（测试 OPTIONS 请求）
- [ ] 后端日志显示 CORS 允许的源包含 `https://nodes.enclave-hq.com`
- [ ] 防火墙允许端口 4000 和 443



















