import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  soEntityId: string;
  soName: string;
  state?: string;
  beat?: string;
  totalOrderAmount: number;
  orderCount: number;
  productiveVisits: number;
  poaPoints: number;
  tcPoints: number;
  pcPoints: number;
  totalPoints: number;
  badge: 'gold' | 'silver' | 'bronze' | 'none';
}

export interface LeaderboardResponse {
  period: string;
  entries: LeaderboardEntry[];
  totalSOs: number;
  generatedAt: string;
}

export interface OutletReportRow {
  retailerEntityId: string;
  outletName: string;
  beat: string;
  state: string;
  totalOrderAmount: number;
  orderCount: number;
  lastOrderDate: string | null;
}

export interface OutletWiseResponse {
  outlets: OutletReportRow[];
  totalAmount: number;
  totalOrders: number;
}

export const leaderboardService = {
  getLeaderboard: async (params: {
    period?: LeaderboardPeriod;
    state?: string;
    beat?: string;
    limit?: number;
  }): Promise<LeaderboardResponse> => {
    const query: Record<string, string> = {};
    if (params.period) query.period = params.period;
    if (params.state) query.state = params.state;
    if (params.beat) query.beat = params.beat;
    if (params.limit) query.limit = String(params.limit);

    const res = await apiClient.get<ApiResponse<LeaderboardResponse>>('/dashboard/leaderboard', {
      params: query,
      timeout: 60000,
    });
    return res.data.data;
  },

  getOutletWiseReport: async (params: {
    soEntityId?: string;
    state?: string;
    beat?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<OutletWiseResponse> => {
    const query: Record<string, string> = {};
    if (params.soEntityId) query.soEntityId = params.soEntityId;
    if (params.state) query.state = params.state;
    if (params.beat) query.beat = params.beat;
    if (params.fromDate) query.fromDate = params.fromDate;
    if (params.toDate) query.toDate = params.toDate;

    const res = await apiClient.get<ApiResponse<OutletWiseResponse>>('/dashboard/outlet-wise', {
      params: query,
      timeout: 60000,
    });
    return res.data.data;
  },
};
