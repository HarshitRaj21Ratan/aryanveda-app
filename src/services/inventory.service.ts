import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export interface IInventory {
  _id?: string;
  entityId?: string;
  skuId: string;
  quantity: number;
  lowStockThreshold: number;
  refillCount?: number;
  lastRefillDate?: string | Date | null;
  lastRefillQuantity?: number;
  quantityAtLastRefill?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryWithLowStock extends IInventory {
  isLowStock: boolean;
  entityId?: string;
  skuName?: string;
  skuCategory?: string;
  skuWeight?: string;
  currentStockInCase?: number;
  boxQty?: number;
  masterPackQty?: number;
  superTotal?: number;
  superPerBox?: number;
}

export interface InventoryListParams {
  page?: number;
  limit?: number;
  lowStock?: boolean;
  skuId?: string;
  search?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SkuAnalyticsRow {
  masterSkuId: string;
  name: string;
  weight?: string;
  principal: string;
  boxPrice: number;
  boxQty: number;
  masterPackQty: number;
  masterPackUnit: string;
  quantityAvailable: number;
  unitCost: number;
  totalValue: number;
  lowStockFlag: boolean;
  displayRequiredQty: number;
}

export interface AnalyticsSummary {
  totalSkuCount: number;
  totalUnitsInStock: number;
  totalInventoryValue: number;
  lowStockSkuCount: number;
}

export interface InventoryAnalyticsData {
  summary: AnalyticsSummary;
  skus: SkuAnalyticsRow[];
  total: number;
  page: number;
  limit: number;
}

export interface InventoryAnalyticsParams {
  page?: number;
  limit?: number;
  entityId?: string;
  search?: string;
  principal?: string;
  lowStockOnly?: boolean;
  sortBy?: 'name' | 'quantity' | 'value' | 'lowStock';
  sortOrder?: 'asc' | 'desc';
}

export const inventoryService = {
  getInventory: async (
    entityId: string,
    params: InventoryListParams = {}
  ): Promise<PaginatedResponse<InventoryWithLowStock>> => {
    const res = await apiClient.get<PaginatedResponse<InventoryWithLowStock>>(
      `/inventory/${entityId}`,
      { params }
    );
    return res.data;
  },

  adminGetUserInventory: async (
    params: { entityId: string; page?: number; limit?: number; search?: string; lowStock?: boolean }
  ): Promise<PaginatedResponse<InventoryWithLowStock>> => {
    const res = await apiClient.get<PaginatedResponse<InventoryWithLowStock>>(
      '/inventory/admin/user-inventory',
      { params }
    );
    return res.data;
  },

  getInventoryValue: async (entityId: string): Promise<ApiResponse<{ totalValue: number }>> => {
    const res = await apiClient.get<ApiResponse<{ totalValue: number }>>(`/inventory/${entityId}/value`);
    return res.data;
  },

  getLowStock: async (entityId: string): Promise<{ total: number }> => {
    const res = await apiClient.get<{ success: boolean; total: number }>(`/inventory/${entityId}/low-stock`);
    return res.data;
  },

  adjustStock: async (
    entityId: string,
    skuId: string,
    payload: { quantityChange: number }
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      `/inventory/${entityId}/adjust/${skuId}`,
      payload
    );
    return res.data;
  },

  updateThreshold: async (
    entityId: string,
    skuId: string,
    payload: { lowStockThreshold: number }
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.put<ApiResponse<unknown>>(
      `/inventory/${entityId}/threshold/${skuId}`,
      payload
    );
    return res.data;
  },

  getAnalytics: async (
    params: InventoryAnalyticsParams = {}
  ): Promise<ApiResponse<InventoryAnalyticsData>> => {
    const res = await apiClient.get<ApiResponse<InventoryAnalyticsData>>(
      '/inventory/analytics',
      { params }
    );
    return res.data;
  },

  getAnalyticsPrincipals: async (params: { entityId?: string } = {}): Promise<ApiResponse<string[]>> => {
    const res = await apiClient.get<ApiResponse<string[]>>(
      '/inventory/analytics/principals',
      { params }
    );
    return res.data;
  },
};
