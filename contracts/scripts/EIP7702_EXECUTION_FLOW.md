# EIP-7702 执行流程

## 执行者（支付 BNB 的地址）

**执行者 = EXECUTOR_PRIVATE_KEY 对应的地址（支付 gas）**

在 EIP-7702 交易中：
- **tx.origin** = 执行者地址（支付 gas）
- **msg.sender** = 目标地址（执行操作）

## 使用步骤

1. 部署代理合约：`npx hardhat run scripts/deploy-eip7702-recovery-proxy.ts --network bscMainnet`
2. 设置环境变量：
   - `EIP7702_PROXY_ADDRESS` - 代理合约地址
   - `TARGET_PRIVATE_KEY` - 目标地址私钥
   - `EXECUTOR_PRIVATE_KEY` - 执行者私钥（支付 gas）
   - `NEW_OWNER_ADDRESS` - 新 Owner 地址
   - `MALICIOUS_VALIDATOR_ADDRESS` - 恶意验证者地址（可选）
3. 执行恢复：`npx hardhat run scripts/execute-eip7702-recovery.ts --network bscMainnet`

