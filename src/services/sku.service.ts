import { apiClient } from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse, ISku } from '@/types';

export interface CreateSkuRequest {
  skuId: string;
  name: string;
  description?: string;
  price: number;
  displayRequired?: number;
  schemeEligible?: boolean;
}

export interface UpdateSkuRequest {
  name?: string;
  description?: string;
  price?: number;
  displayRequired?: number;
  schemeEligible?: boolean;
  isActive?: boolean;
}

export interface SkuListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
  targetEntityId?: string;
}

export const skuService = {
  list: async (params: SkuListParams = {}): Promise<PaginatedResponse<ISku>> => {
    const res = await apiClient.get<PaginatedResponse<ISku>>('/skus', { params });
    return res.data;
  },

  getById: async (skuId: string): Promise<ApiResponse<{ sku: ISku }>> => {
    const res = await apiClient.get<ApiResponse<{ sku: ISku }>>(`/skus/${skuId}`);
    return res.data;
  },

  create: async (data: CreateSkuRequest): Promise<ApiResponse<{ sku: ISku }>> => {
    const res = await apiClient.post<ApiResponse<{ sku: ISku }>>('/skus', data);
    return res.data;
  },

  update: async (skuId: string, data: UpdateSkuRequest): Promise<ApiResponse<{ sku: ISku }>> => {
    const res = await apiClient.patch<ApiResponse<{ sku: ISku }>>(`/skus/${skuId}`, data);
    return res.data;
  },
};
