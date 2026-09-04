import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { orderService } from '@/services/order.service';
import { UserRole, OrderType, OrderStatus } from '@/types';
import { STATUS_CONFIG, formatCurrency } from '@/lib/order-helpers';

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

  // Query Details
  const { data: detailsRes, isLoading, isError, refetch } = useQuery({
    queryKey: ['order-details-dashboard-app', id],
    queryFn: () => orderService.getById(id),
    enabled: !!id,
  });

  const order = detailsRes?.data?.order;

  // Status Action Mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: OrderStatus) => orderService.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      Alert.alert('Success', 'Order status updated');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update order status');
    },
  });

  const handleStatusChange = (status: OrderStatus) => {
    Alert.alert('Update Order', `Confirm changing status to ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => updateStatusMutation.mutate(status) },
    ]);
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

  const isSS = user?.role === UserRole.SUPER_STOCKIST;
  const isDist = user?.role === UserRole.DISTRIBUTOR;
  const isRetailer = user?.role === UserRole.RETAILER;
  const isAdmin = user?.role === UserRole.ADMIN;
  const stockImpact = getStockImpact(order);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
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

      <ScrollView className="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {/* Title & Badges & Creator Meta */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-2.5">
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

        {/* Stock Snapshot Card (if snapshot exists) */}
        {stockImpact && (
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-3">
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
              <View className="flex-row bg-slate-50 border-b border-gray-200 py-2 px-3">
                <Text className="text-[10px] font-bold text-slate-500 uppercase flex-1">Product</Text>
                <Text className="text-[10px] font-bold text-slate-500 uppercase w-16 text-right">Available</Text>
                <Text className="text-[10px] font-bold text-slate-500 uppercase w-16 text-right">Required</Text>
                <Text className="text-[10px] font-bold text-slate-500 uppercase w-14 text-right">Delta</Text>
              </View>
              {stockImpact.lines.map((line: any, idx: number) => {
                const delta = line.availablePieces - line.requiredPieces;
                return (
                  <View key={line.skuId || idx} className="flex-row py-2 px-3 border-b border-gray-100 last:border-b-0 items-center">
                    <Text className="text-xs text-gray-800 font-medium flex-1 truncate">{line.skuId}</Text>
                    <Text className="text-xs text-gray-500 w-16 text-right">{line.availablePieces} pcs</Text>
                    <Text className="text-xs text-gray-500 w-16 text-right">{line.requiredPieces} pcs</Text>
                    <Text className={`text-xs font-bold w-14 text-right ${delta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {delta >= 0 ? '+' : ''}{delta} pcs
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Sender / Buyer / Creator Modular Cards */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-3">
          <View>
            <Text className="text-[8px] text-gray-400 font-bold uppercase">From (Supplier)</Text>
            <Text className="text-xs font-bold text-gray-800 mt-0.5">{order.fromEntityName || 'Source'}</Text>
            <Text className="text-[9px] text-gray-400">ID: {order.fromEntityId}</Text>
          </View>
          <View className="border-t border-gray-100 pt-2.5">
            <Text className="text-[8px] text-gray-400 font-bold uppercase">To (Buyer / Retailer)</Text>
            <Text className="text-xs font-bold text-gray-800 mt-0.5">{order.toEntityName || 'Buyer'}</Text>
            <Text className="text-[9px] text-gray-400">ID: {order.toEntityId}</Text>
          </View>
          {order.createdByName ? (
            <View className="border-t border-gray-100 pt-2.5">
              <Text className="text-[8px] text-gray-400 font-bold uppercase">Created By</Text>
              <Text className="text-xs font-bold text-gray-800 mt-0.5">{order.createdByName}</Text>
              <Text className="text-[9px] text-gray-400">{formatOrderDate(order.createdAt)}</Text>
            </View>
          ) : null}
        </View>

        {/* Items List */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-3">
          <Text className="text-xs font-bold text-gray-800 border-b border-gray-150 pb-2">
            Order Items ({order.items?.length || 0})
          </Text>
          {order.items?.map((item, idx) => (
            <View key={item.skuId || idx} className="flex-row justify-between items-center py-1.5 border-b border-gray-50 last:border-b-0">
              <View className="flex-1 min-w-0 pr-4">
                <Text className="text-xs font-bold text-gray-800 truncate">{item.name || item.skuId || 'Product item'}</Text>
                <Text className="text-[9px] text-gray-400 mt-0.5">Code: {item.skuId} · Qty: {item.quantity} Doz</Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-bold text-purple-700">{formatCurrency(item.totalAmount ?? item.price * item.quantity)}</Text>
                <Text className="text-[8px] text-gray-400 mt-0.5">{formatCurrency(item.price)} per Doz</Text>
              </View>
            </View>
          ))}
          <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 mt-1">
            <Text className="text-xs font-black text-gray-700">Grand Total</Text>
            <Text className="text-sm font-black text-purple-700">{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>

        {/* Actions Controls */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-3.5 mb-16">
          <Text className="text-xs font-bold text-gray-800">Available Actions</Text>
          <View className="flex-row flex-wrap gap-2">
            {order.status === OrderStatus.APPROVED && (isSS || isDist || isAdmin) && (
              <TouchableOpacity
                onPress={() => handleStatusChange(OrderStatus.DISPATCHED)}
                className="flex-1 min-w-[45%] bg-blue-600 py-2.5 rounded-xl items-center"
              >
                <Text className="text-white text-xs font-bold">Dispatch Order</Text>
              </TouchableOpacity>
            )}

            {order.status === OrderStatus.DISPATCHED && (isDist || isRetailer || isAdmin) && (
              <TouchableOpacity
                onPress={() => handleStatusChange(OrderStatus.DELIVERED)}
                className="flex-1 min-w-[45%] bg-emerald-600 py-2.5 rounded-xl items-center"
              >
                <Text className="text-white text-xs font-bold">Confirm Delivery</Text>
              </TouchableOpacity>
            )}

            {order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELIVERED && (
              <TouchableOpacity
                onPress={() => handleStatusChange(OrderStatus.CANCELLED)}
                className="flex-1 min-w-[45%] border border-red-200 bg-red-50 py-2.5 rounded-xl items-center"
              >
                <Text className="text-red-700 text-xs font-bold">Cancel Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
