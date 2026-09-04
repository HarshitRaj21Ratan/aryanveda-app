import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

const { width } = Dimensions.get('window');

interface SkuReportItem {
  rank: number;
  skuId: string;
  name: string;
  principal: string;
  totalQuantitySold: number;
  totalAmountSold: number;
}

function getBadgeColors(rank: number): { bg: string; text: string; border: string } {
  if (rank === 1) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' };
  if (rank === 2) return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-300' };
  if (rank === 3) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' };
  return { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
}

export default function SkuReportScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 15;

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sku-report-dashboard-app', page, limit, searchQuery],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/sku-report', {
        params: { page, limit, search: searchQuery || undefined },
      });
      return res.data.data;
    },
  });

  const skus: SkuReportItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

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

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (skus.length === 0) {
      Alert.alert('No Data', 'There is no data to export.');
      return;
    }
    setIsExporting(true);
    try {
      const rows = skus.map((sku) => ({
        Rank: `#${sku.rank}`,
        'SKU ID': sku.skuId,
        Name: sku.name,
        Principal: sku.principal,
        'Total Quantity Sold': sku.totalQuantitySold,
        'Total Amount Sold (INR)': sku.totalAmountSold,
      }));
      const { downloadXlsxReport } = require('@/lib/xlsx-export');
      await downloadXlsxReport(rows, {
        fileName: `sku-report-${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: 'SKU Report',
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to export SKU report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">

      <ScrollView className="flex-grow" showsVerticalScrollIndicator={false}>
        {/* Title banner matching mockup */}
        <View className="px-6 pt-5 pb-2 flex-row items-center gap-3">
          <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
            <Ionicons name="trending-up-outline" size={22} color="#f97316" />
          </View>
          <View>
            <Text className="text-xl font-bold text-slate-800">SKU Reporting</Text>
            <Text className="text-xs text-slate-400 mt-0.5">Top selling products by quantity</Text>
          </View>
        </View>

        {/* Filter Input Actions Row */}
        <View className="px-6 py-3 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting}
            className="border border-gray-200 bg-white rounded-xl py-2.5 px-4"
          >
            <Text className="text-xs font-semibold text-slate-700">
              {isExporting ? 'Exporting...' : 'Export XLSX'}
            </Text>
          </TouchableOpacity>

          <View className="flex-1 border border-gray-200 rounded-xl px-3 py-2 bg-white flex-row items-center">
            <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search SKU..."
              placeholderTextColor="#9ca3af"
              className="flex-1 text-xs text-gray-800 p-0"
            />
            {!!searchInput && (
              <TouchableOpacity onPress={() => setSearchInput('')} className="p-0.5">
                <Ionicons name="close-circle" size={14} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Data Sheet container wrapper */}
        <View className="px-6 pt-3 pb-24">
          {isLoading ? (
            <ActivityIndicator size="large" color="#f97316" className="my-12" />
          ) : isError ? (
            <View className="bg-white border border-red-150 p-8 rounded-2xl items-center justify-center shadow-sm">
              <Ionicons name="close-circle-outline" size={36} color="#ef4444" />
              <Text className="text-sm text-red-500 mt-2 font-semibold">Failed to load report</Text>
            </View>
          ) : skus.length === 0 ? (
            <View className="bg-white border border-gray-250 p-8 rounded-2xl items-center justify-center shadow-sm">
              <Ionicons name="bar-chart-outline" size={36} color="#9ca3af" className="opacity-40" />
              <Text className="text-sm text-gray-500 mt-2">No selling records matched</Text>
            </View>
          ) : (
            <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Header row */}
              <View className="flex-row px-4 py-3 bg-gray-50/50 border-b border-gray-150">
                <Text className="text-[10px] font-bold text-slate-400 tracking-wider w-16">RANK</Text>
                <Text className="text-[10px] font-bold text-slate-400 tracking-wider">SKU ID</Text>
              </View>

              {/* Data rows */}
              {skus.map((sku) => (
                <View
                  key={sku.skuId}
                  className="flex-row items-center border-b border-gray-100 py-3.5 px-4"
                >
                  <View className="w-16">
                    <View className={`h-8 w-8 rounded-full border-2 justify-center items-center ${
                      sku.rank === 1 ? 'border-yellow-400 bg-yellow-50/50' :
                      sku.rank === 2 ? 'border-blue-300 bg-blue-50/50' :
                      sku.rank === 3 ? 'border-orange-400 bg-orange-50/50' :
                      'border-gray-200 bg-gray-50'
                    }`}>
                      <Text className={`text-xs font-bold ${
                        sku.rank === 1 ? 'text-yellow-600' :
                        sku.rank === 2 ? 'text-blue-600' :
                        sku.rank === 3 ? 'text-orange-600' :
                        'text-gray-500'
                      }`}>
                        #{sku.rank}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs font-bold text-gray-800 flex-1 uppercase">
                    {sku.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
