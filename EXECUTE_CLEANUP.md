# 🚀 执行 Git 历史清理 - node-nft 仓库

## 📋 当前状态

✅ 已从 Git 索引中移除敏感文件  
✅ 已更新 `.gitignore`  
✅ 已创建清理脚本  
⏳ **待执行**：从 Git 历史中完全删除  
⏳ **待执行**：强制推送到 GitHub  

## ⚠️ 执行前确认清单

在执行清理脚本之前，请确认：

- [ ] **已轮换所有泄露的密钥**（最高优先级！）
  - ADMIN_PRIVATE_KEY: `081aff1d67452734b48e99357182bb52062d660349577c2883e9e733afc6c616`
  - ADMIN_PRIVATE_KEY: `1975121600000000000000000000000000000000000000000000000000000017`
  - DEPLOYER_PRIVATE_KEY: `29c30c751477e428dde0bfb591ee184b9eb962a08274f60ac1469772901456ce`
  - JWT_SECRET: `d0cc6930dc825b069b782ea043ead04b473a33ec33d5afb5e5e03716539a4419d2a869f35e84a480765e09a9df63db9a307c675637519e5f7abcb6bbc6c13b14`

- [ ] **已检查相关地址的资金**并转移到新地址
- [ ] **已备份重要数据**
- [ ] **已通知所有团队成员**（他们需要重新克隆仓库）

## 🚀 执行步骤

### 步骤 1: 运行清理脚本

```bash
cd /Users/qizhongzhu/enclave/node-nft

# 运行清理脚本
./remove-sensitive-files-from-history.sh
```

脚本会：
1. 要求确认（输入 `yes` 继续）
2. 使用 `git-filter-repo` 从整个 Git 历史中删除敏感文件
3. 清理所有引用和缓存

### 步骤 2: 验证删除

```bash
# 检查文件是否还在历史中（应该没有输出）
git log --all --full-history -- backend/.env.prod backend/.env.testnet backend/.env.bak contracts/.env.back

# 检查私钥是否还在历史中（应该没有输出）
git log --all -p | grep -E "081aff1d67452734b48e99357182bb52062d660349577c2883e9e733afc6c616|29c30c751477e428dde0bfb591ee184b9eb962a08274f60ac1469772901456ce"
```

如果没有输出，说明删除成功 ✅

### 步骤 3: 提交当前修复

```bash
# 提交 .gitignore 的更新和文件删除
git add .gitignore
git commit -m "security: remove sensitive .env files from tracking and update .gitignore"
```

### 步骤 4: 强制推送到 GitHub

**⚠️ 警告：这会重写远程 Git 历史！**

```bash
# 强制推送所有分支
git push origin --force --all

# 强制推送所有标签
git push origin --force --tags
```

### 步骤 5: 通知团队成员

执行强制推送后，必须通知所有团队成员：

```bash
# 所有团队成员需要执行：
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

## 🔍 检查 GitHub

推送后，检查：
- [ ] GitHub 仓库页面是否正常
- [ ] 检查 Security 页面是否有警告
- [ ] 验证敏感文件是否已从历史中消失

## 📝 需要删除的文件

以下文件将从整个 Git 历史中删除：

- `backend/.env.prod` (提交: b59d4a5)
- `backend/.env.testnet` (提交: b59d4a5)
- `backend/.env.bak` (提交: b59d4a5, 198e3f6)
- `contracts/.env.back` (提交: b59d4a5)

## ⚠️ 重要提醒

1. **必须先轮换密钥**：在删除历史之前，必须确保所有泄露的密钥已被轮换
2. **备份重要数据**：虽然不会删除工作目录的文件，但建议备份
3. **通知团队成员**：强制推送后，所有团队成员必须重新克隆仓库
4. **检查 GitHub**：推送后检查 GitHub 是否还有缓存

---

**状态**: ⏳ 准备执行  
**仓库**: `enclave/node-nft`  
**远程**: `git@github-aigen6:enclave-hq/nodes-nft.git`























