# 🚨 从 GitHub 历史中删除敏感文件

## ⚠️ 重要警告

此操作将**重写 Git 历史**，需要：
1. ✅ 已轮换所有泄露的密钥（最高优先级！）
2. ✅ 已通知所有团队成员
3. ✅ 已备份重要数据

## 📋 需要删除的文件

以下文件包含真实的私钥和密钥，必须从整个 Git 历史中删除：

- `backend/.env.prod` - 包含 ADMIN_PRIVATE_KEY 和 JWT_SECRET
- `backend/.env.testnet` - 包含 ADMIN_PRIVATE_KEY
- `backend/.env.bak` - 包含 DEPLOYER_PRIVATE_KEY
- `contracts/.env.back` - 可能包含私钥

## 🚀 执行步骤

### 方法 1: 使用自动化脚本（推荐）

```bash
cd /Users/qizhongzhu/enclave/node-nft

# 运行清理脚本
./remove-sensitive-files-from-history.sh
```

脚本会：
1. 检查是否安装了 git-filter-repo
2. 从整个 Git 历史中删除敏感文件
3. 清理引用和缓存
4. 提供验证和推送指令

### 方法 2: 手动执行

```bash
cd /Users/qizhongzhu/enclave/node-nft

# 使用 git-filter-repo 删除文件
git filter-repo \
  --path backend/.env.prod \
  --path backend/.env.testnet \
  --path backend/.env.bak \
  --path contracts/.env.back \
  --invert-paths \
  --force

# 验证文件已从历史中删除
echo "验证中..."
git log --all --full-history -- backend/.env.prod backend/.env.testnet backend/.env.bak contracts/.env.back

# 如果没有输出，说明删除成功
```

### 方法 3: 使用 BFG Repo-Cleaner

如果 git-filter-repo 不可用，可以使用 BFG：

```bash
# 下载 BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files backend/.env.prod
java -jar bfg.jar --delete-files backend/.env.testnet
java -jar bfg.jar --delete-files backend/.env.bak
java -jar bfg.jar --delete-files contracts/.env.back

git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## ✅ 验证删除

```bash
# 检查文件是否还在历史中（应该没有输出）
git log --all --full-history -- backend/.env.prod backend/.env.testnet backend/.env.bak contracts/.env.back

# 检查私钥是否还在历史中（应该没有输出）
git log --all -p | grep -E "081aff1d67452734b48e99357182bb52062d660349577c2883e9e733afc6c616|29c30c751477e428dde0bfb591ee184b9eb962a08274f60ac1469772901456ce"
```

## 🔄 推送到 GitHub

**⚠️ 警告：这会重写远程 Git 历史！**

```bash
# 强制推送所有分支
git push origin --force --all

# 强制推送所有标签
git push origin --force --tags
```

## 📢 通知团队成员

执行强制推送后，必须通知所有团队成员：

```bash
# 所有团队成员需要：
# 1. 删除本地仓库
rm -rf /path/to/node-nft

# 2. 重新克隆
git clone git@github-aigen6:enclave-hq/nodes-nft.git

# 或者如果已经克隆，强制重置：
cd /path/to/node-nft
git fetch origin
git reset --hard origin/main
git clean -fd
```

## 🔍 检查其他可能的泄露

运行以下命令检查是否还有其他敏感信息：

```bash
# 检查所有提交中的私钥（64字符十六进制）
git log --all -p | grep -E "0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64}" | \
  grep -v "commit\|Author\|Date\|example\|your\|change" | \
  sort -u

# 检查所有配置文件
git log --all --name-only | grep -E "\.env|config\.yaml" | sort -u
```

## 📝 当前状态

- ✅ 已从 Git 索引中移除敏感文件
- ✅ 已更新 `.gitignore` 忽略所有 `.env.*` 变体
- ⏳ **待执行**：从 Git 历史中完全删除
- ⏳ **待执行**：强制推送到 GitHub
- ⏳ **待执行**：通知团队成员

## ⚠️ 重要提醒

1. **必须先轮换密钥**：在删除历史之前，必须确保所有泄露的密钥已被轮换
2. **备份重要数据**：虽然不会删除工作目录的文件，但建议备份
3. **通知团队成员**：强制推送后，所有团队成员必须重新克隆仓库
4. **检查 GitHub**：推送后检查 GitHub 是否还有缓存

---

**最后更新**: $(date)
**状态**: ⏳ 待执行 - 需要手动运行脚本























