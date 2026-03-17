#!/bin/bash
# 从 Git 历史中替换 .env.example 文件中的真实私钥
# 警告：这会重写 Git 历史

set -e

echo "🚨 警告：此操作将重写 Git 历史！"
echo "将从 backend/.env.example 的历史中替换真实私钥为示例值"
echo ""
read -p "确认继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 1
fi

echo "开始替换 Git 历史中的私钥..."

# 创建替换规则文件
cat > /tmp/replace-rules.txt << 'EOF'
DEPLOYER_PRIVATE_KEY="29c30c751477e428dde0bfb591ee184b9eb962a08274f60ac1469772901456ce"==>DEPLOYER_PRIVATE_KEY="your_deployer_private_key_here"
ADMIN_PRIVATE_KEY="privatekey"==>ADMIN_PRIVATE_KEY="your_admin_private_key_here"
JWT_SECRET="jwt secret"==>JWT_SECRET="your_jwt_secret_here"
EOF

# 使用 git-filter-repo 替换历史中的内容
if command -v git-filter-repo &> /dev/null; then
    echo "使用 git-filter-repo 替换历史中的私钥..."
    git filter-repo \
      --replace-text /tmp/replace-rules.txt \
      --force
else
    echo "错误：需要安装 git-filter-repo"
    echo "安装方法: brew install git-filter-repo 或 pip install git-filter-repo"
    exit 1
fi

# 清理临时文件
rm -f /tmp/replace-rules.txt

echo ""
echo "✅ Git 历史中的私钥已替换"
echo ""
echo "⚠️  下一步："
echo "1. 验证私钥已从历史中删除："
echo "   git log --all -p | grep -E '29c30c751477e428dde0bfb591ee184b9eb962a08274f60ac1469772901456ce'"
echo ""
echo "2. 强制推送到远程（⚠️ 会重写远程历史）："
echo "   git push origin --force --all"
echo "   git push origin --force --tags"























