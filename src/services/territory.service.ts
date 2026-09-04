import { apiClient } from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse, ITerritoryAssignment } from '@/types';

export interface TerritoryListParams {
  page?: number;
  limit?: number;
  agentEntityId?: string;
  agentRole?: string;
  targetRole?: string;
  includeInactive?: boolean;
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTerritoryRequest {
  agentEntityId: string;
  targetEntityId: string;
  assignedBy: string;
}

export interface UpdateTerritoryRequest {
  isActive?: boolean;
}

export const territoryService = {
  create: async (data: CreateTerritoryRequest): Promise<ApiResponse<ITerritoryAssignment>> => {
    const res = await apiClient.post<ApiResponse<ITerritoryAssignment>>('/territories', data);
    return res.data;
  },

  list: async (params: TerritoryListParams = {}): Promise<PaginatedResponse<ITerritoryAssignment>> => {
    const res = await apiClient.get<PaginatedResponse<ITerritoryAssignment>>('/territories', { params });
    return res.data;
  },

  getById: async (assignmentId: string): Promise<ApiResponse<ITerritoryAssignment>> => {
    const res = await apiClient.get<ApiResponse<ITerritoryAssignment>>(`/territories/${assignmentId}`);
    return res.data;
  },

  getByAgent: async (entityId: string): Promise<ApiResponse<ITerritoryAssignment[]>> => {
    const res = await apiClient.get<ApiResponse<ITerritoryAssignment[]>>(`/territories/agent/${entityId}`);
    return res.data;
  },

  update: async (assignmentId: string, data: UpdateTerritoryRequest): Promise<ApiResponse<ITerritoryAssignment>> => {
    const res = await apiClient.put<ApiResponse<ITerritoryAssignment>>(`/territories/${assignmentId}`, data);
    return res.data;
  },

  deactivate: async (assignmentId: string): Promise<ApiResponse<ITerritoryAssignment>> => {
    const res = await apiClient.delete<ApiResponse<ITerritoryAssignment>>(`/territories/${assignmentId}`);
    return res.data;
  },

  getNetwork: async (entityId: string, params: { filterRole?: string; page?: number; limit?: number } = {}): Promise<{
    success: boolean;
    data: {
      centerPerson: { entityId: string; name: string; role: string; parentId?: string; isActive: boolean; phone?: string; state?: string };
      connectedPeople: Array<{ entityId: string; name: string; role: string; parentId?: string; isActive: boolean; phone?: string; state?: string }>;
      totalByRole: Record<string, number>;
    };
    total: number;
    page: number;
    limit: number;
  }> => {
    const res = await apiClient.get(`/territories/network/${entityId}`, { params });
    return res.data;
  },

  getSheet: async (params: { state?: string; entityId?: string; page?: number; limit?: number } = {}): Promise<{
    success: boolean;
    data: Array<{
      entityId: string;
      state: string;
      beat: string;
      retailerName: string;
      retailerMobile: string;
      retailerJoinedAt?: string;
      dbName: string;
      dbMobile: string;
      dbJoinedAt?: string;
      superName: string;
      superMobile: string;
      superJoinedAt?: string;
      aseName: string;
      aseMobile: string;
      aseJoinedAt?: string;
      soName: string;
      soMobile: string;
      soJoinedAt?: string;
      asmName: string;
      asmMobile: string;
      asmJoinedAt?: string;
      rsmName: string;
      rsmMobile: string;
      rsmJoinedAt?: string;
      nsmName: string;
      nsmMobile: string;
      nsmJoinedAt?: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> => {
    const res = await apiClient.get('/territories/sheet', { params });
    return res.data;
  }
};
