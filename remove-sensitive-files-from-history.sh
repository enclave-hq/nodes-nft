#!/bin/bash
# 从 Git 历史中删除敏感文件的脚本
# 警告：这会重写 Git 历史，需要强制推送

set -e

echo "🚨 警告：此操作将重写 Git 历史！"
echo "请确保："
echo "1. 已备份所有重要数据"
echo "2. 已通知所有团队成员"
echo "3. 已轮换所有泄露的密钥"
echo ""
read -p "确认继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 1
fi

echo "开始清理 Git 历史..."

# 检查是否安装了 git-filter-repo
if command -v git-filter-repo &> /dev/null; then
    echo "使用 git-filter-repo..."
    echo "从 Git 历史中删除以下文件："
    echo "  - backend/.env.prod"
    echo "  - backend/.env.testnet"
    echo "  - backend/.env.bak"
    echo "  - contracts/.env.back"
    echo ""
    
    # 一次性删除所有文件（更高效）
    git filter-repo \
      --path backend/.env.prod \
      --path backend/.env.testnet \
      --path backend/.env.bak \
      --path contracts/.env.back \
      --invert-paths \
      --force
elif command -v java &> /dev/null && [ -f "bfg.jar" ]; then
    echo "使用 BFG Repo-Cleaner..."
    java -jar bfg.jar --delete-files backend/.env.prod
    java -jar bfg.jar --delete-files backend/.env.testnet
    java -jar bfg.jar --delete-files backend/.env.bak
    java -jar bfg.jar --delete-files contracts/.env.back
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
else
    echo "使用 git filter-branch..."
    git filter-branch --force --index-filter \
      "git rm --cached --ignore-unmatch backend/.env.prod backend/.env.testnet backend/.env.bak contracts/.env.back" \
      --prune-empty --tag-name-filter cat -- --all
    
    git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
fi

echo ""
echo "✅ Git 历史清理完成"
echo ""
echo "⚠️  下一步："
echo "1. 验证文件已从历史中删除："
echo "   git log --all --full-history -- backend/.env.prod"
echo ""
echo "2. 强制推送到远程（⚠️ 会重写远程历史）："
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. 通知所有团队成员删除本地仓库并重新克隆"
