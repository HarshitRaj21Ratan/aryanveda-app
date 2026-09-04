import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export interface AvailableSo {
  entityId: string;
  name: string;
  email: string;
  phone: string;
  territory: string | null;
}

export interface SoAuthorizedRetailer {
  retailerId: string;
  entityId: string;
  name: string;
  email: string;
  phone: string;
  territory: string | null;
  beat?: string | null;
  storeLatitude: number | null;
  storeLongitude: number | null;
  authorizedAt: string;
}

export interface RetailerAuthorizationInfo {
  so: {
    entityId: string;
    name: string;
    email: string;
    phone: string;
  };
  authorizedAt: string;
}

export interface AuthorizeSoPayload {
  soId: string;
}

export interface AuthorizeSoResponse {
  success: boolean;
  authorization: {
    soId: string;
    soName: string;
    authorizedAt: string;
  };
}

export const retailerAuthorizationService = {
  getMySo: async (): Promise<ApiResponse<RetailerAuthorizationInfo | null>> => {
    const res = await apiClient.get<
      | ApiResponse<RetailerAuthorizationInfo | null>
      | { success: boolean; authorization: RetailerAuthorizationInfo | null }
    >('/retailer-authorization/my-so');

    const payload = res.data as { success: boolean; data?: RetailerAuthorizationInfo | null; authorization?: RetailerAuthorizationInfo | null };

    return {
      success: payload.success,
      data: payload.data ?? payload.authorization ?? null,
    };
  },

  getAvailableSos: async (): Promise<{ success: boolean; sos: AvailableSo[] }> => {
    const res = await apiClient.get<{ success: boolean; sos: AvailableSo[] }>('/retailer-authorization/available-sos');
    return res.data;
  },

  getMyRetailers: async (): Promise<{ success: boolean; retailers: SoAuthorizedRetailer[] }> => {
    const res = await apiClient.get<{ success: boolean; retailers: SoAuthorizedRetailer[] }>('/retailer-authorization/my-retailers');
    return res.data;
  },

  authorizeSo: async (payload: AuthorizeSoPayload): Promise<AuthorizeSoResponse> => {
    const res = await apiClient.post<AuthorizeSoResponse>('/retailer-authorization/authorize', payload);
    return res.data;
  },

  revokeSo: async (): Promise<{ success: boolean; revoked: boolean }> => {
    const res = await apiClient.delete<{ success: boolean; revoked: boolean }>('/retailer-authorization/revoke');
    return res.data;
  },
};
