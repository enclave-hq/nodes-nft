/**
 * Contract ABIs for wallet SDK - 使用真实的合约ABI
 */

import NFTManagerABI from './nft-manager-abi.json';
import TestUSDTABI from './test-usdt-abi.json';

// 使用真实的TestUSDT ABI
export const ERC20_ABI = TestUSDTABI.abi as any[];

// 使用真实的NFTManager ABI
export const NFT_MANAGER_ABI = NFTManagerABI.abi as any[];
