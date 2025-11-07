import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const USDT_ADDRESS = process.env.USDT_ADDRESS || '0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34';
const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || '0xF87F9296955439C323ac79769959bEe087f6D06E';
const DEPLOYER_ADDRESS = '0x0848d929b9D35bFB7aa50641D392a4Ad83E145Ce';

const provider = new ethers.JsonRpcProvider(RPC_URL);

const USDT_ABI = ['function owner() view returns (address)', 'function balanceOf(address) view returns (uint256)'];
const MANAGER_ABI = ['function owner() view returns (address)'];

async function main() {
  console.log('Checking contract owners...\n');
  
  const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
  const manager = new ethers.Contract(NFT_MANAGER_ADDRESS, MANAGER_ABI, provider);
  
  try {
    const usdtOwner = await usdt.owner();
    console.log(`TestUSDT Owner: ${usdtOwner}`);
    console.log(`Deployer Address: ${DEPLOYER_ADDRESS}`);
    console.log(`Is Deployer Owner: ${usdtOwner.toLowerCase() === DEPLOYER_ADDRESS.toLowerCase()}\n`);
    
    const deployerUSDTBalance = await usdt.balanceOf(DEPLOYER_ADDRESS);
    console.log(`Deployer USDT Balance: ${ethers.formatUnits(deployerUSDTBalance, 18)} USDT\n`);
  } catch (error: any) {
    console.error('Error checking TestUSDT:', error.message);
  }
  
  try {
    const managerOwner = await manager.owner();
    console.log(`NFTManager Owner: ${managerOwner}`);
    console.log(`Deployer Address: ${DEPLOYER_ADDRESS}`);
    console.log(`Is Deployer Owner: ${managerOwner.toLowerCase() === DEPLOYER_ADDRESS.toLowerCase()}\n`);
  } catch (error: any) {
    console.error('Error checking NFTManager:', error.message);
  }
}

main().catch(console.error);
