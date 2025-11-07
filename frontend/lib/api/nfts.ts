/**
 * NFTs API
 */

import { apiGet } from './client';

export interface NFT {
  id: number;
  tokenId: string;
  ownerAddress: string;
  inviteCodeId: number;
  createdAt: string;
  updatedAt: string;
}

export interface NFTTrace {
  nft: NFT;
  inviteCodeChain: Array<{
    id: number;
    code: string;
    ownerAddress: string;
  }>;
}

/**
 * Trace an NFT (admin)
 */
export async function traceNFT(id: number): Promise<NFTTrace> {
  return apiGet<NFTTrace>(`/admin/nfts/${id}/trace`);
}

/**
 * Get NFTs by root invite code (admin)
 */
export async function getNFTsByRootInviteCode(rootInviteCodeId: number): Promise<NFT[]> {
  return apiGet<NFT[]>(`/admin/nfts/root/${rootInviteCodeId}`);
}

/**
 * Get NFTs by user address (admin)
 */
export async function getNFTsByUser(address: string): Promise<NFT[]> {
  return apiGet<NFT[]>(`/admin/nfts/user/${address}`);
}

