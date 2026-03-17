# EIP-7702 紧急恢复方案总结

## ✅ 当前实现

### 核心原理

1. **目标地址是 Owner**：目标地址 `0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6` 是所有合约的 Owner
2. **执行者支付 Gas**：执行者（多签）`0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638` 支付 gas 费用
3. **EIP-7702 授权**：目标地址签名授权给代理合约，临时拥有代理合约的代码
4. **msg.sender = 目标地址**：在 EIP-7702 上下文中，`msg.sender` 是目标地址，可以调用 owner 函数

### 执行流程

```
1. 目标地址签名 EIP-7702 授权
   ↓
2. 执行者（多签）构建 EIP-7702 交易（支付 gas）
   ↓
3. 目标地址临时变成代理合约（拥有代理合约的代码）
   ↓
4. 目标地址调用代理合约的 emergencyRecover()
   ↓
5. msg.sender = 目标地址 ✅
   ↓
6. 代理合约执行：
   - 取消委托（如果需要）
   - 转移所有权（NFT_MANAGER, NODE_NFT, ENCLAVE_TOKEN, TOKEN_VESTING）
```

### 关键代码

#### 1. 代理合约 (`EIP7702RecoveryProxy.sol`)

```solidity
function emergencyRecover(
    address validatorAddress,
    address[] calldata contracts,
    address newOwner
) external {
    // msg.sender = 目标地址（通过 EIP-7702）
    // 可以调用 owner 函数
    IOwnable ownable = IOwnable(contractAddr);
    address currentOwner = ownable.owner();
    require(currentOwner == msg.sender, "Owner mismatch");
    ownable.transferOwnership(newOwner);
}
```

#### 2. NFTManager 特殊处理

```solidity
function _transferNFTManagerOwnership(address nftManager, address newOwner) internal {
    // 通过 nftManagerCut 添加临时 Facet
    OwnerTransferFacet tempFacet = new OwnerTransferFacet();
    
    // 添加 Facet 并通过 _init 参数执行 transferOwnership
    INFTManagerCut(nftManager).nftManagerCut(
        addCut,
        address(tempFacet),
        transferCalldata
    );
}
```

#### 3. 执行脚本 (`execute-eip7702-recovery.ts`)

- 目标地址签名 EIP-7702 授权
- 执行者构建并广播交易
- 验证所有权转移结果

## 📋 执行步骤

### 1. 部署代理合约

```bash
cd /Users/qizhongzhu/enclave/node-nft/contracts
npx hardhat run scripts/deploy-eip7702-recovery-proxy.ts --network bscMainnet
```

### 2. 配置环境变量

在 `.env` 文件中设置：

```bash
EIP7702_PROXY_ADDRESS=<代理合约地址>
TARGET_PRIVATE_KEY=<目标地址私钥>
EXECUTOR_PRIVATE_KEY=<执行者私钥>
NEW_OWNER_ADDRESS=0x4561a736b9663948e06371d19541aa1dc5107e1a
```

### 3. 执行恢复

```bash
npx hardhat run scripts/execute-eip7702-recovery.ts --network bscMainnet
```

## ⚠️ 重要提示

1. **目标地址私钥必须安全**：如果目标地址私钥已泄漏，需要立即执行恢复
2. **执行者必须有足够的 BNB**：用于支付 gas 费用（约 0.001 BNB）
3. **NFTManager 特殊处理**：使用 nftManagerCut 添加临时 Facet 来转移所有权
4. **OwnerTransferFacet 不检查 owner**：因为 nftManagerCut 已经检查了权限

## 🔧 已修复的问题

1. ✅ **Owner mismatch 错误**：移除了 `OwnerTransferFacet` 中的 owner 检查
2. ✅ **NFTManager 转移所有权**：使用 nftManagerCut 添加临时 Facet
3. ✅ **EIP-7702 授权签名**：使用 ethers.SigningKey 确保 v 值正确

## 📊 需要转移所有权的合约

- **NFT_MANAGER**: `0xD9eA9F4B8F24872262568fB2C6133117EC02C774`
- **NODE_NFT**: `0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b`
- **ENCLAVE_TOKEN**: `0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011`
- **TOKEN_VESTING**: `0x67B8927F0835e79632f4622F017915Cb0B9a6c72`

## 🎯 优势

1. **无需目标地址支付 gas**：执行者（多签）支付 gas
2. **msg.sender = 目标地址**：可以自然调用 owner 函数
3. **原子操作**：在一个交易中完成所有操作
4. **安全**：通过 EIP-7702 授权，只有目标地址可以执行























