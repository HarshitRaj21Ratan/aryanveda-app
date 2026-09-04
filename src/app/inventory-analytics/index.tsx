import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { inventoryService } from '@/services/inventory.service';
import { UserRole } from '@/types';
import type { SkuAnalyticsRow, AnalyticsSummary, InventoryAnalyticsParams } from '@/services/inventory.service';

type SortKey = InventoryAnalyticsParams['sortBy'];

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseWeightToGrams(weight?: string): number | null {
  if (!weight) return null;
  const normalized = weight.trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (normalized.includes('kg')) return value * 1000;
  if (normalized.includes('gm') || normalized.includes('g')) return value;
  if (normalized.includes('ml')) return value;
  if (normalized.includes('l')) return value * 1000;
  return null;
}

function formatStockWeight(weight: string | undefined, qty: number): string {
  const gramsPerUnit = parseWeightToGrams(weight);
  if (gramsPerUnit === null) return 'N/A';
  const totalGrams = gramsPerUnit * qty;
  if (totalGrams >= 1000) return `${(totalGrams / 1000).toFixed(2)} kg/L`;
  return `${Math.round(totalGrams)} g/ml`;
}

export default function InventoryAnalyticsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // States
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [principal, setPrincipal] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [showPrincipalModal, setShowPrincipalModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  const limit = 10;
  const analyticsEntityId = user?.entityId ?? '';

  // Access Control
  const isBlocked = user?.role === UserRole.SO || user?.role === UserRole.ASE;

  // Queries
  const { data: analyticsQuery, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'inventory-analytics-dashboard',
      analyticsEntityId,
      page,
      search,
      principal,
      lowStockOnly,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      inventoryService.getAnalytics({
        entityId: analyticsEntityId,
        page,
        limit,
        search: search || undefined,
        principal: principal || undefined,
        lowStockOnly: lowStockOnly || undefined,
        sortBy,
        sortOrder,
      }),
    enabled: !!user && !!analyticsEntityId && !isBlocked,
  });

  const { data: principalsQuery } = useQuery({
    queryKey: ['analytics-principals-dashboard', analyticsEntityId],
    queryFn: () => inventoryService.getAnalyticsPrincipals({ entityId: analyticsEntityId }),
    enabled: !!user && !!analyticsEntityId && !isBlocked,
  });

  if (isBlocked) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4 text-center">Access Denied</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Inventory Analytics access is not available for SO/ASE roles.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/')}
          className="mt-6 bg-gray-900 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const summaryData = analyticsQuery?.data?.summary;
  const summary: AnalyticsSummary = summaryData ?? {
    totalSkuCount: 0,
    totalUnitsInStock: 0,
    totalInventoryValue: 0,
    lowStockSkuCount: 0,
  };
  const skus: SkuAnalyticsRow[] = analyticsQuery?.data?.skus ?? [];
  const total = analyticsQuery?.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;
  const principals: string[] = principalsQuery?.data ?? [];

  const handleFilterChange = () => setPage(1);

  const roleLabel =
    user?.role === UserRole.SUPER_STOCKIST
      ? 'Super Stockist'
      : user?.role === UserRole.DISTRIBUTOR
        ? 'Distributor'
        : user?.role === UserRole.RETAILER
          ? 'Retailer'
          : 'Agent';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-gray-200 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.push('/')} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-800">Inventory Intel</Text>
            <Text className="text-xs text-gray-500 mt-0.5">{roleLabel} Health & Value</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => refetch()}
          className="p-2 border border-gray-200 rounded-lg bg-white"
        >
          <Ionicons name="refresh" size={18} color="#4b5563" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-grow p-4" showsVerticalScrollIndicator={false}>
        {/* KPI Cards */}
        <View className="flex-row flex-wrap gap-2.5 mb-4">
          {/* Total SKUs */}
          <View className="w-[47%] bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-1">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="cube-outline" size={14} color="#6b7280" />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total SKUs</Text>
            </View>
            <Text className="text-lg font-black text-gray-800 mt-1">
              {isLoading ? '...' : summary.totalSkuCount.toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Total Units */}
          <View className="w-[47%] bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-1">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="grid-outline" size={14} color="#6b7280" />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Units</Text>
            </View>
            <Text className="text-lg font-black text-gray-800 mt-1">
              {isLoading ? '...' : summary.totalUnitsInStock.toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Inventory Value */}
          <View className="w-[47%] bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-1">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="cash-outline" size={14} color="#6b7280" />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valuation</Text>
            </View>
            <Text className="text-sm font-black text-emerald-700 mt-1">
              {isLoading ? '...' : formatCurrency(summary.totalInventoryValue)}
            </Text>
          </View>

          {/* Low Stock SKUs */}
          <View className="w-[47%] bg-white border border-gray-200 p-4 rounded-xl shadow-sm gap-1">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="alert-circle-outline" size={14} color="#b45309" />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Low Stock</Text>
            </View>
            <Text className={`text-lg font-black mt-1 ${summary.lowStockSkuCount > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
              {isLoading ? '...' : summary.lowStockSkuCount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View className="bg-white border border-gray-200 p-4 rounded-xl mb-4 gap-3.5 shadow-sm">
          {/* Search */}
          <View className="flex-row items-center border border-gray-200 rounded-lg px-3 py-1 bg-gray-50">
            <Ionicons name="search" size={16} color="#9ca3af" className="mr-2" />
            <TextInput
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                handleFilterChange();
              }}
              placeholder="Search SKU name..."
              className="flex-1 text-xs text-gray-800 py-1.5"
            />
          </View>

          {/* Filter options row */}
          <View className="flex-row justify-between items-center gap-2">
            {/* Principal selector */}
            <TouchableOpacity
              onPress={() => setShowPrincipalModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-lg px-3 py-2 bg-gray-50"
            >
              <Text className="text-xs text-gray-600" numberOfLines={1}>
                {principal || 'All Principals'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6b7280" />
            </TouchableOpacity>

            {/* Low stock only filter button */}
            <TouchableOpacity
              onPress={() => {
                setLowStockOnly((prev) => !prev);
                handleFilterChange();
              }}
              className={`flex-row items-center justify-center border px-3 py-2 rounded-lg gap-1.5 ${
                lowStockOnly
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              <Ionicons
                name="alert-circle"
                size={14}
                color={lowStockOnly ? '#b45309' : '#6b7280'}
              />
              <Text className={`text-xs font-semibold ${lowStockOnly ? 'text-amber-800' : 'text-gray-600'}`}>
                Low Stock
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sort Info / Trigger */}
          <View className="border-t border-gray-100 pt-3 flex-row justify-between items-center">
            <View className="flex-row items-center gap-1">
              <Text className="text-[10px] text-gray-400">Sorted by:</Text>
              <Text className="text-xs font-bold text-orange-700 capitalize">
                {sortBy === 'lowStock' ? 'Status' : sortBy} ({sortOrder.toUpperCase()})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSortModal(true)}
              className="flex-row items-center gap-1 border border-orange-200 bg-orange-50/50 px-2.5 py-1 rounded-full"
            >
              <Ionicons name="swap-vertical" size={12} color="#f97316" />
              <Text className="text-[10px] font-bold text-orange-700">Change Sort</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* List of Analytics items */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-8" />
        ) : isError ? (
          <View className="bg-white border border-red-150 rounded-xl p-8 items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={32} color="#ef4444" />
            <Text className="text-xs text-red-500 mt-2 font-semibold">Failed to load analytics</Text>
            <TouchableOpacity onPress={() => refetch()} className="mt-3 bg-red-50 px-4 py-1.5 rounded-full border border-red-100">
              <Text className="text-xs text-red-700 font-bold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : skus.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-xl p-8 items-center justify-center shadow-sm">
            <Ionicons name="cube-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-400 mt-2">No matching analytics records</Text>
          </View>
        ) : (
          <View className="gap-3 pb-24">
            {skus.map((sku) => {
              let statusBadgeBg = 'bg-green-50 border-green-200';
              let statusBadgeText = 'text-green-700';
              let statusText = 'OK';

              if (sku.quantityAvailable === 0) {
                statusBadgeBg = 'bg-red-50 border-red-200';
                statusBadgeText = 'text-red-700';
                statusText = 'OUT OF STOCK';
              } else if (sku.lowStockFlag) {
                statusBadgeBg = 'bg-amber-50 border-amber-200';
                statusBadgeText = 'text-amber-700';
                statusText = 'LOW STOCK';
              }

              return (
                <View
                  key={sku.masterSkuId}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm gap-2.5"
                >
                  {/* Title & Badge */}
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-bold text-gray-800">{sku.name}</Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">Principal: {sku.principal}</Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
                      <Text className={`text-[9px] font-bold uppercase ${statusBadgeText}`}>
                        {statusText}
                      </Text>
                    </View>
                  </View>

                  {/* Quantity & Weight info */}
                  <View className="flex-row justify-between items-center border-t border-gray-50 pt-2.5">
                    <View>
                      <Text className="text-[10px] text-gray-400">Qty Available</Text>
                      <Text className={`text-xs font-bold mt-0.5 ${sku.lowStockFlag ? 'text-amber-600' : 'text-gray-800'}`}>
                        {sku.quantityAvailable.toLocaleString('en-IN')} units
                        {sku.lowStockFlag && (
                          <Text className="text-[9px] font-normal text-gray-400"> / min {sku.displayRequiredQty}</Text>
                        )}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] text-gray-400">Stock Weight</Text>
                      <Text className="text-xs text-gray-700 font-semibold mt-0.5">
                        {formatStockWeight(sku.weight, sku.quantityAvailable)}
                      </Text>
                    </View>
                  </View>

                  {/* Valuation info */}
                  <View className="flex-row justify-between items-center border-t border-gray-50 pt-2.5">
                    <View>
                      <Text className="text-[10px] text-gray-400">Unit Price / Cost</Text>
                      <Text className="text-xs text-gray-600 mt-0.5">
                        {formatCurrency(sku.boxPrice ?? 0)} / {formatCurrency(sku.unitCost)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] text-gray-400">Total Value</Text>
                      <Text className="text-xs text-emerald-700 font-bold mt-0.5">
                        {formatCurrency(sku.totalValue)}
                      </Text>
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
            Page {page} of {totalPages} ({total} SKUs)
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

      {/* ── Principal Modal ── */}
      <Modal
        visible={showPrincipalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrincipalModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Principal</Text>
              <TouchableOpacity onPress={() => setShowPrincipalModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={['', ...principals]}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPrincipal(item);
                    handleFilterChange();
                    setShowPrincipalModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    principal === item ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${principal === item ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                    {item || 'All Principals'}
                  </Text>
                  {principal === item && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Sort Modal ── */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl p-5 gap-4">
            <View className="flex-row justify-between items-center border-b border-gray-100 pb-2">
              <Text className="font-bold text-gray-800 text-base">Sort Options</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Sort Fields */}
            <View className="gap-2">
              <Text className="text-xs font-bold text-gray-400 uppercase">Sort By</Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { field: 'name', label: 'SKU Name' },
                  { field: 'quantity', label: 'Qty Available' },
                  { field: 'value', label: 'Stock Value' },
                  { field: 'lowStock', label: 'Status' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.field}
                    onPress={() => setSortBy(opt.field as SortKey)}
                    className={`px-3.5 py-2 rounded-full border ${
                      sortBy === opt.field
                        ? 'bg-orange-100 border-orange-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-xs ${sortBy === opt.field ? 'font-bold text-orange-700' : 'text-gray-600'}`}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sort Order */}
            <View className="gap-2 mt-2">
              <Text className="text-xs font-bold text-gray-400 uppercase">Order</Text>
              <View className="flex-row gap-3">
                {[
                  { order: 'asc', label: 'Ascending (A-Z, Low to High)' },
                  { order: 'desc', label: 'Descending (Z-A, High to Low)' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.order}
                    onPress={() => setSortOrder(opt.order as 'asc' | 'desc')}
                    className={`flex-1 p-3 rounded-lg border items-center ${
                      sortOrder === opt.order
                        ? 'bg-orange-100 border-orange-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${sortOrder === opt.order ? 'font-bold text-orange-700' : 'text-gray-600'}`}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              onPress={() => {
                handleFilterChange();
                setShowSortModal(false);
              }}
              className="mt-2 bg-orange-500 py-3 rounded-xl items-center"
            >
              <Text className="text-white font-bold text-sm">Apply Sort</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
