import { apiClient } from '@/lib/api-client';

export interface DailySummaryAttendance {
  attendanceId: string;
  attendanceStatus: 'present' | 'absent' | 'half_day' | 'leave';
  workingType: string;
  town: string | null;
  beat: string | null;
  remark: string | null;
  markedAt: string;
  isLate: boolean;
  selfieUrl: string | null;
}

export interface DailySummaryIAmHere {
  visitId: string;
  proofImageUrl: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  notes: string | null;
  visitedAt: string | null;
  timeSpentMinutes?: number | null;
}

export interface DailySummaryPerformance {
  totalOrderAmount: number;
  orderCount: number;
  productiveVisits: number;
}

export interface DailySummaryItem {
  entityId: string;
  name: string;
  role: string;
  state: string | null;
  reportingManagerName: string | null;
  performance: DailySummaryPerformance | null;
  attendance: DailySummaryAttendance | null;
  iAmHere: DailySummaryIAmHere | null;
  timeSpentInMarketMinutes?: number | null;
  totalNewCounters?: number;
  isActive?: boolean;
}

export interface DailySummaryResponse {
  success: boolean;
  date: string;
  data: DailySummaryItem[];
  total: number;
}

export const summaryService = {
  getDailySummary: async (params: {
    date?: string;
    state?: string;
    role?: string;
  }): Promise<DailySummaryResponse> => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.state) query.set('state', params.state);
    if (params.role) query.set('role', params.role);
    const url = `/attendance/admin/daily-summary?${query.toString()}`;
    const res = await apiClient.get<DailySummaryResponse>(url);
    return res.data;
  },

  exportDailySummary: async (params: {
    fromDate: string;
    toDate: string;
    state?: string;
    role?: string;
    search?: string;
    attendance?: string;
  }): Promise<{ blob: any; fileName: string }> => {
    const query = new URLSearchParams();
    query.set('fromDate', params.fromDate);
    query.set('toDate', params.toDate);
    if (params.state) query.set('state', params.state);
    if (params.role) query.set('role', params.role);
    if (params.search) query.set('search', params.search);
    if (params.attendance) query.set('attendance', params.attendance);

    const url = `/attendance/admin/daily-summary/export?${query.toString()}`;
    const res = await apiClient.get(url, {
      responseType: 'blob',
      timeout: 60000,
    });

    const fileName =
      params.fromDate === params.toDate
        ? `daily-summary-${params.fromDate}.xlsx`
        : `daily-summary-${params.fromDate}_to_${params.toDate}.xlsx`;

    return { blob: res.data, fileName };
  },
};
