import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { UserRole, OrderStatus } from '@/types';
import { attendanceService } from '@/services/attendance.service';
import { userService } from '@/services/user.service';
import { skuService } from '@/services/sku.service';
import { retailerAuthorizationService } from '@/services/retailerAuthorization.service';
import AuthorizeSoModal from '@/components/retailer/AuthorizeSoModal';

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInventoryValue(num: number): string {
  if (typeof num !== 'number') return '₹0';
  if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(1) + 'L';
  }
  if (num >= 1000) {
    return '₹' + (num / 1000).toFixed(0) + 'k';
  }
  return '₹' + num.toString();
}

function formatNumber(num: number): string {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString('en-IN');
}

function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN: return 'Admin';
    case UserRole.FINANCE: return 'Finance';
    case UserRole.DISPATCH: return 'Dispatch';
    case UserRole.NSM: return 'National Sales Manager';
    case UserRole.RSM: return 'Regional Sales Manager';
    case UserRole.ASM: return 'Area Sales Manager';
    case UserRole.SUPER_STOCKIST: return 'Super Stockist';
    case UserRole.DISTRIBUTOR: return 'Distributor';
    case UserRole.SO: return 'Sales Officer';
    case UserRole.ASE: return 'Area Sales Executive';
    case UserRole.RETAILER: return 'Retailer';
    default: return String(role);
  }
}

// ── Generic Web-style KPI Stat Card ──
function WebStatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  loading,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
  onPress?: () => void;
}) {
  const cardContent = (
    <View className="w-full bg-white border border-gray-150 p-4 rounded-xl shadow-sm mb-3 flex-row items-center justify-between">
      <View>
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</Text>
        <Text className="text-2xl font-bold text-gray-800 mt-1">
          {loading ? '...' : value}
        </Text>
      </View>
      <View className={`${iconBg} w-11 h-11 rounded-xl items-center justify-center relative`}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <View className="absolute top-1.5 right-1.5">
          <Ionicons name="arrow-forward-outline" size={10} color={iconColor} style={{ opacity: 0.6 }} />
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

// ── Sub-Dashboards ──

// 1. Retailer Dashboard
function RetailerDashboardView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);

  // Queries
  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['retailer-summary-data'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { summary: Record<OrderStatus, number> & { total: number } } }>('/orders/summary');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentRes, isLoading: recentLoading } = useQuery({
    queryKey: ['retailer-recent-orders-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/orders', { params: { page: 1, limit: 5 } });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: inventoryRes, isLoading: inventoryLoading } = useQuery({
    queryKey: ['retailer-inventory-data', user?.entityId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(`/inventory/${user?.entityId}`, { params: { page: 1, limit: 5 } });
      return res.data;
    },
    enabled: !!user?.entityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: mySoAuthRes, isLoading: mySoAuthLoading, refetch: refetchSo } = useQuery({
    queryKey: ['retailer-my-so-authorization'],
    queryFn: () => retailerAuthorizationService.getMySo(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: availableSosRes } = useQuery({
    queryKey: ['available-sos-dashboard'],
    queryFn: () => retailerAuthorizationService.getAvailableSos(),
    enabled: !mySoAuthRes?.data,
    staleTime: 5 * 60 * 1000,
  });

  const { data: listSosRes } = useQuery({
    queryKey: ['all-sos-list-dashboard'],
    queryFn: () => userService.listSOs({ limit: 1000 }),
    enabled: !mySoAuthRes?.data,
    staleTime: 10 * 60 * 1000,
  });

  const [isAutoAuthorizing, setIsAutoAuthorizing] = useState(false);

  useEffect(() => {
    if (mySoAuthLoading || mySoAuthRes?.data || isAutoAuthorizing) return;
    if (!user?.beat || !availableSosRes?.sos || !listSosRes?.data) return;

    const retailerBeat = user.beat.trim().toLowerCase();
    if (!retailerBeat) return;

    const matchedSo = availableSosRes.sos.find((availSo) => {
      const fullSo = listSosRes.data.find((so) => so.entityId === availSo.entityId);
      return fullSo?.beat?.trim().toLowerCase() === retailerBeat;
    });

    if (matchedSo) {
      const performAutoAuth = async () => {
        setIsAutoAuthorizing(true);
        try {
          await retailerAuthorizationService.authorizeSo({ soId: matchedSo.entityId });
          await refetchSo();
          Alert.alert(
            'Auto Authorization',
            `Automatically authorized Sales Officer ${matchedSo.name} (${matchedSo.entityId}) who is routed to your beat "${user.beat}" today.`
          );
        } catch (err: any) {
          console.error('[AutoAuth] Failed auto authorization', err);
        } finally {
          setIsAutoAuthorizing(false);
        }
      };
      void performAutoAuth();
    }
  }, [mySoAuthLoading, mySoAuthRes, availableSosRes, listSosRes, user, isAutoAuthorizing]);

  const queryClient = useQueryClient();

  const revokeSoMutation = useMutation({
    mutationFn: () => retailerAuthorizationService.revokeSo(),
    onSuccess: () => {
      refetchSo();
      Alert.alert('Success', 'Authorization removed. You can authorize a new SO now.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to remove authorization');
    },
  });

  const summary = summaryRes?.summary;
  const recentOrders = recentRes?.data ?? [];
  const inventoryItems = inventoryRes?.data ?? [];
  const inventoryCount = (inventoryRes as any)?.total ?? inventoryItems.length;
  const mySoAuthorization = mySoAuthRes?.data;

  const pendingCount = (summary?.CREATED ?? 0) + (summary?.APPROVED ?? 0);
  const lastOrderDate = recentOrders.length > 0
    ? new Date(recentOrders[0].createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : 'No orders yet';

  return (
    <View className="gap-6 pb-24">
      {/* Retailer Page Header */}
      <View className="mb-1">
        <Text className="text-2xl font-bold text-slate-800">My Dashboard</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
          <Text className="text-xs text-slate-500">Welcome back,</Text>
          <Text className="text-xs font-bold text-slate-700">{user?.name}</Text>
          {user?.state && (
            <>
              <Text className="text-xs text-slate-300">•</Text>
              <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Ionicons name="location" size={10} color="#047857" />
                <Text className="text-[10px] font-bold text-emerald-700 uppercase">
                  {user.state}
                </Text>
              </View>
            </>
          )}
        </View>
        <View className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 self-start">
          <Text className="text-xs text-slate-500 font-semibold">
            Order placement is handled by your authorized SO
          </Text>
        </View>
      </View>

      {/* SO Authorization Card */}
      <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="shield-checkmark" size={18} color="#f97316" />
          <Text className="text-sm font-bold text-slate-800">Your Sales Officer</Text>
        </View>

        {mySoAuthLoading ? (
          <ActivityIndicator size="small" color="#f97316" className="my-2 align-self-start" />
        ) : mySoAuthorization ? (
          <View className="space-y-1.5 mb-4">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="person-circle-outline" size={16} color="#059669" />
              <Text className="text-sm font-semibold text-slate-700">
                {mySoAuthorization.so.name} <Text className="text-xs text-slate-400">({mySoAuthorization.so.entityId})</Text>
              </Text>
            </View>
            <Text className="text-xs text-slate-500">Email: {mySoAuthorization.so.email || 'N/A'}</Text>
            <Text className="text-xs text-slate-500">Phone: {mySoAuthorization.so.phone || 'N/A'}</Text>
            <Text className="text-xs text-slate-500">
              Authorized: {new Date(mySoAuthorization.authorizedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1.5 mb-4">
            <Ionicons name="close-circle-outline" size={16} color="#d97706" />
            <Text className="text-xs text-slate-500">No Sales Officer authorized yet.</Text>
          </View>
        )}

        <View className="flex-row gap-3">
          {mySoAuthorization && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Confirm', 'Remove current SO authorization?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => revokeSoMutation.mutate() },
                ]);
              }}
              disabled={revokeSoMutation.isPending}
              className="flex-1 items-center justify-center border border-red-200 bg-red-50/50 rounded-xl py-2.5"
            >
              <Text className="text-red-600 text-xs font-bold">
                {revokeSoMutation.isPending ? 'Removing...' : 'Remove Authorization'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              if (!mySoAuthorization) {
                setIsAuthorizeModalOpen(true);
              }
            }}
            disabled={Boolean(mySoAuthorization)}
            className={`flex-1 items-center justify-center rounded-xl py-2.5 border ${mySoAuthorization
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-orange-200 bg-orange-500'
              }`}
          >
            <Text className={`text-xs font-bold ${mySoAuthorization ? 'text-emerald-700' : 'text-white'}`}>
              {mySoAuthorization ? 'You are authorized' : 'Authorize SO'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid of KPI Stat Cards */}
      <View className="flex-row flex-wrap gap-3">
        {/* Pending Orders */}
        <View className="flex-1 min-w-[140px] bg-white border border-slate-150 p-4 rounded-2xl shadow-sm">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Pending Orders</Text>
          </View>
          <Text className="text-xl font-bold text-slate-800">
            {summaryLoading ? '...' : pendingCount}
          </Text>
        </View>

        {/* Inventory Items */}
        <View className="flex-1 min-w-[140px] bg-white border border-slate-150 p-4 rounded-2xl shadow-sm">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Ionicons name="cube-outline" size={14} color="#64748b" />
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Inventory Items</Text>
          </View>
          <Text className="text-xl font-bold text-slate-800">
            {inventoryLoading ? '...' : inventoryCount}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {/* Last Order Date */}
        <View className="flex-1 min-w-[140px] bg-white border border-slate-150 p-4 rounded-2xl shadow-sm">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Ionicons name="cart-outline" size={14} color="#64748b" />
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Last Order Date</Text>
          </View>
          <Text className="text-xs font-bold text-slate-800 leading-tight">
            {lastOrderDate}
          </Text>
        </View>

        {/* Delivered Orders */}
        <View className="flex-1 min-w-[140px] bg-white border border-slate-150 p-4 rounded-2xl shadow-sm">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Ionicons name="checkmark-circle-outline" size={14} color="#64748b" />
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Delivered</Text>
          </View>
          <Text className="text-xl font-bold text-green-600">
            {summaryLoading ? '...' : (summary?.DELIVERED ?? 0)}
          </Text>
        </View>
      </View>

      {/* Order Status Pipeline */}
      <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <Text className="text-sm font-bold text-slate-800 mb-4">Order Status Pipeline</Text>
        <View className="flex-row justify-between items-start">
          {[
            { label: 'Placed', status: OrderStatus.CREATED, icon: 'time-outline' as const, color: '#f97316', bg: 'bg-orange-50' },
            { label: 'Approved', status: OrderStatus.APPROVED, icon: 'checkmark-circle-outline' as const, color: '#10b981', bg: 'bg-emerald-50' },
            { label: 'On the Way', status: OrderStatus.DISPATCHED, icon: 'bus-outline' as const, color: '#f59e0b', bg: 'bg-amber-50' },
            { label: 'Delivered', status: OrderStatus.DELIVERED, icon: 'cube-outline' as const, color: '#2563eb', bg: 'bg-blue-50' },
          ].map((step, idx) => {
            const rawCount = (summary as any)?.[step.status] ?? 0;
            const isActive = rawCount > 0;
            return (
              <View key={step.status} className="flex-1 items-center">
                <View className={`w-11 h-11 rounded-full items-center justify-center mb-1.5 ${isActive ? step.bg : 'bg-slate-50'}`}>
                  <Ionicons name={step.icon} size={20} color={isActive ? step.color : '#cbd5e1'} />
                </View>
                <Text className="text-[10px] text-slate-500 font-medium mb-1">{step.label}</Text>
                <Text className={`text-base font-bold ${isActive ? 'text-slate-800' : 'text-slate-300'}`}>{rawCount}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recent Orders List */}
      <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <View className="flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3">
          <Text className="text-sm font-bold text-slate-800">Recent Orders</Text>
          <TouchableOpacity onPress={() => router.push('/orders')} className="flex-row items-center gap-0.5">
            <Text className="text-xs text-orange-500 font-semibold">View all</Text>
            <Ionicons name="chevron-forward" size={12} color="#f97316" />
          </TouchableOpacity>
        </View>

        {recentLoading ? (
          <ActivityIndicator size="small" color="#f97316" className="my-4" />
        ) : recentOrders.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="cart-outline" size={28} color="#cbd5e1" className="mb-1" />
            <Text className="text-xs text-slate-400">No orders placed yet</Text>
          </View>
        ) : (
          <View className="gap-3">
            {recentOrders.map((order) => (
              <View key={order.orderId} className="flex-row justify-between items-center py-2.5 border-b border-slate-50 last:border-b-0 last:pb-0">
                <View className="flex-1 mr-2">
                  <Text className="text-xs font-bold text-slate-800">{order.orderId}</Text>
                  <Text className="text-[10px] text-slate-400 mt-1">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {order.items.length} items
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-bold text-slate-800">{formatCurrency(order.totalAmount)}</Text>
                  <View className="bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full mt-1.5">
                    <Text className="text-[9px] font-bold text-orange-700 uppercase">
                      {order.status === OrderStatus.CREATED ? 'Placed' : order.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Inventory Snapshot */}
      <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <View className="flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3">
          <Text className="text-sm font-bold text-slate-800">Inventory Snapshot</Text>
          <Text className="text-[10px] font-bold text-slate-400 uppercase">Top 5 items</Text>
        </View>

        {inventoryLoading ? (
          <ActivityIndicator size="small" color="#f97316" className="my-4" />
        ) : inventoryItems.length === 0 ? (
          <View className="items-center py-8">
            <View className="w-12 h-12 bg-slate-50 rounded-full items-center justify-center mb-2">
              <Ionicons name="cube-outline" size={24} color="#cbd5e1" />
            </View>
            <Text className="text-xs font-bold text-slate-700 mb-1">No inventory data available</Text>
            <Text className="text-[10px] text-slate-400 text-center leading-relaxed">
              Inventory appears here after you receive orders
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {inventoryItems.map((item: any, idx: number) => {
              const threshold = item.lowStockThreshold ?? 0;
              const isLowStock = typeof item.isLowStock === 'boolean' ? item.isLowStock : item.quantity <= threshold;

              return (
                <View key={item.entityId ? `${item.entityId}-${item.skuId || idx}` : idx} className="flex-row items-center justify-between py-2.5 border-b border-slate-50 last:border-b-0 last:pb-0">
                  <View className="flex-1 mr-3">
                    <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                      {item.skuName || item.skuId}
                    </Text>
                    <View className="flex-row items-center gap-3 mt-1">
                      <Text className="text-[10px] text-slate-500 font-medium">
                        Qty: <Text className="font-bold text-slate-800">{item.quantity}</Text> pcs
                      </Text>
                      <Text className="text-[10px] text-slate-300">•</Text>
                      <Text className="text-[10px] text-slate-500 font-medium">
                        Threshold: <Text className="font-bold text-slate-800">{threshold}</Text>
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    {isLowStock ? (
                      <View className="flex-row items-center gap-1 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                        <Ionicons name="warning" size={10} color="#b91c1c" />
                        <Text className="text-[10px] font-bold text-red-700 uppercase">Low Stock</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        <Ionicons name="trending-up" size={10} color="#047857" />
                        <Text className="text-[10px] font-bold text-emerald-700 uppercase">Good</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <AuthorizeSoModal
        open={isAuthorizeModalOpen}
        onClose={() => {
          setIsAuthorizeModalOpen(false);
          refetchSo();
        }}
        currentSoEntityId={mySoAuthorization?.so?.entityId}
      />
    </View>
  );
}

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function DispatchInsightsView({ orders, loading }: { orders: any[]; loading: boolean }) {
  const router = useRouter();
  const [daysFilter, setDaysFilter] = useState<7 | 30 | 90 | 'ALL'>(30);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>(OrderStatus.APPROVED);

  const filtered = React.useMemo(() => {
    return (orders || []).filter((order: any) => {
      const orderDateStr = order.updatedAt || order.createdAt;
      if (daysFilter !== 'ALL' && orderDateStr && !withinDays(orderDateStr, daysFilter as number)) return false;
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      return true;
    });
  }, [orders, daysFilter, statusFilter]);

  const totalValue = filtered.reduce((sum: number, order: any) => sum + (order.totalAmount ?? 0), 0);
  const readyToDispatch = filtered.filter((order: any) => order.status === OrderStatus.APPROVED).length;
  const inTransit = filtered.filter((order: any) => order.status === OrderStatus.DISPATCHED).length;
  const delivered = filtered.filter((order: any) => order.status === OrderStatus.DELIVERED).length;
  const fulfillmentRate = filtered.length ? Math.round((delivered / filtered.length) * 100) : 0;

  return (
    <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 mt-2">
      <View className="flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3">
        <View>
          <Text className="text-sm font-bold text-slate-800">Dispatch Insights</Text>
          <Text className="text-[11px] text-slate-400 mt-0.5">Filtered execution and fulfillment view</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/orders')} className="flex-row items-center gap-0.5">
          <Text className="text-xs text-orange-500 font-semibold">Open Orders</Text>
          <Ionicons name="chevron-forward" size={12} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 mb-4">
        {[7, 30, 90, 'ALL'].map((days) => (
          <TouchableOpacity
            key={String(days)}
            onPress={() => setDaysFilter(days as any)}
            className={`px-3 py-1.5 rounded-lg border mr-1.5 ${daysFilter === days
              ? 'bg-orange-500 border-orange-500'
              : 'bg-white border-slate-200'
              }`}
          >
            <Text
              className={`text-xs font-semibold ${daysFilter === days ? 'text-white' : 'text-slate-600'
                }`}
            >
              {days === 'ALL' ? 'All' : `Last ${days}d`}
            </Text>
          </TouchableOpacity>
        ))}

        {(['ALL', OrderStatus.APPROVED, OrderStatus.DISPATCHED, OrderStatus.DELIVERED] as const).map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setStatusFilter(status as any)}
            className={`px-3 py-1.5 rounded-lg border mr-1.5 ${statusFilter === status
              ? 'bg-orange-500 border-orange-500'
              : 'bg-white border-slate-200'
              }`}
          >
            <Text
              className={`text-xs font-semibold ${statusFilter === status ? 'text-white' : 'text-slate-600'
                }`}
            >
              {status === 'ALL' ? 'ALL' : status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="small" color="#f97316" className="my-4" />
      ) : (
        <View className="flex-row flex-wrap gap-2.5">
          <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Ready</Text>
            <Text className="text-lg font-bold text-slate-800 mt-1">{formatNumber(readyToDispatch)}</Text>
          </View>

          <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">In Transit</Text>
            <Text className="text-lg font-bold text-slate-800 mt-1">{formatNumber(inTransit)}</Text>
          </View>

          <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Delivered</Text>
            <Text className="text-lg font-bold text-slate-800 mt-1">{formatNumber(delivered)}</Text>
          </View>

          <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Order Value</Text>
            <Text className="text-lg font-bold text-slate-800 mt-1">{formatInventoryValue(totalValue)}</Text>
          </View>

          <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Fulfillment</Text>
            <Text className="text-lg font-bold text-slate-800 mt-1">{fulfillmentRate}%</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function FinanceInsightsView({ orders, loading }: { orders: any[]; loading: boolean }) {
  const router = useRouter();
  const [daysFilter, setDaysFilter] = useState<7 | 30 | 90 | 'ALL'>(30);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>(OrderStatus.IN_FINANCE);

  const filtered = React.useMemo(() => {
    return (orders || []).filter((order: any) => {
      const orderDateStr = order.updatedAt || order.createdAt;
      if (daysFilter !== 'ALL' && orderDateStr && !withinDays(orderDateStr, daysFilter as number)) return false;
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      return true;
    });
  }, [orders, daysFilter, statusFilter]);

  const totalValue = filtered.reduce((sum: number, order: any) => sum + (order.totalAmount ?? 0), 0);
  const avgTicket = filtered.length ? totalValue / filtered.length : 0;
  const highValue = filtered.filter((order: any) => (order.totalAmount ?? 0) >= 50_000).length;

  const topEntities = React.useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((order: any) => {
      const id = order.fromEntityId || 'Unknown';
      map.set(id, (map.get(id) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filtered]);

  return (
    <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 mt-4">
      <View className="flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3">
        <View>
          <Text className="text-sm font-bold text-slate-800">Finance Insights</Text>
          <Text className="text-[11px] text-slate-400 mt-0.5">Filtered operational analytics</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/orders')} className="flex-row items-center gap-0.5">
          <Text className="text-xs text-orange-500 font-semibold">Open Orders</Text>
          <Ionicons name="chevron-forward" size={12} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 mb-4">
        {[7, 30, 90, 'ALL'].map((days) => (
          <TouchableOpacity
            key={String(days)}
            onPress={() => setDaysFilter(days as any)}
            className={`px-3 py-1.5 rounded-lg border mr-1.5 ${daysFilter === days
              ? 'bg-indigo-600 border-indigo-600'
              : 'bg-white border-slate-200'
              }`}
          >
            <Text
              className={`text-xs font-semibold ${daysFilter === days ? 'text-white' : 'text-slate-600'
                }`}
            >
              {days === 'ALL' ? 'All' : `Last ${days}d`}
            </Text>
          </TouchableOpacity>
        ))}

        {(['ALL', OrderStatus.IN_FINANCE, OrderStatus.APPROVED, OrderStatus.CANCELLED] as const).map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setStatusFilter(status as any)}
            className={`px-3 py-1.5 rounded-lg border mr-1.5 ${statusFilter === status
              ? 'bg-orange-500 border-orange-500'
              : 'bg-white border-slate-200'
              }`}
          >
            <Text
              className={`text-xs font-semibold ${statusFilter === status ? 'text-white' : 'text-slate-600'
                }`}
            >
              {status === 'ALL' ? 'ALL' : status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="small" color="#f97316" className="my-4" />
      ) : (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2.5">
            <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Orders</Text>
              <Text className="text-lg font-bold text-slate-800 mt-1">{formatNumber(filtered.length)}</Text>
            </View>

            <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Total Value</Text>
              <Text className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(totalValue)}</Text>
            </View>

            <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Avg Ticket</Text>
              <Text className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(avgTicket)}</Text>
            </View>

            <View className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex-1 min-w-[130px]">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">High Value</Text>
              <Text className="text-lg font-bold text-slate-800 mt-1">{formatNumber(highValue)}</Text>
            </View>
          </View>

          <View className="border border-slate-150 rounded-xl p-3 bg-slate-50 mt-1">
            <View className="flex-row justify-between items-center border-b border-slate-200 pb-2 mb-2">
              <Text className="text-xs font-bold text-slate-700">Top Requesting Entities</Text>
              <Text className="text-[10px] text-slate-400">By order volume</Text>
            </View>
            {topEntities.length === 0 ? (
              <Text className="text-xs text-slate-400 py-2">No orders in selected filter window.</Text>
            ) : (
              topEntities.map(([entityId, count]) => (
                <View key={entityId} className="flex-row justify-between items-center py-1.5 border-b border-slate-150 last:border-b-0">
                  <Text className="text-xs font-semibold text-slate-800">{entityId}</Text>
                  <Text className="text-xs font-bold text-slate-600">{count} orders</Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// 2. Admin & Employee Dashboard
function EmployeeDashboardView({ role }: { role: UserRole }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userEntityId = user?.entityId ?? '';

  const isNSM = role === UserRole.NSM;
  const isRSM = role === UserRole.RSM;
  const isASM = role === UserRole.ASM;
  const isSO = role === UserRole.SO || role === UserRole.ASE;
  const isSS = role === UserRole.SUPER_STOCKIST;
  const isDistributor = role === UserRole.DISTRIBUTOR;
  const isDispatch = role === UserRole.DISPATCH;
  const isFinance = role === UserRole.FINANCE;

  const { data: dashRes, isLoading: dashLoading } = useQuery({
    queryKey: ['employee-dash-data', role, userEntityId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any }>('/dashboard');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['employee-summary-data', role, userEntityId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { summary: Record<OrderStatus, number> & { total: number } } }>('/orders/summary');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: readyDispatchRes, isLoading: readyDispatchLoading } = useQuery({
    queryKey: ['dashboard-dispatch-ready', userEntityId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/orders', {
        params: { status: OrderStatus.APPROVED, page: 1, limit: 5 },
      });
      return res.data;
    },
    enabled: isDispatch && !!userEntityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: readyFinanceQueueRes, isLoading: readyFinanceQueueLoading } = useQuery({
    queryKey: ['dashboard-finance-queue', userEntityId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/orders', {
        params: { status: OrderStatus.IN_FINANCE, page: 1, limit: 8 },
      });
      return res.data;
    },
    enabled: isFinance && !!userEntityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allDispatchOrdersRes, isLoading: allDispatchOrdersLoading } = useQuery({
    queryKey: ['dashboard-dispatch-all-orders', userEntityId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any[] }>('/orders', {
        params: { page: 1, limit: 100 },
      });
      return res.data;
    },
    enabled: (isDispatch || isFinance) && !!userEntityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: todayAttendance, isLoading: todayAttendanceLoading } = useQuery({
    queryKey: ['dashboard-attendance-today-asm', userEntityId],
    queryFn: () => attendanceService.getTodayStatus(),
    enabled: (isASM || isRSM) && !!userEntityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: attendanceSummary, isLoading: attendanceSummaryLoading } = useQuery({
    queryKey: ['dashboard-attendance-summary-asm', userEntityId],
    queryFn: () =>
      attendanceService.getMyAttendanceSummary({
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
      }),
    enabled: (isASM || isRSM) && !!userEntityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: todayAttendanceSO, isLoading: todayAttendanceSOLoading } = useQuery({
    queryKey: ['dashboard-attendance-today-so', userEntityId],
    queryFn: () => attendanceService.getTodayStatus(),
    enabled: isSO && !!userEntityId,
  });

  const { data: attendanceSummarySO, isLoading: attendanceSummarySOLoading } = useQuery({
    queryKey: ['dashboard-attendance-summary-so', userEntityId],
    queryFn: () =>
      attendanceService.getMyAttendanceSummary({
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
      }),
    enabled: isSO && !!userEntityId,
  });

  const { data: agentsRes, isLoading: agentsLoading } = useQuery({
    queryKey: ['dashboard-agents-preview', userEntityId],
    queryFn: () => userService.listSOs({ limit: 5 }),
    enabled: isDistributor,
  });

  const { data: retailersRes, isLoading: retailersLoading } = useQuery({
    queryKey: ['dashboard-retailers-preview', userEntityId, role],
    queryFn: async (): Promise<any> => {
      if (isSO) {
        return retailerAuthorizationService.getMyRetailers();
      }
      return userService.listRetailers({ limit: 5 });
    },
    enabled: isSO || isDistributor,
  });

  const { data: distributorsRes, isLoading: distributorsLoading } = useQuery({
    queryKey: ['dashboard-distributors-preview', userEntityId],
    queryFn: () => userService.listDistributors({ limit: 5 }),
    enabled: isSS,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: skusRes, isLoading: skusLoading } = useQuery({
    queryKey: ['dashboard-skus-preview'],
    queryFn: () => skuService.list({ limit: 5 }),
    enabled: isSS || isDistributor,
  });

  const d = dashRes;
  const summary = summaryRes?.summary;

  const totalUsers = d?.totalUsers ?? 0;
  const totalOrders = d?.totalOrders ?? summary?.total ?? 0;
  const pendingOrders = summary?.CREATED ?? 0;
  const activeRoles = d?.roleBreakdown ? Object.keys(d.roleBreakdown).length : 0;

  const attRate = attendanceSummary?.total
    ? Math.round(((attendanceSummary.present + attendanceSummary.halfDay) / attendanceSummary.total) * 100)
    : 0;

  const attRateSO = attendanceSummarySO?.total
    ? Math.round(((attendanceSummarySO.present + attendanceSummarySO.halfDay) / attendanceSummarySO.total) * 100)
    : 0;

  const previewRetailers = isSO
    ? ((retailersRes as any)?.retailers ?? []).slice(0, 5)
    : isDistributor
      ? (retailersRes as any)?.data ?? []
      : [];

  const agents = agentsRes?.data ?? [];
  const agentTotal = d?.salesAgentCount ?? agentsRes?.total ?? 0;
  const retailerTotal = d?.retailerCount ?? (retailersRes as any)?.total ?? 0;

  return (
    <View className="gap-6 pb-24">
      {/* Stats Cards */}
      {isNSM ? (
        <View className="w-full">
          <WebStatCard label="ASMS" value={d?.asmCount ?? 0} icon="people-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="RSMS" value={d?.rsmCount ?? 0} icon="person-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="TERRITORY COVERAGE" value={formatNumber(d?.territoryCoverage ?? 0)} icon="globe-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="TOTAL ORDERS" value={formatNumber(totalOrders)} icon="cube-outline" iconBg="bg-yellow-50" iconColor="#f59e0b" loading={dashLoading} />
        </View>
      ) : isRSM ? (
        <View className="w-full">
          <WebStatCard label="MY ASMS" value={d?.asmCount ?? 0} icon="people-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="MY SOS" value={d?.soCount ?? 0} icon="person-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="ASSIGNED SS" value={d?.assignedSSCount ?? 0} icon="home-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="ASSIGNED DISTRIBUTORS" value={d?.assignedDistributorCount ?? 0} icon="car-outline" iconBg="bg-yellow-50" iconColor="#f59e0b" loading={dashLoading} />
        </View>
      ) : isASM ? (
        <View className="w-full">
          <WebStatCard label="MY SOS" value={d?.soCount ?? 0} icon="people-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="ASSIGNED DISTRIBUTORS" value={d?.assignedDistributorCount ?? 0} icon="car-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="ASSIGNED RETAILERS" value={formatNumber(d?.assignedRetailerCount ?? 0)} icon="home-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="PENDING ORDERS" value={formatNumber(pendingOrders)} icon="time-outline" iconBg="bg-yellow-50" iconColor="#f59e0b" loading={summaryLoading} />
        </View>
      ) : isSO ? (
        <View className="w-full">
          <WebStatCard label="ASSIGNED RETAILERS" value={formatNumber(d?.assignedRetailers ?? 0)} icon="home-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="ASSIGNED DISTRIBUTORS" value={formatNumber(d?.assignedDistributors ?? 0)} icon="car-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="PENDING ORDERS" value={formatNumber(summary?.CREATED ?? 0)} icon="time-outline" iconBg="bg-yellow-50" iconColor="#f59e0b" loading={summaryLoading} />
          <WebStatCard label="DISPATCHED" value={formatNumber(summary?.DISPATCHED ?? 0)} icon="cube-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={summaryLoading} />
          <WebStatCard label="DELIVERED" value={formatNumber(summary?.DELIVERED ?? 0)} icon="checkmark-circle-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={summaryLoading} />
        </View>
      ) : isSS ? (
        <View className="w-full">
          <WebStatCard label="TOTAL DISTRIBUTORS" value={formatNumber(d?.distributorCount ?? 0)} icon="people-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="INVENTORY VALUE" value={d?.inventoryValue ? formatInventoryValue(d.inventoryValue) : '₹0'} icon="cash-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="LOW STOCK ALERTS" value={formatNumber(d?.lowStockCount ?? 0)} icon="warning-outline" iconBg="bg-amber-50" iconColor="#f59e0b" loading={dashLoading} />
          <WebStatCard label="PENDING ORDERS" value={formatNumber(pendingOrders)} icon="time-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={summaryLoading} />
        </View>
      ) : isDistributor ? (
        <View className="w-full">
          <WebStatCard label="SALES AGENTS" value={formatNumber(agentTotal)} icon="people-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="ACTIVE RETAILERS" value={formatNumber(retailerTotal)} icon="home-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="INVENTORY VALUE" value={d?.inventoryValue ? formatInventoryValue(d.inventoryValue) : '₹0'} icon="cash-outline" iconBg="bg-teal-50" iconColor="#0d9488" loading={dashLoading} />
          <WebStatCard label="LOW STOCK SKUS" value={formatNumber(d?.lowStockCount ?? 0)} icon="warning-outline" iconBg="bg-amber-50" iconColor="#f59e0b" loading={dashLoading} />
        </View>
      ) : isDispatch ? (
        <View className="w-full">
          <WebStatCard label="READY TO DISPATCH" value={formatNumber(summary?.APPROVED ?? 0)} icon="bus-outline" iconBg="bg-amber-50" iconColor="#f59e0b" loading={summaryLoading} onPress={() => router.push('/orders?type=primary_dispatch' as any)} />
          <WebStatCard label="DISPATCHED" value={formatNumber(summary?.DISPATCHED ?? 0)} icon="cube-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={summaryLoading} onPress={() => router.push('/orders?status=DISPATCHED' as any)} />
          <WebStatCard label="DELIVERED" value={formatNumber(summary?.DELIVERED ?? 0)} icon="checkmark-circle-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={summaryLoading} onPress={() => router.push('/orders?status=DELIVERED' as any)} />
          <WebStatCard label="TOTAL ORDERS" value={formatNumber(totalOrders)} icon="stats-chart-outline" iconBg="bg-purple-50" iconColor="#8b5cf6" loading={summaryLoading || dashLoading} onPress={() => router.push('/orders' as any)} />
        </View>
      ) : isFinance ? (
        <View className="w-full">
          <WebStatCard label="IN FINANCE QUEUE" value={formatNumber(summary?.IN_FINANCE ?? 0)} icon="layers-outline" iconBg="bg-indigo-50" iconColor="#4f46e5" loading={summaryLoading} onPress={() => router.push('/orders?type=primary_approve' as any)} />
          <WebStatCard label="APPROVED" value={formatNumber(summary?.APPROVED ?? 0)} icon="checkmark-circle-outline" iconBg="bg-emerald-50" iconColor="#059669" loading={summaryLoading} onPress={() => router.push('/orders?status=APPROVED' as any)} />
          <WebStatCard label="REJECTED" value={formatNumber(summary?.CANCELLED ?? 0)} icon="close-circle-outline" iconBg="bg-red-50" iconColor="#ef4444" loading={summaryLoading} onPress={() => router.push('/orders?status=CANCELLED' as any)} />
          <WebStatCard label="TOTAL ORDERS" value={formatNumber(totalOrders)} icon="stats-chart-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={summaryLoading || dashLoading} onPress={() => router.push('/orders' as any)} />
        </View>
      ) : (
        <View className="w-full">
          <WebStatCard label="TOTAL USERS" value={formatNumber(totalUsers)} icon="people-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
          <WebStatCard label="TOTAL ORDERS" value={formatNumber(totalOrders)} icon="cube-outline" iconBg="bg-emerald-50" iconColor="#10b981" loading={dashLoading} />
          <WebStatCard label="PENDING ORDERS" value={formatNumber(pendingOrders)} icon="time-outline" iconBg="bg-amber-50" iconColor="#f59e0b" loading={summaryLoading} />
          <WebStatCard label="ACTIVE ROLES" value={activeRoles} icon="shield-checkmark-outline" iconBg="bg-orange-50" iconColor="#f97316" loading={dashLoading} />
        </View>
      )}

      {/* User Breakdown / National Overview */}
      {isNSM ? (
        <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <View>
              <Text className="text-base font-bold text-gray-850 text-slate-800">National Overview</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Sales force & territory activity</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/users')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-semibold text-gray-500 mr-1">View All</Text>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View className="gap-3.5 mt-2">
            <View className="bg-white border border-gray-100 p-4 rounded-xl items-center justify-center">
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total ASMs</Text>
              <Text className="text-xl font-bold text-gray-800 mt-1">{d?.asmCount ?? 0}</Text>
            </View>
            <View className="bg-white border border-gray-100 p-4 rounded-xl items-center justify-center">
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total SOs</Text>
              <Text className="text-xl font-bold text-gray-800 mt-1">{d?.soCount ?? 0}</Text>
            </View>
          </View>
        </View>
      ) : isASM ? null : (isSO || isDistributor) ? (
        <>
          {isDistributor && (
            <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm mb-4">
              <View className="flex-row justify-between items-center mb-1">
                <View>
                  <Text className="text-base font-bold text-gray-800">Sales Agents</Text>
                  <Text className="text-[11px] text-gray-400 mt-0.5">{agentTotal} agents under you</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/users')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
                  <Text className="text-xs font-semibold text-gray-500 mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <View className="gap-3 mt-3">
                {agentsLoading ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : agents.length === 0 ? (
                  <Text className="text-xs text-gray-400 py-2">No agents assigned yet</Text>
                ) : (
                  agents.map((agent: any, index: number) => {
                    const initials = agent.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <View key={agent.entityId || index} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                        <View className="flex-row items-center gap-2">
                          <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                            <Text className="text-xs font-bold text-[#f97316]">{initials}</Text>
                          </View>
                          <View>
                            <Text className="text-xs font-semibold text-gray-800">{agent.name}</Text>
                            <Text className="text-[10px] text-gray-400 mt-0.5">{getRoleDisplayName(agent.role)}</Text>
                          </View>
                        </View>
                        <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Text className="text-[8px] font-bold text-emerald-700 uppercase">
                            {agent.isActive !== false ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm">
            <View className="flex-row justify-between items-center mb-1">
              <View>
                <Text className="text-base font-bold text-gray-800">{isSO ? 'My Retailers' : 'Retailers'}</Text>
                <Text className="text-[11px] text-gray-400 mt-0.5">
                  {isSO
                    ? `${d?.assignedRetailers ?? 0} retailers assigned to you`
                    : `${retailerTotal} retailers in your network`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/users')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
                <Text className="text-xs font-semibold text-gray-500 mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View className="gap-3 mt-3">
              {retailersLoading ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : previewRetailers.length === 0 ? (
                <Text className="text-xs text-gray-400 py-2">
                  {isSO ? 'No retailers assigned yet' : 'No retailers onboarded yet'}
                </Text>
              ) : (
                previewRetailers.map((ret: any, index: number) => {
                  const initials = ret.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                  return (
                    <View key={ret.entityId || index} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                      <View className="flex-row items-center gap-2">
                        <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                          <Text className="text-xs font-bold text-[#f97316]">{initials}</Text>
                        </View>
                        <View>
                          <Text className="text-xs font-semibold text-gray-800">{ret.name}</Text>
                          <Text className="text-[10px] text-gray-400 mt-0.5">Retailer</Text>
                        </View>
                      </View>
                      <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Text className="text-[8px] font-bold text-emerald-700 uppercase">
                          {ret.isActive !== false ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </>
      ) : isSS ? (
        <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm">
          <View className="flex-row justify-between items-center mb-1">
            <View>
              <Text className="text-base font-bold text-gray-800">Distributors</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">{d?.distributorCount ?? 0} distributors in your network</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/users')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-semibold text-gray-500 mr-1">View All</Text>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View className="gap-3 mt-3">
            {distributorsLoading ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (distributorsRes?.data ?? []).length === 0 ? (
              <Text className="text-xs text-gray-400 py-2">No distributors in network</Text>
            ) : (
              (distributorsRes?.data ?? []).map((dist: any, index: number) => {
                const initials = dist.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <View key={dist.entityId || index} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                    <View className="flex-row items-center gap-2">
                      <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                        <Text className="text-xs font-bold text-[#f97316]">{initials}</Text>
                      </View>
                      <View>
                        <Text className="text-xs font-semibold text-gray-800">{dist.name}</Text>
                        <Text className="text-[10px] text-gray-400 mt-0.5">Distributor</Text>
                      </View>
                    </View>
                    <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Text className="text-[8px] font-bold text-emerald-700 uppercase">
                        {dist.isActive !== false ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      ) : isDispatch || isFinance || isRSM || isASM ? null : (
        d?.roleBreakdown && (
          <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm">
            <View className="flex-row justify-between items-center mb-1">
              <View>
                <Text className="text-base font-bold text-gray-800">User Breakdown</Text>
                <Text className="text-[11px] text-gray-400 mt-0.5">Users by role</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/users')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
                <Text className="text-xs font-semibold text-gray-500 mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-2.5 mt-3 justify-between">
              {Object.entries(d.roleBreakdown).map(([roleName, count], index, array) => {
                const isLastOdd = array.length % 2 !== 0 && index === array.length - 1;
                return (
                  <View
                    key={roleName}
                    className={`bg-white border border-gray-100 p-3 rounded-lg items-center ${isLastOdd ? 'w-full' : 'w-[48%]'
                      }`}
                  >
                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
                      {roleName.replace(/_/g, ' ')}
                    </Text>
                    <Text className="text-xl font-bold text-gray-800 mt-1">
                      {formatNumber(count as number)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      }

      {/* Dispatch Queue for Dispatch Role */}
      {isDispatch && (
        <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3">
            <View>
              <Text className="text-sm font-bold text-slate-800">Dispatch Queue</Text>
              <Text className="text-[11px] text-slate-400 mt-0.5">Approved orders waiting to be dispatched</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/orders')} className="flex-row items-center gap-0.5">
              <Text className="text-xs text-orange-500 font-semibold">Process Dispatch</Text>
              <Ionicons name="chevron-forward" size={12} color="#f97316" />
            </TouchableOpacity>
          </View>

          {readyDispatchLoading ? (
            <ActivityIndicator size="small" color="#f97316" className="my-4" />
          ) : (readyDispatchRes?.data ?? []).length === 0 ? (
            <View className="items-center py-6">
              <Ionicons name="cube-outline" size={28} color="#cbd5e1" className="mb-1" />
              <Text className="text-xs text-slate-400">No approved orders waiting for dispatch</Text>
            </View>
          ) : (
            <View className="gap-3">
              {(readyDispatchRes?.data ?? []).slice(0, 5).map((order: any) => (
                <TouchableOpacity
                  key={order.orderId}
                  onPress={() => router.push(`/orders/${order.orderId}` as any)}
                  className="flex-row justify-between items-center py-2.5 border-b border-slate-50 last:border-b-0 last:pb-0"
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-2">
                    <View className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
                      <Ionicons name="cube-outline" size={18} color="#f97316" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-slate-800">{order.orderId}</Text>
                      <Text className="text-[10px] text-slate-400 mt-0.5">
                        {order.type === 'primary' ? 'Supplier' : 'Order'}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs font-bold text-slate-800">{formatCurrency(order.totalAmount ?? 0)}</Text>
                    <Text className="text-[10px] text-slate-400 mt-0.5">
                      {order.updatedAt || order.createdAt ? new Date(order.updatedAt || order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Finance Review Queue for Finance Role */}
      {isFinance && (
        <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3">
            <View>
              <Text className="text-sm font-bold text-slate-800">Finance Review Queue</Text>
              <Text className="text-[11px] text-slate-400 mt-0.5">Orders awaiting finance edits and approval</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/orders?type=primary_approve' as any)} className="flex-row items-center gap-0.5">
              <Text className="text-xs text-orange-500 font-semibold">Open Queue</Text>
              <Ionicons name="chevron-forward" size={12} color="#f97316" />
            </TouchableOpacity>
          </View>

          {readyFinanceQueueLoading ? (
            <ActivityIndicator size="small" color="#f97316" className="my-4" />
          ) : (readyFinanceQueueRes?.data ?? []).length === 0 ? (
            <View className="items-center py-6">
              <Ionicons name="wallet-outline" size={28} color="#cbd5e1" className="mb-1" />
              <Text className="text-xs text-slate-400">No orders pending finance review</Text>
            </View>
          ) : (
            <View className="gap-3">
              {(readyFinanceQueueRes?.data ?? []).slice(0, 8).map((order: any) => (
                <TouchableOpacity
                  key={order.orderId}
                  onPress={() => router.push(`/orders/${order.orderId}` as any)}
                  className="flex-row justify-between items-center py-2.5 border-b border-slate-50 last:border-b-0 last:pb-0"
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-2">
                    <View className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 items-center justify-center">
                      <Ionicons name="cube-outline" size={18} color="#f97316" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-slate-800">{order.orderId}</Text>
                      <Text className="text-[10px] text-slate-400 mt-0.5">
                        {order.fromEntityName || 'Supplier'}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs font-bold text-slate-800">{formatInventoryValue(order.totalAmount ?? 0)}</Text>
                    <Text className="text-[10px] text-slate-400 mt-0.5">
                      {order.updatedAt || order.createdAt ? new Date(order.updatedAt || order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* SKU Master for Super Stockist & Distributor */}
      {(isSS || isDistributor) && (
        <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm mt-4">
          <View className="flex-row justify-between items-center mb-1">
            <View>
              <Text className="text-base font-bold text-gray-800">SKU Master</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Products available in your network</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/skus')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-semibold text-gray-500 mr-1">View All</Text>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View className="gap-3 mt-3">
            {skusLoading ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (skusRes?.data ?? []).length === 0 ? (
              <Text className="text-xs text-gray-400 py-2">No products available</Text>
            ) : (
              (skusRes?.data ?? []).map((sku: any, index: number) => {
                return (
                  <View key={sku.skuId || index} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                    <View className="flex-row items-center gap-2">
                      <View className="w-8 h-8 rounded-lg bg-orange-50 items-center justify-center border border-orange-100">
                        <Ionicons name="cube-outline" size={16} color="#f97316" />
                      </View>
                      <View>
                        <Text className="text-xs font-semibold text-gray-800">{sku.name}</Text>
                        <Text className="text-[10px] text-gray-400 mt-0.5">{sku.weight || sku.description || 'Pack'}</Text>
                      </View>
                    </View>
                    <Text className="text-xs font-bold text-gray-800">₹{sku.price}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* Order Pipeline */}
      {summary && (
        <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm">
          <View className="flex-row justify-between items-center mb-1">
            <View>
              <Text className="text-base font-bold text-gray-800">Order Pipeline</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Current order status breakdown</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/orders')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-semibold text-gray-500 mr-1">All Orders</Text>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View className="gap-4 mt-3">
            {[
              { status: OrderStatus.CREATED, label: 'Pending', color: '#f59e0b', icon: 'time-outline', bg: 'bg-amber-50' },
              { status: OrderStatus.IN_FINANCE, label: 'In Finance', color: '#8b5cf6', icon: 'wallet-outline', bg: 'bg-purple-50' },
              { status: OrderStatus.APPROVED, label: 'Approved', color: '#10b981', icon: 'checkmark-circle-outline', bg: 'bg-emerald-50' },
              { status: OrderStatus.DISPATCHED, label: 'Dispatched', color: '#eab308', icon: 'truck-outline', bg: 'bg-yellow-50' },
              { status: OrderStatus.DELIVERED, label: 'Delivered', color: '#059669', icon: 'cube-outline', bg: 'bg-emerald-100' },
              { status: OrderStatus.CANCELLED, label: 'Cancelled', color: '#ef4444', icon: 'close-circle-outline', bg: 'bg-red-50' },
            ].map((step) => {
              const count = summary[step.status] ?? 0;
              const total = summary.total || 1;
              const percentage = Math.min(100, Math.round((count / total) * 100));

              return (
                <View key={step.status} className="gap-1.5">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2">
                      <View className={`${step.bg} w-6 h-6 rounded-md items-center justify-center`}>
                        <Ionicons name={step.icon as any} size={13} color={step.color} />
                      </View>
                      <Text className="text-xs text-gray-600 font-semibold">{step.label}</Text>
                    </View>
                    <Text className="text-xs font-bold text-gray-800">{formatNumber(count)}</Text>
                  </View>
                  <View className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${percentage}%`, backgroundColor: step.color }}
                    />
                  </View>
                </View>
              );
            })}
            <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 mt-1">
              <Text className="text-xs text-gray-400 font-bold">Total Orders</Text>
              <Text className="text-sm font-black text-gray-800">{formatNumber(summary.total ?? 0)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Dispatch Insights for Dispatch Role */}
      {isDispatch && (
        <DispatchInsightsView orders={allDispatchOrdersRes?.data ?? []} loading={allDispatchOrdersLoading} />
      )}
      {/* Finance Insights for Finance Role */}
      {isFinance && (
        <FinanceInsightsView orders={allDispatchOrdersRes?.data ?? []} loading={allDispatchOrdersLoading} />
      )}
      {/* Attendance Snapshot for RSM/ASM */}
      {(isASM || isRSM) && (
        <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm mt-4">
          <View className="flex-row justify-between items-center mb-3">
            <View>
              <Text className="text-base font-bold text-gray-800">Attendance Snapshot</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Last 30 days performance</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/admin/attendance')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-semibold text-gray-500 mr-1">Open Attendance</Text>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {attendanceSummaryLoading ? (
            <ActivityIndicator size="small" color="#f97316" />
          ) : (
            <>
              <View className="flex-row flex-wrap gap-2.5 justify-between">
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Attendance Score</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">{attRate}%</Text>
                </View>
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Late Marks</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">{attendanceSummary?.lateCount ?? 0}</Text>
                </View>
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Present</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">{attendanceSummary?.present ?? 0}</Text>
                </View>
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Leaves/Absent</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">
                    {(attendanceSummary?.leave ?? 0) + (attendanceSummary?.absent ?? 0)}
                  </Text>
                </View>
              </View>

              <View className="mt-3 flex-row items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <Ionicons name="clipboard-outline" size={14} color="#f97316" />
                <Text className="text-xs text-gray-500">
                  {todayAttendanceLoading
                    ? 'Checking today status...'
                    : todayAttendance?.hasMarked
                      ? `Today marked${todayAttendance.record?.workingType ? ` (${todayAttendance.record.workingType.replace(/_/g, ' ')})` : ''}`
                      : 'Today attendance pending'}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
      {/* Attendance Snapshot for SO / ASE */}
      {isSO && (
        <View className="border border-gray-150 rounded-xl p-4 bg-white shadow-sm mt-4">
          <View className="flex-row justify-between items-center mb-3">
            <View>
              <Text className="text-base font-bold text-gray-800">Attendance Snapshot</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Last 30 days performance</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/admin/attendance')} className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-semibold text-gray-500 mr-1">Open Attendance</Text>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {attendanceSummarySOLoading ? (
            <ActivityIndicator size="small" color="#f97316" />
          ) : (
            <>
              <View className="flex-row flex-wrap gap-2.5 justify-between">
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Attendance Score</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">{attRateSO}%</Text>
                </View>
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Late Marks</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">{attendanceSummarySO?.lateCount ?? 0}</Text>
                </View>
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Present</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">{attendanceSummarySO?.present ?? 0}</Text>
                </View>
                <View className="bg-white border border-gray-100 p-3 rounded-lg items-center w-[48%]">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Leaves/Absent</Text>
                  <Text className="text-lg font-bold text-gray-800 mt-1">
                    {(attendanceSummarySO?.leave ?? 0) + (attendanceSummarySO?.absent ?? 0)}
                  </Text>
                </View>
              </View>

              <View className="mt-3 flex-row items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <Ionicons name="clipboard-outline" size={14} color="#f97316" />
                <Text className="text-xs text-gray-500">
                  {todayAttendanceSOLoading
                    ? 'Checking today status...'
                    : todayAttendanceSO?.hasMarked
                      ? `Today marked${todayAttendanceSO.record?.workingType ? ` (${todayAttendanceSO.record.workingType.replace(/_/g, ' ')})` : ''}`
                      : 'Today attendance pending'}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Page Container ──
export default function UniversalDashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();

  if (!user) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white p-6">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    );
  }

  const isRetailer = user.role === UserRole.RETAILER;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* Dynamic Greetings and Location Header */}
        {!isRetailer && (
          <View className="mb-5">
            <Text className="text-2xl font-bold text-gray-800">{getGreeting()}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs text-gray-500">{"Here's what's happening in your network today –"}</Text>
              <Text className="text-xs font-semibold text-gray-700">{getRoleDisplayName(user.role as UserRole)}</Text>
              {user?.state && (
                <>
                  <Text className="text-xs text-gray-300">•</Text>
                  <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <Ionicons name="location" size={10} color="#047857" />
                    <Text className="text-[10px] font-bold text-emerald-700 uppercase">
                      {user.state}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {isRetailer ? <RetailerDashboardView /> : <EmployeeDashboardView role={user.role} />}
      </ScrollView>
    </View>

  );
}
