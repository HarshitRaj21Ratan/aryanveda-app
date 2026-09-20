import { apiClient } from '@/lib/api-client';
import {
  inventoryService,
  type InventoryAnalyticsParams,
  type InventoryAnalyticsData,
  type InventoryWithLowStock,
} from '@/services/inventory.service';
import type { ApiResponse, PaginatedResponse } from '@/types';

export interface InventoryIntelSummary {
  totalSKUs: number;
  inStockCount?: number;
  zeroStockCount?: number;
  lowStockCount: number;
  slowMovingCount: number;
  totalInventoryValue: number;
  lastUpdated: string;
}

export interface InventoryIntelImportRow {
  entityId?: string;
  skuId: string;
  skuName?: string;
  category?: string;
  quantity: number;
  lowStockThreshold?: number;
}

export const inventoryIntelService = {
  getInventoryIntelSummary: async (entityId?: string): Promise<InventoryIntelSummary> => {
    const res = await apiClient.get<ApiResponse<InventoryIntelSummary>>('/inventory/intel/summary', {
      params: { entityId: entityId || undefined },
    });
    return res.data.data;
  },

  getStockOverview: async (
    entityId: string,
    params: { page?: number; limit?: number; lowStock?: boolean; skuId?: string; search?: string } = {}
  ): Promise<PaginatedResponse<InventoryWithLowStock>> => inventoryService.getInventory(entityId, params),

  getLowStockAlerts: async (entityId: string) => inventoryService.getLowStock(entityId),

  getAnalytics: async (params: InventoryAnalyticsParams = {}): Promise<ApiResponse<InventoryAnalyticsData>> =>
    inventoryService.getAnalytics(params),

  getLedger: async (entityId: string, params: { limit?: number; skip?: number } = {}) => {
    const res = await apiClient.get(`/inventory/${entityId}/ledger`, { params });
    return res.data;
  },

  importStock: async (rows: InventoryIntelImportRow[]): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<ApiResponse<any>>('/inventory/intel/import', { rows });
    return res.data;
  },

  adjustStock: inventoryService.adjustStock,
  updateThreshold: inventoryService.updateThreshold,
};
