import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { inventoryService } from '@/services/inventory.service';
import { UserRole } from '@/types';

const { width } = Dimensions.get('window');

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventoryDashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const entityId = user?.entityId ?? '';
  const isSS = user?.role === UserRole.SUPER_STOCKIST;
  const isSupplyChain = isSS || user?.role === UserRole.DISTRIBUTOR || user?.role === UserRole.RETAILER;

  // State Management
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'alerts'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(20);

  // Modals
  const [adjustModalItem, setAdjustModalItem] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState('');

  const [thresholdModalItem, setThresholdModalItem] = useState<any | null>(null);
  const [newThreshold, setNewThreshold] = useState('');

  // Queries
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory-dashboard', entityId, page, search, limit],
    queryFn: () =>
      inventoryService.getInventory(entityId, {
        page,
        limit,
        skuId: search || undefined,
      }),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const { data: valueData, isLoading: valueLoading } = useQuery({
    queryKey: ['inventory-dashboard-value', entityId],
    queryFn: () => inventoryService.getInventoryValue(entityId),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: lowStockData, isLoading: alertsLoading } = useQuery({
    queryKey: ['inventory-dashboard-low-stock', entityId],
    queryFn: () => inventoryService.getLowStock(entityId),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });

  const items = inventoryData?.data ?? [];
  const total = inventoryData?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;
  const totalValue = valueData?.data?.totalValue ?? 0;
  const lowStockCount = lowStockData?.total ?? 0;

  // Mutations
  const adjustMutation = useMutation({
    mutationFn: ({ skuId, qty }: { skuId: string; qty: number }) =>
      inventoryService.adjustStock(entityId, skuId, { quantityChange: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard-value'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard-low-stock'] });
      setAdjustModalItem(null);
      setAdjustQty('');
      Alert.alert('Success', 'Stock adjusted successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to adjust stock');
    },
  });

  const thresholdMutation = useMutation({
    mutationFn: ({ skuId, threshold }: { skuId: string; threshold: number }) =>
      inventoryService.updateThreshold(entityId, skuId, { lowStockThreshold: threshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard-low-stock'] });
      setThresholdModalItem(null);
      setNewThreshold('');
      Alert.alert('Success', 'Low stock threshold updated');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update threshold');
    },
  });

  const handleAdjustStock = () => {
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Error', 'Please enter a valid stock quantity');
      return;
    }
    adjustMutation.mutate({ skuId: adjustModalItem.skuId, qty });
  };

  const handleUpdateThreshold = () => {
    const threshold = Number(newThreshold);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Error', 'Please enter a valid threshold level');
      return;
    }
    thresholdMutation.mutate({ skuId: thresholdModalItem.skuId, threshold });
  };

  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/catalog' },
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
    <View className="flex-1 bg-white">
      <ScrollView className="flex-grow p-4" showsVerticalScrollIndicator={false}>
        {/* Page Title & Count */}
        <View className="mb-4">
          <Text className="text-xl font-bold text-gray-900">Inventory Intel</Text>
          <Text className="text-xs text-gray-500 mt-0.5">Stock levels, analytics, and alerts in one place</Text>
        </View>

        {/* KPI Cards (Vertically stacked list styled) */}
        <View className="gap-3.5 mb-6">
          {/* Card 1: Total SKUs */}
          <View className="border border-gray-200 p-4 rounded-xl bg-white shadow-sm gap-1">
            <Text className="text-xs font-semibold text-gray-400">Total SKUs</Text>
            <Text className="text-3xl font-black text-gray-800">{total}</Text>
          </View>

          {/* Card 2: Low Stock */}
          <View className="border border-gray-200 p-4 rounded-xl bg-white shadow-sm gap-1">
            <Text className="text-xs font-semibold text-gray-400">Low Stock</Text>
            <Text className={`text-3xl font-black ${lowStockCount > 0 ? 'text-[#f37021]' : 'text-gray-800'}`}>
              {alertsLoading ? '...' : lowStockCount}
            </Text>
          </View>

          {/* Card 3: Slow Moving */}
          <View className="border border-gray-200 p-4 rounded-xl bg-white shadow-sm gap-1">
            <Text className="text-xs font-semibold text-gray-400">Slow Moving</Text>
            <Text className="text-3xl font-black text-red-600">0</Text>
          </View>

          {/* Card 4: Total Value */}
          <View className="border border-gray-200 p-4 rounded-xl bg-white shadow-sm gap-1">
            <Text className="text-xs font-semibold text-gray-400">Total Value</Text>
            <Text className="text-2xl font-black text-gray-800">
              {valueLoading ? '...' : formatCurrency(totalValue)}
            </Text>
          </View>
        </View>

        {/* Action Tabs Switcher */}
        <View className="flex-row gap-2.5 mb-4">
          <TouchableOpacity
            onPress={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-lg border ${
              activeTab === 'overview' ? 'bg-[#f37021] border-[#f37021]' : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`text-xs font-bold ${activeTab === 'overview' ? 'text-white' : 'text-gray-600'}`}>
              Stock Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 rounded-lg border ${
              activeTab === 'analytics' ? 'bg-[#f37021] border-[#f37021]' : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`text-xs font-bold ${activeTab === 'analytics' ? 'text-white' : 'text-gray-600'}`}>
              Analytics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('alerts')}
            className={`px-4 py-2.5 rounded-lg border ${
              activeTab === 'alerts' ? 'bg-[#f37021] border-[#f37021]' : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`text-xs font-bold ${activeTab === 'alerts' ? 'text-white' : 'text-gray-600'}`}>
              Alerts
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Button Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6 gap-2.5">
          <TouchableOpacity
            onPress={() => Alert.alert('Action', 'CSV Template Downloaded')}
            className="border border-gray-250 bg-white rounded-lg px-3.5 py-2.5 flex-row items-center gap-1.5"
          >
            <Ionicons name="download-outline" size={14} color="#4b5563" />
            <Text className="text-[10px] font-bold text-gray-700">CSV Template</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Action', 'XLS Template Downloaded')}
            className="border border-gray-250 bg-white rounded-lg px-3.5 py-2.5 flex-row items-center gap-1.5"
          >
            <Ionicons name="download-outline" size={14} color="#4b5563" />
            <Text className="text-[10px] font-bold text-gray-700">XLS Template</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Action', 'Add Stock Dialog opened')}
            className="border border-gray-250 bg-white rounded-lg px-3.5 py-2.5 flex-row items-center gap-1.5"
          >
            <Ionicons name="arrow-up-outline" size={14} color="#4b5563" />
            <Text className="text-[10px] font-bold text-gray-700">Add Your Current Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('Action', 'Inventory Report Downloaded')}
            className="border border-gray-250 bg-white rounded-lg px-3.5 py-2.5 flex-row items-center gap-1.5"
          >
            <Ionicons name="download-outline" size={14} color="#4b5563" />
            <Text className="text-[10px] font-bold text-gray-700">Download Inventory</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Filter Input */}
        <View className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 flex-row items-center mb-3 shadow-sm">
          <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
          <TextInput
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setPage(1);
            }}
            placeholder="Search SKU..."
            placeholderTextColor="#9ca3af"
            className="flex-grow text-xs text-gray-800 p-0"
          />
        </View>

        {/* Limit Dropdown View */}
        <View className="flex-row justify-end mb-4">
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Show items per page',
                'Select limit',
                [
                  { text: '10', onPress: () => { setLimit(10); setPage(1); } },
                  { text: '20', onPress: () => { setLimit(20); setPage(1); } },
                  { text: '50', onPress: () => { setLimit(50); setPage(1); } },
                ]
              );
            }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 flex-row items-center gap-1 bg-white"
          >
            <Text className="text-xs text-gray-700 font-semibold">{limit} / page</Text>
            <Ionicons name="chevron-down" size={12} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {/* Table Content */}
        {inventoryLoading ? (
          <ActivityIndicator size="large" color="#f37021" className="my-8" />
        ) : items.length === 0 ? (
          <View className="bg-gray-50 border border-gray-100 rounded-xl p-8 items-center justify-center">
            <Ionicons name="cube-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-400 mt-2">No inventory records matches filters</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="border border-gray-200 rounded-xl bg-white overflow-hidden mb-8 shadow-sm" style={{ minWidth: 600 }}>
              {/* Table Header */}
              <View className="flex-row bg-gray-50 border-b border-gray-200 py-3.5 px-3">
                <Text className="flex-[2.5] text-[10px] font-bold text-gray-500 uppercase tracking-wider">SKU</Text>
                <Text className="flex-[1.5] text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Category</Text>
                <Text className="flex-[1.2] text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Unit</Text>
                <Text className="flex-[1.5] text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Current Stock</Text>
                <Text className="flex-[2] text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Current Stock in Box</Text>
                <Text className="flex-[1.8] text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Threshold (min/max)</Text>
              </View>

              {/* Table Rows */}
              {items.map((item) => {
                const boxQty = item.masterPackQty || 12;
                const currentStockInBox = Math.floor(item.quantity / boxQty);

                return (
                  <View key={item.skuId} className="flex-row border-b border-gray-100 py-4 px-3 items-center">
                    {/* SKU Name */}
                    <View className="flex-[2.5] pr-1">
                      <Text className="text-xs font-semibold text-gray-800">{item.skuName || item.skuId}</Text>
                      {isSupplyChain && (
                        <View className="flex-row gap-2 mt-1">
                          {isSS && (
                            <TouchableOpacity
                              onPress={() => {
                                setAdjustModalItem(item);
                                setAdjustQty(item.quantity > 0 ? String(item.quantity) : '');
                              }}
                            >
                              <Text className="text-[9px] text-[#f37021] font-bold">Adjust</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => {
                              setThresholdModalItem(item);
                              setNewThreshold(String(item.lowStockThreshold));
                            }}
                          >
                            <Text className="text-[9px] text-[#f37021] font-bold">Edit</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Category */}
                    <Text className="flex-[1.5] text-xs text-gray-500 text-center">{item.skuCategory || 'General'}</Text>

                    {/* Unit */}
                    <Text className="flex-[1.2] text-xs text-gray-500 text-center">{item.skuWeight || '100ML'}</Text>

                    {/* Current Stock */}
                    <Text className="flex-[1.5] text-xs text-gray-800 font-semibold text-center">{item.quantity}</Text>

                    {/* Current Stock in Box */}
                    <Text className="flex-[2] text-xs text-gray-700 text-center">{currentStockInBox}</Text>

                    {/* Threshold */}
                    <Text className="flex-[1.8] text-xs text-gray-700 text-center">
                      {item.lowStockThreshold} / -
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-center py-4 border-t border-gray-100 gap-4 bg-white">
          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            className={`p-2 border rounded-lg ${
              page === 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
            }`}
          >
            <Ionicons name="chevron-back" size={16} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xs text-gray-600 font-semibold">
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity
            disabled={page === totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`p-2 border rounded-lg ${
              page === totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
            }`}
          >
            <Ionicons name="chevron-forward" size={16} color="#374151" />
          </TouchableOpacity>
        </View>
      )}
      {/* Adjust Stock Modal */}
      {adjustModalItem && (
        <Modal visible={!!adjustModalItem} animationType="slide" onRequestClose={() => setAdjustModalItem(null)}>
          <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-800">Adjust Stock</Text>
              <TouchableOpacity onPress={() => setAdjustModalItem(null)} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <View className="p-6 gap-4">
              <Text className="text-xs text-gray-500 mb-2">
                Product: {adjustModalItem.skuName || adjustModalItem.skuId}
              </Text>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1.5">Quantity Change *</Text>
                <TextInput
                  value={adjustQty}
                  onChangeText={setAdjustQty}
                  placeholder="Positive to add, negative to deduct"
                  keyboardType="numeric"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>

              <View className="flex-row justify-end gap-3">
                <TouchableOpacity
                  onPress={() => setAdjustModalItem(null)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg"
                >
                  <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAdjustStock}
                  className="px-5 py-2.5 bg-[#f37021] rounded-lg"
                >
                  <Text className="text-sm font-bold text-white">Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Threshold Modal */}
      {thresholdModalItem && (
        <Modal visible={!!thresholdModalItem} animationType="slide" onRequestClose={() => setThresholdModalItem(null)}>
          <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-800">Edit Threshold</Text>
              <TouchableOpacity onPress={() => setThresholdModalItem(null)} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <View className="p-6 gap-4">
              <Text className="text-xs text-gray-500 mb-2">
                Product: {thresholdModalItem.skuName || thresholdModalItem.skuId}
              </Text>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1.5">New Threshold *</Text>
                <TextInput
                  value={newThreshold}
                  onChangeText={setNewThreshold}
                  placeholder="Minimum stock alert level"
                  keyboardType="numeric"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>

              <View className="flex-row justify-end gap-3">
                <TouchableOpacity
                  onPress={() => setThresholdModalItem(null)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg"
                >
                  <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpdateThreshold}
                  className="px-5 py-2.5 bg-[#f37021] rounded-lg"
                >
                  <Text className="text-sm font-bold text-white">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
