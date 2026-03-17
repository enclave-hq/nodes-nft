#!/bin/bash
# Quick Fix Script for CORS and 502 Errors
# Usage: ./quick-fix-cors-502.sh

set -e

echo "=========================================="
echo "🔧 CORS 和 502 错误快速修复脚本"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Step 1: Check backend container
echo "📦 步骤 1: 检查后端容器状态..."
if docker ps | grep -q node-nft-backend; then
    print_status 0 "后端容器正在运行"
    CONTAINER_RUNNING=1
else
    print_status 1 "后端容器未运行"
    CONTAINER_RUNNING=0
    
    echo -e "${YELLOW}⚠️  尝试启动后端容器...${NC}"
    if command -v docker-compose &> /dev/null; then
        cd "$(dirname "$0")/.." 2>/dev/null || cd /path/to/node-nft
        docker-compose up -d backend 2>/dev/null && sleep 5 || true
    else
        docker start node-nft-backend 2>/dev/null && sleep 5 || true
    fi
    
    if docker ps | grep -q node-nft-backend; then
        print_status 0 "后端容器已启动"
        CONTAINER_RUNNING=1
    else
        print_status 1 "无法启动后端容器，请手动检查"
        echo "查看日志: docker logs node-nft-backend"
    fi
fi

# Step 2: Check backend port
echo ""
echo "🔌 步骤 2: 检查后端端口 4000..."
if netstat -tlnp 2>/dev/null | grep -q ":4000 " || ss -tlnp 2>/dev/null | grep -q ":4000 "; then
    print_status 0 "端口 4000 正在监听"
    PORT_LISTENING=1
else
    print_status 1 "端口 4000 未监听"
    PORT_LISTENING=0
    
    if [ $CONTAINER_RUNNING -eq 1 ]; then
        echo -e "${YELLOW}⚠️  后端容器运行中但端口未监听，查看日志...${NC}"
        docker logs node-nft-backend --tail 20
    fi
fi

# Step 3: Test backend health
echo ""
echo "🏥 步骤 3: 测试后端健康检查..."
if curl -s -f http://localhost:4000/api/health > /dev/null 2>&1; then
    print_status 0 "后端健康检查通过"
    BACKEND_HEALTHY=1
else
    print_status 1 "后端健康检查失败"
    BACKEND_HEALTHY=0
    
    if [ $CONTAINER_RUNNING -eq 1 ]; then
        echo -e "${YELLOW}⚠️  查看后端日志...${NC}"
        docker logs node-nft-backend --tail 30
    fi
fi

# Step 4: Check Nginx configuration
echo ""
echo "⚙️  步骤 4: 检查 Nginx 配置..."
NGINX_CONFIG="/etc/nginx/sites-available/nodes-back.enclave-hq.com"

if [ -f "$NGINX_CONFIG" ]; then
    print_status 0 "Nginx 配置文件存在: $NGINX_CONFIG"
    
    # Check if CORS headers are configured with 'always'
    if grep -q "add_header.*Access-Control-Allow-Origin.*always" "$NGINX_CONFIG"; then
        print_status 0 "CORS 配置包含 'always' 参数"
    else
        print_status 1 "CORS 配置缺少 'always' 参数（错误响应时可能没有 CORS 头）"
        echo -e "${YELLOW}⚠️  建议更新 Nginx 配置，参考: backend/nginx.conf.example${NC}"
    fi
    
    # Check proxy_pass
    if grep -q "proxy_pass.*127.0.0.1:4000" "$NGINX_CONFIG" || grep -q "proxy_pass.*backend:4000" "$NGINX_CONFIG"; then
        print_status 0 "proxy_pass 配置存在"
    else
        print_status 1 "proxy_pass 配置可能有问题"
    fi
else
    print_status 1 "Nginx 配置文件不存在: $NGINX_CONFIG"
    echo -e "${YELLOW}⚠️  请创建配置文件或检查路径${NC}"
fi

# Step 5: Test Nginx configuration
echo ""
echo "🧪 步骤 5: 测试 Nginx 配置语法..."
if sudo nginx -t > /dev/null 2>&1; then
    print_status 0 "Nginx 配置语法正确"
    NGINX_CONFIG_VALID=1
else
    print_status 1 "Nginx 配置语法错误"
    NGINX_CONFIG_VALID=0
    echo "错误详情:"
    sudo nginx -t
fi

# Step 6: Reload Nginx if needed
if [ $NGINX_CONFIG_VALID -eq 1 ]; then
    echo ""
    echo "🔄 步骤 6: 重新加载 Nginx..."
    if sudo systemctl reload nginx > /dev/null 2>&1 || sudo service nginx reload > /dev/null 2>&1; then
        print_status 0 "Nginx 已重新加载"
    else
        print_status 1 "Nginx 重新加载失败"
    fi
fi

# Step 7: Test API endpoint
echo ""
echo "🌐 步骤 7: 测试 API 端点..."
API_URL="https://nodes-back.enclave-hq.com/api/health"
if curl -s -f -o /dev/null -w "%{http_code}" "$API_URL" | grep -q "200\|502"; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
    if [ "$HTTP_CODE" = "200" ]; then
        print_status 0 "API 端点响应正常 (200)"
    else
        print_status 1 "API 端点返回 $HTTP_CODE"
        echo -e "${YELLOW}⚠️  如果返回 502，说明后端服务未运行或 Nginx 无法连接后端${NC}"
    fi
    
    # Check CORS headers
    echo ""
    echo "🔍 检查 CORS 响应头..."
    CORS_HEADER=$(curl -s -I -H "Origin: https://nodes.enclave-hq.com" "$API_URL" | grep -i "access-control-allow-origin" || echo "")
    if [ -n "$CORS_HEADER" ]; then
        print_status 0 "CORS 响应头存在: $CORS_HEADER"
    else
        print_status 1 "CORS 响应头缺失"
        echo -e "${YELLOW}⚠️  即使返回 502，也应该有 CORS 头。请检查 Nginx 配置。${NC}"
    fi
else
    print_status 1 "无法访问 API 端点"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 诊断总结"
echo "=========================================="

if [ $CONTAINER_RUNNING -eq 1 ] && [ $PORT_LISTENING -eq 1 ] && [ $BACKEND_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✅ 后端服务正常${NC}"
else
    echo -e "${RED}❌ 后端服务有问题${NC}"
    echo "   请检查:"
    echo "   - 容器是否运行: docker ps | grep backend"
    echo "   - 端口是否监听: netstat -tlnp | grep 4000"
    echo "   - 后端日志: docker logs node-nft-backend"
fi

if [ $NGINX_CONFIG_VALID -eq 1 ]; then
    echo -e "${GREEN}✅ Nginx 配置正确${NC}"
else
    echo -e "${RED}❌ Nginx 配置有问题${NC}"
    echo "   请检查: sudo nginx -t"
fi

echo ""
echo "📚 更多信息请参考: backend/CORS_502_FIX.md"
echo ""























