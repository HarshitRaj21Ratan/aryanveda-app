import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { STATE_OPTIONS } from '@/lib/states';
import { summaryService } from '@/services/summary.service';
import type { DailySummaryItem } from '@/services/summary.service';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

const { width } = Dimensions.get('window');
const TODAY = new Date().toISOString().slice(0, 10);

function attendanceBadge(status: string): { label: string; bg: string; text: string } {
  switch (status) {
    case 'present':
      return { label: 'Present', bg: 'bg-emerald-50', text: 'text-emerald-600' };
    case 'absent':
      return { label: 'Absent', bg: 'bg-red-50', text: 'text-red-600' };
    case 'half_day':
      return { label: 'Half Day', bg: 'bg-amber-50', text: 'text-amber-600' };
    case 'leave':
      return { label: 'Leave', bg: 'bg-violet-50', text: 'text-violet-600' };
    default:
      return { label: 'Not Marked', bg: 'bg-gray-100', text: 'text-gray-500' };
  }
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
                    isSelected ? 'bg-orange-500' : 'active:bg-gray-100'
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

function MobileSummaryCard({ row }: { row: DailySummaryItem }) {
  const [expanded, setExpanded] = useState(false);
  const status = row.attendance?.attendanceStatus ?? 'not_marked';
  const badge = attendanceBadge(status);

  // formatting
  const workingType = row.attendance?.workingType
    ? row.attendance.workingType
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '—';

  const town = row.attendance?.town || '—';
  const timeSpent = row.timeSpentInMarketMinutes !== null && row.timeSpentInMarketMinutes !== undefined
    ? `${row.timeSpentInMarketMinutes} mins`
    : '—';
  const remark = row.attendance?.remark || '—';
  const userStatus = row.isActive !== false ? 'Active' : 'Inactive';

  // I Am Here
  const hasIAmHere = Boolean(row.iAmHere);

  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm mb-3.5">
      {/* Top Header Card Info */}
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-900">{row.name}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{row.reportingManagerName || '—'}</Text>
        </View>
        <View className="bg-orange-50 px-2 py-0.5 rounded">
          <Text className="text-[10px] font-bold text-[#f97316] uppercase">{row.role}</Text>
        </View>
      </View>

      {/* State & Attendance Status Row */}
      <View className="flex-row justify-between items-center mt-2.5 mb-3">
        <Text className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          {row.state ? row.state.charAt(0).toUpperCase() + row.state.slice(1) : '—'}
        </Text>
        <View className={`rounded-full px-2.5 py-0.5 ${badge.bg}`}>
          <Text className={`text-[10px] font-bold ${badge.text}`}>{badge.label}</Text>
        </View>
      </View>

      {/* Performance Stats Panel */}
      <View className="flex-row rounded-xl border border-gray-100 bg-gray-50/50 p-2.5">
        <View className="flex-1 items-center border-r border-gray-100">
          <Text className="text-[9px] font-bold uppercase tracking-wider text-gray-400">TC</Text>
          <Text className="text-xs font-bold text-gray-800 mt-0.5">
            {row.performance?.orderCount ?? 0}
          </Text>
        </View>
        <View className="flex-1 items-center border-r border-gray-100">
          <Text className="text-[9px] font-bold uppercase tracking-wider text-gray-400">PC</Text>
          <Text className="text-xs font-bold text-emerald-600 mt-0.5">
            {row.performance?.productiveVisits ?? 0}
          </Text>
        </View>
        <View className="flex-1 items-center border-r border-gray-100">
          <Text className="text-[9px] font-bold uppercase tracking-wider text-gray-400">POA</Text>
          <Text className="text-xs font-bold text-gray-800 mt-0.5">
            {row.performance?.totalOrderAmount && row.performance.totalOrderAmount > 0
              ? `₹${row.performance.totalOrderAmount.toLocaleString('en-IN')}`
              : '—'}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-[9px] font-bold uppercase tracking-wider text-gray-400">NEW COUNTER</Text>
          <Text className="text-xs font-bold text-gray-800 mt-0.5">
            {row.totalNewCounters ?? 0}
          </Text>
        </View>
      </View>

      {/* Dropdown Toggle Button */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center justify-center mt-3 pt-2 border-t border-gray-100"
      >
        <Text className="text-xs font-bold text-gray-500 mr-1">
          {expanded ? 'Hide Details' : 'View More Details'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={14}
          color="#6b7280"
        />
      </TouchableOpacity>

      {/* Expanded Feature Details Dropdown */}
      {expanded && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row flex-wrap justify-between gap-y-3.5">
            {/* Status */}
            <View className="w-[48%]">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400">User Status</Text>
              <Text className={`text-xs font-semibold mt-0.5 ${row.isActive !== false ? 'text-emerald-600' : 'text-red-500'}`}>
                {userStatus}
              </Text>
            </View>

            {/* Working Type */}
            <View className="w-[48%]">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Working Type</Text>
              <Text className="text-xs font-semibold text-gray-800 mt-0.5" numberOfLines={1}>
                {workingType}
              </Text>
            </View>

            {/* Town */}
            <View className="w-[48%]">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Town</Text>
              <Text className="text-xs font-semibold text-gray-800 mt-0.5" numberOfLines={1}>
                {town}
              </Text>
            </View>

            {/* Time Spent */}
            <View className="w-[48%]">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Time Spent</Text>
              <Text className="text-xs font-semibold text-gray-800 mt-0.5">
                {timeSpent}
              </Text>
            </View>

            {/* Remark */}
            <View className="w-full">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remark</Text>
              <Text className="text-xs text-gray-700 mt-0.5 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                {remark}
              </Text>
            </View>
          </View>

          {/* I Am Here Panel */}
          {hasIAmHere && row.iAmHere && (
            <View className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-2">
                📍 I Am Here Details
              </Text>

              <View className="gap-2">
                {row.iAmHere.visitedAt && (
                  <View className="flex-row">
                    <Text className="text-[10px] font-bold text-gray-400 w-24">SUBMITTED AT:</Text>
                    <Text className="text-xs text-gray-700 font-semibold">
                      {new Date(row.iAmHere.visitedAt).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </View>
                )}

                {row.iAmHere.locationAddress && (
                  <View className="flex-row">
                    <Text className="text-[10px] font-bold text-gray-400 w-24">LOCATION:</Text>
                    <Text className="text-xs text-gray-700 flex-1 leading-normal font-semibold">
                      {row.iAmHere.locationAddress}
                    </Text>
                  </View>
                )}

                {row.iAmHere.notes && (
                  <View className="flex-row">
                    <Text className="text-[10px] font-bold text-gray-400 w-24">REMARKS:</Text>
                    <Text className="text-xs text-gray-700 flex-1 leading-normal font-semibold">
                      {row.iAmHere.notes}
                    </Text>
                  </View>
                )}

                {row.iAmHere.proofImageUrl && (
                  <View className="flex-row mt-1">
                    <Text className="text-[10px] font-bold text-gray-400 w-24">IMAGE PROOF:</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('View Image', 'Open link in browser:\n' + row.iAmHere!.proofImageUrl);
                      }}
                      className="bg-blue-100 px-2 py-0.5 rounded"
                    >
                      <Text className="text-[10px] font-bold text-blue-700">View Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function DailySummaryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // States
  const [dateFilter, setDateFilter] = useState(TODAY);
  const [stateFilter, setStateFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showStateModal, setShowStateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-daily-summary', dateFilter, stateFilter, roleFilter],
    queryFn: () =>
      summaryService.getDailySummary({
        date: dateFilter,
        state: stateFilter || undefined,
        role: roleFilter || undefined,
      }),
  });

  const allRows = data?.data ?? [];

  const filtered = useMemo(() => {
    let rows = allRows;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.reportingManagerName ?? '').toLowerCase().includes(q)
      );
    }

    if (attendanceFilter) {
      if (attendanceFilter === 'not_marked') {
        rows = rows.filter((r) => r.attendance === null);
      } else {
        rows = rows.filter((r) => r.attendance?.attendanceStatus === attendanceFilter);
      }
    }

    return rows;
  }, [allRows, searchTerm, attendanceFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter((r) => r.attendance?.attendanceStatus === 'present').length;
    const notMarked = filtered.filter((r) => r.attendance === null).length;
    return { total, present, notMarked };
  }, [filtered]);

  const clearFilters = () => {
    setSearchTerm('');
    setStateFilter('');
    setRoleFilter('');
    setAttendanceFilter('');
    setDateFilter(TODAY);
  };

  const handleExport = async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'There is no daily summary data to export.');
      return;
    }

    try {
      const csvRows = [];
      // Headers
      csvRows.push([
        'Employee Name',
        'Role',
        'State',
        'Reporting Manager',
        'Attendance Status',
        'Working Type',
        'Town',
        'Total Calls (TC)',
        'Productive Calls (PC)',
        'Order Value (POA)',
        'New Counters',
        'Time Spent (Mins)',
        'Attendance Remark',
        'I Am Here Address',
        'I Am Here Submitted At',
        'I Am Here Notes'
      ].join(','));

      // Rows
      for (const row of filtered) {
        const clean = (val: any) => {
          if (val === undefined || val === null) return '""';
          const str = String(val).trim();
          return `"${str.replace(/"/g, '""')}"`;
        };

        const status = row.attendance?.attendanceStatus ?? 'not_marked';
        const workingType = row.attendance?.workingType || '—';
        const town = row.attendance?.town || '—';
        const remark = row.attendance?.remark || '—';
        const timeSpent = row.timeSpentInMarketMinutes !== null && row.timeSpentInMarketMinutes !== undefined
          ? `${row.timeSpentInMarketMinutes}`
          : '—';

        csvRows.push([
          clean(row.name),
          clean(row.role),
          clean(row.state),
          clean(row.reportingManagerName),
          clean(status),
          clean(workingType),
          clean(town),
          clean(row.performance?.orderCount ?? 0),
          clean(row.performance?.productiveVisits ?? 0),
          clean(row.performance?.totalOrderAmount ?? 0),
          clean(row.totalNewCounters ?? 0),
          clean(timeSpent),
          clean(remark),
          clean(row.iAmHere?.locationAddress),
          clean(row.iAmHere?.visitedAt),
          clean(row.iAmHere?.notes)
        ].join(','));
      }

      const csvString = csvRows.join('\n');
      const filename = `Daily_Summary_Export_${dateFilter}_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const shareCsv = async () => {
          const fileUri = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: 'utf8' });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Export Daily Summary',
            });
          } else {
            Alert.alert('File Saved', `File saved to: ${filename}`);
          }
        };

        if (Platform.OS === 'android') {
          try {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              const mimeType = 'text/csv';
              const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                filename,
                mimeType
              );
              await FileSystem.writeAsStringAsync(fileUri, csvString, {
                encoding: 'utf8',
              });
              if (await Sharing.isAvailableAsync()) {
                Alert.alert('Export Successful', `File saved successfully to: ${filename}`, [
                  { text: 'OK' },
                  { text: 'Open / Share', onPress: shareCsv },
                ]);
              } else {
                Alert.alert('Export Successful', `File saved successfully to: ${filename}`);
              }
            } else {
              await shareCsv();
            }
          } catch (safErr) {
            console.warn('SAF export failed, using sharing fallback:', safErr);
            await shareCsv();
          }
        } else {
          // iOS sharing
          await shareCsv();
        }
      }
    } catch (err: any) {
      console.error('Summary export error:', err);
      Alert.alert('Error', err.message || 'Failed to export daily summary data.');
    }
  };

  // Helper labels
  const getRoleLabel = () => {
    if (roleFilter === 'nsm') return 'NSM';
    if (roleFilter === 'rsm') return 'RSM';
    if (roleFilter === 'asm') return 'ASM';
    if (roleFilter === 'so') return 'SO';
    if (roleFilter === 'ase') return 'ASE';
    return 'All Roles';
  };

  const getStatusLabel = () => {
    if (attendanceFilter === 'present') return 'Present';
    if (attendanceFilter === 'absent') return 'Absent';
    if (attendanceFilter === 'half_day') return 'Half Day';
    if (attendanceFilter === 'leave') return 'Leave';
    if (attendanceFilter === 'not_marked') return 'Not Marked';
    return 'All Status';
  };

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
            <Ionicons name="list-outline" size={24} color="#f97316" />
            <Text className="text-2xl font-bold text-gray-900">Daily Summary</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            Attendance and field activity overview for your team
          </Text>
        </View>

        {/* Filters Form Card */}
        <View className="mx-5 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm gap-3.5 mb-4">
          {/* Row 1: Search & Date picker */}
          <View className="flex-row gap-2">
            <View className="flex-1 flex-row items-center border border-gray-200 rounded-xl px-2.5 bg-white">
              <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-1.5" />
              <TextInput
                placeholder="Search name or manager..."
                placeholderTextColor="#9ca3af"
                value={searchTerm}
                onChangeText={setSearchTerm}
                className="flex-1 text-xs text-gray-800 p-0 h-9"
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowCalendar(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-3 bg-white h-9"
            >
              <Text className="text-xs text-gray-700">
                {dateFilter ? dateFilter.split('-').reverse().join('-') : 'dd-mm-yyyy'}
              </Text>
              <Ionicons name="calendar-outline" size={14} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Row 2: States, Roles, Status Selectors & Reset */}
          <View className="flex-row items-center gap-2">
            {/* State Picker */}
            <TouchableOpacity
              onPress={() => setShowStateModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-2.5 py-2 bg-white"
            >
              <Text className="text-[10px] text-gray-700 font-medium truncate" numberOfLines={1}>
                {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All States'}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#6b7280" />
            </TouchableOpacity>

            {/* Role Picker */}
            <TouchableOpacity
              onPress={() => setShowRoleModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-2.5 py-2 bg-white"
            >
              <Text className="text-[10px] text-gray-700 font-medium truncate" numberOfLines={1}>
                {getRoleLabel()}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#6b7280" />
            </TouchableOpacity>

            {/* Status Picker */}
            <TouchableOpacity
              onPress={() => setShowStatusModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-2.5 py-2 bg-white"
            >
              <Text className="text-[10px] text-gray-700 font-medium truncate" numberOfLines={1}>
                {getStatusLabel()}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#6b7280" />
            </TouchableOpacity>

            {/* Reset button */}
            <TouchableOpacity
              onPress={clearFilters}
              className="border border-gray-200 p-2 rounded-xl bg-white active:bg-gray-50"
            >
              <Ionicons name="refresh-outline" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Row 3: Export Button */}
          <View className="flex-row">
            <TouchableOpacity
              onPress={handleExport}
              className="flex-row items-center border border-gray-200 px-3 py-1.5 rounded-xl active:bg-gray-50"
            >
              <Ionicons name="download-outline" size={14} color="#4b5563" className="mr-1.5" />
              <Text className="text-xs font-semibold text-gray-700 mr-1">Export</Text>
              <Ionicons name="chevron-down" size={12} color="#4b5563" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Chips (Total, Present, Not Marked) */}
        <View className="px-5 mb-4 flex-row gap-2">
          <View className="flex-row items-center bg-white border border-gray-200 px-3 py-1 rounded-full">
            <View className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
            <Text className="text-xs font-semibold text-gray-600">{stats.total} Total</Text>
          </View>
          <View className="flex-row items-center bg-[#10b981]/5 border border-[#10b981]/25 px-3 py-1 rounded-full">
            <View className="w-2 h-2 rounded-full bg-[#10b981] mr-2" />
            <Text className="text-xs font-semibold text-emerald-700">{stats.present} Present</Text>
          </View>
          <View className="flex-row items-center bg-white border border-gray-200 px-3 py-1 rounded-full">
            <View className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
            <Text className="text-xs font-semibold text-gray-500">{stats.notMarked} Not Marked</Text>
          </View>
        </View>

        {/* Card List */}
        {isLoading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : filtered.length === 0 ? (
          <View className="py-20 justify-center items-center gap-2">
            <Ionicons name="calendar-outline" size={48} color="#9ca3af" className="opacity-50" />
            <Text className="text-sm text-gray-500 font-semibold">No attendance data matching filters</Text>
          </View>
        ) : (
          <View className="px-5 pb-24">
            {filtered.map((item) => (
              <MobileSummaryCard key={item.entityId} row={item} />
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

      {/* Role Filter Modal */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { value: '', label: 'All Roles' },
                { value: 'nsm', label: 'NSM' },
                { value: 'rsm', label: 'RSM' },
                { value: 'asm', label: 'ASM' },
                { value: 'so', label: 'SO' },
                { value: 'ase', label: 'ASE' }
              ]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setRoleFilter(item.value);
                    setShowRoleModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    roleFilter === item.value ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${roleFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {roleFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

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
              data={[
                { value: '', label: 'All Status' },
                { value: 'present', label: 'Present' },
                { value: 'absent', label: 'Absent' },
                { value: 'half_day', label: 'Half Day' },
                { value: 'leave', label: 'Leave' },
                { value: 'not_marked', label: 'Not Marked' }
              ]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setAttendanceFilter(item.value);
                    setShowStatusModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    attendanceFilter === item.value ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${attendanceFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {attendanceFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Calendar Picker Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={setDateFilter}
        currentValue={dateFilter}
      />
    </View>
  );
}

