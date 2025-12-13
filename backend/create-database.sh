#!/bin/bash
# 创建数据库脚本

echo "📦 创建 PostgreSQL 数据库..."

# 从 .env 文件中提取数据库信息
DB_NAME=$(grep "^DATABASE_URL" .env | sed -E 's/.*\/([^?]+).*/\1/' | tr -d '"')
DB_USER=$(grep "^DATABASE_URL" .env | sed -E 's/.*:\/\/([^:]+):.*/\1/' | tr -d '"')
DB_HOST=$(grep "^DATABASE_URL" .env | sed -E 's/.*@([^:]+):.*/\1/' | tr -d '"')
DB_PORT=$(grep "^DATABASE_URL" .env | sed -E 's/.*:([0-9]+)\/.*/\1/' | tr -d '"')

echo "数据库名: $DB_NAME"
echo "用户名: $DB_USER"
echo "主机: $DB_HOST"
echo "端口: $DB_PORT"
echo ""

# 检查数据库是否已存在
if psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "✅ 数据库 '$DB_NAME' 已存在"
else
    echo "🔄 创建数据库 '$DB_NAME'..."
    createdb -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" "$DB_NAME" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 数据库 '$DB_NAME' 创建成功"
    else
        echo "❌ 数据库创建失败，请手动创建："
        echo "   createdb -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME"
        echo "   或者使用 psql："
        echo "   psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c 'CREATE DATABASE \"$DB_NAME\";'"
        exit 1
    fi
fi

echo ""
echo "🔄 运行 Prisma 迁移..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 数据库设置完成！"
else
    echo ""
    echo "❌ 迁移失败，请检查错误信息"
    exit 1
fi
