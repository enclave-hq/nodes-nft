import { apiGet, apiPost } from './client';

/**
 * Transfer enabled status
 */
export interface TransfersEnabledStatus {
  enabled: boolean;
}

/**
 * Set transfers enabled response
 */
export interface SetTransfersEnabledResponse {
  success: boolean;
  txHash: string;
  enabled: boolean;
}

/**
 * Get transfers enabled status
 */
export async function getTransfersEnabled(): Promise<TransfersEnabledStatus> {
  return apiGet<TransfersEnabledStatus>('/admin/contract/transfers-enabled');
}

/**
 * Set transfers enabled/disabled
 */
export async function setTransfersEnabled(enabled: boolean): Promise<SetTransfersEnabledResponse> {
  return apiPost<SetTransfersEnabledResponse>('/admin/contract/transfers-enabled', { enabled });
}

