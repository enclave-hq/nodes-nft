/**
 * Contract ABIs for wallet SDK - 使用真实的合约ABI
 */

import NFTManagerABI from './nft-manager-abi.json';
import TestUSDTABI from './test-usdt-abi.json';
import NodeNFTABI from './node-nft-abi.json';

// 使用真实的TestUSDT ABI
// JSON file is already an array, not an object with .abi property
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeABI(abiData: unknown): any[] {
  if (Array.isArray(abiData)) {
    return abiData;
  }
  if (abiData && typeof abiData === 'object' && abiData !== null && 'abi' in abiData) {
    const abiValue = (abiData as { abi?: unknown }).abi;
    return Array.isArray(abiValue) ? abiValue : [];
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ERC20_ABI = normalizeABI(TestUSDTABI) as any[];

// 使用真实的NFTManager ABI
// JSON file is already an array, not an object with .abi property
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NFT_MANAGER_ABI = normalizeABI(NFTManagerABI) as any[];

// 使用真实的NodeNFT ABI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NODE_NFT_ABI = normalizeABI(NodeNFTABI) as any[];
