import { apiClient } from '@/lib/api-client';
import type { IUser, ApiResponse, UserRole } from '@/types';

export type UserWithoutPassword = Omit<IUser, 'password'>;

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  state?: string;
  beat?: string;
  role?: UserRole | string;
  parentId?: string;
}

export interface ManagementUsersResponse extends PaginatedResponse<UserWithoutPassword> {
  meta?: {
    visibleRoles?: UserRole[];
    deactivationRoles?: UserRole[];
  };
}

export interface CreateUserRequest {
  name: string;
  state?: string;
  beat?: string;
  email?: string;
  phone: string;
  role: UserRole;
  entityId?: string;
  password?: string;
  parentId?: string;
  salesAgentId?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  retailerType?: string;
}

export interface EditUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  beat?: string;
  retailerType?: string;
}

export const userService = {
  listDistributors: async (params: UserListParams = {}): Promise<PaginatedResponse<UserWithoutPassword>> => {
    const res = await apiClient.get<PaginatedResponse<UserWithoutPassword>>('/users/distributors', { params });
    return res.data;
  },

  listSOs: async (params: UserListParams = {}): Promise<PaginatedResponse<UserWithoutPassword>> => {
    const res = await apiClient.get<PaginatedResponse<UserWithoutPassword>>('/users/agents', { params });
    return res.data;
  },

  listRetailers: async (params: UserListParams = {}): Promise<PaginatedResponse<UserWithoutPassword>> => {
    const res = await apiClient.get<PaginatedResponse<UserWithoutPassword>>('/users/retailers', { params });
    return res.data;
  },

  toggleStatus: async (entityId: string, isActive: boolean): Promise<{ user: UserWithoutPassword }> => {
    const res = await apiClient.patch<{ success: boolean; data: { user: UserWithoutPassword } }>(
      `/users/${entityId}/status`,
      { isActive }
    );
    return res.data.data;
  },

  createUser: async (data: CreateUserRequest): Promise<ApiResponse<{ user: UserWithoutPassword; generatedPassword?: string }>> => {
    const res = await apiClient.post<ApiResponse<{ user: UserWithoutPassword; generatedPassword?: string }>>('/users', data);
    return res.data;
  },

  listAll: async (params: UserListParams = {}): Promise<PaginatedResponse<UserWithoutPassword>> => {
    const res = await apiClient.get<PaginatedResponse<UserWithoutPassword>>('/users', { params });
    return res.data;
  },

  listSubordinates: async (params: UserListParams = {}): Promise<PaginatedResponse<UserWithoutPassword>> => {
    const res = await apiClient.get<PaginatedResponse<UserWithoutPassword>>('/users/subordinates', { params });
    return res.data;
  },

  listManagement: async (params: UserListParams = {}): Promise<ManagementUsersResponse> => {
    const res = await apiClient.get<ManagementUsersResponse>('/users/management', { params });
    return res.data;
  },

  countByRole: async (): Promise<ApiResponse<{ counts: Record<string, number> }>> => {
    const res = await apiClient.get<ApiResponse<{ counts: Record<string, number> }>>('/users/count-by-role');
    return res.data;
  },

  getByEntityId: async (entityId: string): Promise<ApiResponse<{ user: UserWithoutPassword }>> => {
    const res = await apiClient.get<ApiResponse<{ user: UserWithoutPassword }>>(`/users/${entityId}`);
    return res.data;
  },

  listBeats: async (params: { state?: string; role?: UserRole } = {}): Promise<string[]> => {
    const res = await apiClient.get<ApiResponse<string[]>>('/users/beats', { params });
    return res.data.data ?? [];
  },

  getBeatsForDistributors: async (distributorEntityIds: string[]): Promise<string[]> => {
    const res = await apiClient.post<ApiResponse<string[]>>('/users/beats/by-distributors', { distributorEntityIds });
    return res.data.data ?? [];
  },

  listUniqueStates: async (): Promise<string[]> => {
    const res = await apiClient.get<ApiResponse<string[]>>('/users/states');
    return res.data.data ?? [];
  },

  listByRole: async (role: UserRole): Promise<ApiResponse<UserWithoutPassword[]>> => {
    const res = await apiClient.get<ApiResponse<UserWithoutPassword[]>>(`/users/by-role/${role}`);
    return res.data;
  },

  deleteBeat: async (state: string, beat: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>('/users/beats', {
      params: { state, beat }
    });
    return res.data;
  },

  searchBeats: async (query: string, params: { state?: string; limit?: number; role?: UserRole } = {}): Promise<string[]> => {
    const res = await apiClient.get<ApiResponse<string[]>>('/users/beats/search', {
      params: { q: query, state: params.state, limit: params.limit, role: params.role },
    });
    return res.data.data ?? [];
  },

  editUser: async (entityId: string, data: EditUserRequest): Promise<ApiResponse<{ user: UserWithoutPassword }>> => {
    const res = await apiClient.patch<ApiResponse<{ user: UserWithoutPassword }>>(`/users/${entityId}`, data);
    return res.data;
  },

  adminResetPassword: async (entityId: string, newPassword: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.patch<ApiResponse<{ message: string }>>(`/users/${entityId}/password`, { newPassword });
    return res.data;
  },

  deleteUser: async (entityId: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/users/${entityId}`);
    return res.data;
  },
};
