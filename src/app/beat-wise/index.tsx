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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { UserRole } from '@/types';
import { STATE_OPTIONS } from '@/lib/states';

const { width } = Dimensions.get('window');

interface BeatReportEntry {
  beat: string;
  state: string;
  soName: string;
  soEntityId: string;
  totalOrders: number;
  totalAmount: number;
  avgOrderValue: number;
  uniqueRetailers: number;
}

interface BeatReportResponse {
  period: { from: string; to: string };
  entries: BeatReportEntry[];
  grandTotal: {
    totalOrders: number;
    totalAmount: number;
    uniqueBeats: number;
    uniqueSOs: number;
  };
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
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
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function BeatWiseReportScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // States
  const [fromDate, setFromDate] = useState(() => thisMonthRange().from);
  const [toDate, setToDate] = useState(() => thisMonthRange().to);
  const [state, setState] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');

  // Dropdown States / Modal flags
  const [showStateModal, setShowStateModal] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Checks
  const isAuthorizedRole = user && [UserRole.ADMIN, UserRole.NSM, UserRole.RSM, UserRole.ASM].includes(user.role as UserRole);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['beat-wise-report', fromDate, toDate, state],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: BeatReportResponse }>('/dashboard/beat-wise', {
        params: { from: fromDate, to: toDate, state: state || undefined },
      });
      return res.data.data;
    },
    enabled: !!user && isAuthorizedRole,
  });

  const applyRange = (type: '7d' | '30d' | 'month') => {
    const range = type === 'month' ? thisMonthRange() : lastNDaysRange(type === '7d' ? 7 : 30);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const clearFilters = () => {
    const range = thisMonthRange();
    setFromDate(range.from);
    setToDate(range.to);
    setState('');
  };

  const handleExport = () => {
    Alert.alert('Export Data', 'CSV Beat Wise report export is available on the Web app portal.');
  };

  if (!isAuthorizedRole) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          You do not have administrative permissions to view beat reports.
        </Text>
      </SafeAreaView>
    );
  }

  const entries = data?.entries ?? [];
  const grandTotal = data?.grandTotal;

  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/admin/inventory' },
    { name: 'Stock Movements', icon: 'cube-outline' as const, route: '/stock-movements' },
    { name: 'Orders', icon: 'cart-outline' as const, route: '/admin/performance' },
    { name: 'Leaderboard', icon: 'trophy-outline' as const, route: '/leaderboard' },
    { name: 'Outlet Report', icon: 'home-outline' as const, route: '/outlet-wise' },
    { name: 'Beat Report', icon: 'bar-chart-outline' as const, route: '/beat-wise' },
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
    <SafeAreaView className="flex-1 bg-gray-50" style={{ flex: 1 }}>
      {/* Top Header Navigation Bar (Matches Admin Control Panel) */}
      <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-4">
          <TouchableOpacity onPress={() => setIsSidebarOpen(true)} className="p-2 mr-2">
            <Ionicons name="menu-outline" size={26} color="#374151" />
          </TouchableOpacity>

          {/* Search bar */}
          <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
            <Ionicons name="search-outline" size={18} color="#9ca3af" className="mr-2" />
            <TextInput
              placeholder="Search users, orders..."
              placeholderTextColor="#9ca3af"
              value={headerSearch}
              onChangeText={setHeaderSearch}
              className="flex-1 text-sm text-gray-800 p-0 h-8"
            />
          </View>
        </View>

        {/* Right Action Icons */}
        <View className="flex-row items-center gap-3">
          <TouchableOpacity className="p-1.5 relative">
            <Ionicons name="mail-outline" size={22} color="#4b5563" />
          </TouchableOpacity>
          <TouchableOpacity className="p-1.5 relative">
            <Ionicons name="notifications-outline" size={22} color="#4b5563" />
            <View className="absolute top-0 right-0 bg-orange-500 rounded-full px-1 py-0.2 min-w-[16px] items-center justify-center">
              <Text className="text-[9px] font-bold text-white">99+</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} className="p-1.5">
            <Ionicons name="log-out-outline" size={22} color="#4b5563" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
        {/* Title Header */}
        <View className="px-5 pt-5 pb-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="bar-chart-outline" size={24} color="#f97316" />
            <Text className="text-2xl font-bold text-gray-900">Beat Wise Report</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            Sales aggregation by beat with region filtering.
          </Text>
        </View>

        {/* Action Buttons Row */}
        <View className="px-5 pb-4 flex-row gap-2">
          <TouchableOpacity
            onPress={() => refetch()}
            className="flex-row items-center justify-center border border-gray-200 bg-white px-4 py-2 rounded-xl active:bg-gray-50"
          >
            <Ionicons name="refresh-outline" size={14} color="#4b5563" className="mr-1.5" />
            <Text className="text-xs font-semibold text-gray-700">Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExport}
            className="flex-row items-center justify-center border border-emerald-200 bg-emerald-50/20 px-4 py-2 rounded-xl active:bg-emerald-50/40"
          >
            <Ionicons name="download-outline" size={14} color="#10b981" className="mr-1.5" />
            <Text className="text-xs font-semibold text-emerald-700">Export Beat XLSX</Text>
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

          {/* State Select pill list */}
          <View>
            <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">State</Text>
            <TouchableOpacity
              onPress={() => setShowStateModal(true)}
              className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
            >
              <Text className="text-xs text-gray-700 font-medium">
                {state ? STATE_OPTIONS.find((s) => s.value === state)?.label : 'All States'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Grand Totals / KPI Cards */}
        {grandTotal && (
          <View className="px-5 flex-row flex-wrap gap-3.5 mb-4">
            <View className="flex-grow min-w-[45%] bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="grid-outline" size={14} color="#f97316" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Beats</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 mt-1">{grandTotal.uniqueBeats}</Text>
            </View>

            <View className="flex-grow min-w-[45%] bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="cube-outline" size={14} color="#f97316" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Orders</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 mt-1">{grandTotal.totalOrders}</Text>
            </View>

            <View className="flex-grow min-w-[45%] bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="wallet-outline" size={14} color="#10b981" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Amount</Text>
              </View>
              <Text className="text-2xl font-black text-[#10b981] mt-1" numberOfLines={1}>
                {formatCurrency(grandTotal.totalAmount)}
              </Text>
            </View>

            <View className="flex-grow min-w-[45%] bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="people-outline" size={14} color="#f97316" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active SOs</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 mt-1">{grandTotal.uniqueSOs}</Text>
            </View>
          </View>
        )}

        {/* Log Entries */}
        <View className="px-5 pb-2">
          <Text className="text-sm font-bold text-gray-800 uppercase tracking-wide">Beat Breakdowns</Text>
        </View>

        {isLoading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : isError ? (
          <View className="mx-5 bg-white border border-red-200 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={32} color="#ef4444" />
            <Text className="text-xs text-red-600 font-semibold mt-2">Failed to load beat-wise reports</Text>
          </View>
        ) : entries.length === 0 ? (
          <View className="mx-5 bg-white border border-gray-200 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="bar-chart-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-500 mt-2">No records found for current filters</Text>
          </View>
        ) : (
          <View className="mx-5 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm gap-4 mb-24">
            {entries.map((entry, idx) => (
              <View
                key={idx}
                className="border-b border-gray-50 pb-3 last:border-b-0 last:pb-0 gap-2"
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs font-bold text-gray-800 capitalize">{entry.beat}</Text>
                  <View className="bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[9px] font-bold text-orange-700 uppercase">{entry.state}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between pt-1">
                  <Text className="text-[10px] text-gray-400">Sales Officer</Text>
                  <Text className="text-[10px] text-gray-700 font-semibold">{entry.soName || 'N/A'}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-[10px] text-gray-400">Orders</Text>
                  <Text className="text-[10px] text-gray-700 font-semibold">{entry.totalOrders}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-[10px] text-gray-400">Sales Amount</Text>
                  <Text className="text-[10px] text-emerald-600 font-bold">{formatCurrency(entry.totalAmount)}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-[10px] text-gray-400">Average Order</Text>
                  <Text className="text-[10px] text-gray-700 font-semibold">{formatCurrency(entry.avgOrderValue)}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-[10px] text-gray-400">Retailers Placed</Text>
                  <Text className="text-[10px] text-gray-700 font-semibold">{entry.uniqueRetailers}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sidebar Drawer Navigation Modal Overlay */}
      <Modal
        visible={isSidebarOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSidebarOpen(false)}
      >
        <View className="flex-1 flex-row">
          <View style={{ width: width * 0.78 }} className="h-full bg-[#181d2a] p-4 justify-between">
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
              <View className="flex-row justify-between items-center pb-4 mb-4 border-b border-gray-800">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-orange-500 rounded-full items-center justify-center mr-3 shadow-md">
                    <Text className="text-white font-bold text-lg">N</Text>
                  </View>
                  <View>
                    <Text className="text-white font-bold text-base">Nimson DMS</Text>
                    <Text className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mt-0.5">OPERATIONS PANEL</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setIsSidebarOpen(false)} className="p-2">
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                <View className="gap-1">
                  {sidebarItems.map((item, idx) => {
                    const isSelected = item.name === 'Beat Report';
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setIsSidebarOpen(false);
                          router.push(item.route as any);
                        }}
                        className={`flex-row items-center justify-between px-3 py-3 rounded-xl ${
                          isSelected ? 'bg-[#2c3144] border border-gray-700' : 'active:bg-[#202637]'
                        }`}
                      >
                        <View className="flex-row items-center gap-3">
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={isSelected ? '#ffffff' : '#9ca3af'}
                          />
                          <Text
                            className={`text-sm ${
                              isSelected ? 'text-white font-semibold' : 'text-gray-300'
                            }`}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={isSelected ? '#ffffff' : '#4b5563'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View className="border border-gray-800 rounded-xl p-3 bg-[#1e2332] items-center justify-center">
                <Text className="text-[9px] font-bold text-gray-500 tracking-widest uppercase">ROLE</Text>
                <Text className="text-white font-bold text-sm mt-1">{user?.role || 'User'}</Text>
              </View>
            </SafeAreaView>
          </View>

          <TouchableOpacity
            style={{ width: width * 0.22 }}
            className="h-full bg-black/50"
            activeOpacity={1}
            onPress={() => setIsSidebarOpen(false)}
          />
        </View>
      </Modal>

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
                    setState(item.value);
                    setShowStateModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    state === item.value ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${state === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {state === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
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
    </SafeAreaView>
  );
}

