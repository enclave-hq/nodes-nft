# 🚨 紧急安全修复 - 私钥泄露

## ⚠️ 严重警告

发现以下真实的私钥和密钥被提交到 Git 历史中：

### 泄露的敏感信息

1. **ADMIN_PRIVATE_KEY**: `081aff1d67452734b48e99357182bb52062d660349577c2883e9e733afc6c616`
2. **ADMIN_PRIVATE_KEY**: `1975121600000000000000000000000000000000000000000000000000000017`
3. **DEPLOYER_PRIVATE_KEY**: `29c30c751477e428dde0bfb591ee184b9eb962a08274f60ac1469772901456ce`
4. **JWT_SECRET**: `d0cc6930dc825b069b782ea043ead04b473a33ec33d5afb5e5e03716539a4419d2a869f35e84a480765e09a9df63db9a307c675637519e5f7abcb6bbc6c13b14`

### 泄露的文件

- `backend/.env.prod` (提交: b59d4a5)
- `backend/.env.testnet` (提交: b59d4a5)
- `backend/.env.bak` (提交: b59d4a5, 198e3f6)
- `contracts/.env.back` (提交: b59d4a5)

## ⚡ 立即执行的紧急步骤

### 1. 立即轮换所有泄露的密钥（最高优先级！）

```bash
# 如果这些私钥对应的地址中有资金，立即转移！
# 生成新私钥并更新所有服务配置
```

**必须立即执行：**
- [ ] 检查所有使用这些私钥的地址余额
- [ ] 立即将资金转移到新地址
- [ ] 生成新的 ADMIN_PRIVATE_KEY
- [ ] 生成新的 DEPLOYER_PRIVATE_KEY
- [ ] 生成新的 JWT_SECRET
- [ ] 更新所有生产环境配置

### 2. 从 Git 历史中完全删除敏感文件

**方法 1: 使用 git filter-repo（推荐）**

```bash
cd /Users/qizhongzhu/enclave/node-nft

# 安装 git-filter-repo
# macOS: brew install git-filter-repo
# 或: pip install git-filter-repo

# 从整个 Git 历史中删除文件
git filter-repo --path backend/.env.prod --invert-paths
git filter-repo --path backend/.env.testnet --invert-paths
git filter-repo --path backend/.env.bak --invert-paths
git filter-repo --path contracts/.env.back --invert-paths

# 强制推送到远程（⚠️ 警告：这会重写历史）
git push origin --force --all
git push origin --force --tags
```

**方法 2: 使用 BFG Repo-Cleaner（更快）**

```bash
# 下载 BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files backend/.env.prod
java -jar bfg.jar --delete-files backend/.env.testnet
java -jar bfg.jar --delete-files backend/.env.bak
java -jar bfg.jar --delete-files contracts/.env.back
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

**方法 3: 使用 git filter-branch（如果上述工具不可用）**

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env.prod backend/.env.testnet backend/.env.bak contracts/.env.back" \
  --prune-empty --tag-name-filter cat -- --all

git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

git push origin --force --all
git push origin --force --tags
```

### 3. 通知所有团队成员

- [ ] 立即通知所有有仓库访问权限的成员
- [ ] 要求他们删除本地仓库并重新克隆
- [ ] 要求他们更改所有可能泄露的凭据
- [ ] 如果仓库是公开的，立即设为私有

### 4. 检查 GitHub 安全警告

- [ ] 登录 GitHub，检查 Security 页面
- [ ] 查看是否有 Secret Scanning 警告
- [ ] 如果仓库是公开的，检查是否有安全警告邮件

### 5. 验证修复

```bash
# 验证文件已从历史中删除
git log --all --full-history -- backend/.env.prod backend/.env.testnet backend/.env.bak contracts/.env.back

# 应该没有输出，如果有输出说明还有残留
```

## 🔍 检查其他可能的泄露

运行以下命令检查是否还有其他敏感信息：

```bash
cd /Users/qizhongzhu/enclave/node-nft

# 检查所有提交中的私钥（64字符十六进制）
git log --all -p | grep -E "0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64}" | \
  grep -v "commit\|Author\|Date\|example\|your\|change" | \
  sort -u

# 检查所有配置文件
git log --all --name-only | grep -E "\.env|config\.yaml" | sort -u
```

## 📋 已完成的修复

✅ 已从 Git 索引中移除敏感文件
✅ 已更新 `.gitignore` 忽略所有 `.env.*` 变体
✅ 已创建紧急修复指南

## ⚠️ 重要提醒

1. **不要**只是删除文件，必须从 Git 历史中完全清除
2. **不要**在提交消息中提及敏感信息
3. **不要**使用 `git rm --cached`，这不会从历史中删除
4. **必须**使用 `git filter-repo`、`BFG` 或 `git filter-branch` 来清理历史
5. **必须**强制推送才能从远程删除历史

## 🔐 预防措施

1. **使用环境变量**：所有敏感信息必须从环境变量读取
2. **使用 .gitignore**：确保所有配置文件都被忽略
3. **使用 pre-commit hooks**：检查提交中是否包含敏感信息
4. **使用 Secret Scanning**：启用 GitHub 的 Secret Scanning 功能
5. **代码审查**：所有提交必须经过代码审查

## 📞 需要帮助？

如果发现资金被盗或需要紧急帮助：
1. 立即联系安全团队
2. 考虑使用专业的安全审计服务
3. 报告给相关安全机构

---

**最后更新**: $(date)
**状态**: 🚨 紧急 - 需要立即处理























