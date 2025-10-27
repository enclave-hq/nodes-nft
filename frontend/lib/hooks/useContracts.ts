import { useMemo } from "react";
import { Contract } from "ethers";
import { useWallet } from "@/lib/providers/WalletProvider";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/config";

// Import ABIs
import EnclaveTokenABI from "@/lib/contracts/abis/EnclaveToken.json";
import NodeNFTABI from "@/lib/contracts/abis/NodeNFT.json";
import NFTManagerABI from "@/lib/contracts/abis/NFTManager.json";

// Standard ERC20 ABI for USDT
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

/**
 * Hook to get contract instances
 */
export function useContracts() {
  const { signer, provider } = useWallet();

  const contracts = useMemo(() => {
    // Use signer if available (for write operations), otherwise use provider (read-only)
    const signerOrProvider = signer || provider;

    if (!signerOrProvider) {
      return {
        enclaveToken: null,
        nodeNFT: null,
        nftManager: null,
        usdt: null,
      };
    }

    return {
      enclaveToken: CONTRACT_ADDRESSES.enclaveToken
        ? new Contract(CONTRACT_ADDRESSES.enclaveToken, EnclaveTokenABI, signerOrProvider)
        : null,
      nodeNFT: CONTRACT_ADDRESSES.nodeNFT
        ? new Contract(CONTRACT_ADDRESSES.nodeNFT, NodeNFTABI, signerOrProvider)
        : null,
      nftManager: CONTRACT_ADDRESSES.nftManager
        ? new Contract(CONTRACT_ADDRESSES.nftManager, NFTManagerABI, signerOrProvider)
        : null,
      usdt: CONTRACT_ADDRESSES.usdt
        ? new Contract(CONTRACT_ADDRESSES.usdt, ERC20_ABI, signerOrProvider)
        : null,
    };
  }, [signer, provider]);

  return contracts;
}

/**
 * Hook to get read-only contract instances (for queries without wallet)
 */
export function useReadOnlyContracts() {
  const { provider } = useWallet();

  const contracts = useMemo(() => {
    if (!provider) {
      return {
        enclaveToken: null,
        nodeNFT: null,
        nftManager: null,
        usdt: null,
      };
    }

    return {
      enclaveToken: CONTRACT_ADDRESSES.enclaveToken
        ? new Contract(CONTRACT_ADDRESSES.enclaveToken, EnclaveTokenABI, provider)
        : null,
      nodeNFT: CONTRACT_ADDRESSES.nodeNFT
        ? new Contract(CONTRACT_ADDRESSES.nodeNFT, NodeNFTABI, provider)
        : null,
      nftManager: CONTRACT_ADDRESSES.nftManager
        ? new Contract(CONTRACT_ADDRESSES.nftManager, NFTManagerABI, provider)
        : null,
      usdt: CONTRACT_ADDRESSES.usdt
        ? new Contract(CONTRACT_ADDRESSES.usdt, ERC20_ABI, provider)
        : null,
    };
  }, [provider]);

  return contracts;
}

