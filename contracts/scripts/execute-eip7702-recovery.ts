import { createWalletClient, createPublicClient, http, Address, Hex, keccak256, encodeFunctionData, decodeFunctionResult } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { ethers } from 'ethers';
import * as dotenv from "dotenv";
// @ts-ignore - @ethereumjs/rlp 可能没有类型定义
const RLP = require('@ethereumjs/rlp');

dotenv.config();

/**
 * 通过 EIP-7702 执行紧急恢复 - 转移多个合约的 Owner
 * 
 * 执行流程：
 * 1. 目标地址签名 EIP-7702 授权（授权给代理合约）
 * 2. 执行者构建 EIP-7702 交易（支付 gas）
 * 3. 目标地址临时变成代理合约
 * 4. 目标地址调用代理合约的 emergencyRecover()
 * 5. 在一个交易中完成：取消委托 + 转移所有权
 */

// 代理合约地址（部署后获取）
const PROXY_CONTRACT = process.env.EIP7702_PROXY_ADDRESS as Address;

// 目标地址（私钥泄露的地址）- 正确的地址是 0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6
import { getAddress } from 'viem';
const TARGET_ADDRESS = getAddress("0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6") as Address;

// BNB Chain 系统委托合约
const DELEGATION_CONTRACT = "0x0000000000000000000000000000000000001000" as Address;

// 需要转移所有权的合约
const CONTRACTS = {
  NFT_MANAGER: "0xD9eA9F4B8F24872262568fB2C6133117EC02C774" as Address,
  NODE_NFT: "0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b" as Address,
  ENCLAVE_TOKEN: "0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011" as Address,
  TOKEN_VESTING: "0x67B8927F0835e79632f4622F017915Cb0B9a6c72" as Address,
};

// 新 Owner 地址
const NEW_OWNER = process.env.NEW_OWNER_ADDRESS as Address;

const MAGIC = 0x05;
const SET_CODE_TX_TYPE = 0x04;

async function main() {
  const targetPrivateKey = process.env.TARGET_PRIVATE_KEY as Hex;
  const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY as Hex;
  
  if (!targetPrivateKey) throw new Error("TARGET_PRIVATE_KEY 未设置");
  if (!executorPrivateKey) throw new Error("EXECUTOR_PRIVATE_KEY 未设置（支付 gas 的地址）");
  if (!PROXY_CONTRACT) throw new Error("EIP7702_PROXY_ADDRESS 未设置");
  if (!NEW_OWNER) throw new Error("NEW_OWNER_ADDRESS 未设置");

  const rpcUrl = process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
  const targetAccount = privateKeyToAccount(targetPrivateKey);
  const executorAccount = privateKeyToAccount(executorPrivateKey);
  
  console.log("🔐 账户信息:");
  console.log("   目标地址:", targetAccount.address);
  console.log("   执行者地址:", executorAccount.address, "(支付 gas)");
  console.log("   代理合约:", PROXY_CONTRACT);
  console.log("");

  // 创建 Public Client 用于查询（获取 nonce）
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl)
  });

  // 检查两个地址的余额
  const executorBalance = await publicClient.getBalance({ address: executorAccount.address });
  const targetBalance = await publicClient.getBalance({ address: targetAccount.address });
  
  console.log("💰 余额检查:");
  console.log("   执行者地址:", executorAccount.address);
  console.log("   执行者余额:", (Number(executorBalance) / 1e18).toFixed(6), "BNB");
  console.log("   目标地址:", targetAccount.address);
  console.log("   目标余额:", (Number(targetBalance) / 1e18).toFixed(6), "BNB");
  console.log("");
  
  // 在 EIP-7702 交易中，节点会从签名中恢复执行者地址并检查余额
  // 如果节点报 "balance 0"，说明节点恢复出的地址余额为0
  console.log("   ⚠️  注意：节点会从交易签名中恢复执行者地址并检查余额");
  console.log("   如果节点报 'balance 0'，请确认执行者地址有足够的 BNB");
  console.log("");
  
  if (executorBalance === 0n) {
    throw new Error(`❌ 执行者地址余额为 0！请向 ${executorAccount.address} 充值 BNB`);
  }
  
  const gasPrice = await publicClient.getGasPrice();
  const estimatedCostWei = gasPrice * 3000000n;
  const estimatedCostBnb = Number(estimatedCostWei) / 1e18;
  console.log("   预计 Gas 成本:", estimatedCostBnb.toFixed(6), "BNB (gasLimit: 3,000,000)");
  
  if (executorBalance < estimatedCostWei) {
    throw new Error(`❌ 余额不足！需要至少 ${estimatedCostBnb.toFixed(6)} BNB`);
  }
  
  console.log("   ✅ 余额充足");
  console.log("");

  // 创建 Wallet Client 用于签名和发送交易
  const walletClient = createWalletClient({
    account: executorAccount,
    chain: bsc,
    transport: http(rpcUrl)
  });

  // 获取 nonces
  const targetNonce = await publicClient.getTransactionCount({ address: targetAccount.address });
  const executorNonce = await publicClient.getTransactionCount({ address: executorAccount.address });
  
  console.log("📊 Nonces:");
  console.log("   目标地址 nonce:", targetNonce);
  console.log("   执行者 nonce:", executorNonce);
  console.log("");

  // 步骤 1: 生成授权签名
  console.log("📝 步骤 1: 生成 EIP-7702 授权签名...");
  const authMessage = buildAuthorizationMessage(56n, PROXY_CONTRACT, BigInt(targetNonce));
  
  // 使用 ethers.SigningKey 来签名（与 zkpay 项目一致）
  const targetSigningKey = new ethers.SigningKey(targetPrivateKey);
  const authSignature = targetSigningKey.sign(authMessage);
  
  // ethers 返回的签名中，v 是 27 或 28，需要转换为 yParity (0 或 1)
  const authYParity = authSignature.v === 27 ? 0 : 1;
  
  const authorizationTuple = {
    chainId: 56n,
    address: PROXY_CONTRACT,
    nonce: BigInt(targetNonce),
    yParity: authYParity,
    r: BigInt(authSignature.r),
    s: BigInt(authSignature.s)
  };
  
  console.log("   ✅ 授权签名已生成");
  console.log("");

  // 步骤 2: 构建调用数据
  console.log("📝 步骤 2: 构建调用数据...");
  const maliciousValidator = (process.env.MALICIOUS_VALIDATOR_ADDRESS as Address) || "0x0000000000000000000000000000000000000000" as Address;
  
  // 包含所有需要转移 Owner 的合约（包括 NFT_MANAGER）
  const contractsArray = [
    CONTRACTS.NFT_MANAGER,
    CONTRACTS.NODE_NFT,
    CONTRACTS.ENCLAVE_TOKEN,
    CONTRACTS.TOKEN_VESTING,
  ];
  
  console.log("   需要转移 Owner 的合约:");
  contractsArray.forEach((addr, idx) => {
    const name = Object.keys(CONTRACTS).find(k => CONTRACTS[k as keyof typeof CONTRACTS] === addr) || `合约${idx + 1}`;
    console.log(`     ${idx + 1}. ${name}: ${addr}`);
  });
  
  const callData = encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'emergencyRecover',
      inputs: [
        { name: 'validatorAddress', type: 'address' },
        { name: 'contracts', type: 'address[]' },
        { name: 'newOwner', type: 'address' }
      ],
      outputs: [],
      stateMutability: 'nonpayable'
    }],
    functionName: 'emergencyRecover',
    args: [maliciousValidator, contractsArray, NEW_OWNER]
  });
  
  console.log("   调用函数: emergencyRecover");
  console.log("   验证者地址:", maliciousValidator);
  console.log("   合约数量:", contractsArray.length);
  console.log("   新 Owner:", NEW_OWNER);
  console.log("");

  // 步骤 3: 构建 EIP-7702 交易
  console.log("📝 步骤 3: 构建 EIP-7702 交易...");
  // gasPrice 已在余额检查时获取，直接使用
  
  const rawTx = [
    56n, // chainId
    BigInt(executorNonce),
    gasPrice,
    gasPrice,
    3000000n, // gasLimit (增加以支持多个合约)
    targetAccount.address, // to = 目标地址
    0n, // value
    callData,
    [], // accessList
    [authorizationTuple] // authorizationList
  ];
  
  // RLP 编码：@ethereumjs/rlp 可以直接处理 bigint 和 string
  // 但需要将地址字符串转换为 Buffer，将授权元组正确格式化
  const rlpData = [
    rawTx[0], // chainId (bigint)
    rawTx[1], // nonce (bigint)
    rawTx[2], // maxPriorityFeePerGas (bigint)
    rawTx[3], // maxFeePerGas (bigint)
    rawTx[4], // gasLimit (bigint)
    Buffer.from(rawTx[5].slice(2), 'hex'), // to (address as Buffer)
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
  console.log("   To:", targetAccount.address);
  console.log("");

  // 步骤 4: 执行者签名交易
  console.log("📝 步骤 4: 执行者签名交易...");
  
  // 计算交易哈希（节点会使用这个哈希来恢复地址）
  const unsignedTxHex = `0x${unsignedTx.toString('hex')}` as Hex;
  const txHash = keccak256(unsignedTxHex);
  
  console.log("   🔍 交易详情:");
  console.log("   未签名交易长度:", unsignedTx.length, "字节");
  console.log("   交易哈希:", txHash);
  console.log("   执行者地址:", executorAccount.address);
  console.log("");
  
  // 执行者签名交易哈希
  // 使用 ethers.SigningKey 来签名（与 zkpay 项目一致）
  const executorSigningKey = new ethers.SigningKey(executorPrivateKey);
  const executorSig = executorSigningKey.sign(txHash);
  
  // ethers 返回的签名中，v 是 27 或 28
  const yParity = executorSig.v === 27 ? 0 : 1;
  
  const executorSigParsed = {
    v: yParity,
    r: BigInt(executorSig.r),
    s: BigInt(executorSig.s)
  };
  
  console.log("   🔍 签名详情:");
  console.log("   签名 v (ethers):", executorSig.v, "(27 或 28)");
  console.log("   yParity:", executorSigParsed.v, "(用于 EIP-7702)");
  console.log("   签名 r:", executorSigParsed.r.toString(16).slice(0, 20) + "...");
  console.log("   签名 s:", executorSigParsed.s.toString(16).slice(0, 20) + "...");
  console.log("");
  
  // 将签名附加到交易
  const signedTx = appendSignature(unsignedTx, executorSigParsed);
  
  console.log("   ⚠️  重要提示:");
  console.log("   节点会从签名中恢复执行者地址并检查余额");
  console.log("   如果节点报 'balance 0'，请确认:");
  console.log("   1. 执行者地址:", executorAccount.address, "有足够的 BNB");
  console.log("   2. 签名格式正确（yParity:", executorSigParsed.v, ")");
  console.log("   ✅ 交易已签名");
  console.log("");
  
  // 步骤 5: 广播交易
  console.log("📝 步骤 5: 广播交易...");
  
  const txHashResult = await publicClient.request({
    method: 'eth_sendRawTransaction',
    params: [signedTx]
  }) as Hex;
  
  console.log("   ✅ 交易已发送");
  console.log("   交易哈希:", txHashResult);
  console.log("   等待确认...");
  console.log("");
  
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash: txHashResult,
    confirmations: 1
  });
  
  if (receipt.status === 'success') {
    console.log("   ✅ 交易已确认");
    console.log("   区块:", receipt.blockNumber.toString());
    console.log("   Gas 使用:", receipt.gasUsed.toString());
    console.log("");
    
    // 步骤 6: 验证 Owner 转移
    console.log("📝 步骤 6: 验证 Owner 转移...");
    await verifyOwnershipTransfer(publicClient, contractsArray, NEW_OWNER);
    
    console.log("");
    console.log("🔗 BSCScan:");
    console.log(`   https://bscscan.com/tx/${txHashResult}`);
    console.log("");
    console.log("✅ 所有操作已完成！");
  } else {
    console.error("   ❌ 交易失败！");
    throw new Error("交易执行失败");
  }
}

/**
 * 构建 EIP-7702 授权消息
 * 格式: keccak256(0x05 ++ rlp([chainId, address, nonce]))
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

/**
 * 将签名附加到交易
 */
function appendSignature(txPayload: Buffer, sig: { v: number; r: bigint; s: bigint }): Hex {
  const payload = txPayload.slice(1); // 移除类型前缀
  const decoded = RLP.decode(payload);
  
  // 添加签名: [v, r, s]
  // 根据 zkpay 的实现，直接使用 bigint，RLP 库会处理
  const withSig = [
    ...Array.from(decoded),
    sig.v,  // yParity (number)
    sig.r,  // r (bigint)
    sig.s   // s (bigint)
  ];
  
  const encoded = RLP.encode(withSig);
  return `0x04${Buffer.from(encoded).toString('hex')}` as Hex;
}

/**
 * 解析签名
 * viem 的 signMessage 返回的签名中，v 是 27 或 28（以太坊标准）
 * EIP-7702 交易需要 yParity (0 或 1)
 */
function parseSignature(signature: Hex): { v: number; r: bigint; s: bigint } {
  const sig = signature.slice(2);
  const r = BigInt('0x' + sig.slice(0, 64));
  const s = BigInt('0x' + sig.slice(64, 128));
  const v = parseInt(sig.slice(128, 130), 16);
  
  // 将以太坊标准的 v (27/28) 转换为 yParity (0/1)
  // yParity = v === 27 ? 0 : 1
  const yParity = v === 27 ? 0 : 1;
  
  return { v: yParity, r, s };
}

/**
 * 验证 Owner 转移是否成功
 */
async function verifyOwnershipTransfer(
  client: ReturnType<typeof createPublicClient>,
  contracts: Address[],
  expectedOwner: Address
) {
  const OWNER_ABI = [{
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  }] as const;
  
  console.log("   验证合约 Owner:");
  
  for (const contractAddr of contracts) {
    const name = Object.keys(CONTRACTS).find(
      k => CONTRACTS[k as keyof typeof CONTRACTS] === contractAddr
    ) || contractAddr;
    
    // NFTManager 使用 Diamond Pattern，需要直接读取存储
    if (contractAddr.toLowerCase() === CONTRACTS.NFT_MANAGER.toLowerCase()) {
      try {
        // 存储位置: keccak256("nftmanager.standard.storage") + 1
        // 计算存储槽：使用 keccak256 计算 base position
        const basePositionHex = keccak256(
          Buffer.from("nftmanager.standard.storage", "utf-8")
        );
        const basePosition = BigInt(basePositionHex);
        const ownerSlot = basePosition + 1n;
        
        // 读取存储
        const storageValue = await client.getStorageAt({
          address: contractAddr,
          slot: ownerSlot
        });
        
        // 存储值是 bytes32，最后 20 字节是地址（去掉前导零）
        // 将 bytes32 转换为 address（取最后 40 个字符，即 20 字节）
        const ownerHex = storageValue.slice(-40);
        const owner = ("0x" + ownerHex) as Address;
        
        if (owner.toLowerCase() === expectedOwner.toLowerCase()) {
          console.log(`     ✅ ${name}: Owner 已成功转移`);
          console.log(`        ${contractAddr}`);
          console.log(`        新 Owner: ${owner}`);
        } else {
          console.log(`     ❌ ${name}: Owner 转移失败`);
          console.log(`        当前 Owner: ${owner}`);
          console.log(`        期望 Owner: ${expectedOwner}`);
        }
      } catch (error) {
        console.log(`     ⚠️  ${name}: 无法读取 Owner (读取存储失败)`);
        console.log(`        ${contractAddr}`);
        console.log(`        错误: ${error}`);
      }
    } else {
      // 标准 Ownable 合约
      try {
        const owner = await client.readContract({
          address: contractAddr,
          abi: OWNER_ABI,
          functionName: 'owner'
        });
        
        if (owner.toLowerCase() === expectedOwner.toLowerCase()) {
          console.log(`     ✅ ${name}: Owner 已成功转移`);
          console.log(`        ${contractAddr}`);
          console.log(`        新 Owner: ${owner}`);
        } else {
          console.log(`     ❌ ${name}: Owner 转移失败`);
          console.log(`        当前 Owner: ${owner}`);
          console.log(`        期望 Owner: ${expectedOwner}`);
        }
      } catch (error) {
        console.log(`     ⚠️  ${name}: 无法读取 Owner (可能不是 Ownable 合约或合约地址错误)`);
        console.log(`        ${contractAddr}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

