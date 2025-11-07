/**
 * Batches API
 */

import { apiGet, apiPost, apiPatch } from './client';

export interface Batch {
  id: string;
  maxMintable: string;
  mintPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateBatchRequest {
  maxMintable: string;
  mintPrice: string;
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
  mintPrice: string
): Promise<CreateBatchResponse> {
  return apiPost<CreateBatchResponse>('/admin/batches', {
    maxMintable,
    mintPrice,
  });
}

/**
 * Activate a batch (admin)
 */
export async function activateBatch(batchId: string): Promise<Batch> {
  return apiPatch<Batch>(`/admin/batches/${batchId}/activate`);
}

