import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { leaderboardService } from '@/services/leaderboard.service';
import { STATE_OPTIONS } from '@/lib/states';

const { width } = Dimensions.get('window');

const ALLOWED_ROLES = new Set([
  UserRole.ADMIN,
  UserRole.NSM,
  UserRole.RSM,
  UserRole.ASM,
  UserRole.SO,
  UserRole.ASE,
]);

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function thisMonthRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: toInputDate(from), to: toInputDate(to) };
}

function lastNDaysRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0';
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

// Custom Date Picker Modal
function CalendarModal({
  visible,
  onClose,
  onSelectDate,
  currentValue,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  currentValue: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const selectDay = (day: number) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    onSelectDate(`${year}-${formattedMonth}-${formattedDay}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl p-4">
          <View className="flex-row justify-between items-center mb-4">
            <TouchableOpacity onPress={handlePrevMonth} className="p-2">
              <Ionicons name="chevron-back" size={20} color="#374151" />
            </TouchableOpacity>
            <Text className="font-bold text-gray-800 text-base">{months[month]} {year}</Text>
            <TouchableOpacity onPress={handleNextMonth} className="p-2">
              <Ionicons name="chevron-forward" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <View key={day} className="w-[14%] items-center">
                <Text className="text-[11px] font-bold text-gray-400">{day}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap justify-start">
            {days.map((day, idx) => {
              if (day === null) {
                return <View key={idx} className="w-[14%] h-9" />;
              }

              const formattedMonth = String(month + 1).padStart(2, '0');
              const formattedDay = String(day).padStart(2, '0');
              const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
              const isSelected = currentValue === dateStr;

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => selectDay(day)}
                  className={`w-[14%] h-9 items-center justify-center rounded-full ${
                    isSelected ? 'bg-orange-50' : 'active:bg-gray-100'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-orange-600 font-bold' : 'text-gray-700'}`}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={onClose} className="mt-4 border-t border-gray-100 pt-3 items-center">
            <Text className="text-xs font-bold text-gray-500">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function OutletWiseScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const initialRange = useMemo(() => lastNDaysRange(30), []);

  // Filter States
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [stateFilter, setStateFilter] = useState('');
  const [beatFilter, setBeatFilter] = useState('');
  const [outletSearch, setOutletSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showStateModal, setShowStateModal] = useState(false);
  const [showBeatModal, setShowBeatModal] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Query
  const isAllowed = !!user && ALLOWED_ROLES.has(user.role as UserRole);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['outlet-wise-dashboard-app', fromDate, toDate, stateFilter, beatFilter],
    queryFn: () =>
      leaderboardService.getOutletWiseReport({
        state: stateFilter || undefined,
        beat: beatFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    enabled: isAllowed,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
    retry: 2,
  });

  const applyRange = (type: '7d' | '30d' | 'month') => {
    const range = type === 'month' ? thisMonthRange() : lastNDaysRange(type === '7d' ? 7 : 30);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setStateFilter('');
    setBeatFilter('');
    setOutletSearch('');
  };

  // Beat options from query data
  const beatOptions = useMemo(() => {
    const beats = new Set<string>();
    for (const outlet of data?.outlets ?? []) {
      const beat = (outlet.beat ?? '').trim().toLowerCase();
      if (beat && beat !== '-') beats.add(beat);
    }
    return Array.from(beats).sort();
  }, [data]);

  // Filtered outlets based on search string
  const filteredOutlets = useMemo(() => {
    const query = outletSearch.trim().toLowerCase();
    if (!query) return data?.outlets ?? [];

    return (data?.outlets ?? []).filter(
      (outlet) =>
        outlet.outletName.toLowerCase().includes(query) ||
        outlet.retailerEntityId.toLowerCase().includes(query) ||
        outlet.beat.toLowerCase().includes(query) ||
        outlet.state.toLowerCase().includes(query)
    );
  }, [data, outletSearch]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const outletsToExport = filteredOutlets;
    if (outletsToExport.length === 0) {
      Alert.alert('No Data', 'There is no outlet data to export.');
      return;
    }

    setIsExporting(true);
    try {
      const rows = outletsToExport.map((row, idx) => ({
        'S.No': idx + 1,
        'Outlet Name': row.outletName,
        'Outlet ID': row.retailerEntityId,
        Beat: row.beat,
        State: row.state,
        'Total Order Amount (INR)': row.totalOrderAmount,
        'Order Count': row.orderCount,
        'Last Order Date': row.lastOrderDate ? new Date(row.lastOrderDate).toLocaleDateString('en-IN') : '—',
      }));

      const { downloadXlsxReport } = require('@/lib/xlsx-export');
      await downloadXlsxReport(rows, {
        fileName: `Outlet_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Outlet Report',
      });
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Error', err.message || 'Failed to export outlet report.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAllowed) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4 text-center">Access Denied</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Outlet Wise report is not available for your role.
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

  // Sidebar navigation options matching the Operations panel
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
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
        {/* Title Header */}
        <View className="px-5 pt-5 pb-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="home-outline" size={24} color="#f97316" />
            <Text className="text-2xl font-bold text-gray-900">Outlet Wise Report</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            Individual outlet-level order analytics with beat and state breakdown.
          </Text>
        </View>

        {/* Action Buttons Row */}
        <View className="px-5 pb-4 flex-row gap-2">
          <TouchableOpacity
            onPress={() => refetch()}
            disabled={isFetching}
            className="flex-row items-center justify-center border border-gray-200 bg-white px-4 py-2 rounded-xl active:bg-gray-50"
          >
            <Ionicons name="refresh-outline" size={14} color="#4b5563" className="mr-1.5" />
            <Text className="text-xs font-semibold text-gray-700">Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting}
            className="flex-row items-center justify-center border border-emerald-200 bg-emerald-50/20 px-4 py-2 rounded-xl active:bg-emerald-50/40"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#10b981" className="mr-1.5" />
            ) : (
              <Ionicons name="download-outline" size={14} color="#10b981" className="mr-1.5" />
            )}
            <Text className="text-xs font-semibold text-emerald-700">
              {isExporting ? 'Exporting...' : 'Export Outlet XLSX'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filters Card */}
        <View className="mx-5 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm gap-3.5 mb-4">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="funnel-outline" size={16} color="#f97316" />
            <Text className="text-sm font-bold text-gray-800">Filters</Text>
          </View>

          {/* Quick Date Selectors Row */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => applyRange('7d')}
              className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50"
            >
              <Text className="text-xs text-gray-600 font-medium">Last 7 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyRange('30d')}
              className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50"
            >
              <Text className="text-xs text-gray-600 font-medium">Last 30 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyRange('month')}
              className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50"
            >
              <Text className="text-xs text-gray-600 font-medium">This month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearFilters}
              className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50 flex-row justify-center gap-1"
            >
              <Ionicons name="refresh-outline" size={12} color="#6b7280" />
              <Text className="text-xs text-gray-600 font-medium">Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View className="flex-row items-center border border-gray-200 rounded-xl px-3 bg-white h-9">
            <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-1.5" />
            <TextInput
              value={outletSearch}
              onChangeText={setOutletSearch}
              placeholder="Search outlets by name, ID, beat, or state..."
              placeholderTextColor="#9ca3af"
              className="flex-1 text-xs text-gray-800 p-0 h-full"
            />
          </View>

          {/* Date Range selectors */}
          <View className="gap-2">
            <View>
              <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">From</Text>
              <TouchableOpacity
                onPress={() => setShowStartCalendar(true)}
                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 bg-white h-9"
              >
                <Text className="text-xs text-gray-700">
                  {fromDate ? fromDate.split('-').reverse().join('-') : 'dd-mm-yyyy'}
                </Text>
                <Ionicons name="calendar-outline" size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">To</Text>
              <TouchableOpacity
                onPress={() => setShowEndCalendar(true)}
                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 bg-white h-9"
              >
                <Text className="text-xs text-gray-700">
                  {toDate ? toDate.split('-').reverse().join('-') : 'dd-mm-yyyy'}
                </Text>
                <Ionicons name="calendar-outline" size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dropdown filters */}
          <View className="gap-2">
            <View>
              <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">State</Text>
              <TouchableOpacity
                onPress={() => setShowStateModal(true)}
                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
              >
                <Text className="text-xs text-gray-700 font-medium">
                  {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All States'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Beat</Text>
              <TouchableOpacity
                onPress={() => setShowBeatModal(true)}
                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
              >
                <Text className="text-xs text-gray-700 font-medium">
                  {beatFilter ? beatFilter.toUpperCase() : 'All Beats'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats / KPI Blocks */}
        {!isLoading && !isError && (
          <View className="px-5 gap-3.5 mb-4">
            {/* TOTAL OUTLETS */}
            <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="storefront-outline" size={14} color="#9ca3af" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL OUTLETS</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 mt-1">{filteredOutlets.length}</Text>
            </View>

            {/* TOTAL REVENUE */}
            <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs font-bold text-gray-400">₹</Text>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL REVENUE</Text>
              </View>
              <Text className="text-2xl font-black text-[#10b981] mt-1">{formatCurrency(data?.totalAmount ?? 0)}</Text>
            </View>

            {/* TOTAL ORDERS */}
            <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="cart-outline" size={14} color="#9ca3af" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL ORDERS</Text>
              </View>
              <Text className="text-2xl font-black text-[#f97316] mt-1">{data?.totalOrders ?? 0}</Text>
            </View>
          </View>
        )}

        {/* Loading / Error States */}
        {isLoading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : isError ? (
          <View className="mx-5 bg-white border border-red-200 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={32} color="#ef4444" />
            <Text className="text-xs text-red-500 mt-2 font-semibold">
              {error instanceof Error ? error.message : 'Failed to load reports'}
            </Text>
          </View>
        ) : filteredOutlets.length === 0 ? (
          <View className="mx-5 bg-white border border-gray-200 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="storefront-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-400 mt-2">No outlet data matches the selected filters</Text>
          </View>
        ) : (
          <View className="mx-5 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm gap-4 mb-24">
            <Text className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Outlet performance</Text>
            {filteredOutlets.map((row, idx) => (
              <View
                key={row.retailerEntityId}
                className="flex-row items-center gap-3 border-b border-gray-55 pb-3 last:border-b-0 last:pb-0"
              >
                <View className="h-7 w-7 rounded-full bg-gray-50 border border-gray-200 justify-center items-center">
                  <Text className="text-xs font-bold text-gray-500">{idx + 1}</Text>
                </View>
                <View className="flex-grow min-w-0">
                  <Text className="text-xs font-bold text-gray-800 truncate">{row.outletName}</Text>
                  <View className="flex-row items-center flex-wrap gap-x-2.5 mt-0.5">
                    <Text className="text-[10px] text-gray-400">Beat: {row.beat}</Text>
                    <Text className="text-[10px] text-gray-400">State: {row.state}</Text>
                    {row.lastOrderDate && (
                      <Text className="text-[10px] text-gray-400">
                        Last Order: {new Date(row.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="items-end justify-center">
                  <Text className="text-xs font-bold text-[#f97316]">{formatCurrency(row.totalOrderAmount)}</Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">{row.orderCount} orders</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      {/* State Filter Modal */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStateModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ value: '', label: 'All States' }, ...STATE_OPTIONS]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setStateFilter(item.value);
                    setShowStateModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    stateFilter === item.value ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${stateFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {stateFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Beat Filter Modal */}
      <Modal
        visible={showBeatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBeatModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Beat</Text>
              <TouchableOpacity onPress={() => setShowBeatModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={['', ...beatOptions]}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setBeatFilter(item);
                    setShowBeatModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    beatFilter === item ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${beatFilter === item ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item ? item.toUpperCase() : 'All Beats'}
                  </Text>
                  {beatFilter === item && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Calendar modals */}
      <CalendarModal
        visible={showStartCalendar}
        onClose={() => setShowStartCalendar(false)}
        onSelectDate={setFromDate}
        currentValue={fromDate}
      />

      <CalendarModal
        visible={showEndCalendar}
        onClose={() => setShowEndCalendar(false)}
        onSelectDate={setToDate}
        currentValue={toDate}
      />
    </View>
  );
}
