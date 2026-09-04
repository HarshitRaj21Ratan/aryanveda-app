import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@/types';

export interface CapabilityEntry {
  key: string;
  label: string;
}

export interface CapabilityGroup {
  name: string;
  capabilities: CapabilityEntry[];
}

export interface RoleColumn {
  key: string;
  label: string;
  shortLabel: string;
}

export interface CapabilityMatrixData {
  matrix: Record<string, string[]>;
  groups: CapabilityGroup[];
  roles: RoleColumn[];
}

interface ApiSuccess<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const capabilityManagementService = {
  getMatrix: async (): Promise<CapabilityMatrixData> => {
    const res = await apiClient.get<ApiSuccess<CapabilityMatrixData>>('/admin/capabilities');
    return res.data.data;
  },

  saveMatrix: async (matrix: Record<string, string[]>): Promise<void> => {
    await apiClient.put('/admin/capabilities', { matrix });
  },

  resetToDefaults: async (): Promise<void> => {
    await apiClient.post('/admin/capabilities/reset');
  },
};
