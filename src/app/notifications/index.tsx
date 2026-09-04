import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { notificationService } from '@/services/notification.service';
import { NotificationType, type INotification } from '@/types';

const { width } = Dimensions.get('window');

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

interface TypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  [NotificationType.ORDER_CREATED]: {
    icon: 'cart-outline',
    color: '#3b82f6',
    bg: 'bg-blue-50 border-blue-200',
    label: 'Order Placed',
  },
  [NotificationType.ORDER_APPROVED]: {
    icon: 'checkmark-circle-outline',
    color: '#059669',
    bg: 'bg-emerald-50 border-emerald-200',
    label: 'Approved',
  },
  [NotificationType.ORDER_DISPATCHED]: {
    icon: 'bus-outline',
    color: '#d97706',
    bg: 'bg-amber-50 border-amber-200',
    label: 'Dispatched',
  },
  [NotificationType.ORDER_DELIVERED]: {
    icon: 'cube-outline',
    color: '#16a34a',
    bg: 'bg-green-50 border-green-200',
    label: 'Delivered',
  },
  [NotificationType.ORDER_CANCELLED]: {
    icon: 'close-circle-outline',
    color: '#dc2626',
    bg: 'bg-red-50 border-red-200',
    label: 'Cancelled',
  },
  [NotificationType.USER_DEACTIVATED]: {
    icon: 'close-circle-outline',
    color: '#dc2626',
    bg: 'bg-red-50 border-red-200',
    label: 'Deactivated',
  },
  [NotificationType.USER_ACTIVATED]: {
    icon: 'checkmark-circle-outline',
    color: '#059669',
    bg: 'bg-emerald-50 border-emerald-200',
    label: 'Activated',
  },
  [NotificationType.SKU_ADDED]: {
    icon: 'cube-outline',
    color: '#3b82f6',
    bg: 'bg-blue-50 border-blue-200',
    label: 'SKU Added',
  },
  [NotificationType.RETAILER_SO_AUTHORIZATION]: {
    icon: 'shield-checkmark-outline',
    color: '#7c3aed',
    bg: 'bg-purple-50 border-purple-200',
    label: 'SO Authorization',
  },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const userEntityId = user?.entityId ?? 'anonymous';
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const limit = 10;

  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications-dashboard-app', userEntityId, page, limit, unreadOnly],
    queryFn: () => notificationService.list({ page, limit, unreadOnly }),
    enabled: !!user,
  });

  const notifications: INotification[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const unreadCount = data?.unreadCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] });
      Alert.alert('Success', 'All notifications marked as read');
    },
  });

  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/admin/inventory' },
    { name: 'Stock Movements', icon: 'cube-outline' as const, route: '/stock-movements' },
    { name: 'Orders', icon: 'cart-outline' as const, route: '/admin/performance' },
    { name: 'Leaderboard', icon: 'trophy-outline' as const, route: '/leaderboard' },
    { name: 'Outlet Report', icon: 'home-outline' as const, route: '/outlet-wise' },
    { name: 'SKU Report', icon: 'bar-chart-outline' as const, route: '/admin/inventory' },
    { name: 'Notifications', icon: 'notifications-outline' as const, route: '/announcement' },
    { name: 'Performance Track', icon: 'stats-chart-outline' as const, route: '/admin/performance' },
    { name: 'Attendance Track', icon: 'clipboard-outline' as const, route: '/admin/attendance' },
    { name: 'Summary', icon: 'grid-outline' as const, route: '/admin/summary' },
    { name: 'Admin Inventory', icon: 'archive-outline' as const, route: '/admin/inventory' },
    { name: 'Announcements', icon: 'megaphone-outline' as const, route: '/announcement' },
    // { name: 'Role Permissions', icon: 'shield-checkmark-outline' as const, route: '/admin/role-permissions' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-grow" showsVerticalScrollIndicator={false}>
        {/* Title Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-2xl font-bold text-gray-900">Notifications</Text>
          <Text className="text-xs text-gray-500 mt-1 leading-5">
            In-app alerts for order events
          </Text>
        </View>

        {/* Mark All Read button */}
        <View className="px-6 mb-4">
          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || unreadCount === 0}
            className="flex-row items-center border border-gray-200 bg-white px-3 py-2 rounded-xl self-start gap-2 shadow-sm"
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#64748b" />
            <Text className="text-xs font-semibold text-slate-600">Mark all read</Text>
            {unreadCount > 0 && (
              <View className="bg-slate-100 px-1.5 py-0.2 rounded-full">
                <Text className="text-[10px] font-bold text-slate-500">{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Filter funnels */}
        <View className="px-6 flex-row items-center gap-3 mb-6">
          <Ionicons name="funnel-outline" size={16} color="#64748b" />
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                setUnreadOnly(false);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full border ${
                !unreadOnly ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${!unreadOnly ? 'text-white' : 'text-slate-600'}`}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setUnreadOnly(true);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full border flex-row items-center gap-1.5 ${
                unreadOnly ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${unreadOnly ? 'text-white' : 'text-slate-600'}`}>
                Unread
              </Text>
              {unreadCount > 0 && (
                <View className={`px-1.5 py-0.2 rounded-full ${unreadOnly ? 'bg-white/20' : 'bg-orange-100'}`}>
                  <Text className={`text-[9px] font-black ${unreadOnly ? 'text-white' : 'text-orange-700'}`}>
                    {unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* List Content */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : isError ? (
          <View className="mx-6 bg-white border border-red-100 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={36} color="#ef4444" />
            <Text className="text-sm text-red-500 mt-2 font-semibold">Failed to load notifications</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View className="mx-6 bg-white border border-gray-200 p-12 rounded-2xl items-center justify-center shadow-sm gap-2">
            <View className="h-14 w-14 rounded-full bg-gray-50 border border-gray-150 justify-center items-center">
              <Ionicons name="notifications-off-outline" size={24} color="#9ca3af" />
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-2">
              {unreadOnly ? 'No unread notifications' : 'All caught up!'}
            </Text>
            <Text className="text-xs text-gray-400 text-center px-4">
              {unreadOnly
                ? 'Switch to "All" tab to see past alerts.'
                : 'Notifications will appear here when order updates occur.'}
            </Text>
          </View>
        ) : (
          <View className="mx-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100 mb-24">
            {notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] ?? {
                icon: 'notifications-outline',
                color: '#f97316',
                bg: 'bg-orange-50 border-orange-100',
                label: 'Alert',
              };

              const isEditedNotification = /\b(edited|updated)\b/i.test(`${notif.title} ${notif.message}`);
              const effectiveCfg = isEditedNotification
                ? {
                    icon: 'checkmark-circle-outline',
                    color: '#059669',
                    bg: 'bg-emerald-50 border-emerald-200',
                    label: 'Order Edited',
                  }
                : cfg;

              // Override for unread look in mockup
              const isUnread = !notif.isRead;

              return (
                <View
                  key={notif.notificationId}
                  className={`p-4 flex-row gap-3.5 items-start ${
                    isUnread ? 'bg-[#fffaf4]' : 'bg-white'
                  }`}
                >
                  {/* Left Icon (Orange border box style) */}
                  <View className="h-10 w-10 rounded-xl border border-[#ffedd5] bg-[#fff7ed] justify-center items-center shrink-0">
                    <Ionicons name="cart-outline" size={20} color="#f97316" />
                  </View>

                  {/* Body Content */}
                  <View className="flex-1 min-w-0">
                    <View className="flex-row justify-between items-start flex-wrap gap-x-2 gap-y-0.5">
                      <View className="flex-row items-center gap-1.5">
                        <Text className={`text-sm ${isUnread ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                          {notif.title}
                        </Text>
                        {isUnread && (
                          <View className="h-2 w-2 rounded-full bg-[#f97316]" />
                        )}
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[10px] text-gray-400">
                          {timeAgo(notif.createdAt)}
                        </Text>
                        {isUnread && (
                          <TouchableOpacity
                            onPress={() => markReadMutation.mutate(notif.notificationId)}
                            disabled={markReadMutation.isPending}
                          >
                            <Ionicons name="checkmark-outline" size={16} color="#64748b" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <Text className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {notif.message}
                    </Text>

                    {/* Footer tag rows */}
                    <View className="flex-row items-center gap-2.5 mt-2">
                      <View className="px-2.5 py-0.5 rounded-full border border-[#ffedd5] bg-[#fff7ed]">
                        <Text className="text-[9px] font-bold text-[#f97316] uppercase">
                          {effectiveCfg.label}
                        </Text>
                      </View>
                      {notif.referenceOrderId && (
                        <Text className="text-[10px] font-semibold text-slate-400">
                          {notif.referenceOrderId.replace(/:from$|:to$|:from:cancel$|:to:cancel$/, '')}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
          <Text className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              className={`p-2 border rounded-lg ${
                page <= 1 ? 'border-gray-100 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons name="chevron-back" size={16} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`p-2 border rounded-lg ${
                page >= totalPages ? 'border-gray-100 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons name="chevron-forward" size={16} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
