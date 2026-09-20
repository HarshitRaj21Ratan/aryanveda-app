import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { userService } from '@/services/user.service';
import { inventoryService } from '@/services/inventory.service';
import { UserRole } from '@/types';
import { formatCurrencyDecimal as formatCurrency } from '@/lib/format-utils';
import { exportPaginatedData } from '@/lib/xlsx-export';

export default function AdminInventoryScreen() {
  const router = useRouter();

  // Selection States
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // State & Role filters
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');

  // Inventory page filters
  const [inventorySearch, setInventorySearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const limit = 15;

  const handleExportXlsx = async () => {
    if (!selectedUser) return;
    try {
      setIsExporting(true);
      
      const rowMapper = (item: any) => {
        const caseQty = item.boxQty && item.boxQty > 0 ? item.boxQty : 1;
        const masterPackQty = item.masterPackQty && item.masterPackQty > 0 ? item.masterPackQty : 1;
        const forPerPc = item.perPcPrice && item.perPcPrice > 0 ? item.perPcPrice : (item.forPerPc && item.forPerPc > 0 ? item.forPerPc : 12);
        const noOfCases = Math.floor((item.quantity ?? 0) / caseQty);
        const amount = Math.round(((item.superTotal ?? 0) / forPerPc) * (item.quantity ?? 0) * 100) / 100;
        return {
          'SKU ID': item.skuId,
          'Product Name': item.skuName ?? 'Unknown',
          'Weight': item.skuWeight ?? 'N/A',
          'Quantity': item.quantity,
          'Case QTY': caseQty,
          'Master': masterPackQty,
          'No. of cases': noOfCases,
          'Amount': amount,
          'Low Stock Threshold': item.lowStockThreshold,
          'Status': item.isLowStock ? 'Low Stock' : 'OK',
          'Refill Count': item.refillCount ?? 0,
          'Last Refill': item.lastRefillDate
            ? new Date(item.lastRefillDate).toLocaleDateString('en-IN')
            : 'N/A',
          'Last Updated': new Date(item.updatedAt).toLocaleDateString('en-IN'),
        };
      };

      const options = {
        fileName: `inventory-${selectedUser.name.replace(/\s+/g, '-')}-${selectedUser.entityId}.xlsx`,
        sheetName: `Inventory - ${selectedUser.name}`,
      };

      const baseParams = {
        entityId: selectedUser.entityId,
        search: inventorySearch || undefined,
        lowStock: lowStockOnly || undefined,
      };

      await exportPaginatedData(
        inventoryService.adminGetUserInventory,
        baseParams,
        rowMapper,
        options
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Export Error', err?.message || 'Failed to export inventory');
    } finally {
      setIsExporting(false);
    }
  };

  // Queries
  const { data: roleCountsRes, isLoading: roleCountsLoading } = useQuery({
    queryKey: ['admin-users-count-by-role'],
    queryFn: () => userService.countByRole(),
  });

  const roleCounts = roleCountsRes?.data?.counts ?? {};
  const superStockistCount =
    roleCounts[UserRole.SUPER_STOCKIST] ??
    roleCounts['super_stockist'] ??
    roleCounts['SUPER_STOCKIST'] ??
    0;
  const distributorCount =
    roleCounts[UserRole.DISTRIBUTOR] ??
    roleCounts['distributor'] ??
    roleCounts['DISTRIBUTOR'] ??
    0;

  const { data: statesList } = useQuery({
    queryKey: ['admin-unique-states'],
    queryFn: () => userService.listUniqueStates(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-inventory-users', selectedState, selectedRole, userSearchQuery],
    queryFn: () =>
      userService.listAll({
        state: selectedState || undefined,
        role: selectedRole || undefined,
        search: userSearchQuery || undefined,
        limit: 200,
      }),
    enabled: showSuggestions || !!selectedRole || !!selectedState || !!userSearchQuery,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['admin-user-inventory', selectedUser?.entityId, inventorySearch, lowStockOnly, page],
    queryFn: () =>
      inventoryService.adminGetUserInventory({
        entityId: selectedUser?.entityId ?? '',
        search: inventorySearch || undefined,
        lowStock: lowStockOnly || undefined,
        page,
        limit,
      }),
    enabled: !!selectedUser?.entityId,
  });

  const { data: allInventoryData, isLoading: allInventoryLoading } = useQuery({
    queryKey: ['admin-user-inventory-all', selectedUser?.entityId],
    queryFn: () =>
      inventoryService.adminGetUserInventory({
        entityId: selectedUser?.entityId ?? '',
        page: 1,
        limit: 500,
      }),
    enabled: !!selectedUser?.entityId,
  });

  const states = statesList ?? [];
  const matchingUsers = usersData?.data ?? [];
  const items = inventoryData?.data ?? [];
  const total = inventoryData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setInventorySearch('');
    setLowStockOnly(false);
    setPage(1);
  };

  const handleDeselectUser = () => {
    setSelectedUser(null);
    setInventorySearch('');
    setLowStockOnly(false);
    setPage(1);
  };

  // KPI calculations
  const allItems = allInventoryData?.data ?? [];
  const totalSkus = allInventoryData?.total ?? 0;
  const totalQuantity = allItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const lowStockCount = allItems.filter((item: any) => item.isLowStock).length;
  const totalAmount = allItems.reduce((sum: number, item: any) => {
    const forPerPc = item.perPcPrice && item.perPcPrice > 0 ? item.perPcPrice : (item.forPerPc && item.forPerPc > 0 ? item.forPerPc : 12);
    const amount = ((item.superTotal ?? 0) / forPerPc) * (item.quantity ?? 0);
    return sum + amount;
  }, 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      {/* Header Banner */}
      <View className="px-4 py-3 border-b border-gray-150 bg-white flex-row items-center gap-3">
        <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
          <Ionicons name="archive-outline" size={22} color="#f97316" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800">Admin Inventory</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            Search and view inventory for any user in the system.
          </Text>
        </View>
        {selectedUser && items.length > 0 && (
          <TouchableOpacity
            disabled={isExporting}
            onPress={handleExportXlsx}
            className="flex-row items-center gap-1 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg active:bg-orange-100"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <Ionicons name="download-outline" size={14} color="#f97316" />
            )}
            <Text className="text-xs font-bold text-orange-600">
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* KPI Role Summary Tiles */}
        <View className="px-4 pt-4 flex-row gap-3">
          {/* Super Stockist Tile */}
          <TouchableOpacity
            onPress={() => {
              router.push('/all-superstockish');
            }}
            activeOpacity={0.7}
            className="flex-1 p-3.5 rounded-2xl border flex-row items-center justify-between shadow-sm bg-white border-gray-200 active:bg-orange-50/50 active:border-orange-300"
          >
            <View className="flex-1 pr-2">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Super Stockist
              </Text>
              <Text className="text-xl font-extrabold text-gray-900 mt-0.5">
                {roleCountsLoading ? '...' : superStockistCount.toLocaleString('en-IN')}
              </Text>
              <Text className="text-[10px] font-semibold text-orange-600 mt-0.5">
                Tap to view all
              </Text>
            </View>
            <View className="w-10 h-10 rounded-xl items-center justify-center bg-orange-50 border border-orange-100">
              <Ionicons name="business-outline" size={20} color="#f97316" />
            </View>
          </TouchableOpacity>

          {/* Distributor Tile */}
          <TouchableOpacity
            onPress={() => {
              router.push('/all-distributor');
            }}
            activeOpacity={0.7}
            className="flex-1 p-3.5 rounded-2xl border flex-row items-center justify-between shadow-sm bg-white border-gray-200 active:bg-orange-50/50 active:border-orange-300"
          >
            <View className="flex-1 pr-2">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Distributor
              </Text>
              <Text className="text-xl font-extrabold text-gray-900 mt-0.5">
                {roleCountsLoading ? '...' : distributorCount.toLocaleString('en-IN')}
              </Text>
              <Text className="text-[10px] font-semibold text-orange-600 mt-0.5">
                Tap to view all
              </Text>
            </View>
            <View className="w-10 h-10 rounded-xl items-center justify-center bg-orange-50 border border-orange-100">
              <Ionicons name="people-outline" size={20} color="#f97316" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Selection/Filters Panel Card */}
        <View className="p-4 m-4 bg-white border border-gray-200 rounded-2xl shadow-sm gap-4" style={{ zIndex: 100, elevation: 5 }}>
          {/* State Picker row */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">State</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 py-0.5">
              <TouchableOpacity
                onPress={() => {
                  setSelectedState('');
                  setUserSearchQuery('');
                  setSelectedUser(null);
                  setShowSuggestions(false);
                }}
                className={`px-3 py-1.5 rounded-lg border ${
                  selectedState === '' ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-[11px] font-bold ${selectedState === '' ? 'text-orange-600' : 'text-gray-600'}`}>
                  All States
                </Text>
              </TouchableOpacity>
              {states.filter(state => typeof state === 'string' && !state.includes(',')).map((state) => {
                const isSelected = selectedState.toLowerCase() === state.toLowerCase();
                return (
                  <TouchableOpacity
                    key={state}
                    onPress={() => {
                      setSelectedState(state);
                      setUserSearchQuery('');
                      setSelectedUser(null);
                      setShowSuggestions(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg border ${
                      isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-[11px] font-bold capitalize ${isSelected ? 'text-orange-600' : 'text-gray-600'}`}>
                      {state}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Role selector buttons list */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</Text>
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={() => {
                  setSelectedRole('');
                  setUserSearchQuery('');
                  setSelectedUser(null);
                  setShowSuggestions(false);
                }}
                className={`px-3 py-1.5 rounded-lg border ${
                  selectedRole === '' ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-[11px] font-bold ${selectedRole === '' ? 'text-orange-600' : 'text-gray-600'}`}>
                  All Roles
                </Text>
              </TouchableOpacity>
              {[
                { role: UserRole.SUPER_STOCKIST, label: 'Super Stockist' },
                { role: UserRole.DISTRIBUTOR, label: 'Distributor' },
                { role: UserRole.RETAILER, label: 'Retailer' },
              ].map((r) => {
                const isSelected = selectedRole === r.role;
                return (
                  <TouchableOpacity
                    key={r.role}
                    onPress={() => {
                      setSelectedRole(r.role);
                      setUserSearchQuery('');
                      setSelectedUser(null);
                      setShowSuggestions(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg border ${
                      isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-[11px] font-bold ${isSelected ? 'text-orange-600' : 'text-gray-600'}`}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* User search box */}
          <View className="gap-1.5 relative" style={{ zIndex: 1000, elevation: 10 }}>
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search User</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowSuggestions((prev) => !prev)}
              className="flex-row items-center border border-gray-200 rounded-xl px-4 py-2.5 bg-white"
            >
              <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
              <TextInput
                value={userSearchQuery}
                onPressIn={() => setShowSuggestions((prev) => !prev)}
                onChangeText={(text) => {
                  setUserSearchQuery(text);
                  setShowSuggestions(true);
                  if (selectedUser) setSelectedUser(null);
                }}
                placeholder="Click to select or type user name, entity ID, or phone..."
                placeholderTextColor="#9ca3af"
                className="flex-grow text-xs text-gray-800 p-0"
              />
              {!!userSearchQuery && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setUserSearchQuery('');
                    setShowSuggestions(false);
                  }}
                  className="p-0.5 mr-1"
                >
                  <Ionicons name="close-circle" size={14} color="#9ca3af" />
                </TouchableOpacity>
              )}
              <Ionicons
                name={showSuggestions ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#9ca3af"
              />
            </TouchableOpacity>

            {/* Suggestions Dropdown overlay */}
            {showSuggestions && (
              <View
                className="absolute top-[68px] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-hidden"
                style={{ backgroundColor: '#ffffff', zIndex: 9999, elevation: 20, opacity: 1 }}
              >
                {usersLoading ? (
                  <View className="p-4 items-center justify-center bg-white" style={{ backgroundColor: '#ffffff' }}>
                    <ActivityIndicator size="small" color="#f97316" />
                  </View>
                ) : matchingUsers.length === 0 ? (
                  <View className="p-4 items-center justify-center bg-white" style={{ backgroundColor: '#ffffff' }}>
                    <Text className="text-xs text-gray-400">No users found</Text>
                  </View>
                ) : (
                  <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" className="bg-white" style={{ backgroundColor: '#ffffff' }}>
                    {matchingUsers.map((u: any) => (
                      <TouchableOpacity
                        key={u.entityId}
                        onPress={() => {
                          handleSelectUser(u);
                          setUserSearchQuery('');
                          setShowSuggestions(false);
                        }}
                        className="border-b border-gray-100 p-3 bg-white active:bg-gray-50 flex-row justify-between items-center"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <View className="flex-1 pr-2">
                          <Text className="text-xs font-bold text-gray-800">{u.name}</Text>
                          <Text className="text-[10px] text-gray-400 mt-0.5">
                            {u.role.toUpperCase()} · {u.entityId}
                            {u.state ? ` · ${u.state}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Viewing User Chip (under Search User) */}
          {selectedUser && (
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-[11px] text-gray-500 font-semibold">Viewing:</Text>
              <View className="flex-row items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
                <Text className="text-[10px] font-bold text-orange-600">
                  {selectedUser.name} ({selectedUser.role.replace('_', ' ').toUpperCase()})
                </Text>
                <TouchableOpacity onPress={handleDeselectUser} className="p-0.5 bg-orange-100 rounded-full">
                  <Ionicons name="close" size={10} color="#f97316" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Selected User Inventory Details */}
        {selectedUser ? (
          <View className="px-4 pb-20 gap-4">
            {/* Filter by Product & Low Stock filters block */}
            <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
              <View className="flex-row items-center border border-gray-200 bg-gray-50 rounded-xl px-3 py-2">
                <Ionicons name="funnel-outline" size={14} color="#9ca3af" className="mr-2" />
                <TextInput
                  placeholder="Filter by product..."
                  placeholderTextColor="#9ca3af"
                  value={inventorySearch}
                  onChangeText={(text) => {
                    setInventorySearch(text);
                    setPage(1);
                  }}
                  className="flex-grow text-xs text-gray-800 p-0"
                />
                {!!inventorySearch && (
                  <TouchableOpacity onPress={() => setInventorySearch('')} className="p-0.5">
                    <Ionicons name="close-circle" size={14} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Low Stock Warning Card Button */}
              <TouchableOpacity
                onPress={() => {
                  setLowStockOnly(!lowStockOnly);
                  setPage(1);
                }}
                className={`flex-row items-center justify-center gap-1.5 border rounded-xl py-2.5 ${
                  lowStockOnly
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Ionicons name="alert-circle-outline" size={15} color={lowStockOnly ? '#b45309' : '#6b7280'} />
                <Text className={`text-xs font-bold ${lowStockOnly ? 'text-amber-700' : 'text-gray-500'}`}>
                  Low Stock Only
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4 KPI Summary Cards Grid */}
            <View className="flex-row flex-wrap gap-2.5">
              <View className="w-[47%] bg-white border border-gray-200 p-3.5 rounded-2xl shadow-sm items-center">
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">Total SKUs</Text>
                <Text className="text-base font-extrabold text-gray-800 mt-1">{allInventoryLoading ? '...' : totalSkus}</Text>
              </View>
              <View className="w-[47%] bg-white border border-gray-200 p-3.5 rounded-2xl shadow-sm items-center">
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">Total Quantity</Text>
                <Text className="text-base font-extrabold text-gray-800 mt-1">{allInventoryLoading ? '...' : totalQuantity.toLocaleString('en-IN')}</Text>
              </View>
              <View className="w-[47%] bg-white border border-gray-200 p-3.5 rounded-2xl shadow-sm items-center">
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">Total Amount</Text>
                <Text className="text-base font-extrabold text-emerald-700 mt-1">{allInventoryLoading ? '...' : formatCurrency(totalAmount)}</Text>
              </View>
              <View className="w-[47%] bg-white border border-gray-200 p-3.5 rounded-2xl shadow-sm items-center">
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">Low Stock Items</Text>
                <Text className={`text-base font-extrabold mt-1 ${!allInventoryLoading && lowStockCount > 0 ? 'text-amber-600' : 'text-gray-850'}`}>
                  {allInventoryLoading ? '...' : lowStockCount}
                </Text>
              </View>
            </View>

            {/* Inventory table */}
            <View className="gap-2">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Inventory Logs</Text>
              {inventoryLoading ? (
                <ActivityIndicator size="large" color="#f97316" className="my-8" />
              ) : items.length === 0 ? (
                <View className="bg-white border border-gray-200 rounded-2xl p-8 items-center justify-center shadow-sm">
                  <Ionicons name="cube-outline" size={32} color="#9ca3af" className="opacity-40" />
                  <Text className="text-xs text-gray-400 mt-2">No inventory records found</Text>
                </View>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <View style={{ width: 1240, flexDirection: 'column' }}>
                      {/* Table Header */}
                      <View className="flex-row border-b border-gray-250 bg-slate-50/80 py-3 px-4">
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 160, flexShrink: 0 }}>Product</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 100, flexShrink: 0 }}>SKU ID</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 90, flexShrink: 0 }}>Quantity</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 80, flexShrink: 0 }}>Case QTY</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 80, flexShrink: 0 }}>Master</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 100, flexShrink: 0 }}>No. of cases</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 120, flexShrink: 0 }}>Amount</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 80, flexShrink: 0 }}>Weight</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 90, flexShrink: 0 }}>Threshold</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 140, flexShrink: 0 }}>Refill</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 90, flexShrink: 0 }}>Status</Text>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 110, flexShrink: 0 }}>Last Update</Text>
                      </View>

                      {/* Table Rows */}
                      {items.map((item: any, index: number) => {
                        const refillDate = item.lastRefillDate
                          ? new Date(item.lastRefillDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : '';
                        const updateDate = new Date(item.updatedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        });

                        const caseQty = item.boxQty ?? 1;
                        const masterPack = item.masterPackQty ?? 1;
                        const noOfCases = Math.floor(item.quantity / caseQty);
                        const forPerPc = item.perPcPrice && item.perPcPrice > 0 ? item.perPcPrice : (item.forPerPc && item.forPerPc > 0 ? item.forPerPc : 12);
                        const amount = ((item.superTotal ?? 0) / forPerPc) * (item.quantity ?? 0);

                        return (
                          <View key={item.skuId} className={`flex-row border-b border-gray-100 py-3 px-4 items-center ${item.isLowStock ? 'bg-amber-50/20' : ''}`}>
                            {/* Product */}
                            <View style={{ width: 160, flexShrink: 0, paddingRight: 8 }}>
                              <Text className="text-xs font-semibold text-slate-800" numberOfLines={2}>{item.skuName ?? 'Unknown Product'}</Text>
                            </View>

                            {/* SKU ID */}
                            <View style={{ width: 100, flexShrink: 0 }}>
                              <Text className="text-xs font-mono text-slate-500">{item.skuId}</Text>
                            </View>

                            {/* Quantity */}
                            <View style={{ width: 90, flexShrink: 0 }}>
                              <Text className={`text-xs font-semibold ${item.isLowStock ? 'text-amber-600 font-bold' : 'text-slate-800'}`}>
                                {item.quantity.toLocaleString('en-IN')}
                              </Text>
                            </View>

                            {/* Case QTY */}
                            <View style={{ width: 80, flexShrink: 0 }}>
                              <Text className="text-xs text-slate-800">{caseQty}</Text>
                            </View>

                            {/* Master */}
                            <View style={{ width: 80, flexShrink: 0 }}>
                              <Text className="text-xs text-slate-800">{item.masterPackQty ?? '-'}</Text>
                            </View>

                            {/* No. of cases */}
                            <View style={{ width: 100, flexShrink: 0 }}>
                              <Text className="text-xs text-slate-800">{noOfCases}</Text>
                            </View>

                            {/* Amount */}
                            <View style={{ width: 120, flexShrink: 0 }}>
                              <Text className="text-xs font-semibold text-slate-800">{formatCurrency(amount)}</Text>
                            </View>

                            {/* Weight */}
                            <View style={{ width: 80, flexShrink: 0 }}>
                              <Text className="text-xs text-slate-600">{item.skuWeight ?? 'N/A'}</Text>
                            </View>

                            {/* Threshold */}
                            <View style={{ width: 90, flexShrink: 0 }}>
                              <Text className="text-xs text-slate-600">{item.lowStockThreshold}</Text>
                            </View>

                            {/* Refill */}
                            <View style={{ width: 140, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="refresh-outline" size={11} color="#6b7280" />
                              <Text className="text-xs text-slate-700 font-medium">
                                {item.refillCount ?? 0} {refillDate ? `(${refillDate})` : ''}
                              </Text>
                            </View>

                            {/* Status */}
                            <View style={{ width: 90, flexShrink: 0 }}>
                              {item.isLowStock ? (
                                <View className="bg-amber-100 border border-amber-250 px-2 py-0.5 rounded-full self-start flex-row items-center gap-0.5">
                                  <Ionicons name="alert-circle" size={10} color="#b45309" />
                                  <Text className="text-[9px] font-bold text-amber-700 uppercase">Low</Text>
                                </View>
                              ) : (
                                <View className="bg-emerald-100 border border-emerald-250 px-2 py-0.5 rounded-full self-start">
                                  <Text className="text-[9px] font-bold text-emerald-700 uppercase">OK</Text>
                                </View>
                              )}
                            </View>

                            {/* Last Update */}
                            <View style={{ width: 110, flexShrink: 0 }}>
                              <Text className="text-xs text-slate-500">{updateDate}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Table Pagination */}
                  {totalPages > 1 && (
                    <View className="flex-row items-center justify-between py-4 mt-4 border-t border-gray-150 bg-white px-2">
                      <Text className="text-xs text-gray-500">
                        Page {page} of {totalPages}
                      </Text>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          disabled={page <= 1}
                          onPress={() => setPage((p) => Math.max(1, p - 1))}
                          className={`p-2 border rounded-lg ${
                            page <= 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <Ionicons name="chevron-back" size={16} color="#374151" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={page >= totalPages}
                          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className={`p-2 border rounded-lg ${
                            page >= totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <Ionicons name="chevron-forward" size={16} color="#374151" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-16 px-4">
            <Text className="text-sm text-gray-400 text-center">
              Search and select a user to view their inventory.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
