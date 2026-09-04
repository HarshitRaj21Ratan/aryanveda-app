import { apiClient } from '@/lib/api-client';
import type { IAnnouncement, PaginatedResponse, ApiResponse } from '@/types';

export interface AnnouncementListParams {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface MobileUploadFile {
  uri: string;
  name: string;
  type: string;
}

export interface CreateAnnouncementData {
  title: string;
  description: string;
  images: Array<MobileUploadFile | File | any>;
  browserLinks?: string[];
  videoLinks?: string[];
}

export interface UpdateAnnouncementData {
  title?: string;
  description?: string;
  images?: Array<MobileUploadFile | File | any>;
  browserLinks?: string[];
  videoLinks?: string[];
}

export const announcementService = {
  list: async (
    params: AnnouncementListParams = {}
  ): Promise<PaginatedResponse<IAnnouncement>> => {
    const res = await apiClient.get<PaginatedResponse<IAnnouncement>>('/announcements', { params });
    return res.data;
  },

  getById: async (announcementId: string): Promise<ApiResponse<IAnnouncement>> => {
    const res = await apiClient.get<ApiResponse<IAnnouncement>>(`/announcements/${announcementId}`);
    return res.data;
  },

  create: async (data: CreateAnnouncementData): Promise<ApiResponse<IAnnouncement>> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);

    if (data.browserLinks && data.browserLinks.length > 0) {
      data.browserLinks.forEach((link) => formData.append('browserLinks', link));
    }

    if (data.videoLinks && data.videoLinks.length > 0) {
      data.videoLinks.forEach((link) => formData.append('videoLinks', link));
    }

    data.images.forEach((file) => {
      formData.append('images', file);
    });

    const res = await apiClient.post<ApiResponse<IAnnouncement>>('/announcements', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  update: async (announcementId: string, data: UpdateAnnouncementData): Promise<ApiResponse<IAnnouncement>> => {
    const formData = new FormData();

    if (data.title !== undefined) formData.append('title', data.title);
    if (data.description !== undefined) formData.append('description', data.description);

    if (data.browserLinks !== undefined) {
      data.browserLinks.forEach((link) => formData.append('browserLinks', link));
    }

    if (data.videoLinks !== undefined) {
      data.videoLinks.forEach((link) => formData.append('videoLinks', link));
    }

    if (data.images && data.images.length > 0) {
      data.images.forEach((file) => {
        formData.append('images', file);
      });
    }

    const res = await apiClient.patch<ApiResponse<IAnnouncement>>(`/announcements/${announcementId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  delete: async (announcementId: string): Promise<void> => {
    await apiClient.delete(`/announcements/${announcementId}`);
  },
};
