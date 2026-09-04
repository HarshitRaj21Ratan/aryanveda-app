import { apiClient } from '@/lib/api-client';
import type { IUser } from '@/types';

export interface LoginResponse {
  success: boolean;
  data: {
    user: Pick<IUser, 'entityId' | 'name' | 'email' | 'role' | 'parentId' | 'isActive' | 'phone'>;
    token?: string;
  };
}

export const authService = {
  login: async (mobile: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { mobile, password });
    return res.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Swallowed
    }
  },

  me: async (): Promise<LoginResponse> => {
    const res = await apiClient.get<LoginResponse>('/auth/me');
    return res.data;
  },

  refresh: async (): Promise<void> => {
    await apiClient.post('/auth/refresh');
  },

  sendOtp: async (mobile: string): Promise<void> => {
    await apiClient.post('/auth/send-otp', { mobile });
  },

  resetPassword: async (mobile: string, otp: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { mobile, otp, newPassword });
  },

  saveEmailPreference: async (email?: string): Promise<any> => {
    const res = await apiClient.post('/auth/email-preference', { email });
    return res.data;
  },
};

