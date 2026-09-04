import { apiClient } from '@/lib/api-client';
import type { INotification } from '@/types';

export interface NotificationListResponse {
  success: boolean;
  data: INotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const notificationService = {
  list: async (
    params: NotificationListParams = {}
  ): Promise<NotificationListResponse> => {
    const res = await apiClient.get<NotificationListResponse>(
      '/notifications',
      { params }
    );
    return res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<UnreadCountResponse>(
      '/notifications/unread-count'
    );
    return res.data.data.count;
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },
};
