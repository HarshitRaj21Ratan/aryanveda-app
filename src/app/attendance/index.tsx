import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Platform,
  FlatList,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { attendanceService } from '@/services/attendance.service';
import { UserRole, AttendanceStatus, WorkingType } from '@/types';

const { width } = Dimensions.get('window');

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
                  className={`w-[14%] h-9 items-center justify-center rounded-full ${isSelected ? 'bg-orange-500' : 'active:bg-gray-100'
                    }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
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

type LateFilter = 'all' | 'late' | 'on_time';

const STATUS_OPTIONS: Array<{ label: string; value: AttendanceStatus }> = [
  { label: 'Present', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Half Day', value: 'half_day' },
  { label: 'Leave', value: 'leave' },
];

const WORKING_TYPE_OPTIONS: Array<{ label: string; value: WorkingType }> = [
  { label: 'Market Working', value: 'market_working' },
  { label: 'Joint Working', value: 'joint_working' },
  { label: 'Distribution Point Visit', value: 'distribution_point_visit' },
  { label: 'Super Point Visit', value: 'super_point_visit' },
  { label: 'In Office', value: 'in_office' },
  { label: 'Field Visit', value: 'field_visit' },
  { label: 'Leave', value: 'leave' },
  { label: 'Other', value: 'other' },
];

function statusClasses(value: AttendanceStatus): string {
  if (value === 'present') return 'bg-emerald-50 border-emerald-100 text-emerald-700';
  if (value === 'absent') return 'bg-red-50 border-red-100 text-red-700';
  if (value === 'half_day') return 'bg-amber-50 border-amber-100 text-amber-700';
  return 'bg-purple-50 border-purple-100 text-purple-700';
}

function formatAttendanceStatus(value: AttendanceStatus): string {
  if (value === 'half_day') return 'Half Day';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatWorkingType(value: WorkingType): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function MyAttendanceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Checks
  const isAuthorizedRole = user?.role === UserRole.SO || user?.role === UserRole.ASE || user?.role === UserRole.ASM || user?.role === UserRole.RSM;

  // Filter States
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('');
  const [workingTypeFilter, setWorkingTypeFilter] = useState<WorkingType | ''>('');
  const [lateFilter, setLateFilter] = useState<LateFilter>('all');
  const [selectedSelfieUrl, setSelectedSelfieUrl] = useState<string | null>(null);

  // UI Modals & Navigation
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const lateFilterValue = useMemo(() => {
    if (lateFilter === 'late') return true;
    if (lateFilter === 'on_time') return false;
    return undefined;
  }, [lateFilter]);

  // React Queries
  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching, refetch } = useQuery({
    queryKey: [
      'my-attendance-history',
      user?.entityId,
      page,
      fromDate,
      toDate,
      statusFilter,
      workingTypeFilter,
      lateFilter,
    ],
    queryFn: () =>
      attendanceService.getMyAttendanceHistory({
        page,
        limit: 10,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        attendanceStatus: statusFilter || undefined,
        workingType: workingTypeFilter || undefined,
        isLate: lateFilterValue,
        sortOrder: 'desc',
      }),
    enabled: isAuthorizedRole,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: [
      'my-attendance-summary',
      user?.entityId,
      fromDate,
      toDate,
      statusFilter,
      workingTypeFilter,
      lateFilter,
    ],
    queryFn: () =>
      attendanceService.getMyAttendanceSummary({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        attendanceStatus: statusFilter || undefined,
        workingType: workingTypeFilter || undefined,
        isLate: lateFilterValue,
      }),
    enabled: isAuthorizedRole,
  });

  const { data: todayStatus } = useQuery({
    queryKey: ['my-today-attendance-status', user?.entityId],
    queryFn: () => attendanceService.getTodayStatus(),
    enabled: isAuthorizedRole,
  });

  const records = historyData?.data ?? [];
  const total = historyData?.total ?? 0;
  const totalPages = Math.max(1, historyData?.pagination?.totalPages ?? Math.ceil(total / 10));
  const attendanceRate = summaryData?.total
    ? Math.round(((summaryData.present + summaryData.halfDay) / summaryData.total) * 100)
    : 0;

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setStatusFilter('');
    setWorkingTypeFilter('');
    setLateFilter('all');
    setPage(1);
  };

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

  const setQuickRange = (range: '7' | '30' | 'month') => {
    const to = new Date();
    const from = new Date();
    if (range === 'month') {
      from.setDate(1);
    } else {
      const days = range === '7' ? 7 : 30;
      from.setDate(to.getDate() - (days - 1));
    }
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
    setPage(1);
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (records.length === 0) {
      Alert.alert('No Data', 'There is no attendance history to export.');
      return;
    }
    setIsExporting(true);
    try {
      const rows = records.map((rec: any) => ({
        Date: rec.attendanceDateKey,
        Status: formatAttendanceStatus(rec.attendanceStatus),
        'Working Type': formatWorkingType(rec.workingType),
        Town: rec.town || '-',
        Punctuality: rec.isLate ? 'Late' : 'On Time',
        Outstation: rec.isOutstation ? 'Yes' : 'No',
        Remark: rec.remark || '-',
        'Marked At': new Date(rec.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }));
      const { downloadXlsxReport } = require('@/lib/xlsx-export');
      await downloadXlsxReport(rows, {
        fileName: `attendance-report-${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: 'Attendance',
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to export attendance report');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAuthorizedRole) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          This portal is reserved for Sales Force roles (SO, ASE, ASM, RSM).
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title & Desc */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-2xl font-bold text-gray-900">My Attendance</Text>
          <Text className="text-xs text-gray-500 mt-1 leading-5">
            Track your daily marks with status, working type, selfie, and late/on-time visibility.
          </Text>
        </View>

        {/* Quick buttons under title */}
        <View className="px-6 flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting}
            className="flex-row items-center border border-gray-200 bg-white rounded-lg px-3 py-2 gap-1.5"
          >
            <Ionicons name="download-outline" size={16} color="#64748b" />
            <Text className="text-slate-600 text-xs font-semibold">
              {isExporting ? 'Exporting...' : 'Download XLSX'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center border border-gray-200 bg-white rounded-lg px-3 py-2 gap-1.5">
            <Ionicons name="person-outline" size={16} color="#f97316" />
            <Text className="text-slate-600 text-xs font-semibold">
              Today marked ({todayStatus?.hasMarked ? formatAttendanceStatus(todayStatus.record?.attendanceStatus ?? 'present') : 'Not Marked'})
            </Text>
          </View>
        </View>

        {/* Stacked Stat Cards */}
        <View className="px-6 gap-3 mb-6">
          {/* Card 1 */}
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
            <Text className="text-[10px] uppercase font-bold text-gray-400">Total Days</Text>
            <Text className="text-2xl font-bold text-gray-800 mt-1">
              {summaryLoading ? '...' : summaryData?.total ?? 0}
            </Text>
            <Text className="text-[10px] text-gray-400 mt-1">For current filters</Text>
          </View>

          {/* Card 2 */}
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
            <Text className="text-[10px] uppercase font-bold text-gray-400">Present + Half Day</Text>
            <Text className="text-2xl font-bold text-gray-800 mt-1">
              {summaryLoading ? '...' : (summaryData?.present ?? 0) + (summaryData?.halfDay ?? 0)}
            </Text>
            <Text className="text-[10px] text-gray-400 mt-1">{attendanceRate}% attendance strength</Text>
          </View>

          {/* Card 3 */}
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
            <Text className="text-[10px] uppercase font-bold text-gray-400">Late Marks</Text>
            <Text className="text-2xl font-bold text-gray-800 mt-1">
              {summaryLoading ? '...' : summaryData?.lateCount ?? 0}
            </Text>
            <Text className="text-[10px] text-gray-400 mt-1">Based on 09:00 IST threshold</Text>
          </View>

          {/* Card 4 */}
          <View className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
            <Text className="text-[10px] uppercase font-bold text-gray-400">Leaves/Absent</Text>
            <Text className="text-2xl font-bold text-gray-800 mt-1">
              {summaryLoading ? '...' : (summaryData?.leave ?? 0) + (summaryData?.absent ?? 0)}
            </Text>
            <Text className="text-[10px] text-gray-400 mt-1">Leave + absent count</Text>
          </View>
        </View>

        {/* Filters Card Container */}
        <View className="mx-6 bg-white border border-gray-200 p-5 rounded-2xl shadow-sm gap-4 mb-6">
          <View className="flex-row items-center gap-1.5 pb-2 border-b border-gray-100">
            <Ionicons name="funnel-outline" size={16} color="#f97316" />
            <Text className="text-base font-bold text-slate-800">Filters</Text>
          </View>

          {/* Quick ranges */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setQuickRange('7')}
              className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white active:bg-gray-50"
            >
              <Text className="text-[11px] font-semibold text-slate-600">Last 7 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setQuickRange('30')}
              className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white active:bg-gray-50"
            >
              <Text className="text-[11px] font-semibold text-slate-600">Last 30 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setQuickRange('month')}
              className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white active:bg-gray-50"
            >
              <Text className="text-[11px] font-semibold text-slate-600">This month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResetFilters}
              className="flex-row items-center border border-gray-200 rounded-lg px-3 py-1.5 bg-white active:bg-gray-50 gap-1"
            >
              <Ionicons name="refresh-outline" size={12} color="#475569" />
              <Text className="text-[11px] font-semibold text-slate-600">Reset</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Date picker inputs */}
          <View className="gap-3">
            <View>
              <Text className="text-xs font-semibold text-slate-500 mb-1.5">From</Text>
              <TouchableOpacity
                onPress={() => setShowFromCalendar(true)}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
              >
                <Text className="text-sm text-gray-800">
                  {fromDate ? fromDate.split('-').reverse().join('-') : 'dd-mm-yyyy'}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-xs font-semibold text-slate-500 mb-1.5">To</Text>
              <TouchableOpacity
                onPress={() => setShowToCalendar(true)}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
              >
                <Text className="text-sm text-gray-800">
                  {toDate ? toDate.split('-').reverse().join('-') : 'dd-mm-yyyy'}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-xs font-semibold text-slate-500 mb-1.5">Attendance Status</Text>
              <TouchableOpacity
                onPress={() => setShowStatusModal(true)}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
              >
                <Text className="text-sm text-gray-800">
                  {statusFilter ? STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label : 'All statuses'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Timeline Logs List */}
        <View className="px-6 mb-24">
          <Text className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
            Attendance Timeline ({total})
          </Text>

          {historyLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#8b5cf6" />
            </View>
          ) : records.length === 0 ? (
            <View className="bg-white border border-gray-200 rounded-2xl p-8 items-center justify-center shadow-sm">
              <Ionicons name="calendar-outline" size={32} color="#9ca3af" className="opacity-40" />
              <Text className="text-xs text-gray-500 mt-2">No records found for current filters</Text>
            </View>
          ) : (
            <View className="gap-4">
              {records.map((rec: any) => (
                <View key={rec.attendanceId} className="border border-gray-100 rounded-xl bg-white p-4 shadow-sm">
                  <View className="flex-row justify-between items-start mb-3">
                    <View>
                      <Text className="text-sm font-bold text-gray-800">{rec.attendanceDateKey}</Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">
                        Marked: {new Date(rec.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View className="items-end">
                      <View className={`px-2.5 py-0.5 rounded-full border ${statusClasses(rec.attendanceStatus)}`}>
                        <Text className="text-[10px] font-bold uppercase">{formatAttendanceStatus(rec.attendanceStatus)}</Text>
                      </View>
                      {rec.isOutstation && (
                        <View className="mt-1 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[8px] font-bold text-amber-700 uppercase">Outstation</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Details grid */}
                  <View className="gap-2 text-xs border-t border-gray-50 pt-3">
                    <View className="flex-row justify-between">
                      <Text className="text-gray-400 text-xs">Working Type</Text>
                      <Text className="text-gray-700 text-xs font-semibold">{formatWorkingType(rec.workingType)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-400 text-xs">Town</Text>
                      <Text className="text-gray-700 text-xs font-semibold">{rec.town?.trim() || '-'}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-400 text-xs">Punctuality</Text>
                      <Text className={`text-xs font-bold ${rec.isLate ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {rec.isLate ? 'Late' : 'On Time'}
                      </Text>
                    </View>
                    {rec.remark?.trim() ? (
                      <View className="flex-row justify-between">
                        <Text className="text-gray-400 text-xs">Remark</Text>
                        <Text className="text-gray-700 text-xs italic flex-1 text-right ml-4" numberOfLines={2}>
                          {rec.remark.trim()}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Selfie / Location links */}
                  <View className="flex-row gap-3 border-t border-gray-50 mt-4 pt-3">
                    {rec.selfieUrl ? (
                      <TouchableOpacity
                        onPress={() => setSelectedSelfieUrl(rec.selfieUrl)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 flex-row items-center justify-center gap-1"
                      >
                        <Ionicons name="camera-outline" size={14} color="#4b5563" />
                        <Text className="text-xs font-semibold text-gray-700">View Selfie</Text>
                      </TouchableOpacity>
                    ) : null}
                    {rec.latitude && rec.longitude ? (
                      <TouchableOpacity
                        onPress={() => Alert.alert('Location coordinates', `Lat: ${rec.latitude}, Lon: ${rec.longitude}`)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 flex-row items-center justify-center gap-1"
                      >
                        <Ionicons name="map-outline" size={14} color="#3b82f6" />
                        <Text className="text-xs font-semibold text-blue-600">GPS Coords</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-center py-4 border-t border-gray-100 gap-4 bg-white">
          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            className={`p-2 border rounded-lg ${page === 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
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
            className={`p-2 border rounded-lg ${page === totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
              }`}
          >
            <Ionicons name="chevron-forward" size={16} color="#374151" />
          </TouchableOpacity>
        </View>
      )}

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
                    const isSelected = item.name === 'Attendance Track';
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setIsSidebarOpen(false);
                          router.push(item.route as any);
                        }}
                        className={`flex-row items-center justify-between px-3 py-3 rounded-xl ${isSelected ? 'bg-[#2c3144] border border-gray-700' : 'active:bg-[#202637]'
                          }`}
                      >
                        <View className="flex-row items-center gap-3">
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={isSelected ? '#ffffff' : '#9ca3af'}
                          />
                          <Text
                            className={`text-sm ${isSelected ? 'text-white font-semibold' : 'text-gray-300'
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

      {/* From Calendar Picker Modal */}
      <CalendarModal
        visible={showFromCalendar}
        onClose={() => setShowFromCalendar(false)}
        onSelectDate={(date) => {
          setFromDate(date);
          setPage(1);
        }}
        currentValue={fromDate}
      />

      {/* To Calendar Picker Modal */}
      <CalendarModal
        visible={showToCalendar}
        onClose={() => setShowToCalendar(false)}
        onSelectDate={(date) => {
          setToDate(date);
          setPage(1);
        }}
        currentValue={toDate}
      />

      {/* Status Filter Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setStatusFilter(item.value);
                    setPage(1);
                    setShowStatusModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${statusFilter === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${statusFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {statusFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Selfie Modal ── */}
      {selectedSelfieUrl && (
        <Modal
          visible={!!selectedSelfieUrl}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedSelfieUrl(null)}
        >
          <View className="flex-1 justify-center items-center bg-black/85 p-6">
            <TouchableOpacity
              onPress={() => setSelectedSelfieUrl(null)}
              className="absolute right-6 top-12 p-2 bg-white/10 rounded-full"
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Image
              source={{ uri: selectedSelfieUrl }}
              className="w-full h-[70%] rounded-xl"
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
}
