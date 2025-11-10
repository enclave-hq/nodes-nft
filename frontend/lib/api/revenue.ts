import { apiGet, apiPost } from './client';

export interface TotalRevenueResponse {
  totalRevenue: string;
  totalRevenueWei: string;
  recordCount: number;
}

export interface RevenueDetail {
  id: number;
  nftId: number;
  batchId: string;
  minterAddress: string;
  mintPrice: string;
  mintPriceWei: string;
  mintTxHash: string | null;
  createdAt: string;
}

export interface RevenueDetailsResponse {
  records: RevenueDetail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TotalReferralRewardsResponse {
  totalRewards: string;
  totalRewardsWei: string;
  recordCount: number;
}

export interface ReferralRewardDetail {
  id: number;
  nftId: number;
  batchId: string;
  minterAddress: string;
  rootReferrerAddress: string;
  rootInviteCode: {
    id: number;
    code: string;
    applicantAddress: string;
  } | null;
  referralReward: string;
  referralRewardWei: string;
  mintTxHash: string | null;
  createdAt: string;
}

export interface ReferralRewardDetailsResponse {
  records: ReferralRewardDetail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TreasuryBalanceResponse {
  treasuryAddress: string;
  balance: string;
  balanceWei: string;
}

export interface TransferUsdtRequest {
  to: string;
  amount: string;
  password: string;
  totpCode: string;
  rootReferrerAddress?: string; // Required for referral reward transfer
  note?: string; // Optional note
}

export interface TransferUsdtResponse {
  success: boolean;
  txHash: string;
  message: string;
}

export interface RevenueStatisticsResponse {
  totalRevenue: string;
  totalRevenueWei: string;
  withdrawnRevenue: string;
  withdrawnRevenueWei: string;
  availableRevenue: string;
  availableRevenueWei: string;
}

export interface ReferralRewardStatisticsResponse {
  totalRewards: string;
  totalRewardsWei: string;
  distributedRewards: string;
  distributedRewardsWei: string;
  distributableRewards: string;
  distributableRewardsWei: string;
}

export async function getTotalRevenue(): Promise<TotalRevenueResponse> {
  return apiGet<TotalRevenueResponse>('/admin/revenue/total');
}

export async function getRevenueDetails(page: number = 1, limit: number = 20): Promise<RevenueDetailsResponse> {
  return apiGet<RevenueDetailsResponse>(`/admin/revenue/details?page=${page}&limit=${limit}`);
}

export async function getTotalReferralRewards(): Promise<TotalReferralRewardsResponse> {
  return apiGet<TotalReferralRewardsResponse>('/admin/revenue/referral-rewards/total');
}

export async function getReferralRewardDetails(page: number = 1, limit: number = 20): Promise<ReferralRewardDetailsResponse> {
  return apiGet<ReferralRewardDetailsResponse>(`/admin/revenue/referral-rewards/details?page=${page}&limit=${limit}`);
}

export async function getTreasuryBalance(): Promise<TreasuryBalanceResponse> {
  return apiGet<TreasuryBalanceResponse>('/admin/revenue/treasury-balance');
}

export async function getRevenueStatistics(): Promise<RevenueStatisticsResponse> {
  return apiGet<RevenueStatisticsResponse>('/admin/revenue/revenue-statistics');
}

export async function getReferralRewardStatistics(): Promise<ReferralRewardStatisticsResponse> {
  return apiGet<ReferralRewardStatisticsResponse>('/admin/revenue/referral-reward-statistics');
}

export async function transferUsdt(data: TransferUsdtRequest): Promise<TransferUsdtResponse> {
  return apiPost<TransferUsdtResponse>('/admin/revenue/transfer', data);
}

export async function transferReferralReward(data: TransferUsdtRequest & { rootReferrerAddress: string }): Promise<TransferUsdtResponse> {
  return apiPost<TransferUsdtResponse>('/admin/revenue/transfer-referral-reward', data);
}

export async function transferRevenue(data: TransferUsdtRequest): Promise<TransferUsdtResponse> {
  return apiPost<TransferUsdtResponse>('/admin/revenue/transfer-revenue', data);
}

export interface RefreshNftRecordsRequest {
  fullRefresh?: boolean;
}

export interface RefreshNftRecordsResponse {
  success: boolean;
  totalNfts: number;
  newRecords: number;
  updatedRecords: number;
  errors: number;
}

export interface NftWithoutReferralReward {
  id: number;
  nftId: number;
  batchId: string;
  minterAddress: string;
  mintPrice: string;
  mintPriceWei: string;
  mintTxHash: string | null;
  createdAt: string;
}

export interface NftsWithoutReferralRewardsResponse {
  records: NftWithoutReferralReward[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateReferralRewardResponse {
  success: boolean;
  message: string;
}

export interface BatchCreateReferralRewardsResponse {
  success: boolean;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

export interface DistributableReferralReward {
  rootAddress: string;
  totalRewards: string;
  totalRewardsWei: string;
  distributedRewards: string;
  distributedRewardsWei: string;
  distributableRewards: string;
  distributableRewardsWei: string;
  recordCount: number;
}

export interface DistributableReferralRewardsResponse {
  success: boolean;
  rewards: DistributableReferralReward[];
}

export async function refreshNftRecords(fullRefresh: boolean = false): Promise<RefreshNftRecordsResponse> {
  return apiPost<RefreshNftRecordsResponse>('/admin/revenue/refresh-nfts', { fullRefresh });
}

export async function getNftsWithoutReferralRewards(page: number = 1, limit: number = 20): Promise<NftsWithoutReferralRewardsResponse> {
  return apiGet<NftsWithoutReferralRewardsResponse>(`/admin/revenue/nfts-without-referral-rewards?page=${page}&limit=${limit}`);
}

export async function createReferralRewardForNft(nftId: number): Promise<CreateReferralRewardResponse> {
  return apiPost<CreateReferralRewardResponse>(`/admin/revenue/create-referral-reward/${nftId}`, {});
}

export async function batchCreateReferralRewards(): Promise<BatchCreateReferralRewardsResponse> {
  return apiPost<BatchCreateReferralRewardsResponse>('/admin/revenue/batch-create-referral-rewards', {});
}

export async function getDistributableReferralRewards(): Promise<DistributableReferralRewardsResponse> {
  return apiGet<DistributableReferralRewardsResponse>('/admin/revenue/distributable-referral-rewards');
}

export interface NftMintCallbackRequest {
  nftId: number;
  minterAddress: string;
  mintTxHash: string;
  batchId?: string;
}

export interface NftMintCallbackResponse {
  success: boolean;
  nftRecordCreated: boolean;
  revenueRecordCreated: boolean;
  referralRewardCreated: boolean;
  inviteCodeActivated: boolean;
}

export async function handleNftMintCallback(data: NftMintCallbackRequest): Promise<NftMintCallbackResponse> {
  return apiPost<NftMintCallbackResponse>('/admin/revenue/nft-mint-callback', data);
}

