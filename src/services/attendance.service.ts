import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@/types';
import { Platform } from 'react-native';

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';
export type WorkingType = 'market_working' | 'joint_working' | 'distribution_point_visit' | 'super_point_visit' | 'other';

export interface IAttendanceHistoryParams {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  attendanceStatus?: AttendanceStatus;
  workingType?: WorkingType;
  isLate?: boolean;
  sortOrder?: string;
}

export interface IAttendanceHistoryRecord {
  attendanceId: string;
  userEntityId: string;
  attendanceStatus: AttendanceStatus;
  workingType: WorkingType;
  attendanceDateKey: string;
  markedAt: string;
  isLate: boolean;
  remark?: string;
  selfieUrl?: string;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  gpsErrorOverride?: boolean;
  gpsErrorReason?: string;
}

export interface ITodayAttendanceStatus {
  hasMarked: boolean;
  record?: IAttendanceHistoryRecord;
}

export interface IAttendanceMarkPayload {
  attendanceStatus: AttendanceStatus;
  workingType: WorkingType;
  remark?: string;
  selfie?: any;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  beat?: string;
  town?: string;
  gpsErrorOverride?: boolean;
  gpsErrorReason?: string;
}

export interface IAttendanceMarkResult {
  record: IAttendanceHistoryRecord;
}

export interface IAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  lateCount: number;
}

interface ApiSuccess<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const attendanceService = {
  getTodayStatus: async (): Promise<ITodayAttendanceStatus> => {
    const res = await apiClient.get<ApiSuccess<ITodayAttendanceStatus>>('/attendance/today-status');
    return res.data.data;
  },

  markTodayAttendance: async (payload: IAttendanceMarkPayload): Promise<IAttendanceMarkResult> => {
    const formData = new FormData();
    formData.append('attendanceStatus', payload.attendanceStatus);
    formData.append('workingType', payload.workingType);
    if (payload.remark?.trim()) {
      formData.append('remark', payload.remark.trim());
    }
    if (payload.selfie) {
      if (typeof File !== 'undefined' && (payload.selfie instanceof File || payload.selfie instanceof Blob)) {
        formData.append('selfie', payload.selfie);
      } else if (payload.selfie?.uri) {
        if (Platform.OS === 'web' || (typeof window !== 'undefined' && payload.selfie.uri.startsWith('blob:'))) {
          try {
            const blobRes = await fetch(payload.selfie.uri);
            const blob = await blobRes.blob();
            const file = new File([blob], payload.selfie.name || 'selfie.jpg', {
              type: payload.selfie.type || 'image/jpeg',
            });
            formData.append('selfie', file);
          } catch (e) {
            formData.append('selfie', payload.selfie);
          }
        } else {
          formData.append('selfie', {
            uri: payload.selfie.uri,
            name: payload.selfie.name || 'selfie.jpg',
            type: payload.selfie.type || 'image/jpeg',
          } as any);
        }
      } else {
        formData.append('selfie', payload.selfie);
      }
    }
    if (typeof payload.latitude === 'number') {
      formData.append('latitude', String(payload.latitude));
    }
    if (typeof payload.longitude === 'number') {
      formData.append('longitude', String(payload.longitude));
    }
    if (payload.locationAddress?.trim()) {
      formData.append('locationAddress', payload.locationAddress.trim());
    }
    if (payload.beat?.trim()) {
      formData.append('beat', payload.beat.trim());
    }
    if (payload.town?.trim()) {
      formData.append('town', payload.town.trim());
    }
    if (payload.gpsErrorOverride) {
      formData.append('gpsErrorOverride', String(payload.gpsErrorOverride));
    }
    if (payload.gpsErrorReason?.trim()) {
      formData.append('gpsErrorReason', payload.gpsErrorReason.trim());
    }

    const res = await apiClient.post<ApiSuccess<IAttendanceMarkResult>>('/attendance/mark', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return res.data.data;
  },

  getMyAttendanceHistory: async (
    params: IAttendanceHistoryParams = {}
  ): Promise<any> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    if (params.attendanceStatus) query.set('attendanceStatus', params.attendanceStatus);
    if (params.workingType) query.set('workingType', params.workingType);
    if (typeof params.isLate === 'boolean') query.set('isLate', String(params.isLate));
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const url = queryString ? `/attendance/my?${queryString}` : '/attendance/my';
    const res = await apiClient.get(url);
    return res.data;
  },

  getMyAttendanceSummary: async (
    params: Omit<IAttendanceHistoryParams, 'page' | 'limit' | 'sortOrder'> = {}
  ): Promise<IAttendanceSummary> => {
    const query = new URLSearchParams();
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    if (params.attendanceStatus) query.set('attendanceStatus', params.attendanceStatus);
    if (params.workingType) query.set('workingType', params.workingType);
    if (typeof params.isLate === 'boolean') query.set('isLate', String(params.isLate));

    const queryString = query.toString();
    const url = queryString ? `/attendance/my-summary?${queryString}` : '/attendance/my-summary';
    const res = await apiClient.get<ApiSuccess<IAttendanceSummary>>(url);
    return res.data.data;
  },

  getAdminAttendanceHistory: async (
    userEntityId: string,
    params: IAttendanceHistoryParams = {}
  ): Promise<any> => {
    const query = new URLSearchParams();
    query.set('userEntityId', userEntityId);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    if (params.attendanceStatus) query.set('attendanceStatus', params.attendanceStatus);
    if (params.workingType) query.set('workingType', params.workingType);
    if (typeof params.isLate === 'boolean') query.set('isLate', String(params.isLate));
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const url = `/attendance/admin/history?${queryString}`;
    const res = await apiClient.get(url);
    return res.data;
  },

  getAdminAttendanceSummary: async (
    userEntityId: string,
    params: Omit<IAttendanceHistoryParams, 'page' | 'limit' | 'sortOrder'> = {}
  ): Promise<IAttendanceSummary> => {
    const query = new URLSearchParams();
    query.set('userEntityId', userEntityId);
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    if (params.attendanceStatus) query.set('attendanceStatus', params.attendanceStatus);
    if (params.workingType) query.set('workingType', params.workingType);
    if (typeof params.isLate === 'boolean') query.set('isLate', String(params.isLate));

    const queryString = query.toString();
    const url = `/attendance/admin/summary?${queryString}`;
    const res = await apiClient.get<ApiSuccess<IAttendanceSummary>>(url);
    return res.data.data;
  },

  exportAdminAttendanceXlsx: async (params: {
    state: string;
    selectAll: boolean;
    userEntityIds?: string[];
    role?: UserRole;
    fromDate?: string;
    toDate?: string;
    attendanceStatus?: AttendanceStatus;
    workingType?: WorkingType;
    isLate?: boolean;
  }): Promise<any> => {
    const query = new URLSearchParams();
    query.set('state', params.state);
    query.set('selectAll', String(params.selectAll));
    if (params.userEntityIds && params.userEntityIds.length > 0) {
      query.set('userEntityIds', params.userEntityIds.join(','));
    }
    if (params.role) query.set('role', params.role);
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);
    if (params.attendanceStatus) query.set('attendanceStatus', params.attendanceStatus);
    if (params.workingType) query.set('workingType', params.workingType);
    if (typeof params.isLate === 'boolean') query.set('isLate', String(params.isLate));

    const url = `/attendance/admin/export?${query.toString()}`;
    const res = await apiClient.get(url, {
      responseType: 'blob',
    });
    return res.data;
  },
};
