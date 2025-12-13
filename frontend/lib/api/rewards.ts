import { apiGet } from './client';

export interface ReferralRecord {
  id: number;
  nftId: number;
  batchId: string;
  minterAddress: string;
  referralReward: string;
  referralRewardWei: string;
  mintTxHash: string | null;
  createdAt: string;
}

export interface ReferralRecordsResponse {
  records: ReferralRecord[];
  totals: {
    totalRewards: string;
    totalRewardsWei: string;
    recordCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RewardVaultStateResponse {
  rewardVaultAddress: string;
  allocatedWei: string;
  withdrawnWei: string;
  availableWei: string;
}

export async function getMyReferralRecords(params: {
  address: string;
  page?: number;
  limit?: number;
  includeSelf?: boolean;
}): Promise<ReferralRecordsResponse> {
  const q = new URLSearchParams();
  q.set('address', params.address);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.includeSelf) q.set('includeSelf', 'true');
  return apiGet<ReferralRecordsResponse>(`/rewards/referral/records?${q.toString()}`);
}

export async function getRewardVaultState(address: string): Promise<RewardVaultStateResponse> {
  const q = new URLSearchParams();
  q.set('address', address);
  return apiGet<RewardVaultStateResponse>(`/rewards/referral/vault-state?${q.toString()}`);
}


