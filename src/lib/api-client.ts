import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { Platform } from 'react-native';

const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:5000',
  default: 'http://localhost:5000',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message ?? '';

    if (status === 401) {
      const url = error.config?.url ?? '';
      const isAuthRoute = url.includes('/auth/');
      if (!isAuthRoute) {
        useAuthStore.getState().logout();
      }
    }

    if (status === 403 && message.toLowerCase().includes('deactivated')) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);
