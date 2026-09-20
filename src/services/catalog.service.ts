import { apiClient } from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse } from '@/types';

export interface IMasterSku {
  _id: string;
  masterSkuId: string;
  name: string;
  principal: string;
  category: string;
  weight: string;
  mrpPerUnit: number;
  masterPackQty: number;
  masterPackUnit: string;
  pricePerDozenSS: number;
  pricePerDozenDist: number;
  pricePerDozenRetail: number;
  boxPrice: number;
  unitPrice: number;
  schemePercent: number;
  displayRequiredQty: number;
  schemeEligible: boolean;
  isActive: boolean;
  enabled?: boolean;
  assortmentActive?: boolean;
  companyStock?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IMasterSkuPriceRow extends Partial<IMasterSku> {
  masterSkuId: string;
  name: string;
  principal: string;
  boxPrice: number;
  unitPrice: number;
  sellingPrice: number;
  isCustomPrice: boolean;
  displayRequiredQty: number;
  schemeEligible: boolean;
}

export interface CatalogListParams {
  page?: number;
  limit?: number;
  search?: string;
  principal?: string;
}

export type AdminPricingScope = 'GLOBAL' | 'STATE' | 'ENTITY';

export interface CreateMasterSkuPayload {
  masterSkuId: string;
  name: string;
  principal: string;
  boxPrice: number;
  unitPrice: number;
  displayRequiredQty: number;
  schemeEligible: boolean;
  weight?: string;
  mrpPerUnit?: number;
  offerRateNew?: number;
  masterPackQty?: number;
  masterPackUnit?: string;
  perPcPrice?: number;
  schemePercent?: number;
  schemeAmount?: number;
  billing?: number;
  tax18?: number;
  tax5?: number;
  superTotal?: number;
  ssMargin?: number;
  distributorTotal?: number;
  distMargin?: number;
  retailTotal?: number;
  pricePerDozenSS?: number;
  pricePerDozenDist?: number;
  pricePerDozenRetail?: number;
  superPerBox?: number;
  distPerBox?: number;
  retailPerBox?: number;
  boxQty?: number;
  boxRate?: number;
  retailPerPiece?: number;
}

export interface UpdateMasterSkuPayload {
  name?: string;
  principal?: string;
  weight?: string;
  category?: string;
  unitPrice?: number;
  mrpPerUnit?: number;
  offerRateNew?: number;
  perPcPrice?: number;
  masterPackQty?: number;
  masterPackUnit?: string;
  schemePercent?: number;
  schemeAmount?: number;
  billing?: number;
  tax18?: number;
  tax5?: number;
  superTotal?: number;
  ssMargin?: number;
  distributorTotal?: number;
  distMargin?: number;
  retailTotal?: number;
  pricePerDozenSS?: number;
  pricePerDozenDist?: number;
  pricePerDozenRetail?: number;
  retailPerPiece?: number;
  distPerBox?: number;
  retailPerBox?: number;
  superPerBox?: number;
  boxQty?: number;
  boxRate?: number;
  boxPrice?: number;
  displayRequiredQty?: number;
  schemeEligible?: boolean;
  isActive?: boolean;
}

export const catalogService = {
  list: async (params: CatalogListParams = {}): Promise<PaginatedResponse<IMasterSku>> => {
    const res = await apiClient.get<PaginatedResponse<IMasterSku>>('/catalog', { params });
    return res.data;
  },

  getById: async (masterSkuId: string): Promise<ApiResponse<{ sku: IMasterSku }>> => {
    const res = await apiClient.get<ApiResponse<{ sku: IMasterSku }>>(`/catalog/${masterSkuId}`);
    return res.data;
  },

  listPrincipals: async (): Promise<ApiResponse<string[]>> => {
    const res = await apiClient.get<ApiResponse<string[]>>('/catalog/principals');
    return res.data;
  },

  getAssortment: async (params: CatalogListParams = {}): Promise<PaginatedResponse<IMasterSku>> => {
    const res = await apiClient.get<PaginatedResponse<IMasterSku>>('/catalog/assortment', { params });
    return res.data;
  },

  adminCreateSku: async (payload: CreateMasterSkuPayload): Promise<ApiResponse<{ sku: IMasterSku }>> => {
    const res = await apiClient.post<ApiResponse<{ sku: IMasterSku }>>('/catalog/admin/sku', payload);
    return res.data;
  },

  adminUpdateSku: async (masterSkuId: string, payload: UpdateMasterSkuPayload): Promise<ApiResponse<{ sku: IMasterSku }>> => {
    const res = await apiClient.patch<ApiResponse<{ sku: IMasterSku }>>(`/catalog/admin/sku/${masterSkuId}`, payload);
    return res.data;
  },

  adminUpdateStock: async (masterSkuId: string, companyStock: number): Promise<ApiResponse<{ sku: IMasterSku }>> => {
    const res = await apiClient.patch<ApiResponse<{ sku: IMasterSku }>>(`/catalog/admin/stock/${masterSkuId}`, { companyStock });
    return res.data;
  },

  adminAddStock: async (masterSkuId: string, quantity: number): Promise<ApiResponse<{ sku: IMasterSku }>> => {
    const res = await apiClient.post<ApiResponse<{ sku: IMasterSku }>>('/catalog/admin/add-stock', { masterSkuId, quantity });
    return res.data;
  },

  adminDeleteSku: async (masterSkuId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.delete<ApiResponse<unknown>>(`/catalog/admin/sku/${masterSkuId}`);
    return res.data;
  },

  adminBulkImport: async (rows: any[]): Promise<ApiResponse<{ inserted: number; existing: number; invalid: number }>> => {
    const res = await apiClient.post<ApiResponse<{ inserted: number; existing: number; invalid: number }>>('/catalog/admin/bulk-import', { rows });
    return res.data;
  },

  enableSku: async (masterSkuId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/catalog/assortment/enable', {
      masterSkuId,
    });
    return res.data;
  },

  disableSku: async (masterSkuId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/catalog/assortment/disable', {
      masterSkuId,
    });
    return res.data;
  },

  bulkToggle: async (
    enableIds: string[],
    disableIds: string[]
  ): Promise<ApiResponse<{ enabled: number; disabled: number }>> => {
    const res = await apiClient.post<ApiResponse<{ enabled: number; disabled: number }>>(
      '/catalog/assortment/bulk',
      { enableIds, disableIds }
    );
    return res.data;
  },

  getEntityPricing: async (
    targetEntityId: string,
    params: CatalogListParams = {}
  ): Promise<PaginatedResponse<IMasterSkuPriceRow>> => {
    const res = await apiClient.get<PaginatedResponse<IMasterSkuPriceRow>>(
      `/catalog/pricing/${targetEntityId}`,
      { params }
    );
    return res.data;
  },

  setEntityPrice: async (
    targetEntityId: string,
    masterSkuId: string,
    sellingPrice: number
  ): Promise<ApiResponse<{ pricing: unknown }>> => {
    const res = await apiClient.put<ApiResponse<{ pricing: unknown }>>(
      `/catalog/pricing/${targetEntityId}/${masterSkuId}`,
      { sellingPrice }
    );
    return res.data;
  },

  bulkSetPrices: async (
    targetEntityId: string,
    prices: { masterSkuId: string; sellingPrice: number }[]
  ): Promise<ApiResponse<{ updated: number; failed: number }>> => {
    const res = await apiClient.put<ApiResponse<{ updated: number; failed: number }>>(
      `/catalog/pricing/${targetEntityId}/bulk`,
      { prices }
    );
    return res.data;
  },

  adminGetScopedPricing: async (
    scope: AdminPricingScope,
    params: CatalogListParams & { targetId?: string } = {}
  ): Promise<PaginatedResponse<IMasterSkuPriceRow>> => {
    const res = await apiClient.get<PaginatedResponse<IMasterSkuPriceRow>>('/pricing/catalog', {
      params: {
        scope,
        targetId: params.targetId,
        page: params.page,
        limit: params.limit,
        search: params.search,
        principal: params.principal,
      },
    });
    return res.data;
  },

  adminSetScopedPrice: async (
    scope: AdminPricingScope,
    masterSkuId: string,
    sellingPrice: number,
    targetId?: string
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.put<ApiResponse<unknown>>(`/pricing/catalog/${masterSkuId}`, {
      scope,
      targetId,
      sellingPrice,
    });
    return res.data;
  },

  adminBulkSetScopedPrices: async (
    scope: AdminPricingScope,
    prices: { masterSkuId: string; sellingPrice: number }[],
    targetId?: string
  ): Promise<ApiResponse<{ updated: number; failed: number }>> => {
    const res = await apiClient.put<ApiResponse<{ updated: number; failed: number }>>(
      '/pricing/catalog/bulk',
      {
        scope,
        targetId,
        prices,
      }
    );
    return res.data;
  },

  adminUploadScopedPricingFile: async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    scope: string,
    targetId?: string
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as any);
    formData.append('scope', scope);
    if (targetId) {
      formData.append('targetId', targetId);
    }

    const res = await apiClient.post('/pricing/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};
