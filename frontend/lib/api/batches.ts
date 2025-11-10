/**
 * Batches API
 */

import { apiGet, apiPost, apiPatch } from './client';

export interface Batch {
  batchId: string;
  maxMintable: string;
  currentMinted: string;
  mintPrice: string; // in wei (BSC USDT has 18 decimals)
  referralReward: string | null; // Referral reward per NFT in USDT (only in database)
  active: boolean;
  createdAt: string;
}

export interface CreateBatchRequest {
  maxMintable: string;
  mintPrice: string;
  referralReward?: string; // Optional referral reward in USDT
}

export interface CreateBatchResponse {
  id: string;
  maxMintable: string;
  mintPrice: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Get all batches (admin)
 */
export async function getBatches(): Promise<Batch[]> {
  return apiGet<Batch[]>('/admin/batches');
}

/**
 * Create a new batch (admin)
 */
export async function createBatch(
  maxMintable: string,
  mintPrice: string,
  referralReward?: string
): Promise<CreateBatchResponse> {
  return apiPost<CreateBatchResponse>('/admin/batches', {
    maxMintable,
    mintPrice,
    referralReward,
  });
}

/**
 * Activate a batch (admin)
 */
export async function activateBatch(batchId: string): Promise<Batch> {
  return apiPatch<Batch>(`/admin/batches/${batchId}/activate`);
}

