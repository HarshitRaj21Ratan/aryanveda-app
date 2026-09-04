import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export type VisitPerformancePeriod = 'day' | 'week' | 'month';

export interface VisitPerformanceBucket {
  key: string;
  label: string;
  rangeStartKey: string;
  rangeEndKey: string;
  visits: number;
  productive: number;
  visitedOnly: number;
  productivityRate: number;
}

export interface VisitPerformanceSummary {
  totalVisits: number;
  productiveVisits: number;
  visitedOnlyVisits: number;
  productivityRate: number;
  totalOrdersFromVisits: number;
  productiveOrderAmount: number;
  totalTimeSpentMinutes: number;
  averageTimeSpentMinutes: number;
  newCountersAdded: number;
  newDistributorsAdded: number;
  newSupersAdded: number;
}

export interface VisitPerformanceRecentRow {
  visitId: string;
  retailerEntityId: string;
  retailerName: string;
  retailerBeat?: string;
  visitDateKey: string;
  visitedAt: string;
  proofImageUrl: string;
  productive: boolean;
  classification: 'productive' | 'visited' | 'out_store';
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  isIAmHere?: boolean;
  notes?: string;
  timeSpentMinutes?: number;
  manualVerify?: boolean;
  distanceFromStore?: number;
  createdByEntityId?: string;
  createdByName?: string;
}

export interface VisitPerformance {
  period: VisitPerformancePeriod;
  summary: VisitPerformanceSummary;
  buckets: VisitPerformanceBucket[];
  recentVisits: VisitPerformanceRecentRow[];
}

export interface CreatedVisit {
  visitId: string;
  retailerEntityId: string;
  retailerName: string;
  visitDateKey: string;
  visitedAt: string;
  proofImageUrl: string;
  productive: boolean;
  classification: 'productive' | 'visited' | 'out_store';
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  manualVerify?: boolean;
  distanceFromStore?: number;
  isIAmHere?: boolean;
}

export const visitService = {
  createVisit: async (
    retailerId: string,
    photo: { uri: string; name: string; type: string },
    notes?: string,
    location?: { latitude: number; longitude: number; locationAddress?: string },
    manualVerify?: boolean,
    distanceFromStore?: number
  ): Promise<CreatedVisit> => {
    const form = new FormData();
    form.append('retailerId', retailerId);
    if (photo) {
      form.append('photo', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as any);
    }
    if (notes?.trim()) form.append('notes', notes.trim());
    if (location) {
      form.append('latitude', String(location.latitude));
      form.append('longitude', String(location.longitude));
      if (location.locationAddress?.trim()) {
        form.append('locationAddress', location.locationAddress.trim());
      }
    }
    if (manualVerify) {
      form.append('manualVerify', 'true');
    }
    if (typeof distanceFromStore === 'number') {
      form.append('distanceFromStore', String(Math.round(distanceFromStore)));
    }

    const res = await apiClient.post<ApiResponse<CreatedVisit>>('/retailer-visits', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  createIAmHere: async (
    remark: string,
    photo: { uri: string; name: string; type: string },
    location?: { latitude: number; longitude: number; locationAddress?: string }
  ): Promise<CreatedVisit> => {
    const form = new FormData();
    form.append('remark', remark.trim());
    
    form.append('photo', {
      uri: photo.uri,
      name: photo.name,
      type: photo.type,
    } as any);

    if (location) {
      form.append('latitude', String(location.latitude));
      form.append('longitude', String(location.longitude));
      if (location.locationAddress?.trim()) {
        form.append('locationAddress', location.locationAddress.trim());
      }
    }

    const res = await apiClient.post<ApiResponse<CreatedVisit>>('/retailer-visits/iamhere', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  getPerformance: async (period: VisitPerformancePeriod, fromDate?: string, toDate?: string, beat?: string): Promise<VisitPerformance> => {
    const params: Record<string, string> = { period };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (beat) params.beat = beat;

    const res = await apiClient.get<ApiResponse<VisitPerformance>>('/retailer-visits/performance', {
      params,
    });
    return res.data.data;
  },

  getAdminPerformance: async (soEntityId: string | string[], period: VisitPerformancePeriod, fromDate?: string, toDate?: string, beat?: string, state?: string): Promise<VisitPerformance> => {
    const params: Record<string, string> = { period };
    if (Array.isArray(soEntityId)) {
      params.soEntityIds = soEntityId.join(',');
    } else {
      params.soEntityId = soEntityId;
    }
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (beat) params.beat = beat;
    if (state) params.state = state;

    const res = await apiClient.get<ApiResponse<VisitPerformance>>('/retailer-visits/admin/performance', {
      params,
    });
    return res.data.data;
  },

  getAdminNewEntities: async (params: {
    soEntityId: string | string[];
    period: VisitPerformancePeriod;
    fromDate?: string;
    toDate?: string;
    state?: string;
  }): Promise<any[]> => {
    const queryParams: Record<string, string> = { period: params.period };
    if (Array.isArray(params.soEntityId)) {
      queryParams.soEntityIds = params.soEntityId.join(',');
    } else {
      queryParams.soEntityId = params.soEntityId;
    }
    if (params.fromDate) queryParams.fromDate = params.fromDate;
    if (params.toDate) queryParams.toDate = params.toDate;
    if (params.state) queryParams.state = params.state;

    const res = await apiClient.get<ApiResponse<any[]>>('/retailer-visits/admin/performance/new-entities', {
      params: queryParams,
    });
    return res.data.data;
  },
};
