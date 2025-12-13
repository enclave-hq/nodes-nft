-- 创建数据库脚本
-- 使用方法：psql -U zhuqizhong -h localhost -d postgres -f create-database.sql

-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE "node-nft"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'node-nft')\gexec

-- 显示创建结果
SELECT 'Database "node-nft" created successfully' AS result;












