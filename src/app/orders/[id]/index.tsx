import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { orderService } from '@/services/order.service';
import { skuService } from '@/services/sku.service';
import { inventoryService } from '@/services/inventory.service';
import { UserRole, OrderType, OrderStatus } from '@/types';
import { STATUS_CONFIG, formatCurrency, canApproveOrder, canDispatchOrder, canDeliverOrder, canCancelOrder } from '@/lib/order-helpers';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ApproveOrderModal from '@/components/orders/ApproveOrderModal';

function formatOrderDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return dateStr;
  }
}

function getStockImpact(order: any) {
  const lines = order?.sourceStockSnapshot?.lines;
  if (!lines || lines.length === 0) return null;

  const requested = lines.reduce((sum: number, line: any) => sum + (line.requiredPieces || 0), 0);
  const available = lines.reduce((sum: number, line: any) => sum + (line.availablePieces || 0), 0);
  const remaining = available - requested;

  return {
    requested,
    available,
    remaining,
    canFulfill: remaining >= 0,
    lines,
  };
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [confirmAction, setConfirmAction] = React.useState<{
    open: boolean;
    targetStatus: OrderStatus;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: 'warning' | 'danger' | 'info';
  } | null>(null);

  const [showApproveModal, setShowApproveModal] = React.useState(false);

  // Query Details
  const { data: detailsRes, isLoading, isError, refetch } = useQuery({
    queryKey: ['order-details-dashboard-app', id],
    queryFn: () => orderService.getById(id),
    enabled: !!id,
  });

  const order = detailsRes?.data?.order;

  const [financeLines, setFinanceLines] = React.useState<Record<string, { quantity: string; price: string }>>({});

  const roleStr = (user?.role || '').toLowerCase();
  const isSS = roleStr === String(UserRole.SUPER_STOCKIST).toLowerCase() || user?.role === UserRole.SUPER_STOCKIST;
  const isAdmin = roleStr === String(UserRole.ADMIN).toLowerCase() || user?.role === UserRole.ADMIN;
  const isDist = roleStr === String(UserRole.DISTRIBUTOR).toLowerCase() || user?.role === UserRole.DISTRIBUTOR;
  const isRetailer = roleStr === String(UserRole.RETAILER).toLowerCase() || user?.role === UserRole.RETAILER;
  const isSO = roleStr === String(UserRole.SO).toLowerCase() || roleStr === String(UserRole.ASE).toLowerCase() || user?.role === UserRole.SO || user?.role === UserRole.ASE;
  const isFinance = roleStr === String(UserRole.FINANCE).toLowerCase() || user?.role === UserRole.FINANCE;
  const isDispatch = roleStr === String(UserRole.DISPATCH).toLowerCase() || user?.role === UserRole.DISPATCH;
  const isManagement = isSO || roleStr === String(UserRole.ASM).toLowerCase() || roleStr === String(UserRole.RSM).toLowerCase() || user?.role === UserRole.ASM || user?.role === UserRole.RSM;
  const isStockIn = !!(
    order &&
    (order.type === OrderType.PRIMARY || order.type === OrderType.PRIMARY_HANDOVER) &&
    order.fromEntityId === order.toEntityId
  );

  const canSSEdit =
    order &&
    isSS &&
    order.status === OrderStatus.CREATED &&
    (order.fromEntityId === user?.entityId ||
      order.toEntityId === user?.entityId ||
      order.createdBy === user?.entityId);

  const canFinanceEdit =
    order &&
    (isFinance || isAdmin) &&
    (order.type === OrderType.PRIMARY || order.type === OrderType.PRIMARY_HANDOVER) &&
    (order.status === OrderStatus.IN_FINANCE || order.status === OrderStatus.APPROVED);

  const canDispatchEdit =
    order &&
    (isDispatch || isAdmin) &&
    (order.type === OrderType.PRIMARY || order.type === OrderType.PRIMARY_HANDOVER) &&
    order.status === OrderStatus.APPROVED;

  const canManagementEdit =
    order &&
    isManagement &&
    order.status === OrderStatus.CREATED;

  const canDistributorEdit =
    order &&
    isDist &&
    order.status === OrderStatus.CREATED &&
    (((order.type === OrderType.PRIMARY || order.type === OrderType.PRIMARY_HANDOVER) && order.toEntityId === user?.entityId) ||
      (order.type === OrderType.SECONDARY && order.fromEntityId === user?.entityId));

  const canSalesOfficerEdit =
    order &&
    (isSO || isManagement) &&
    order.type === OrderType.SECONDARY &&
    order.status === OrderStatus.CREATED;

  const canAdminEdit =
    order &&
    isAdmin &&
    (order.status === OrderStatus.CREATED || order.status === OrderStatus.IN_FINANCE || order.status === OrderStatus.APPROVED);

  const canOrderEdit = !!(
    canSSEdit ||
    canFinanceEdit ||
    canDispatchEdit ||
    canManagementEdit ||
    canDistributorEdit ||
    canSalesOfficerEdit ||
    canAdminEdit
  );

  React.useEffect(() => {
    if (!order || !canOrderEdit) return;
    const next: Record<string, { quantity: string; price: string }> = {};
    for (const item of order.items) {
      next[item.skuId] = {
        quantity: String(item.orderedQuantity ?? item.quantity),
        price: String(item.price),
      };
    }
    setFinanceLines(next);
  }, [order, canOrderEdit]);

  const displayItems = React.useMemo(() => {
    if (!order) return [];
    if (!canOrderEdit) return order.items;
    return order.items.filter((item) => financeLines[item.skuId] !== undefined);
  }, [order, canOrderEdit, financeLines]);

  const handleRemoveItem = (skuId: string) => {
    const remainingCount = Object.keys(financeLines).filter((id) => id !== skuId).length;
    if (remainingCount === 0) {
      setConfirmAction({
        open: true,
        targetStatus: OrderStatus.CANCELLED,
        title: 'Cancel Order',
        description: `Deleting the last product will cancel the entire order. Do you want to cancel order ${order?.orderId}?`,
        confirmLabel: 'Yes, Cancel Order',
        cancelLabel: 'No, Keep Order',
        variant: 'danger',
      });
    } else {
      setFinanceLines((prev) => {
        const next = { ...prev };
        delete next[skuId];
        return next;
      });
    }
  };

  const financeEditMutation = useMutation({
    mutationFn: () => {
      if (!order) throw new Error('Order not loaded');
      const items = displayItems.map((item) => ({
        skuId: item.skuId,
        quantity: Number(financeLines[item.skuId]?.quantity ?? item.quantity),
        price: Number(financeLines[item.skuId]?.price ?? item.price),
      }));
      return orderService.financeEdit(id, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      Alert.alert('Success', 'Order changes saved successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to save order edits');
    },
  });

  // Fetch SKU map for resolving human-readable product names
  const { data: skusData } = useQuery({
    queryKey: ['order-detail-sku-map'],
    queryFn: () => skuService.list({ limit: 1000 }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const skuMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const list = (skusData as any)?.data ?? (skusData as any)?.skus ?? [];
    if (Array.isArray(list)) {
      for (const s of list) {
        const key = (s.masterSkuId || s.skuId || '').trim().toUpperCase();
        if (key && s.name) {
          map.set(key, s.name);
        }
      }
    }
    return map;
  }, [skusData]);

  const getSkuLabel = (skuId?: string, fallbackName?: string): string => {
    if (!skuId) return fallbackName || 'Product';
    const key = skuId.trim().toUpperCase();
    if (skuMap.has(key)) return skuMap.get(key)!;
    if (fallbackName && fallbackName.trim().toUpperCase() !== key) return fallbackName.trim();
    return skuId;
  };

  // -- SS Inventory Pre-flight Check -------------------------------
  const showInventoryCheck = !!(
    order &&
    isSS &&
    !isStockIn &&
    order.type === OrderType.PRIMARY &&
    order.status === OrderStatus.CREATED
  );

  const { data: ssInventoryData } = useQuery({
    queryKey: ['ss-inventory-check', order?.fromEntityId],
    queryFn: () => inventoryService.getInventory(order!.fromEntityId, { limit: 500 }),
    enabled: showInventoryCheck,
    staleTime: 30_000,
  });

  const getAvailableStock = React.useCallback(
    (skuId?: string): number => {
      if (!skuId || !ssInventoryData?.data) return 0;
      const target = skuId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const inv of ssInventoryData.data) {
        if ((inv.skuId || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
          return inv.quantity;
        }
      }
      return 0;
    },
    [ssInventoryData?.data]
  );

  const stockIssues = React.useMemo(() => {
    if (!showInventoryCheck || !order) return [];
    return order.items.filter((item: any) => {
      const avail = getAvailableStock(item.skuId);
      return avail < item.quantity;
    });
  }, [showInventoryCheck, order, getAvailableStock]);

  const canAdminHandover = !!(
    order &&
    isAdmin &&
    (isStockIn || order.type === OrderType.PRIMARY_HANDOVER) &&
    order.status === OrderStatus.CREATED
  );
  const canFinanceApprove = !!(
    order &&
    isFinance &&
    (isStockIn || order.type === OrderType.PRIMARY_HANDOVER) &&
    order.status === OrderStatus.IN_FINANCE
  );
  const canFinanceReject = !!(
    order &&
    isFinance &&
    (isStockIn || order.type === OrderType.PRIMARY_HANDOVER) &&
    order.status === OrderStatus.IN_FINANCE
  );

  const adminHandoverMutation = useMutation({
    mutationFn: () => orderService.adminHandoverFinance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      Alert.alert('Success', 'Order handed over to finance successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to hand over order to finance');
    },
  });

  const financeApproveMutation = useMutation({
    mutationFn: () => orderService.financeApprove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      Alert.alert('Success', 'Order approved in finance successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to approve order in finance');
    },
  });

  const financeRejectMutation = useMutation({
    mutationFn: (reason?: string) => orderService.financeReject(id, reason || 'Rejected by finance'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      Alert.alert('Success', 'Order rejected in finance');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to reject order in finance');
    },
  });

  // Status Action Mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: OrderStatus) => orderService.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['retailer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['so-all-retailer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-user-distributor-orders'] });
      refetch();
      setConfirmAction(null);
      Alert.alert('Success', 'Order status updated');
    },
    onError: (err: any) => {
      setConfirmAction(null);
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' ? err.response.data : undefined) ||
        err.message ||
        'Failed to update order status';
      const isStockError = typeof message === 'string' && message.toLowerCase().includes('insufficient stock');
      Alert.alert(isStockError ? 'Insufficient Stock' : 'Error', message);
    },
  });

  const handleStatusChange = (status: OrderStatus) => {
    if (status === OrderStatus.DISPATCHED) {
      setConfirmAction({
        open: true,
        targetStatus: status,
        title: 'Mark as Dispatched',
        description: `Confirm that order ${order?.orderId || id} has been dispatched and is on its way to the receiver?`,
        confirmLabel: 'Yes, Dispatch',
        cancelLabel: 'No, Cancel',
        variant: 'warning',
      });
      return;
    }
    if (status === OrderStatus.DELIVERED) {
      setConfirmAction({
        open: true,
        targetStatus: status,
        title: 'Confirm Delivery',
        description: `Confirm that you have received order ${order?.orderId || id}? This will mark it as Delivered.`,
        confirmLabel: 'Yes, Deliver',
        cancelLabel: 'No, Cancel',
        variant: 'info',
      });
      return;
    }
    if (status === OrderStatus.CANCELLED) {
      setConfirmAction({
        open: true,
        targetStatus: status,
        title: 'Cancel Order',
        description: `Are you sure you want to cancel order ${order?.orderId || id}? This action cannot be undone.`,
        confirmLabel: 'Yes, Cancel Order',
        cancelLabel: 'No, Keep Order',
        variant: 'danger',
      });
      return;
    }
    updateStatusMutation.mutate(status);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4 text-center">Failed to load order</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">The order might not exist or you lack permission to view it.</Text>
        <TouchableOpacity onPress={() => router.push('/orders')} className="mt-6 bg-gray-900 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Back to Orders</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] ?? {
    label: order.status,
    bg: 'bg-gray-100 border border-gray-200',
    text: 'text-gray-650',
  };

  const stockImpact = (isFinance || isDispatch || isStockIn) ? null : getStockImpact(order);

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-gray-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-gray-200 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.push('/orders')} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-800">Order Details</Text>
          <Text className="text-[10px] font-mono text-gray-400 mt-0.5">ID: {order.orderId}</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} className="p-2 border border-gray-200 rounded-lg bg-white">
          <Ionicons name="refresh" size={16} color="#4b5563" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        alwaysBounceVertical={true}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }}
      >
        {/* Title & Badges & Creator Meta */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-2.5 mb-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <View className={`px-2.5 py-0.5 rounded-full ${statusCfg.bg}`}>
                <Text className={`text-[10px] font-bold uppercase ${statusCfg.text}`}>
                  {statusCfg.label}
                </Text>
              </View>
              <View className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold uppercase text-slate-700">
                  {order.type === OrderType.PRIMARY ? 'Primary' : 'Secondary'}
                </Text>
              </View>
            </View>
          </View>

          {order.onBehalfOfName ? (
            <Text className="text-xs text-gray-500 mt-1 leading-relaxed">
              Order placed by: <Text className="font-semibold text-gray-800">{order.createdByName || 'Sales Rep'}</Text> on behalf of <Text className="font-semibold text-gray-800">{order.onBehalfOfName}</Text>
            </Text>
          ) : order.createdByName ? (
            <Text className="text-xs text-gray-500 mt-1">
              Created by: <Text className="font-semibold text-gray-800">{order.createdByName}</Text>
            </Text>
          ) : null}
        </View>

        {/* Actions Controls (Prominently placed at top) */}
        {(canAdminHandover || canFinanceApprove || canFinanceReject || canApproveOrder(order, user?.role, user?.entityId) || canDispatchOrder(order, user?.role, user?.entityId) || canDeliverOrder(order, user?.role, user?.entityId) || canCancelOrder(order, user?.role, user?.entityId)) && (
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-3 mb-4">
            <Text className="text-xs font-bold text-gray-800">Available Actions</Text>
            <View className="flex-row flex-wrap gap-2">
              {canAdminHandover && (
                <TouchableOpacity
                  onPress={() => adminHandoverMutation.mutate()}
                  className="flex-1 min-w-[45%] bg-emerald-600 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                  <Text className="text-white text-xs font-bold">Hand Over to Finance</Text>
                </TouchableOpacity>
              )}

              {canFinanceApprove && (
                <TouchableOpacity
                  disabled={financeApproveMutation.isPending}
                  onPress={() => financeApproveMutation.mutate()}
                  className={`flex-1 min-w-[45%] bg-emerald-600 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${financeApproveMutation.isPending ? 'opacity-50' : ''}`}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <Text className="text-white text-xs font-bold">
                    {financeApproveMutation.isPending ? 'Approving...' : 'Approve in Finance'}
                  </Text>
                </TouchableOpacity>
              )}

              {canFinanceReject && (
                <TouchableOpacity
                  disabled={financeRejectMutation.isPending}
                  onPress={() => financeRejectMutation.mutate()}
                  className={`flex-1 min-w-[45%] border border-red-200 bg-red-50 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${financeRejectMutation.isPending ? 'opacity-50' : ''}`}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                  <Text className="text-red-700 text-xs font-bold">
                    {financeRejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                  </Text>
                </TouchableOpacity>
              )}

              {canApproveOrder(order, user?.role, user?.entityId) && (
                <TouchableOpacity
                  disabled={stockIssues.length > 0}
                  onPress={() => {
                    if (stockIssues.length > 0) return;
                    setShowApproveModal(true);
                  }}
                  className={`flex-1 min-w-[45%] py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${stockIssues.length > 0 && ssInventoryData
                      ? 'bg-emerald-600/50 opacity-60'
                      : 'bg-[#f97316]'
                    }`}
                >
                  <Ionicons
                    name={stockIssues.length > 0 && ssInventoryData ? 'warning-outline' : 'checkmark-circle-outline'}
                    size={16}
                    color="#fff"
                  />
                  <Text className="text-white text-xs font-bold">
                    {stockIssues.length > 0 && ssInventoryData ? 'Insufficient Stock' : 'Approve Order'}
                  </Text>
                </TouchableOpacity>
              )}

              {canDispatchOrder(order, user?.role, user?.entityId) && (
                <TouchableOpacity
                  onPress={() => handleStatusChange(OrderStatus.DISPATCHED)}
                  className="flex-1 min-w-[45%] bg-amber-500 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                >
                  <Ionicons name="bus-outline" size={16} color="#fff" />
                  <Text className="text-white text-xs font-bold">Mark Dispatched</Text>
                </TouchableOpacity>
              )}

              {canDeliverOrder(order, user?.role, user?.entityId) && (
                <TouchableOpacity
                  onPress={() => handleStatusChange(OrderStatus.DELIVERED)}
                  className="flex-1 min-w-[45%] bg-emerald-600 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <Text className="text-white text-xs font-bold">Confirm Delivery</Text>
                </TouchableOpacity>
              )}

              {canCancelOrder(order, user?.role, user?.entityId) && (
                <TouchableOpacity
                  onPress={() => handleStatusChange(OrderStatus.CANCELLED)}
                  className="flex-1 min-w-[45%] border border-red-200 bg-red-50 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                >
                  <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                  <Text className="text-red-700 text-xs font-bold">Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* SS Inventory Pre-flight Check — Your Stock Check */}
        {showInventoryCheck && ssInventoryData && (
          <View
            className={`border p-4 rounded-xl shadow-sm gap-3 mb-4 ${stockIssues.length > 0
                ? 'border-amber-200 bg-amber-50/80'
                : 'border-emerald-200 bg-emerald-50/80'
              }`}
          >
            <View className="flex-row items-center justify-between pb-2.5 border-b border-amber-200/60">
              <View className="flex-row items-center gap-1.5">
                <Ionicons
                  name="home-outline"
                  size={16}
                  color={stockIssues.length > 0 ? '#d97706' : '#059669'}
                />
                <Text
                  className={`text-xs font-bold ${stockIssues.length > 0 ? 'text-amber-800' : 'text-emerald-800'
                    }`}
                >
                  Your Stock Check
                </Text>
              </View>
              {stockIssues.length > 0 ? (
                <View className="bg-amber-100 px-2.5 py-0.5 rounded-full flex-row items-center gap-1 border border-amber-200">
                  <Ionicons name="warning-outline" size={11} color="#b45309" />
                  <Text className="text-[10px] font-bold text-amber-700">
                    {stockIssues.length} item{stockIssues.length > 1 ? 's' : ''} short
                  </Text>
                </View>
              ) : (
                <View className="bg-emerald-100 px-2.5 py-0.5 rounded-full flex-row items-center gap-1 border border-emerald-200">
                  <Ionicons name="checkmark-circle-outline" size={11} color="#047857" />
                  <Text className="text-[10px] font-bold text-emerald-700">
                    All items in stock
                  </Text>
                </View>
              )}
            </View>

            <View className="gap-2.5">
              {order.items.map((item: any) => {
                const avail = getAvailableStock(item.skuId);
                const ok = avail >= item.quantity;
                const gap = item.quantity - avail;
                const label = getSkuLabel(item.skuId, item.productName || item.name);
                return (
                  <View
                    key={item.skuId}
                    className="flex-row items-center justify-between py-1.5 border-b border-amber-200/40 last:border-b-0"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-medium text-gray-800">
                        {label}
                      </Text>
                      <View className="flex-row items-center gap-3 mt-0.5">
                        <Text className="text-[11px] text-gray-600">
                          Requested: <Text className="font-bold text-gray-800">{item.quantity}</Text>
                        </Text>
                        <Text className={`text-[11px] ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                          Available: <Text className="font-bold">{avail}</Text>
                        </Text>
                      </View>
                    </View>

                    {ok ? (
                      <Ionicons name="checkmark-circle" size={18} color="#059669" />
                    ) : (
                      <View className="bg-amber-100 px-2 py-0.5 rounded-full flex-row items-center gap-1 border border-amber-200">
                        <Ionicons name="warning-outline" size={10} color="#b45309" />
                        <Text className="text-[10px] font-bold text-amber-700">
                          Short {gap}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {stockIssues.length > 0 && (
              <View className="flex-row items-start gap-1.5 pt-2.5 border-t border-amber-200/60">
                <Ionicons name="warning-outline" size={14} color="#b45309" style={{ marginTop: 1 }} />
                <Text className="text-[11px] text-amber-800 flex-1 leading-relaxed">
                  You don't have enough stock to fulfil this order. Please{' '}
                  <Text
                    onPress={() => router.push('/inventory')}
                    className="font-bold underline text-amber-900"
                  >
                    add stock-in
                  </Text>{' '}
                  first, then return to approve.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Stock Snapshot Card (if snapshot exists) */}
        {stockImpact && (
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-3 mb-4">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Stock Snapshot For This Order
            </Text>

            <View className="flex-row flex-wrap gap-2">
              <View className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-semibold text-amber-800">
                  Requested: {stockImpact.requested}
                </Text>
              </View>
              <View className={`px-2.5 py-1 rounded-full border ${stockImpact.canFulfill ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <Text className={`text-[10px] font-semibold ${stockImpact.canFulfill ? 'text-emerald-800' : 'text-red-800'}`}>
                  Available: {stockImpact.available}
                </Text>
              </View>
              <View className={`px-2.5 py-1 rounded-full border ${stockImpact.canFulfill ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <Text className={`text-[10px] font-semibold ${stockImpact.canFulfill ? 'text-emerald-800' : 'text-red-800'}`}>
                  After Approval: {stockImpact.remaining >= 0 ? '+' : ''}{stockImpact.remaining}
                </Text>
              </View>
            </View>

            <View className="border border-gray-150 rounded-lg overflow-hidden mt-1">
              <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                <View className="min-w-[450px]">
                  <View className="flex-row bg-slate-50 border-b border-gray-200 py-2.5 px-3">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase flex-1 pr-2">Product</Text>
                    <Text className="text-[10px] font-bold text-slate-500 uppercase w-20 text-right">Available</Text>
                    <Text className="text-[10px] font-bold text-slate-500 uppercase w-20 text-right">Required</Text>
                    <Text className="text-[10px] font-bold text-slate-500 uppercase w-16 text-right">Delta</Text>
                  </View>
                  {stockImpact.lines.map((line: any, idx: number) => {
                    const delta = line.availablePieces - line.requiredPieces;
                    const productName = getSkuLabel(line.skuId, line.productName || line.name);
                    return (
                      <View key={line.skuId || idx} className="flex-row py-2.5 px-3 border-b border-gray-100 last:border-b-0 items-center bg-white">
                        <Text className="text-xs text-gray-800 font-medium flex-1 pr-2">{productName}</Text>
                        <Text className="text-xs text-gray-500 w-20 text-right">{line.availablePieces} pcs</Text>
                        <Text className="text-xs text-gray-500 w-20 text-right">{line.requiredPieces} pcs</Text>
                        <Text className={`text-xs font-bold w-16 text-right ${delta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {delta >= 0 ? '+' : ''}{delta} pcs
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Sender / Buyer / Creator Separate Cards with Spacing */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mb-4">
          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">From (Supplier)</Text>
          <Text className="text-sm font-bold text-slate-800 mt-1">{order.fromEntityName || 'Source'}</Text>
          <Text className="text-xs text-gray-400 mt-0.5 font-mono">ID: {order.fromEntityId}</Text>
        </View>

        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mb-4">
          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">To (Buyer / Retailer)</Text>
          <Text className="text-sm font-bold text-slate-800 mt-1">{order.toEntityName || 'Buyer'}</Text>
          <Text className="text-xs text-gray-400 mt-0.5 font-mono">ID: {order.toEntityId}</Text>
        </View>

        {order.createdByName ? (
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mb-4">
            <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Created By</Text>
            <Text className="text-sm font-bold text-slate-800 mt-1">{order.createdByName}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">{formatOrderDate(order.createdAt)}</Text>
          </View>
        ) : null}

        {/* Order Items Table with Left-to-Right Horizontal Scrolling */}
        <View className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-12">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-150 bg-white">
            <Text className="text-sm font-bold text-slate-800">
              Order Items ({displayItems.length})
            </Text>
            {canOrderEdit && (
              <TouchableOpacity
                disabled={financeEditMutation.isPending}
                onPress={() => financeEditMutation.mutate()}
                className="bg-indigo-600 px-3 py-1.5 rounded-lg flex-row items-center gap-1.5"
              >
                {financeEditMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="save-outline" size={14} color="#fff" />
                )}
                <Text className="text-white text-xs font-bold">Save Order Edits</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} className="w-full">
            <View className={canOrderEdit ? 'min-w-[660px]' : 'min-w-[560px]'}>
              {/* Table Header */}
              <View className="flex-row bg-slate-50 border-b border-gray-200 py-3 px-4 items-center">
                <Text className="text-[11px] font-bold text-slate-500 uppercase w-8">#</Text>
                <Text className="text-[11px] font-bold text-slate-500 uppercase flex-1 pr-2">Product</Text>
                <Text className="text-[11px] font-bold text-slate-500 uppercase w-28 text-right">Qty</Text>
                <Text className="text-[11px] font-bold text-slate-500 uppercase w-32 text-right">Unit Price</Text>
                <Text className="text-[11px] font-bold text-slate-500 uppercase w-28 text-right">Line Total</Text>
                {canOrderEdit && (
                  <Text className="text-[11px] font-bold text-slate-500 uppercase w-16 text-center">Actions</Text>
                )}
              </View>

              {/* Table Rows */}
              {displayItems.map((item, idx) => {
                const productName = getSkuLabel(item.skuId, item.name);
                const currentPrice = canOrderEdit ? Number(financeLines[item.skuId]?.price ?? item.price) : item.price;
                const currentQty = canOrderEdit ? Number(financeLines[item.skuId]?.quantity ?? item.quantity) : item.quantity;
                const lineTotal = canOrderEdit ? currentPrice * currentQty : (item.totalAmount ?? item.price * item.quantity);

                return (
                  <View
                    key={item.skuId || idx}
                    className="flex-row items-center py-3.5 px-4 border-b border-gray-100 bg-white"
                  >
                    <Text className="text-xs text-slate-400 w-8">{idx + 1}</Text>
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-semibold text-slate-800">{productName}</Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">Code: {item.skuId}</Text>
                    </View>

                    {/* Qty Column */}
                    <View className="w-28 items-end justify-center">
                      {canOrderEdit ? (
                        <TextInput
                          keyboardType="numeric"
                          value={financeLines[item.skuId]?.quantity ?? String(item.quantity)}
                          onChangeText={(val) =>
                            setFinanceLines((prev) => ({
                              ...prev,
                              [item.skuId]: {
                                quantity: val,
                                price: prev[item.skuId]?.price ?? String(item.price),
                              },
                            }))
                          }
                          className="border border-gray-200 bg-gray-50 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 w-20 text-right"
                        />
                      ) : (
                        <Text className="text-xs font-medium text-slate-700">
                          {item.quantity} {item.unitMode || 'Doz'}
                        </Text>
                      )}
                    </View>

                    {/* Unit Price Column */}
                    <View className="w-32 items-end justify-center">
                      {canOrderEdit ? (
                        <TextInput
                          keyboardType="numeric"
                          value={financeLines[item.skuId]?.price ?? String(item.price)}
                          onChangeText={(val) =>
                            setFinanceLines((prev) => ({
                              ...prev,
                              [item.skuId]: {
                                quantity: prev[item.skuId]?.quantity ?? String(item.quantity),
                                price: val,
                              },
                            }))
                          }
                          className="border border-gray-200 bg-gray-50 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 w-24 text-right"
                        />
                      ) : (
                        <Text className="text-xs font-medium text-slate-700">
                          {formatCurrency(item.price)}
                        </Text>
                      )}
                    </View>

                    {/* Line Total */}
                    <Text className="text-xs font-bold text-slate-900 w-28 text-right">
                      {formatCurrency(lineTotal)}
                    </Text>

                    {/* Actions (Delete) */}
                    {canOrderEdit && (
                      <View className="w-16 items-center justify-center">
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(item.skuId)}
                          className="p-1.5 rounded-lg bg-red-50 border border-red-100"
                        >
                          <Ionicons name="trash-outline" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Table Footer */}
              <View className="flex-row items-center py-3.5 px-4 bg-slate-50 border-t border-gray-200">
                <Text className="text-xs font-bold text-slate-800 flex-1 text-right pr-4">Total</Text>
                <Text className="text-sm font-black text-slate-900 w-28 text-right">
                  {formatCurrency(
                    canOrderEdit
                      ? displayItems.reduce((sum, item) => {
                        const price = Number(financeLines[item.skuId]?.price ?? item.price);
                        const qty = Number(financeLines[item.skuId]?.quantity ?? item.quantity);
                        return sum + price * qty;
                      }, 0)
                      : order.totalAmount
                  )}
                </Text>
                {canOrderEdit && <View className="w-16" />}
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Action Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          open={confirmAction.open}
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          cancelLabel={confirmAction.cancelLabel}
          variant={confirmAction.variant}
          loading={updateStatusMutation.isPending}
          onConfirm={() => {
            if (confirmAction) {
              updateStatusMutation.mutate(confirmAction.targetStatus);
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Approve Order Modal */}
      <ApproveOrderModal
        visible={showApproveModal}
        orderId={order?.orderId || id}
        onClose={() => setShowApproveModal(false)}
        onApproved={() => refetch()}
      />
    </SafeAreaView>
  );
}
