import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { userService, type UserWithoutPassword } from '@/services/user.service';
import { UserRole } from '@/types';
import { exportPaginatedData } from '@/lib/xlsx-export';

export default function AllSuperStockishScreen() {
  const router = useRouter();

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const limit = 20;

  // Fetch unique states for filter
  const { data: statesList } = useQuery({
    queryKey: ['unique-states-super-stockist'],
    queryFn: () => userService.listUniqueStates(),
  });

  // Fetch Super Stockists list
  const { data: superStockistsData, isLoading } = useQuery({
    queryKey: ['all-super-stockists-page', selectedState, search, page],
    queryFn: () =>
      userService.listAll({
        role: UserRole.SUPER_STOCKIST,
        state: selectedState || undefined,
        search: search.trim() || undefined,
        page,
        limit,
      }),
  });

  const states = statesList ?? [];
  const superStockists = superStockistsData?.data ?? [];
  const total = superStockistsData?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Export to Excel
  const handleExportXlsx = async () => {
    try {
      setIsExporting(true);
      const rowMapper = (u: UserWithoutPassword) => ({
        'Super Stockist Name': u.name,
        'Entity ID': u.entityId,
        'Email': u.email || '-',
        'Phone': u.phone || '-',
        'State': u.state || '-',
        'Status': u.isActive ? 'Active' : 'Inactive',
        'Created Date': u.createdAt
          ? new Date(u.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '-',
      });

      const baseParams = {
        role: UserRole.SUPER_STOCKIST,
        search: search.trim() || undefined,
        state: selectedState || undefined,
      };

      await exportPaginatedData(
        userService.listAll,
 baseParams,
        rowMapper,
        {
          fileName: `all-super-stockists-${new Date().toISOString().slice(0, 10)}.xlsx`,
          sheetName: 'Super Stockists',
        }
      );
    } catch (err: any) {
      console.error('Export Super Stockist error:', err);
      Alert.alert('Export Error', err?.message || 'Failed to export Super Stockist data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" style={{ flex: 1 }}>
      {/* Header Banner */}
      <View className="px-4 py-3 border-b border-gray-200 bg-white flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push('/admin/inventory');
              }
            }}
            className="p-2 bg-gray-100 rounded-xl"
          >
            <Ionicons name="arrow-back" size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-gray-800">All Super Stockists</Text>
              <View className="bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                <Text className="text-[10px] font-bold text-orange-700">{total} Total</Text>
              </View>
            </View>
            <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
              Complete list & data export of registered Super Stockists
            </Text>
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          disabled={isExporting}
          onPress={handleExportXlsx}
          className="flex-row items-center gap-1.5 bg-orange-500 px-3.5 py-2 rounded-xl active:bg-orange-600 shadow-sm"
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="download-outline" size={16} color="#ffffff" />
          )}
          <Text className="text-xs font-bold text-white">
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search & State Filter Card */}
        <View className="p-4 m-4 bg-white border border-gray-200 rounded-2xl shadow-sm gap-4">
          {/* Search bar */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Super Stockist</Text>
            <View className="flex-row items-center border border-gray-200 rounded-xl px-3.5 py-2 bg-gray-50">
              <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
              <TextInput
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  setPage(1);
                }}
                placeholder="Search by name, entity ID, phone..."
                placeholderTextColor="#9ca3af"
                className="flex-grow text-xs text-gray-800 p-0"
              />
              {!!search && (
                <TouchableOpacity onPress={() => { setSearch(''); setPage(1); }} className="p-0.5">
                  <Ionicons name="close-circle" size={14} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* State Filter Chips */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter by State</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 py-0.5">
              <TouchableOpacity
                onPress={() => {
                  setSelectedState('');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg border ${
                  selectedState === '' ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-[11px] font-bold ${selectedState === '' ? 'text-orange-600' : 'text-gray-600'}`}>
                  All States
                </Text>
              </TouchableOpacity>
              {states.filter(s => typeof s === 'string' && !s.includes(',')).map((st) => {
                const isSelected = selectedState.toLowerCase() === st.toLowerCase();
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => {
                      setSelectedState(st);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg border ${
                      isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-[11px] font-bold capitalize ${isSelected ? 'text-orange-600' : 'text-gray-600'}`}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Super Stockist Cards List */}
        <View className="px-4 pb-20 gap-3">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Super Stockist Accounts ({total})
            </Text>
            {totalPages > 1 && (
              <Text className="text-xs text-gray-400">
                Page {page} of {totalPages}
              </Text>
            )}
          </View>

          {isLoading ? (
            <View className="bg-white border border-gray-200 rounded-2xl p-12 items-center justify-center shadow-sm">
              <ActivityIndicator size="large" color="#f97316" />
              <Text className="text-xs text-gray-500 mt-3 font-medium">Loading Super Stockist data...</Text>
            </View>
          ) : superStockists.length === 0 ? (
            <View className="bg-white border border-gray-200 rounded-2xl p-12 items-center justify-center shadow-sm">
              <Ionicons name="business-outline" size={40} color="#9ca3af" className="opacity-40" />
              <Text className="text-sm font-semibold text-gray-600 mt-3">No Super Stockists Found</Text>
              <Text className="text-xs text-gray-400 mt-1 text-center">
                No Super Stockist accounts match your current search and state filter.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {superStockists.map((u: UserWithoutPassword) => (
                <View
                  key={u.entityId}
                  className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-base font-bold text-gray-800">{u.name}</Text>
                        <View className="bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                          <Text className="text-[9px] font-bold text-orange-700">SUPER STOCKIST</Text>
                        </View>
                      </View>
                      <Text className="text-xs text-gray-500">
                        Entity ID: <Text className="font-mono text-gray-800 font-semibold">{u.entityId}</Text>
                      </Text>
                    </View>

                    <View
                      className={`px-2.5 py-1 rounded-full border ${
                        u.isActive
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold uppercase ${
                          u.isActive ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  <View className="h-[1px] bg-gray-150" />

                  <View className="flex-row flex-wrap gap-y-2 justify-between">
                    <View className="w-[48%] flex-row items-center gap-1.5">
                      <Ionicons name="location-outline" size={14} color="#6b7280" />
                      <Text className="text-xs text-gray-600 capitalize">
                        {u.state || 'State N/A'}
                      </Text>
                    </View>

                    <View className="w-[48%] flex-row items-center gap-1.5">
                      <Ionicons name="call-outline" size={14} color="#6b7280" />
                      <Text className="text-xs text-gray-600">
                        {u.phone || 'Phone N/A'}
                      </Text>
                    </View>

                    <View className="w-[48%] flex-row items-center gap-1.5">
                      <Ionicons name="mail-outline" size={14} color="#6b7280" />
                      <Text className="text-xs text-gray-600" numberOfLines={1}>
                        {u.email || 'Email N/A'}
                      </Text>
                    </View>

                    <View className="w-[48%] flex-row items-center gap-1.5">
                      <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                      <Text className="text-xs text-gray-600">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <View className="flex-row items-center justify-between py-4 mt-2 border-t border-gray-200 bg-white px-4 rounded-xl shadow-sm">
                  <Text className="text-xs text-gray-500 font-medium">
                    Page {page} of {totalPages} ({total} items)
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
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
