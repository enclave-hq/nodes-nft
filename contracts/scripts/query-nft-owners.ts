import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  // 从 hardhat 网络配置获取网络名称
  const hre = require("hardhat");
  const networkName = hre.network.name;
  const network = networkName === "bscMainnet" || networkName === "mainnet" ? "bscMainnet" : "bscTestnet";
  
  // 从部署文件读取地址
  let NODE_NFT_ADDRESS: string;
  try {
    const deploymentFile = network === "bscMainnet" 
      ? path.join(__dirname, "../deployment.mainnet.json")
      : path.join(__dirname, "../deployment.testnet.json");
    
    if (fs.existsSync(deploymentFile)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
      NODE_NFT_ADDRESS = deployment.contracts.nodeNFT;
      console.log(`📄 从部署文件读取地址: ${deploymentFile}`);
    } else {
      // 回退到环境变量或默认值
      NODE_NFT_ADDRESS = network === "bscMainnet" 
        ? process.env.NODE_NFT_ADDRESS || "0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b"
        : process.env.NODE_NFT_ADDRESS || "0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe";
    }
  } catch (error) {
    // 如果读取失败，使用默认值
    NODE_NFT_ADDRESS = network === "bscMainnet" 
      ? "0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b"
      : "0x7c49bF1BE9992De7bd458d045bbBfe75233ddfFe";
  }

  console.log(`🔍 查询 NFT Owners (${network})...\n`);
  console.log(`📋 NodeNFT 地址: ${NODE_NFT_ADDRESS}\n`);

  try {
    // 获取 NodeNFT 合约实例
    const nodeNFT = await ethers.getContractAt("NodeNFT", NODE_NFT_ADDRESS);
    
    // 尝试获取总铸造数量
    let totalMinted = 0n;
    try {
      totalMinted = await nodeNFT.totalMinted();
      console.log(`📊 总铸造数量: ${totalMinted.toString()}\n`);
    } catch (error: any) {
      console.log(`⚠️  无法获取 totalMinted()，将尝试逐个查询...\n`);
    }

    // 查询每个 NFT 的 owner
    console.log("📋 NFT Owners 列表:\n");
    console.log("=".repeat(80));
    console.log(`Token ID | Owner Address`);
    console.log("=".repeat(80));

    const owners: { [key: string]: string[] } = {};
    const maxTokenId = totalMinted > 0n ? Number(totalMinted) : 10000; // 如果没有总数，最多查询 10000 个
    let foundCount = 0;
    let errorCount = 0;

    for (let i = 1; i <= maxTokenId; i++) {
      try {
        const owner = await nodeNFT.ownerOf(i);
        console.log(`   ${i.toString().padStart(6)} | ${owner}`);
        foundCount++;
        
        // 按 owner 分组统计
        if (!owners[owner]) {
          owners[owner] = [];
        }
        owners[owner].push(i.toString());
      } catch (error: any) {
        // 如果连续多个 tokenId 都失败，可能已经查询完所有 NFT
        if (errorCount > 10 && foundCount > 0) {
          console.log(`\n⚠️  连续 ${errorCount} 个 tokenId 查询失败，可能已查询完所有 NFT`);
          break;
        }
        errorCount++;
        if (errorCount <= 3) {
          // 只显示前几个错误
          console.log(`   ${i.toString().padStart(6)} | ❌ Error: ${error.message.substring(0, 50)}`);
        }
      }
    }
    
    if (foundCount === 0) {
      console.log("⚠️  没有找到任何 NFT");
      return;
    }

    console.log("=".repeat(80));
    console.log("\n📊 按 Owner 分组统计:\n");
    console.log("=".repeat(80));
    console.log(`Owner Address | NFT 数量 | Token IDs`);
    console.log("=".repeat(80));

    const sortedOwners = Object.entries(owners).sort((a, b) => b[1].length - a[1].length);
    
    for (const [owner, tokenIds] of sortedOwners) {
      const count = tokenIds.length;
      const idsDisplay = tokenIds.length <= 10 
        ? tokenIds.join(", ")
        : `${tokenIds.slice(0, 10).join(", ")} ... (共 ${count} 个)`;
      console.log(`${owner} | ${count.toString().padStart(6)} | ${idsDisplay}`);
    }

    console.log("=".repeat(80));
    console.log(`\n✅ 总计: ${foundCount} 个 NFT, ${Object.keys(owners).length} 个不同的 Owner\n`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

