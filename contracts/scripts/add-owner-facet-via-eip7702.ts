import { createPublicClient, http, Address, Hex, keccak256, encodeFunctionData, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { ethers as ethersV5 } from 'ethers';
import * as dotenv from "dotenv";
// @ts-ignore - @ethereumjs/rlp 可能没有类型定义
const RLP = require('@ethereumjs/rlp');

dotenv.config();

/**
 * 通过 EIP-7702 添加 OwnerFacet 到 NFTManager
 * 
 * 执行流程：
 * 1. 部署 OwnerFacet 合约
 * 2. 目标地址签名 EIP-7702 授权（授权给代理合约）
 * 3. 执行者构建 EIP-7702 交易（支付 gas）
 * 4. 目标地址临时变成代理合约
 * 5. 目标地址调用代理合约的 addOwnerFacet()
 * 6. 代理合约通过 nftManagerCut 添加 OwnerFacet
 */

// 代理合约地址（部署后获取）- 在 main 函数中从环境变量读取
// 目标地址在 main 函数中动态确定（从环境变量或使用执行者地址）

// NFTManager 合约地址 - 使用 getAddress 修复校验和
const NFT_MANAGER_ADDRESS = getAddress("0xD9eA9F4B8F24872262568fB2C6133117EC02C774") as Address;

const MAGIC = 0x05;
const SET_CODE_TX_TYPE = 0x04;

async function main() {
  const targetPrivateKey = process.env.TARGET_PRIVATE_KEY as Hex;
  const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY as Hex;
  
  if (!executorPrivateKey) throw new Error("EXECUTOR_PRIVATE_KEY 未设置（支付 gas 的地址）");
  if (!process.env.EIP7702_PROXY_ADDRESS) throw new Error("EIP7702_PROXY_ADDRESS 未设置");
  
  // 确保所有地址都是校验和格式
  const proxyContract = getAddress(process.env.EIP7702_PROXY_ADDRESS);

  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  const executorAccount = privateKeyToAccount(executorPrivateKey);
  
  // 确定目标地址：优先使用 TARGET_ADDRESS 环境变量，否则使用执行者地址
  let targetAddress: Address;
  let targetAccount: ReturnType<typeof privateKeyToAccount>;
  
  if (process.env.TARGET_ADDRESS) {
    targetAddress = getAddress(process.env.TARGET_ADDRESS) as Address;
    if (!targetPrivateKey) throw new Error("TARGET_PRIVATE_KEY 未设置（需要目标地址的私钥来签名授权）");
    targetAccount = privateKeyToAccount(targetPrivateKey);
    if (targetAccount.address.toLowerCase() !== targetAddress.toLowerCase()) {
      throw new Error(`TARGET_PRIVATE_KEY 对应的地址 ${targetAccount.address} 与 TARGET_ADDRESS ${targetAddress} 不匹配`);
    }
  } else {
    // 如果 contractOwner 已经被转移到执行者地址，使用执行者地址作为目标地址
    targetAddress = executorAccount.address;
    targetAccount = executorAccount;
    console.log("⚠️  未设置 TARGET_ADDRESS，使用执行者地址作为目标地址");
    console.log("   假设 contractOwner 已经被转移到执行者地址");
    console.log("   注意：目标地址和执行者地址是同一个，授权签名和执行者签名使用同一个私钥");
  }
  
  console.log("🔐 账户信息:");
  console.log("   目标地址 (contractOwner):", targetAddress);
  console.log("   执行者地址:", executorAccount.address, "(支付 gas)");
  console.log("   代理合约:", proxyContract);
  console.log("   NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("");

  // 创建 Public Client 用于查询
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  // 步骤 1: 部署 OwnerFacet
  console.log("📝 步骤 1: 部署 OwnerFacet...");
  const { ethers } = await import("hardhat");
  const [deployer] = await ethers.getSigners();
  const OwnerFacet = await ethers.getContractFactory("OwnerFacet");
  const ownerFacet = await OwnerFacet.deploy();
  await ownerFacet.waitForDeployment();
  const ownerFacetAddress = (await ownerFacet.getAddress()) as Address;
  console.log(`   ✅ OwnerFacet 已部署: ${ownerFacetAddress}`);
  console.log("");

  // 步骤 2: 生成授权签名
  console.log("📝 步骤 2: 生成 EIP-7702 授权签名...");
  const targetNonce = await publicClient.getTransactionCount({ address: targetAddress });
  const authMessage = buildAuthorizationMessage(56n, proxyContract, BigInt(targetNonce));
  
  // 使用目标地址的私钥签名（如果使用执行者地址作为目标，则使用执行者私钥）
  const targetKeyForSigning = process.env.TARGET_ADDRESS ? targetPrivateKey! : executorPrivateKey;
  const targetSigningKey = new ethersV5.SigningKey(targetKeyForSigning);
  const authSignature = targetSigningKey.sign(authMessage);
  const authYParity = authSignature.v === 27 ? 0 : 1;
  
  const authorizationTuple = {
    chainId: 56n,
    address: proxyContract,
    nonce: BigInt(targetNonce),
    yParity: authYParity,
    r: BigInt(authSignature.r),
    s: BigInt(authSignature.s)
  };
  
  console.log("   ✅ 授权签名已生成");
  console.log("");

  // 步骤 3: 构建调用数据
  console.log("📝 步骤 3: 构建调用数据...");
  const callData = encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'addOwnerFacet',
      inputs: [
        { name: 'nftManager', type: 'address' },
        { name: 'ownerFacet', type: 'address' }
      ],
      outputs: [],
      stateMutability: 'nonpayable'
    }],
    functionName: 'addOwnerFacet',
    args: [NFT_MANAGER_ADDRESS, ownerFacetAddress]
  });
  
  console.log("   调用函数: addOwnerFacet");
  console.log("   NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("   OwnerFacet:", ownerFacetAddress);
  console.log("");

  // 步骤 4: 构建 EIP-7702 交易（手动 RLP 编码）
  console.log("📝 步骤 4: 构建 EIP-7702 交易...");
  const executorNonce = await publicClient.getTransactionCount({ address: executorAccount.address });
  const gasPrice = await publicClient.getGasPrice();
  
  // 构建原始交易数据（与 execute-eip7702-recovery.ts 相同的方式）
  const rawTx = [
    56n, // chainId
    BigInt(executorNonce), // nonce
    gasPrice, // maxPriorityFeePerGas (使用 gasPrice)
    gasPrice, // maxFeePerGas (使用 gasPrice)
    500000n, // gasLimit
    targetAddress, // to (使用动态确定的目标地址)
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
    Buffer.from(targetAddress.slice(2), 'hex'), // to (address as Buffer)
    rawTx[6], // value (bigint)
    Buffer.from(rawTx[7].slice(2), 'hex'), // data (callData as Buffer)
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
  console.log("   To:", targetAddress);
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
    Buffer.from(rawTx[5].slice(2), 'hex'), // to
    rawTx[6], // value
    Buffer.from(rawTx[7].slice(2), 'hex'), // data
    rawTx[8], // accessList
    rawTx[9].map((auth: any) => [ // authorizationList
      auth.chainId,
      Buffer.from(auth.address.slice(2), 'hex'),
      auth.nonce,
      auth.yParity,
      toBuffer(auth.r, 32),
      toBuffer(auth.s, 32)
    ]),
    executorYParity, // yParity
    toBuffer(BigInt(executorSig.r), 32), // r
    toBuffer(BigInt(executorSig.s), 32)  // s
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
  const finalTxHash = await publicClient.sendRawTransaction({ 
    serializedTransaction: `0x${signedTx.toString('hex')}` as Hex
  });
  console.log("   ✅ 交易已发送");
  console.log("   交易哈希:", finalTxHash);
  console.log("   等待确认...");
  console.log("");

  // 等待确认
  const receipt = await publicClient.waitForTransactionReceipt({ hash: finalTxHash });
  
  if (receipt.status === 'success') {
    console.log("   ✅ 交易成功！");
    console.log("");
    console.log("🔗 BSCScan:");
    console.log(`   https://bscscan.com/tx/${finalTxHash}`);
    console.log("");
    console.log("✅ OwnerFacet 已添加到 NFTManager！");
    console.log("   现在可以通过 owner() 或 contractOwner() 函数查询 owner 了");
  } else {
    console.error("   ❌ 交易失败！");
    throw new Error("交易执行失败");
  }
}

/**
 * 构建 EIP-7702 授权消息
 */
function buildAuthorizationMessage(chainId: bigint, contractAddress: Address, nonce: bigint): Hex {
  const chainIdBuf = toBuffer(chainId);
  const addressBuf = Buffer.from(contractAddress.slice(2), 'hex');
  const nonceBuf = toBuffer(nonce);
  
  const rlpData = Buffer.from(RLP.encode([chainIdBuf, addressBuf, nonceBuf]));
  const message = Buffer.concat([Buffer.from([MAGIC]), rlpData]);
  return keccak256(`0x${message.toString('hex')}` as Hex);
}

/**
 * 将 bigint 转换为 Buffer
 */
function toBuffer(value: bigint, length?: number): Buffer {
  const hex = value.toString(16);
  const padded = hex.length % 2 === 0 ? hex : '0' + hex;
  let buffer = Buffer.from(padded, 'hex');
  
  if (length && buffer.length < length) {
    const padding = Buffer.alloc(length - buffer.length, 0);
    buffer = Buffer.concat([padding, buffer]);
  }
  
  return buffer;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

