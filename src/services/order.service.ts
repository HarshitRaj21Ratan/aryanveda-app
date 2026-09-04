import { apiClient } from '@/lib/api-client';
import type { IOrder, PaginatedResponse, ApiResponse, OrderType, OrderStatus } from '@/types';

export interface CreatePrimaryOrderRequest {
  items: { skuId: string; quantity: number; unitMode?: 'dozen' | 'piece' | 'jar' | 'box' }[];
  idempotencyKey: string;
}

export interface CreateAmountPrimaryOrderRequest {
  items: { skuId: string; inputAmount: number }[];
  idempotencyKey: string;
}

export interface CreateSecondaryOrderRequest {
  retailerId?: string;
  onBehalfOf?: string;
  items: { skuId: string; quantity: number; unitMode?: 'dozen' | 'piece' | 'jar' | 'box' }[];
  idempotencyKey: string;
  soLatitude?: number;
  soLongitude?: number;
}

export interface CreateSalesUserOrderRequest {
  distributorId: string;
  items: { skuId: string; quantity: number; unitMode?: 'dozen' | 'piece' | 'jar' | 'box' }[];
  idempotencyKey: string;
}

export interface ConnectedDistributor {
  entityId: string;
  name: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface SoRetailerOrdersResponse {
  success: boolean;
  orders: IOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderApprovalPreviewLine {
  skuId: string;
  requiredPieces: number;
  availablePieces: number;
  remainingPieces: number;
  enoughStock: boolean;
}

export interface OrderApprovalPreview {
  orderId: string;
  supplierEntityId: string;
  distributorEntityId: string;
  lines: OrderApprovalPreviewLine[];
  canApprove: boolean;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  type?: OrderType;
  status?: OrderStatus;
  state?: string;
  beat?: string;
  orderFlow?: 'admin_to_super' | 'super_to_dist' | 'dist_to_ret';
  search?: string;
}

export type OrderExportParams = Omit<OrderListParams, 'page' | 'limit'>;

export interface UpdateStatusRequest {
  status: OrderStatus;
}

export interface OrderSummary {
  CREATED: number;
  IN_FINANCE: number;
  APPROVED: number;
  DISPATCHED: number;
  DELIVERED: number;
  CANCELLED: number;
  total: number;
}

export const orderService = {
  summary: async (params: OrderListParams = {}, refresh = false): Promise<ApiResponse<{ summary: OrderSummary }>> => {
    const queryParams = { ...params };
    if (refresh) (queryParams as any).refresh = 'true';
    const res = await apiClient.get<ApiResponse<{ summary: OrderSummary }>>('/orders/summary', { params: queryParams });
    return res.data;
  },

  createPrimary: async (
    data: CreatePrimaryOrderRequest
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>('/orders/primary', data);
    return res.data;
  },

  createAmountPrimary: async (
    data: CreateAmountPrimaryOrderRequest
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(
      '/orders/primary/amount',
      data
    );
    return res.data;
  },

  createSecondary: async (
    data: CreateSecondaryOrderRequest
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>('/orders/secondary', data);
    return res.data;
  },

  createOrderOnBehalfOf: async (
    data: CreateSecondaryOrderRequest
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>('/orders/secondary', data);
    return res.data;
  },

  list: async (params: OrderListParams = {}): Promise<PaginatedResponse<IOrder>> => {
    const res = await apiClient.get<PaginatedResponse<IOrder>>('/orders', { params });
    return res.data;
  },

  getOrdersForRetailer: async (
    retailerId: string,
    page = 1,
    limit = 20,
    type?: string,
    status?: string
  ): Promise<SoRetailerOrdersResponse> => {
    const res = await apiClient.get<SoRetailerOrdersResponse>(`/orders/so/retailer/${retailerId}`, {
      params: { page, limit, type, status },
    });
    return res.data;
  },

  getById: async (orderId: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.get<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}`);
    return res.data;
  },

  approve: async (orderId: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(
      `/orders/${orderId}/approve`
    );
    return res.data;
  },

  getApprovalPreview: async (orderId: string): Promise<ApiResponse<OrderApprovalPreview>> => {
    const res = await apiClient.get<ApiResponse<OrderApprovalPreview>>(
      `/orders/${orderId}/approval-preview`
    );
    return res.data;
  },

  updateStatus: async (
    orderId: string,
    data: UpdateStatusRequest
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.patch<ApiResponse<{ order: IOrder }>>(
      `/orders/${orderId}/status`,
      data
    );
    return res.data;
  },

  listPendingApproval: async (params: OrderListParams = {}): Promise<PaginatedResponse<IOrder>> => {
    const res = await apiClient.get<PaginatedResponse<IOrder>>('/orders/pending-approval', { params });
    return res.data;
  },

  adminApprove: async (orderId: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}/admin-approve`);
    return res.data;
  },

  adminReject: async (orderId: string, reason: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}/admin-reject`, { rejectionReason: reason });
    return res.data;
  },

  adminHandoverFinance: async (orderId: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}/admin-handover-finance`);
    return res.data;
  },

  financeEdit: async (
    orderId: string,
    items: { skuId: string; quantity: number; price: number }[]
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.patch<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}/finance-edit`, { items });
    return res.data;
  },

  financeApprove: async (orderId: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}/finance-approve`);
    return res.data;
  },

  financeReject: async (orderId: string, reason: string): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>(`/orders/${orderId}/finance-reject`, { rejectionReason: reason });
    return res.data;
  },

  getConnectedDistributors: async (): Promise<ApiResponse<{ distributors: ConnectedDistributor[] }>> => {
    const res = await apiClient.get<ApiResponse<{ distributors: ConnectedDistributor[] }>>('/orders/sales-user/connected-distributors');
    return res.data;
  },

  createSalesUserOrder: async (
    data: CreateSalesUserOrderRequest
  ): Promise<ApiResponse<{ order: IOrder }>> => {
    const res = await apiClient.post<ApiResponse<{ order: IOrder }>>('/orders/sales-user', data);
    return res.data;
  },
};
