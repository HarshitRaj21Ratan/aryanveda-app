import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export type StockHealthColor = 'gray' | 'red' | 'yellow' | 'green';
export type StockMovementStatus = 'no_data' | 'critical' | 'warning' | 'healthy';

export interface SkuMovementRow {
  skuId: string;
  skuName: string;
  weight: string;
  principal: string;
  currentQuantity: number;
  openingStock: number;
  totalSoldInPeriod: number;
  sellPercentage: number;
  status: StockMovementStatus;
  colorCode: StockHealthColor;
  periodDays: number;

  firstOrderQuantity: number;
  refillQuantity: number;
  refillCount: number;
  soldQuantity: number;
  remainingAfterSell: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;

  openingQty: number;
  totalIn: number;
  totalOut: number;
  closingQty: number;
  lastInAt: string | null;
  lastOutAt: string | null;
  color: StockHealthColor;
}

export interface EntityMovementSummary {
  entityId: string;
  entityName: string;
  entityRole: string;
  entityState?: string;
  totalSkus: number;
  noDataCount: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  skus: SkuMovementRow[];
}

export interface StockMovementResponse {
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  entities: EntityMovementSummary[];
}

export const stockMovementService = {
  async getOwnMovement(days: number = 45, startDate?: string, endDate?: string): Promise<StockMovementResponse> {
    const params: Record<string, string | number> = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await apiClient.get<ApiResponse<StockMovementResponse>>(
      '/stock-movement/own',
      { params, timeout: 120000 },
    );
    return res.data.data!;
  },

  async getDownstreamMovement(
    days: number = 45,
    targetEntityId?: string,
    state?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<StockMovementResponse> {
    const params: Record<string, string | number> = { days, limit: -1 };
    if (targetEntityId) params.targetEntityId = targetEntityId;
    if (state) params.state = state;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await apiClient.get<ApiResponse<StockMovementResponse>>(
      '/stock-movement/downstream',
      { params, timeout: 120000 },
    );
    return res.data.data!;
  },
};
