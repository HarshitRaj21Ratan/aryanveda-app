import { apiClient } from '@/lib/api-client';

export interface IGPSTrackSubmit {
  latitude: number;
  longitude: number;
  accuracy?: number;
  provider?: string;
  activityType?: string;
}

export interface IGPSTrackResult {
  trackId: string;
}

export interface ILocationHistoryRecord {
  trackId: string;
  userEntityId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  activityType?: string;
  createdAt: string;
}

export interface ITeamLocationRecord {
  entityId: string;
  name: string;
  role: string;
  state?: string;
  latitude: number | null;
  longitude: number | null;
  lastUpdated?: string | null;
}

export interface IGeofence {
  geofenceId: string;
  name: string;
  description?: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  state?: string;
  isActive: boolean;
}

export interface IGeofenceCheckResult {
  inside: boolean;
  geofenceName?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const locationService = {
  async submitTrack(payload: IGPSTrackSubmit): Promise<IGPSTrackResult> {
    const { data } = await apiClient.post<{ success: boolean; data: IGPSTrackResult }>(
      '/location/track',
      payload
    );
    return data.data;
  },

  async getMyLocationHistory(params: {
    page?: number;
    limit?: number;
    fromDate?: string;
    toDate?: string;
    activityType?: string;
  }): Promise<PaginatedResponse<ILocationHistoryRecord>> {
    const { data } = await apiClient.get<PaginatedResponse<ILocationHistoryRecord>>(
      '/location/my-history',
      { params }
    );
    return data;
  },

  async getAdminLocationHistory(params: {
    userEntityId: string;
    page?: number;
    limit?: number;
    fromDate?: string;
    toDate?: string;
    activityType?: string;
  }): Promise<PaginatedResponse<ILocationHistoryRecord>> {
    const { data } = await apiClient.get<PaginatedResponse<ILocationHistoryRecord>>(
      '/location/admin/history',
      { params }
    );
    return data;
  },

  async getTeamLiveLocations(params?: { state?: string; role?: string; search?: string }): Promise<ITeamLocationRecord[]> {
    const { data } = await apiClient.get<{ success: boolean; data: ITeamLocationRecord[] }>(
      '/location/admin/team-live',
      { params }
    );
    return data.data;
  },

  async checkGeofence(latitude: number, longitude: number): Promise<IGeofenceCheckResult> {
    const { data } = await apiClient.post<{ success: boolean; data: IGeofenceCheckResult }>(
      '/location/check-geofence',
      { latitude, longitude }
    );
    return data.data;
  },

  async createGeofence(payload: {
    name: string;
    description?: string;
    centerLatitude: number;
    centerLongitude: number;
    radiusMeters: number;
    state?: string;
    territoryEntityId?: string;
  }): Promise<IGeofence> {
    const { data } = await apiClient.post<{ success: boolean; data: IGeofence }>(
      '/location/geofences',
      payload
    );
    return data.data;
  },

  async listGeofences(state?: string): Promise<IGeofence[]> {
    const { data } = await apiClient.get<{ success: boolean; data: IGeofence[] }>(
      '/location/geofences',
      { params: state ? { state } : {} }
    );
    return data.data;
  },

  async updateGeofence(
    geofenceId: string,
    payload: Partial<{
      name: string;
      description: string;
      centerLatitude: number;
      centerLongitude: number;
      radiusMeters: number;
      state: string;
    }>
  ): Promise<IGeofence> {
    const { data } = await apiClient.patch<{ success: boolean; data: IGeofence }>(
      `/location/geofences/${geofenceId}`,
      payload
    );
    return data.data;
  },

  async deleteGeofence(geofenceId: string): Promise<void> {
    await apiClient.delete(`/location/geofences/${geofenceId}`);
  },
};
