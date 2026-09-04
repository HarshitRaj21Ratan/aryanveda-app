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
  Image,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { STATE_OPTIONS } from '@/lib/states';
import { attendanceService } from '@/services/attendance.service';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/auth.store';
import { UserRole, type AttendanceStatus, type WorkingType } from '@/types';

const { width } = Dimensions.get('window');

function statusBgClasses(status: string): string {
  if (status === 'present') return 'bg-emerald-50 border border-emerald-100';
  if (status === 'absent') return 'bg-red-50 border border-red-100';
  if (status === 'half_day') return 'bg-amber-50 border border-amber-100';
  return 'bg-violet-50 border border-violet-100';
}

function statusTextClasses(status: string): string {
  if (status === 'present') return 'text-emerald-700';
  if (status === 'absent') return 'text-red-700';
  if (status === 'half_day') return 'text-amber-700';
  return 'text-violet-755';
}

function formatAttendanceStatus(status: string): string {
  if (status === 'half_day') return 'Half Day';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatWorkingType(value: string): string {
  if (!value) return '-';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(date: string | Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  } catch (e) {
    return String(date);
  }
}

function formatDateTime(date: string | Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  } catch (e) {
    return String(date);
  }
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDaysRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

function thisMonthRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: toInputDate(from), to: toInputDate(to) };
}

// Custom Date Picker Modal Component
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
                  className={`w-[14%] h-9 items-center justify-center rounded-full ${isSelected ? 'bg-orange-50' : 'active:bg-gray-100'
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
            <Text className="text-xs font-bold text-[#f37021]">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Selector List Modal Component
function SelectorModal({ visible, onClose, data, selectedValue, onSelect, title }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[70%]">
          <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
            <Text className="font-bold text-gray-800 text-base">{title}</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${selectedValue === item.value ? 'bg-orange-50' : ''
                  }`}
              >
                <Text className={`text-xs ${selectedValue === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {selectedValue === item.value && <Ionicons name="checkmark" size={16} color="#f37021" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const getAvailableTargetRoles = (viewerRole: UserRole | undefined): UserRole[] => {
  if (!viewerRole) return [];
  switch (viewerRole) {
    case UserRole.ADMIN:
    case UserRole.NSM:
      return [UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM];
    case UserRole.RSM:
      return [UserRole.ASM, UserRole.SO, UserRole.ASE];
    case UserRole.ASM:
      return [UserRole.SO, UserRole.ASE];
    default:
      return [];
  }
};

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [selectedState, setSelectedState] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUserEntityIds, setSelectedUserEntityIds] = useState<string[]>([]);
  const [selectAllUsers, setSelectAllUsers] = useState(false);
  const [selectedUserEntityId, setSelectedUserEntityId] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [workingTypeFilter, setWorkingTypeFilter] = useState('');
  const [lateFilter, setLateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // UI states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showWorkingTypeModal, setShowWorkingTypeModal] = useState(false);
  const [showPunctualityModal, setShowPunctualityModal] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [selectedSelfie, setSelectedSelfie] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const viewerRole = user?.role as UserRole | undefined;

  // Debounced user search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(userSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [userSearch]);

  const shouldSearchUsers = !!selectedState && !!selectedRole && debouncedSearch.trim().length > 0;
  const shouldLoadStateUsers = !!selectedState && !!selectedRole;

  // Fetch users for search-select based on role scope
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-attendance-users', viewerRole, selectedState, selectedRole, debouncedSearch],
    queryFn: () => {
      const params = {
        limit: 500,
        role: (selectedRole as UserRole) || undefined,
        search: debouncedSearch.trim(),
        state: selectedState || undefined,
      };
      if (viewerRole === UserRole.ADMIN) {
        return userService.listAll(params);
      }
      return userService.listSubordinates(params);
    },
    enabled: shouldSearchUsers,
  });

  // Fetch users in State & Role
  const { data: stateUsersData, isLoading: stateUsersLoading } = useQuery({
    queryKey: ['admin-attendance-state-users', viewerRole, selectedState, selectedRole],
    queryFn: () => {
      const params = {
        limit: 500,
        role: (selectedRole as UserRole) || undefined,
        state: selectedState || undefined,
      };
      if (viewerRole === UserRole.ADMIN) {
        return userService.listAll(params);
      }
      return userService.listSubordinates(params);
    },
    enabled: shouldLoadStateUsers,
  });

  const validUsers = useMemo(() => {
    const raw = usersData?.data ?? [];
    return raw
      .filter((u: any) => [UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM].includes(u.role as UserRole))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [usersData]);

  const stateUsers = useMemo(() => {
    const raw = stateUsersData?.data ?? [];
    return raw
      .filter((u: any) => [UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM].includes(u.role as UserRole))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [stateUsersData]);

  const filteredUsers = useMemo(() => {
    if (debouncedSearch.trim().length > 0) {
      return validUsers;
    }
    return stateUsers;
  }, [validUsers, stateUsers, debouncedSearch]);

  const userLookup = useMemo(() => {
    const map = new Map<string, { entityId: string; name: string; role: string }>();
    for (const u of stateUsers) {
      map.set(u.entityId, { entityId: u.entityId, name: u.name, role: u.role });
    }
    for (const u of validUsers) {
      if (!map.has(u.entityId)) {
        map.set(u.entityId, { entityId: u.entityId, name: u.name, role: u.role });
      }
    }
    return map;
  }, [stateUsers, validUsers]);

  // Handle select all users in state
  React.useEffect(() => {
    if (!selectAllUsers) {
      return;
    }

    const allIds = stateUsers.map((u) => u.entityId);
    setSelectedUserEntityIds(allIds);
    if (allIds.length > 0) {
      setSelectedUserEntityId((prev) => (allIds.includes(prev) ? prev : allIds[0]));
    } else {
      setSelectedUserEntityId('');
    }
  }, [selectAllUsers, stateUsers]);

  // 2. Fetch Attendance Summary Metrics
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin-attendance-summary-v2', selectedUserEntityId, fromDate, toDate, statusFilter, workingTypeFilter, lateFilter],
    queryFn: () => {
      const lateVal = lateFilter === 'late' ? true : lateFilter === 'on_time' ? false : undefined;
      return attendanceService.getAdminAttendanceSummary(selectedUserEntityId, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        attendanceStatus: (statusFilter as AttendanceStatus) || undefined,
        workingType: (workingTypeFilter as WorkingType) || undefined,
        isLate: lateVal,
      });
    },
    enabled: !!selectedUserEntityId,
  });

  // 3. Fetch Attendance History Logs
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-attendance-history-v2', selectedUserEntityId, page, fromDate, toDate, statusFilter, workingTypeFilter, lateFilter],
    queryFn: () => {
      const lateVal = lateFilter === 'late' ? true : lateFilter === 'on_time' ? false : undefined;
      return attendanceService.getAdminAttendanceHistory(selectedUserEntityId, {
        page,
        limit: 15,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        attendanceStatus: (statusFilter as AttendanceStatus) || undefined,
        workingType: (workingTypeFilter as WorkingType) || undefined,
        isLate: lateVal,
      });
    },
    enabled: !!selectedUserEntityId,
  });

  const records = historyData?.data ?? [];
  const total = historyData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 15));

  const attendanceRate = summaryData?.total
    ? Math.round(((summaryData.present + summaryData.halfDay) / summaryData.total) * 100)
    : 0;

  const roleOptions = useMemo(() => {
    const allowed = getAvailableTargetRoles(viewerRole);
    const allOptions = [
      { value: UserRole.SO, label: 'Sales Officer (SO)' },
      { value: UserRole.ASE, label: 'ASE Agent' },
      { value: UserRole.ASM, label: 'Area Manager (ASM)' },
      { value: UserRole.RSM, label: 'Regional Manager (RSM)' },
    ];
    return allOptions.filter((o) => allowed.includes(o.value));
  }, [viewerRole]);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'present', label: 'Present' },
    { value: 'half_day', label: 'Half Day' },
    { value: 'absent', label: 'Absent' },
    { value: 'leave', label: 'Leave' },
  ];

  const workingTypeOptions = [
    { value: '', label: 'All Working Types' },
    { value: 'market_working', label: 'Market Working' },
    { value: 'joint_working', label: 'Joint Working' },
    { value: 'distribution_point_visit', label: 'Distribution Point Visit' },
    { value: 'super_point_visit', label: 'Super Point Visit' },
    { value: 'other', label: 'Other' },
  ];

  const punctualityOptions = [
    { value: 'all', label: 'All' },
    { value: 'late', label: 'Late only' },
    { value: 'on_time', label: 'On-time only' },
  ];

  const handleExport = async () => {
    if (!selectedUserEntityId) {
      Alert.alert('Selection Required', 'Please select a user to export attendance logs.');
      return;
    }
    if (records.length === 0) {
      Alert.alert('No Data', 'There are no attendance records to export.');
      return;
    }
    setIsExporting(true);
    try {
      const activeUser = userLookup.get(selectedUserEntityId);
      const userName = activeUser?.name || selectedUserEntityId;
      const { exportPaginatedData } = require('@/lib/xlsx-export');

      const baseParams = {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        attendanceStatus: (statusFilter as AttendanceStatus) || undefined,
        workingType: (workingTypeFilter as WorkingType) || undefined,
        isLate: lateFilter === 'late' ? true : lateFilter === 'on_time' ? false : undefined,
      };

      const rowMapper = (rec: any) => ({
        'User Name': userName,
        'User Role': activeUser?.role ? activeUser.role.toUpperCase() : '-',
        Date: formatDate(rec.markedAt),
        'Marked Time': formatDateTime(rec.markedAt),
        Status: formatAttendanceStatus(rec.attendanceStatus),
        'Working Type': formatWorkingType(rec.workingType),
        Punctuality: rec.isLate ? 'Late' : 'On Time',
        Remark: rec.remark?.trim() || '-',
      });

      await exportPaginatedData(
        (params: any) => attendanceService.getAdminAttendanceHistory(selectedUserEntityId, params),
        baseParams,
        rowMapper,
        {
          fileName: `attendance-${userName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`,
          sheetName: 'Team Attendance',
        }
      );
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Error', err.message || 'Failed to export attendance.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header Banner */}
      <View className="px-4 py-3 border-b border-gray-150 bg-white flex-row items-center gap-3">
        <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
          <Ionicons name="calendar-outline" size={22} color="#f97316" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800">Attendance Track</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            View attendance tracking for your team with selfie records.
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Filters Card Wrapper */}
        <View className="p-4 m-4 bg-white border border-gray-200 rounded-2xl shadow-sm gap-4" style={{ zIndex: 50 }}>
          {/* State Picker row */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">State</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {STATE_OPTIONS.map((opt) => {
                const isSelected = selectedState === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => {
                      setSelectedState(opt.value);
                      setSelectedRole('');
                      setSelectedUserEntityId('');
                      setSelectedUserEntityIds([]);
                      setSelectAllUsers(false);
                      setUserSearch('');
                    }}
                    className={`px-3 py-1.5 rounded-lg border ${isSelected ? 'bg-orange-550 border-[#f37021]' : 'bg-white border-gray-200'
                      }`}
                    style={isSelected && { backgroundColor: '#f37021' }}
                  >
                    <Text className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Role selector dropdown field */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</Text>
            <TouchableOpacity
              onPress={() => setShowRoleModal(true)}
              className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className={`text-xs ${selectedRole ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                {selectedRole ? roleOptions.find((r) => r.value === selectedRole)?.label : 'Select role'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Name Search field */}
          <View className="gap-1.5 relative z-10">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Name</Text>
            <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-2.5 bg-white">
              <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
              <TextInput
                value={userSearch}
                onChangeText={(text) => {
                  setUserSearch(text);
                  setShowUserSuggestions(true);
                }}
                onFocus={() => setShowUserSuggestions(true)}
                disabled={!selectedState}
                placeholder={selectedState ? 'Type name or entity ID' : 'Select state first'}
                placeholderTextColor="#9ca3af"
                className="flex-grow text-xs text-gray-800 p-0"
              />
              {!!userSearch && (
                <TouchableOpacity onPress={() => setUserSearch('')} className="p-0.5">
                  <Ionicons name="close-circle" size={14} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Subordinates User list chips / dropdown */}
            {selectedRole && showUserSuggestions && selectedState && userSearch.trim().length > 0 && (
              <>
                <TouchableOpacity
                  style={{ position: 'absolute', top: -1000, bottom: -1000, left: -1000, right: -1000, zIndex: 15 }}
                  activeOpacity={1}
                  onPress={() => setShowUserSuggestions(false)}
                />
                <View className="absolute left-0 right-0 top-[70px] bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-hidden z-20">
                  {usersLoading || stateUsersLoading ? (
                    <View className="p-3 items-center">
                      <ActivityIndicator size="small" color="#f97316" />
                    </View>
                  ) : filteredUsers.length === 0 ? (
                    <View className="p-3 items-center">
                      <Text className="text-xs text-gray-450">No users found</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={filteredUsers}
                      keyExtractor={(item) => item.entityId}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => {
                            if (!selectedUserEntityIds.includes(item.entityId)) {
                              setSelectedUserEntityIds((prev) => [...prev, item.entityId]);
                            }
                            setSelectedUserEntityId(item.entityId);
                            setUserSearch('');
                            setShowUserSuggestions(false);
                          }}
                          className={`p-3 border-b border-gray-100 flex-row justify-between items-center ${selectedUserEntityId === item.entityId ? 'bg-orange-50' : ''
                            }`}
                        >
                          <Text className="text-xs text-gray-800 font-semibold">{item.name}</Text>
                          <Text className="text-[10px] text-gray-400 font-bold uppercase">{item.role}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              </>
            )}
          </View>

          {/* Select All In State row */}
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              disabled={!selectedState || stateUsers.length === 0}
              onPress={() => {
                const next = !selectAllUsers;
                setSelectAllUsers(next);
                setUserSearch('');
                setShowUserSuggestions(false);
                if (!next) {
                  setSelectedUserEntityIds([]);
                  setSelectedUserEntityId('');
                }
                setPage(1);
              }}
              className={`px-3 py-2 rounded-lg border ${selectAllUsers ? 'bg-orange-50 border-[#f37021]' : 'bg-white border-gray-200'
                } ${(!selectedState || stateUsers.length === 0) ? 'opacity-50' : ''}`}
            >
              <Text className={`text-xs font-bold ${selectAllUsers ? 'text-[#f37021]' : 'text-gray-600'}`}>
                Select All In State ({stateUsers.length})
              </Text>
            </TouchableOpacity>
            <Text className="text-xs text-gray-500 font-medium">
              Selected: {selectAllUsers ? stateUsers.length : selectedUserEntityIds.length}
            </Text>
          </View>

          {/* Selected user chips */}
          {!selectAllUsers && selectedUserEntityIds.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1 flex-row">
              <View className="flex-row gap-1.5 pr-4 py-0.5">
                {selectedUserEntityIds.map((entityId) => {
                  const userRow = userLookup.get(entityId);
                  const isActive = selectedUserEntityId === entityId;
                  return (
                    <TouchableOpacity
                      key={entityId}
                      onPress={() => {
                        setSelectedUserEntityId(entityId);
                        setPage(1);
                      }}
                      className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border ${isActive ? 'bg-orange-50 border-[#f37021]' : 'bg-white border-gray-200'
                        }`}
                    >
                      <Text className={`text-[11px] font-semibold ${isActive ? 'text-[#f37021]' : 'text-gray-600'}`}>
                        {userRow?.name ?? entityId}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedUserEntityIds((prev) => prev.filter((id) => id !== entityId));
                          setSelectedUserEntityId((prev) => {
                            if (prev !== entityId) return prev;
                            const nextIds = selectedUserEntityIds.filter((id) => id !== entityId);
                            return nextIds[0] ?? '';
                          });
                          setPage(1);
                        }}
                        className="p-0.5 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="close" size={10} color="#6b7280" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Dynamic Timeline Dashboard Content */}
        {selectedUserEntityId ? (
          <View className="px-4 pb-24">
            {/* KPI Cards Grid */}
            <View className="flex-row flex-wrap gap-2.5 mb-5 justify-between">
              <View className="flex-1 min-w-[45%] bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                <Text className="text-[9px] font-bold text-slate-400 uppercase">Total Days</Text>
                <Text className="text-lg font-black text-slate-800 mt-1">{summaryLoading ? '...' : summaryData?.total ?? 0}</Text>
              </View>

              <View className="flex-1 min-w-[45%] bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                <Text className="text-[9px] font-bold text-slate-400 uppercase">Present + Half Day</Text>
                <Text className="text-lg font-black text-emerald-600 mt-1">
                  {summaryLoading ? '...' : (summaryData?.present ?? 0) + (summaryData?.halfDay ?? 0)}
                </Text>
                <Text className="text-[9px] text-slate-400 mt-0.5">{attendanceRate}% strength</Text>
              </View>

              <View className="flex-1 min-w-[45%] bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                <Text className="text-[9px] font-bold text-slate-400 uppercase">Late Marks</Text>
                <Text className="text-lg font-black text-amber-600 mt-1">{summaryLoading ? '...' : summaryData?.lateCount ?? 0}</Text>
              </View>

              <View className="flex-1 min-w-[45%] bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                <Text className="text-[9px] font-bold text-slate-400 uppercase">Leaves / Absent</Text>
                <Text className="text-lg font-black text-rose-600 mt-1">
                  {summaryLoading ? '...' : (summaryData?.leave ?? 0) + (summaryData?.absent ?? 0)}
                </Text>
              </View>
            </View>

            {/* Filters Card */}
            <View className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm gap-3.5 mb-4">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="funnel-outline" size={16} color="#f97316" />
                <Text className="text-sm font-bold text-gray-800">Filters</Text>
              </View>

              {/* Quick Date Selectors Row */}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    const range = lastNDaysRange(7);
                    setFromDate(range.from);
                    setToDate(range.to);
                    setPage(1);
                  }}
                  className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50"
                >
                  <Text className="text-xs text-gray-600 font-medium">Last 7 days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const range = lastNDaysRange(30);
                    setFromDate(range.from);
                    setToDate(range.to);
                    setPage(1);
                  }}
                  className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50"
                >
                  <Text className="text-xs text-gray-600 font-medium">Last 30 days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const range = thisMonthRange();
                    setFromDate(range.from);
                    setToDate(range.to);
                    setPage(1);
                  }}
                  className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50"
                >
                  <Text className="text-xs text-gray-600 font-medium">This month</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setFromDate('');
                    setToDate('');
                    setStatusFilter('');
                    setWorkingTypeFilter('');
                    setLateFilter('all');
                    setPage(1);
                  }}
                  className="flex-1 border border-gray-200 py-2 rounded-xl bg-white items-center active:bg-gray-50 flex-row justify-center gap-1"
                >
                  <Ionicons name="refresh-outline" size={12} color="#6b7280" />
                  <Text className="text-xs text-gray-600 font-medium">Reset</Text>
                </TouchableOpacity>
              </View>

              {/* Date Range selectors */}
              <View className="flex-row gap-2">
                <View className="flex-1">
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

                <View className="flex-1">
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

              {/* Selectors */}
              <View className="gap-2">
                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Attendance Status</Text>
                  <TouchableOpacity
                    onPress={() => setShowStatusModal(true)}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <Text className="text-xs text-gray-700 font-medium">
                      {statusFilter ? statusOptions.find(o => o.value === statusFilter)?.label : 'All Statuses'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Working Type</Text>
                  <TouchableOpacity
                    onPress={() => setShowWorkingTypeModal(true)}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <Text className="text-xs text-gray-700 font-medium">
                      {workingTypeFilter ? workingTypeOptions.find(o => o.value === workingTypeFilter)?.label : 'All Working Types'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Punctuality</Text>
                  <TouchableOpacity
                    onPress={() => setShowPunctualityModal(true)}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <Text className="text-xs text-gray-700 font-medium">
                      {lateFilter === 'late' ? 'Late only' : lateFilter === 'on_time' ? 'On-time only' : 'All'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Timeline Header */}
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Timeline</Text>
              <View className="flex-row items-center gap-3">
                <Text className="text-[11px] text-gray-400 font-bold">
                  {total} record{total === 1 ? '' : 's'}
                </Text>
                {records.length > 0 && (
                  <TouchableOpacity
                    onPress={handleExport}
                    disabled={isExporting}
                    className="flex-row items-center border border-gray-200 bg-white rounded-lg px-2.5 py-1 gap-1.5 shadow-sm active:bg-gray-50"
                  >
                    <Ionicons name="download-outline" size={14} color="#f97316" />
                    <Text className="text-[#f97316] text-[11px] font-bold">
                      {isExporting ? 'Exporting...' : 'Export XLSX'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* History logs timeline table */}
            {historyLoading ? (
              <ActivityIndicator size="large" color="#f97316" className="my-8" />
            ) : records.length === 0 ? (
              <View className="bg-white border border-gray-200 rounded-2xl p-8 items-center justify-center">
                <Ionicons name="time-outline" size={32} color="#9ca3af" className="opacity-40" />
                <Text className="text-xs text-gray-400 mt-2">No logs found matching filters</Text>
              </View>
            ) : (
              <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  contentContainerStyle={{ minWidth: 920 }}
                  style={{ width: '100%' }}
                >
                  <View style={{ minWidth: 920, flexDirection: 'column' }}>
                    {/* Table Header */}
                    <View className="flex-row border-b border-gray-250 bg-slate-50/80 py-3 px-4">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 140, flexShrink: 0 }}>Date & Time</Text>
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 100, flexShrink: 0 }}>Status</Text>
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 190, flexShrink: 0 }}>Working Type</Text>
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 120, flexShrink: 0 }}>Punctuality</Text>
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: 250, flexShrink: 0 }}>Remark</Text>
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center" style={{ width: 120, flexShrink: 0 }}>Selfie</Text>
                    </View>

                    {/* Table Rows */}
                    {records.map((rec: any) => {
                      const formattedDate = formatDate(rec.markedAt);
                      const formattedTime = formatDateTime(rec.markedAt);
                      return (
                        <View key={rec.attendanceId} className="flex-row border-b border-gray-100 py-3 px-4 items-center">
                          {/* Date & Time */}
                          <View style={{ width: 140, flexShrink: 0 }}>
                            <Text className="text-xs font-semibold text-slate-800">{formattedDate}</Text>
                            <Text className="text-[10px] text-gray-400 mt-0.5">{formattedTime}</Text>
                          </View>

                          {/* Status */}
                          <View style={{ width: 100, flexShrink: 0 }}>
                            <View className={`px-2.5 py-0.5 rounded-full self-start ${statusBgClasses(rec.attendanceStatus)}`}>
                              <Text className={`text-[9px] font-bold ${statusTextClasses(rec.attendanceStatus)}`}>{formatAttendanceStatus(rec.attendanceStatus)}</Text>
                            </View>
                          </View>

                          {/* Working Type */}
                          <View style={{ width: 190, flexShrink: 0, paddingRight: 8 }}>
                            <Text className="text-xs text-slate-700 font-medium">{formatWorkingType(rec.workingType)}</Text>
                          </View>

                          {/* Punctuality */}
                          <View style={{ width: 120, flexShrink: 0 }}>
                            <View className={`px-2.5 py-0.5 rounded-full self-start ${rec.isLate ? 'bg-amber-50 border border-amber-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                              <Text className={`text-[9px] font-bold ${rec.isLate ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {rec.isLate ? 'Late' : 'On Time'}
                              </Text>
                            </View>
                          </View>

                          {/* Remark */}
                          <View style={{ width: 250, flexShrink: 0, paddingRight: 12 }}>
                            <Text className="text-xs text-slate-600 italic" numberOfLines={2}>
                              {rec.remark?.trim() || '-'}
                            </Text>
                          </View>

                          {/* Selfie */}
                          <View style={{ width: 120, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
                            {rec.selfieUrl ? (
                              <TouchableOpacity
                                onPress={() => setSelectedSelfie(rec)}
                                className="flex-row items-center gap-1 border border-gray-200 px-2 py-1 bg-gray-50/50 rounded-lg"
                              >
                                <Ionicons name="camera-outline" size={12} color="#f97316" />
                                <Text className="text-[10px] font-bold text-[#f97316]">View</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text className="text-xs text-gray-400">-</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Pagination footer */}
            {totalPages > 1 && (
              <View className="flex-row items-center justify-between py-4 mt-4 border-t border-gray-100 bg-white px-2">
                <Text className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    disabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    className={`p-2 border rounded-lg ${page <= 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                      }`}
                  >
                    <Ionicons name="chevron-back" size={16} color="#374151" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={page >= totalPages}
                    onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={`p-2 border rounded-lg ${page >= totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                      }`}
                  >
                    <Ionicons name="chevron-forward" size={16} color="#374151" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View className="items-center justify-center p-12 mt-4">
            <Ionicons name="time-outline" size={48} color="#9ca3af" className="opacity-45" />
            <Text className="text-xs text-slate-400 mt-3 text-center leading-normal">
              {!selectedState
                ? 'Select state first to load attendance users.'
                : !selectAllUsers && selectedUserEntityIds.length === 0
                  ? 'Select one or more users to view and export attendance.'
                  : 'Select an active user chip to view detailed attendance timeline.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Role Picker Modal */}
      <SelectorModal
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        data={roleOptions}
        selectedValue={selectedRole}
        onSelect={(val: string) => {
          setSelectedRole(val);
          setSelectedUserEntityId('');
          setUserSearch('');
        }}
        title="Select Role"
      />

      {/* Status Picker Modal */}
      <SelectorModal
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        data={statusOptions}
        selectedValue={statusFilter}
        onSelect={(val: string) => {
          setStatusFilter(val);
          setPage(1);
        }}
        title="Filter Attendance Status"
      />

      {/* Working Type Picker Modal */}
      <SelectorModal
        visible={showWorkingTypeModal}
        onClose={() => setShowWorkingTypeModal(false)}
        data={workingTypeOptions}
        selectedValue={workingTypeFilter}
        onSelect={(val: string) => {
          setWorkingTypeFilter(val);
          setPage(1);
        }}
        title="Filter Working Type"
      />

      {/* Punctuality Picker Modal */}
      <SelectorModal
        visible={showPunctualityModal}
        onClose={() => setShowPunctualityModal(false)}
        data={punctualityOptions}
        selectedValue={lateFilter}
        onSelect={(val: string) => {
          setLateFilter(val);
          setPage(1);
        }}
        title="Filter Punctuality"
      />

      {/* Calendar modals */}
      <CalendarModal
        visible={showStartCalendar}
        onClose={() => setShowStartCalendar(false)}
        onSelectDate={(date) => {
          setFromDate(date);
          setPage(1);
        }}
        currentValue={fromDate}
      />

      <CalendarModal
        visible={showEndCalendar}
        onClose={() => setShowEndCalendar(false)}
        onSelectDate={(date) => {
          setToDate(date);
          setPage(1);
        }}
        currentValue={toDate}
      />

      {/* Selfie Detail Modal */}
      {selectedSelfie && (
        <Modal visible={!!selectedSelfie} transparent animationType="fade" onRequestClose={() => setSelectedSelfie(null)}>
          <View className="flex-1 bg-black/70 justify-center items-center p-6">
            <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl p-4 relative">
              <TouchableOpacity
                onPress={() => setSelectedSelfie(null)}
                className="absolute right-3 top-3 bg-white/80 rounded-full p-1.5 z-10 border border-gray-200 shadow-sm"
              >
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
              <Image
                source={{ uri: selectedSelfie.selfieUrl }}
                style={{ width: '100%', height: 350, borderRadius: 12 }}
                resizeMode="cover"
              />
              <View className="mt-3.5 items-center">
                <Text className="font-bold text-slate-800 text-sm">{selectedSelfie.attendanceDateKey}</Text>
                <Text className="text-xs text-gray-500 mt-1 uppercase font-semibold">
                  {formatAttendanceStatus(selectedSelfie.attendanceStatus)} ({formatWorkingType(selectedSelfie.workingType)})
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
