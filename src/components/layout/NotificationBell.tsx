import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { notificationService } from '@/services/notification.service';
import { useAuthStore } from '@/store/auth.store';
import { NotificationType } from '@/types';
import type { INotification } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatBadge(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

const TYPE_ICON: Record<NotificationType, { name: any; color: string; bg: string }> = {
  [NotificationType.ORDER_CREATED]: {
    name: 'cart-outline',
    color: '#f97316',
    bg: '#ffedd5',
  },
  [NotificationType.ORDER_APPROVED]: {
    name: 'checkmark-circle-outline',
    color: '#059669',
    bg: '#d1fae5',
  },
  [NotificationType.ORDER_DISPATCHED]: {
    name: 'bus-outline',
    color: '#d97706',
    bg: '#fef3c7',
  },
  [NotificationType.ORDER_DELIVERED]: {
    name: 'cube-outline',
    color: '#16a34a',
    bg: '#dcfce7',
  },
  [NotificationType.ORDER_CANCELLED]: {
    name: 'close-circle-outline',
    color: '#ef4444',
    bg: '#fee2e2',
  },
  [NotificationType.USER_DEACTIVATED]: {
    name: 'close-circle-outline',
    color: '#ef4444',
    bg: '#fee2e2',
  },
  [NotificationType.USER_ACTIVATED]: {
    name: 'checkmark-circle-outline',
    color: '#059669',
    bg: '#d1fae5',
  },
  [NotificationType.SKU_ADDED]: {
    name: 'cube-outline',
    color: '#f97316',
    bg: '#ffedd5',
  },
  [NotificationType.RETAILER_SO_AUTHORIZATION]: {
    name: 'shield-checkmark-outline',
    color: '#f97316',
    bg: '#ffedd5',
  },
};

export default function NotificationBell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userEntityId = user?.entityId ?? 'anonymous';
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // -- Unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notif-unread-count', userEntityId],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // -- Latest 10 notifications for preview
  const { data: listData, isLoading } = useQuery({
    queryKey: ['notif-preview', userEntityId],
    queryFn: () => notificationService.list({ page: 1, limit: 10 }),
    enabled: !!user && open,
    staleTime: 30_000,
  });
  const previewItems: INotification[] = listData?.data ?? [];

  // -- Mark single read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notif-unread-count', userEntityId] });
      void queryClient.invalidateQueries({ queryKey: ['notif-preview', userEntityId] });
    },
  });

  // -- Mark all read
  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notif-unread-count', userEntityId] });
      void queryClient.invalidateQueries({ queryKey: ['notif-preview', userEntityId] });
    },
  });

  const handleRowClick = (notif: INotification) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.notificationId);
    }
    setOpen(false);
    // Navigate to notifications screen
    router.push('/notifications');
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="relative p-1.5"
      >
        <Ionicons name="notifications-outline" size={22} color="#4b5563" />
        {unreadCount > 0 && (
          <View className="absolute top-0 right-0 bg-orange-500 rounded-full px-1.5 py-0.5 min-w-[18px] items-center justify-center">
            <Text className="text-[9px] font-bold text-white leading-none">
              {formatBadge(unreadCount)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent={false}>
        <SafeAreaView className="flex-1 bg-white">
          {/* Header */}
          <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-gray-800">Notifications</Text>
              {unreadCount > 0 && (
                <View className="ml-2 bg-orange-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-orange-600">{unreadCount} new</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center gap-4">
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                >
                  <Text className="text-xs font-bold text-orange-500">Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setOpen(false)} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#f97316" />
            </View>
          ) : previewItems.length === 0 ? (
            <View className="flex-1 items-center justify-center p-6">
              <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center border border-gray-100 mb-3">
                <Ionicons name="notifications-off-outline" size={28} color="#9ca3af" />
              </View>
              <Text className="text-sm font-bold text-gray-800">All caught up!</Text>
              <Text className="text-xs text-gray-400 mt-1">No new notifications at this time.</Text>
            </View>
          ) : (
            <FlatList
              data={previewItems}
              keyExtractor={(item) => item.notificationId}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const iconCfg = TYPE_ICON[item.type] ?? {
                  name: 'notifications-outline',
                  color: '#6b7280',
                  bg: '#f3f4f6',
                };
                return (
                  <TouchableOpacity
                    onPress={() => handleRowClick(item)}
                    className={`flex-row items-start px-4 py-3.5 border-b border-gray-50 ${
                      !item.isRead ? 'bg-orange-50/40' : ''
                    }`}
                  >
                    <View
                      style={{ backgroundColor: iconCfg.bg }}
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    >
                      <Ionicons name={iconCfg.name} size={18} color={iconCfg.color} />
                    </View>
                    <View className="flex-1 mr-2">
                      <View className="flex-row justify-between items-start gap-1">
                        <Text className={`text-sm ${!item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {item.title}
                        </Text>
                        <Text className="text-[10px] text-gray-400 font-semibold">{timeAgo(item.createdAt)}</Text>
                      </View>
                      <Text className="text-xs text-gray-500 mt-1 leading-4" numberOfLines={2}>
                        {item.message}
                      </Text>
                    </View>
                    {!item.isRead && (
                      <View className="w-2.5 h-2.5 bg-orange-500 rounded-full mt-1.5" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
