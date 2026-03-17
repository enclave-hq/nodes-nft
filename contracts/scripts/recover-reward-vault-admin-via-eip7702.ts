import { createPublicClient, createWalletClient, http, Address, Hex, keccak256, encodeFunctionData, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { ethers as ethersV5 } from 'ethers';
import * as dotenv from "dotenv";
// @ts-ignore - @ethereumjs/rlp 可能没有类型定义
const RLP = require('@ethereumjs/rlp');

dotenv.config();

/**
 * 通过 EIP-7702 恢复 RewardVault 的 DEFAULT_ADMIN_ROLE
 * 
 * 执行流程：
 * 1. 部署 EIP7702RewardVaultRecoveryProxy 合约
 * 2. 被盗的 admin 地址签名 EIP-7702 授权（授权给代理合约）
 * 3. 执行者构建 EIP-7702 交易（支付 gas）
 * 4. 被盗的 admin 地址临时变成代理合约
 * 5. 被盗的 admin 地址调用代理合约的 recoverRewardVaultAdmin()
 * 6. 代理合约授予新地址 DEFAULT_ADMIN_ROLE 和 OPERATOR_ROLE
 */

const DEFAULT_REWARD_VAULT_ADDRESS = "0xb34AF294558761dcD366ffe998759F2C9BC26a8A";
const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS || DEFAULT_REWARD_VAULT_ADDRESS;
const COMPROMISED_ADMIN_ADDRESS = "0xa80eb088b2844914000bec0d2894a9edf43f0cb6"; // 被盗的 admin 地址
const NEW_ADMIN_ADDRESS = "0x4561a736b9663948e06371d19541aa1dc5107e1a"; // 新的 admin 地址

const MAGIC = 0x05;
const SET_CODE_TX_TYPE = 0x04;

// 辅助函数：构建授权消息
function buildAuthorizationMessage(chainId: bigint, contractAddress: Address, nonce: bigint): string {
  const chainIdBuf = toBuffer(chainId);
  const addressBuf = Buffer.from(contractAddress.slice(2), 'hex');
  const nonceBuf = toBuffer(nonce);
  
  const rlpData = Buffer.from(RLP.encode([chainIdBuf, addressBuf, nonceBuf]));
  const message = Buffer.concat([Buffer.from([MAGIC]), rlpData]);
  return keccak256(`0x${message.toString('hex')}` as Hex);
}

// 辅助函数：将 BigInt 转换为 Buffer
function toBuffer(value: bigint, length?: number): Buffer {
  const hex = value.toString(16);
  const padded = hex.length % 2 === 0 ? hex : '0' + hex;
  let buffer = Buffer.from(padded, 'hex');
  
  if (length && buffer.length < length) {
    const paddedBuffer = Buffer.alloc(length);
    buffer.copy(paddedBuffer, length - buffer.length);
    return paddedBuffer;
  }
  
  return buffer;
}

async function main() {
  const compromisedPrivateKey = process.env.COMPROMISED_ADMIN_PRIVATE_KEY as Hex;
  const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY as Hex;
  
  if (!executorPrivateKey) throw new Error("EXECUTOR_PRIVATE_KEY 未设置（支付 gas 的地址）");
  if (!compromisedPrivateKey) throw new Error("COMPROMISED_ADMIN_PRIVATE_KEY 未设置（需要被盗 admin 地址的私钥来签名授权）");
  
  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  const executorAccount = privateKeyToAccount(executorPrivateKey);
  const compromisedAccount = privateKeyToAccount(compromisedPrivateKey);
  
  // 验证私钥对应的地址
  if (compromisedAccount.address.toLowerCase() !== COMPROMISED_ADMIN_ADDRESS.toLowerCase()) {
    throw new Error(`COMPROMISED_ADMIN_PRIVATE_KEY 对应的地址 ${compromisedAccount.address} 与 COMPROMISED_ADMIN_ADDRESS ${COMPROMISED_ADMIN_ADDRESS} 不匹配`);
  }
  
  console.log("🔐 账户信息:");
  console.log("   被盗的 Admin 地址:", COMPROMISED_ADMIN_ADDRESS);
  console.log("   新 Admin 地址:", NEW_ADMIN_ADDRESS);
  console.log("   执行者地址:", executorAccount.address, "(支付 gas)");
  console.log("   RewardVault:", REWARD_VAULT_ADDRESS);
  console.log("");

  // 创建 Public Client 和 Wallet Client
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });
  
  const walletClient = createWalletClient({
    account: executorAccount,
    chain: bsc,
    transport: http(rpcUrl)
  });

  // 步骤 1: 部署 EIP7702RewardVaultRecoveryProxy
  console.log("📝 步骤 1: 部署 EIP7702RewardVaultRecoveryProxy...");
  
  // 使用 hardhat 编译并获取字节码
  const { ethers } = await import("hardhat");
  const RecoveryProxyFactory = await ethers.getContractFactory("EIP7702RewardVaultRecoveryProxy");
  const bytecode = RecoveryProxyFactory.bytecode;
  
  // 使用 walletClient 部署合约
  const deployHash = await walletClient.sendTransaction({
    account: executorAccount,
    to: undefined, // 合约部署
    data: bytecode as Hex,
    value: BigInt(0),
  });
  
  console.log(`   部署交易哈希: ${deployHash}`);
  console.log("   等待确认...");
  
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const proxyAddress = deployReceipt.contractAddress;
  
  if (!proxyAddress) {
    throw new Error("合约部署失败：未返回合约地址");
  }
  
  console.log(`   ✅ EIP7702RewardVaultRecoveryProxy 已部署: ${proxyAddress}`);
  console.log("");

  // 步骤 2: 生成 EIP-7702 授权签名
  console.log("📝 步骤 2: 生成 EIP-7702 授权签名...");
  const chainId = 56n; // BSC Mainnet
  const contractAddress = getAddress(proxyAddress) as Address;
  
  // 获取目标地址的 nonce（用于授权签名）- 使用 pending 以包含待处理的交易
  const targetNonce = await publicClient.getTransactionCount({ 
    address: COMPROMISED_ADMIN_ADDRESS as Address,
    blockTag: 'pending'
  });
  
  const authMessage = buildAuthorizationMessage(chainId, contractAddress, BigInt(targetNonce));
  
  // 使用被盗 admin 地址的私钥签名授权
  const compromisedSigningKey = new ethersV5.SigningKey(compromisedPrivateKey);
  const authSignature = compromisedSigningKey.sign(authMessage);
  const authYParity = authSignature.v === 27 ? 0 : 1;
  
  // 构建授权元组（r 和 s 使用 BigInt，与 add-owner-facet-via-eip7702.ts 一致）
  const authorizationTuple = {
    chainId,
    address: contractAddress,
    nonce: BigInt(targetNonce),
    yParity: authYParity,
    r: BigInt(authSignature.r),
    s: BigInt(authSignature.s),
  };
  
  console.log("   ✅ 授权签名已生成");
  console.log("   🔍 授权签名详情:");
  console.log("      chainId:", chainId.toString());
  console.log("      contractAddress:", contractAddress);
  console.log("      nonce:", targetNonce.toString());
  console.log("      yParity:", authYParity);
  console.log("      r:", authorizationTuple.r.toString());
  console.log("      s:", authorizationTuple.s.toString());
  console.log("");

  // 步骤 3: 构建调用数据
  console.log("📝 步骤 3: 构建调用数据...");
  const callData = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "recoverRewardVaultAdmin",
        inputs: [
          { type: "address", name: "rewardVault" },
          { type: "address", name: "newAdmin" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ],
    functionName: "recoverRewardVaultAdmin",
    args: [getAddress(REWARD_VAULT_ADDRESS) as Address, getAddress(NEW_ADMIN_ADDRESS) as Address],
  });
  
  console.log("   调用函数: recoverRewardVaultAdmin");
  console.log("   RewardVault:", REWARD_VAULT_ADDRESS);
  console.log("   新 Admin:", NEW_ADMIN_ADDRESS);
  console.log("");

  // 步骤 4: 构建 EIP-7702 交易
  console.log("📝 步骤 4: 构建 EIP-7702 交易...");
  
  // 获取执行者 nonce
  const executorNonce = await publicClient.getTransactionCount({
    address: executorAccount.address,
  });
  
  // 获取 gas price
  const gasPrice = await publicClient.getGasPrice();
  
  // 构建原始交易数据
  const rawTx = [
    56n, // chainId
    BigInt(executorNonce), // nonce
    gasPrice, // maxPriorityFeePerGas (使用 gasPrice)
    gasPrice, // maxFeePerGas (使用 gasPrice)
    500000n, // gasLimit
    COMPROMISED_ADMIN_ADDRESS as Address, // to (被盗的 admin 地址)
    0n, // value
    callData, // data
    [], // accessList (空)
    [authorizationTuple] // authorizationList
  ];
  
  // RLP 编码
  const rlpData = [
    rawTx[0], // chainId (bigint)
    rawTx[1], // nonce (bigint)
    rawTx[2], // maxPriorityFeePerGas (bigint)
    rawTx[3], // maxFeePerGas (bigint)
    rawTx[4], // gasLimit (bigint)
    Buffer.from((rawTx[5] as Address).slice(2), 'hex'), // to (address as Buffer)
    rawTx[6], // value (bigint)
    Buffer.from((rawTx[7] as Hex).slice(2), 'hex'), // data (callData as Buffer)
    rawTx[8], // accessList (empty array)
    rawTx[9].map((auth: any) => [ // authorizationList
      auth.chainId, // chainId (bigint)
      Buffer.from(auth.address.slice(2), 'hex'), // address (Buffer)
      auth.nonce, // nonce (bigint)
      auth.yParity, // yParity (number)
      toBuffer(auth.r, 32), // r (Buffer, 32 bytes)
      toBuffer(auth.s, 32)  // s (Buffer, 32 bytes)
    ])
  ];
  
  const rlpEncoded = Buffer.from(RLP.encode(rlpData));
  const unsignedTx = Buffer.concat([
    Buffer.from([SET_CODE_TX_TYPE]),
    rlpEncoded
  ]);
  
  console.log("   ✅ 未签名交易已构建");
  console.log("   交易类型: 0x04 (EIP-7702)");
  console.log("   To:", COMPROMISED_ADMIN_ADDRESS);
  console.log("   🔍 授权列表详情:");
  console.log("      授权数量:", rawTx[9].length);
  for (let i = 0; i < rawTx[9].length; i++) {
    const auth = rawTx[9][i];
    console.log(`      授权 ${i + 1}:`);
    console.log("         chainId:", auth.chainId.toString());
    console.log("         address:", auth.address);
    console.log("         nonce:", auth.nonce.toString());
    console.log("         yParity:", auth.yParity);
  }
  console.log("");

  // 步骤 5: 执行者签名交易
  console.log("📝 步骤 5: 执行者签名交易...");
  
  // 计算交易哈希（节点会使用这个哈希来恢复地址）
  const unsignedTxHex = `0x${unsignedTx.toString('hex')}` as Hex;
  const txHash = keccak256(unsignedTxHex);
  
  console.log("   🔍 交易详情:");
  console.log("   未签名交易长度:", unsignedTx.length, "字节");
  console.log("   交易哈希:", txHash);
  console.log("   执行者地址:", executorAccount.address);
  console.log("");
  
  // 执行者签名交易哈希
  const executorSigningKey = new ethersV5.SigningKey(executorPrivateKey);
  const executorSig = executorSigningKey.sign(txHash);
  const executorYParity = executorSig.v === 27 ? 0 : 1;
  
  // 构建签名后的交易
  const signedTxData = [
    rawTx[0], // chainId
    rawTx[1], // nonce
    rawTx[2], // maxPriorityFeePerGas
    rawTx[3], // maxFeePerGas
    rawTx[4], // gasLimit
    Buffer.from((rawTx[5] as Address).slice(2), 'hex'), // to
    rawTx[6], // value
    Buffer.from((rawTx[7] as Hex).slice(2), 'hex'), // data
    rawTx[8], // accessList
    rawTx[9].map((auth: any) => [ // authorizationList
      auth.chainId,
      Buffer.from(auth.address.slice(2), 'hex'),
      auth.nonce,
      auth.yParity,
      toBuffer(auth.r, 32),
      toBuffer(auth.s, 32)
    ]),
    executorYParity, // yParity (执行者签名)
    toBuffer(BigInt(executorSig.r), 32), // r (执行者签名)
    toBuffer(BigInt(executorSig.s), 32)  // s (执行者签名)
  ];
  
  const signedRlpEncoded = Buffer.from(RLP.encode(signedTxData));
  const signedTx = Buffer.concat([
    Buffer.from([SET_CODE_TX_TYPE]),
    signedRlpEncoded
  ]);
  
  console.log("   ✅ 交易已签名");
  console.log("");

  // 步骤 6: 广播交易
  console.log("📝 步骤 6: 广播交易...");
  const signedTxHex = `0x${signedTx.toString('hex')}` as Hex;
  const txHash2 = await publicClient.sendRawTransaction({
    serializedTransaction: signedTxHex,
  });
  
  console.log("   ✅ 交易已发送");
  console.log(`   交易哈希: ${txHash2}`);
  console.log("   等待确认...");
  console.log("");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash2,
  });
  
  if (receipt.status === "success") {
    console.log("   ✅ 交易成功！");
    console.log("");
    console.log("🔗 BSCScan:");
    console.log(`   https://bscscan.com/tx/${txHash2}`);
    console.log("");
    console.log("✅ RewardVault Admin 已恢复！");
    console.log(`   新 Admin 地址: ${NEW_ADMIN_ADDRESS}`);
    console.log("   现在可以使用新 Admin 地址设置 Operator 了");
  } else {
    console.error("   ❌ 交易失败！");
    throw new Error("交易执行失败");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

