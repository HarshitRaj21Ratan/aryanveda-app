import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Image,
  Linking,
  Dimensions,
  Alert,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { visitService, type VisitPerformancePeriod } from '@/services/visit.service';
import { userService } from '@/services/user.service';
import { STATE_OPTIONS } from '@/lib/states';
import { NewCountersModal } from '@/components/performance/PerformanceComponents';

const { width } = Dimensions.get('window');

function toInputDate(d: Date): string {
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const localTime = d.getTime() + tzOffset;
    const localDate = new Date(localTime);
    return localDate.toISOString().slice(0, 10);
  }
}

function lastNDaysRange(n: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (n - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

function thisMonthRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: toInputDate(from), to: toInputDate(to) };
}

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0';
  if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(1) + 'L';
  }
  if (num >= 1000) {
    return '₹' + (num / 1000).toFixed(0) + 'k';
  }
  return '₹' + num.toString();
}

function formatVisitTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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
            <Text className="text-xs font-bold text-gray-500">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AdminPerformanceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const viewerRole = user?.role as UserRole | undefined;
  const canUse = Boolean(viewerRole && [UserRole.ADMIN, UserRole.NSM, UserRole.RSM, UserRole.ASM, UserRole.ASE].includes(viewerRole));

  const allowedStates = useMemo(() => {
    if (viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) return STATE_OPTIONS.map(s => s.value);
    if (!user?.state) return [];
    return user.state.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }, [viewerRole, user?.state]);

  useEffect(() => {
    if (user && user.role === UserRole.SO) {
      router.replace('/performance');
    }
  }, [user, router]);

  const initialRange = useMemo(() => lastNDaysRange(30), []);

  // Filter States
  const [selectedStates, setSelectedStates] = useState<string[]>(
    (viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) ? ['ALL'] : (allowedStates.length > 0 ? [allowedStates[0]] : [])
  );

  useEffect(() => {
    if (selectedStates.length === 0 && allowedStates.length > 0) {
      setSelectedStates(viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM || allowedStates.length > 1 ? ['ALL'] : [allowedStates[0]]);
    }
  }, [allowedStates, selectedStates.length, viewerRole]);

  const [selectedRoles, setSelectedRoles] = useState<string[]>(['ALL']);
  const [soSearch, setSoSearch] = useState('');
  const [showSoSuggestions, setShowSoSuggestions] = useState(false);
  const [selectedSoId, setSelectedSoId] = useState('');
  const [selectedSoIds, setSelectedSoIds] = useState<string[]>([]);
  const [selectAllSos, setSelectAllSos] = useState(false);

  const [period, setPeriod] = useState<VisitPerformancePeriod>('day');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);

  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const [activeTab, setActiveTab] = useState<'recent-visits' | 'iamhere-logs'>('recent-visits');
  const [showVisitImage, setShowVisitImage] = useState<{ retailerName: string; visitDateKey: string; proofImageUrl: string } | null>(null);
  const [showRemark, setShowRemark] = useState<string | null>(null);

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (activeSoIds.length === 0) {
      Alert.alert('No Users Selected', 'Please select at least one Sales Officer to export.');
      return;
    }

    setIsExporting(true);
    try {
      const { downloadAdminPerformanceReport } = require('@/lib/xlsx-export');
      await downloadAdminPerformanceReport({
        soEntityIds: activeSoIds,
        period,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        state: selectedStates.includes('ALL') ? undefined : selectedStates.join(','),
        selectAll: selectAllSos,
      });
    } catch (err: any) {
      console.error('Export performance error:', err);
      Alert.alert('Export Error', err.message || 'Failed to export performance report.');
    } finally {
      setIsExporting(false);
    }
  };

  // Debounced search
  const [debouncedSoSearch, setDebouncedSoSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSoSearch(soSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [soSearch]);

  const shouldLoadAll = canUse && selectedStates.length > 0;
  const selectedStateParam = useMemo(() => {
    return selectedStates.includes('ALL') || selectedStates.length === 0 ? undefined : selectedStates.join(',');
  }, [selectedStates]);

  // Queries
  const { data: statesList } = useQuery({
    queryKey: ['admin-perf-states'],
    queryFn: () => userService.listUniqueStates(),
    staleTime: 5 * 60 * 1000,
  });

  const rolesToFetch = useMemo(() => {
    if (viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) {
      return [UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM];
    }
    if (viewerRole === UserRole.RSM) {
      return [UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM];
    }
    if (viewerRole === UserRole.ASM) {
      return [UserRole.SO, UserRole.ASE, UserRole.ASM];
    }
    if (viewerRole === UserRole.ASE) {
      return [UserRole.SO];
    }
    return [UserRole.SO];
  }, [viewerRole]);

  const { data: allSoData, isLoading: allSoLoading } = useQuery({
    queryKey: ['admin-perf-all-so', viewerRole, selectedStateParam],
    queryFn: async () => {
      const fetcher = viewerRole === UserRole.ADMIN ? userService.listAll : userService.listSubordinates;
      const res = await fetcher({ limit: 1000, state: selectedStateParam, role: 'so,ase,asm,rsm' });
      const rawData = res.data ?? [];
      const uniqueData = Array.from(new Map(rawData.map((u) => [u.entityId, u])).values());
      return { data: uniqueData, total: uniqueData.length };
    },
    enabled: shouldLoadAll,
    staleTime: 5 * 60 * 1000,
  });

  const allSos = useMemo(() => {
    const raw = (allSoData?.data ?? []).filter((u) => (selectedRoles.includes('ALL') || selectedRoles.includes(u.role)) && [UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM].includes(u.role as UserRole));
    const seen = new Set<string>();
    const out: typeof raw = [];
    for (const u of raw) {
      if (u.entityId && !seen.has(u.entityId)) {
        seen.add(u.entityId);
        out.push(u);
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [allSoData, selectedRoles]);

  // Instant In-Memory Search over fetched users (0ms network latency)
  const searchUsers = useMemo(() => {
    if (!debouncedSoSearch.trim()) return allSos;
    const q = debouncedSoSearch.trim().toLowerCase();
    return allSos.filter((u) => u.name.toLowerCase().includes(q) || u.entityId.toLowerCase().includes(q));
  }, [allSos, debouncedSoSearch]);

  const searchLoading = allSoLoading;

  // Restrict selected/active SO IDs strictly to currently available allSos
  const validSoIdsSet = useMemo(() => new Set(allSos.map((u) => u.entityId)), [allSos]);

  // Sync Select All & Clean Stale Selections
  useEffect(() => {
    if (selectAllSos) {
      const ids = allSos.map((u) => u.entityId);
      setSelectedSoIds(ids);
      if (ids.length > 0) setSelectedSoId((p) => (ids.includes(p) ? p : ids[0]));
      else setSelectedSoId('');
    } else {
      setSelectedSoIds((prev) => prev.filter((id) => validSoIdsSet.has(id)));
    }
  }, [selectAllSos, allSos, validSoIdsSet]);

  const activeSoIds = useMemo(() => {
    const rawIds = selectAllSos ? allSos.map((u) => u.entityId) : selectedSoIds;
    const cleanIds = rawIds.map((id) => (typeof id === 'string' ? id.trim() : id)).filter(Boolean);
    return Array.from(new Set(cleanIds)).filter((id) => validSoIdsSet.has(id));
  }, [selectAllSos, allSos, selectedSoIds, validSoIdsSet]);

  const { data: perfData, isLoading: dataLoading, isError, refetch } = useQuery({
    queryKey: ['admin-perf-data-v2', activeSoIds.join(','), period, fromDate, toDate, selectedStateParam],
    queryFn: async () => {
      try {
        return await visitService.getAdminPerformance(
          activeSoIds,
          period,
          fromDate || undefined,
          toDate || undefined,
          undefined,
          selectedStateParam
        );
      } catch (err: any) {
        console.warn('Bulk getAdminPerformance failed, running per-SO fallback:', err?.message);
        const results = await Promise.allSettled(
          activeSoIds.map((id) =>
            visitService.getAdminPerformance(
              id,
              period,
              fromDate || undefined,
              toDate || undefined,
              undefined,
              selectedStateParam
            )
          )
        );
        const fulfilled = results
          .filter((r): r is PromiseFulfilledResult<VisitPerformance> => r.status === 'fulfilled')
          .map((r) => r.value);

        if (fulfilled.length === 0) {
          throw err;
        }

        const combinedSummary = fulfilled.reduce(
          (acc, item) => ({
            totalVisits: acc.totalVisits + (item.summary?.totalVisits || 0),
            productiveVisits: acc.productiveVisits + (item.summary?.productiveVisits || 0),
            visitedOnlyVisits: acc.visitedOnlyVisits + (item.summary?.visitedOnlyVisits || 0),
            productivityRate: 0,
            totalOrdersFromVisits: acc.totalOrdersFromVisits + (item.summary?.totalOrdersFromVisits || 0),
            productiveOrderAmount: acc.productiveOrderAmount + (item.summary?.productiveOrderAmount || 0),
            totalTimeSpentMinutes: acc.totalTimeSpentMinutes + (item.summary?.totalTimeSpentMinutes || 0),
            averageTimeSpentMinutes: acc.averageTimeSpentMinutes + (item.summary?.averageTimeSpentMinutes || 0),
            newCountersAdded: acc.newCountersAdded + (item.summary?.newCountersAdded || 0),
            newDistributorsAdded: acc.newDistributorsAdded + (item.summary?.newDistributorsAdded || 0),
            newSupersAdded: acc.newSupersAdded + (item.summary?.newSupersAdded || 0),
          }),
          {
            totalVisits: 0,
            productiveVisits: 0,
            visitedOnlyVisits: 0,
            productivityRate: 0,
            totalOrdersFromVisits: 0,
            productiveOrderAmount: 0,
            totalTimeSpentMinutes: 0,
            averageTimeSpentMinutes: 0,
            newCountersAdded: 0,
            newDistributorsAdded: 0,
            newSupersAdded: 0,
          }
        );

        if (combinedSummary.totalVisits > 0) {
          combinedSummary.productivityRate = Math.round((combinedSummary.productiveVisits / combinedSummary.totalVisits) * 100);
        }

        const bucketMap = new Map<string, VisitPerformanceBucket>();
        for (const f of fulfilled) {
          for (const b of f.buckets || []) {
            const existing = bucketMap.get(b.key) || { ...b, visits: 0, productive: 0, visitedOnly: 0, productivityRate: 0 };
            existing.visits += b.visits;
            existing.productive += b.productive;
            existing.visitedOnly += b.visitedOnly;
            if (existing.visits > 0) {
              existing.productivityRate = Math.round((existing.productive / existing.visits) * 100);
            }
            bucketMap.set(b.key, existing);
          }
        }

        const allRecent = fulfilled.flatMap((f) => f.recentVisits || []);
        const uniqueRecentMap = new Map<string, VisitPerformanceRecentRow>();
        for (const v of allRecent) {
          uniqueRecentMap.set(v.visitId, v);
        }

        return {
          period,
          summary: combinedSummary,
          buckets: Array.from(bucketMap.values()),
          recentVisits: Array.from(uniqueRecentMap.values()).sort(
            (a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()
          ),
        };
      }
    },
    enabled: activeSoIds.length > 0 && !allSoLoading,
    staleTime: 30 * 1000,
  });

  const [showNewCountersModal, setShowNewCountersModal] = useState(false);
  const [newCountersType, setNewCountersType] = useState<'retailer' | 'distributor_super'>('retailer');

  const userLookup = useMemo(() => {
    const m = new Map<string, any>();
    for (const u of allSos) {
      m.set(u.entityId, u);
    }
    return m;
  }, [allSos]);

  const activeSoRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const id of activeSoIds) {
      const u = userLookup.get(id);
      if (u?.role) roles.add(u.role);
    }
    return Array.from(roles);
  }, [activeSoIds, userLookup]);

  const hasSoOrAse = useMemo(() => {
    if (activeSoIds.length === 0) return false;
    return activeSoIds.some((id) => {
      const u = userLookup.get(id);
      return u?.role === UserRole.SO || u?.role === UserRole.ASE;
    });
  }, [activeSoIds, userLookup]);

  const hasAsmOrRsm = useMemo(() => {
    if (activeSoIds.length === 0) return false;
    return activeSoIds.some((id) => {
      const u = userLookup.get(id);
      return u?.role === UserRole.ASM || u?.role === UserRole.RSM;
    });
  }, [activeSoIds, userLookup]);

  const applyRange = (type: '7d' | '30d' | 'month') => {
    const range = type === 'month' ? thisMonthRange() : lastNDaysRange(type === '7d' ? 7 : 30);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const clearFilters = () => {
    setFromDate(initialRange.from);
    setToDate(initialRange.to);
  };

  const openMap = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url);
  };

  const maxVisits = useMemo(() => {
    const vals = perfData?.buckets.map((b) => b.visits) ?? [];
    return vals.length ? Math.max(1, ...vals) : 1;
  }, [perfData]);

  const toggleSoSelection = (id: string) => {
    setSelectAllSos(false);
    setSelectedSoIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const recentVisits = perfData?.recentVisits ?? [];
  const nonIAmHereVisits = useMemo(() => recentVisits.filter((v) => !v.isIAmHere), [recentVisits]);
  const iAmHereVisits = useMemo(() => recentVisits.filter((v) => v.isIAmHere), [recentVisits]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header (No back button, treated as top-level page) */}
      <View className="px-4 py-3 border-b border-gray-150 bg-white flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Ionicons name="stats-chart" size={22} color="#f97316" className="mt-0.5" />
          <View>
            <Text className="text-lg font-bold text-gray-800">Performance Track</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Track store visit productivity across Sales Officers</Text>
          </View>
        </View>

        {/* Export Button */}
        {perfData && !dataLoading && (
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting}
            className="flex-row items-center bg-white border border-gray-200 px-3 py-1.5 rounded-xl active:bg-gray-50"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#f97316" className="mr-1.5" />
            ) : (
              <Ionicons name="download-outline" size={14} color="#f97316" className="mr-1.5" />
            )}
            <Text className="text-xs font-semibold text-gray-700">
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        {/* Selection Configuration Panel */}
        <View className="m-4 bg-white border border-gray-200 p-4 rounded-2xl gap-4 shadow-sm">
          {/* State selector */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">State</Text>
            {viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM || allowedStates.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 py-0.5">
                <TouchableOpacity
                  onPress={() => {
                    setSelectedStates((viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) ? ['ALL'] : [...allowedStates]);
                    setSoSearch('');
                    setShowSoSuggestions(false);
                    setSelectAllSos(false);
                    setSelectedSoIds([]);
                    setSelectedSoId('');
                  }}
                  className={`px-3 py-1.5 rounded-lg border ${((viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) && selectedStates.includes('ALL')) || (!(viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) && selectedStates.length === allowedStates.length)
                    ? 'bg-orange-50 border-orange-300'
                    : 'bg-white border-gray-200'
                    }`}
                >
                  <Text className={`text-xs font-semibold ${((viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) && selectedStates.includes('ALL')) || (!(viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM) && selectedStates.length === allowedStates.length)
                    ? 'text-orange-700'
                    : 'text-gray-600'
                    }`}>
                    {viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM ? 'All States' : 'All Allowed States'}
                  </Text>
                </TouchableOpacity>
                {(viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM ? STATE_OPTIONS.map(s => s.value) : allowedStates).map((st) => {
                  const label = STATE_OPTIONS.find(o => o.value === st.toLowerCase())?.label || (typeof st === 'string' ? st.charAt(0).toUpperCase() + st.slice(1) : '');
                  const isSelected = selectedStates.includes(st) && !selectedStates.includes('ALL') && selectedStates.length !== allowedStates.length;
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => {
                        setSelectedStates((prev) => {
                          const clean = prev.filter((x) => x !== 'ALL');
                          if (clean.includes(st)) {
                            const res = clean.filter((x) => x !== st);
                            return res.length === 0 ? (viewerRole === UserRole.ADMIN || viewerRole === UserRole.NSM || allowedStates.length > 1 ? ['ALL'] : [allowedStates[0]]) : res;
                          } else {
                            return [...clean, st];
                          }
                        });
                        setSoSearch('');
                        setShowSoSuggestions(false);
                        setSelectAllSos(false);
                        setSelectedSoIds([]);
                        setSelectedSoId('');
                      }}
                      className={`px-3 py-1.5 rounded-lg border ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                        }`}
                    >
                      <Text className={`text-xs font-semibold capitalize ${isSelected ? 'text-orange-700' : 'text-gray-600'}`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View className="flex-row py-0.5">
                <View className="px-3 py-1.5 rounded-lg border border-orange-250 bg-orange-50 opacity-80">
                  <Text className="text-xs font-semibold text-orange-700 capitalize">
                    {STATE_OPTIONS.find(o => o.value === allowedStates[0])?.label || allowedStates[0]}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Role selector */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role</Text>
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={() => {
                  setSelectedRoles(['ALL']);
                  setSoSearch('');
                  setShowSoSuggestions(false);
                  setSelectAllSos(false);
                  setSelectedSoIds([]);
                  setSelectedSoId('');
                }}
                className={`px-3.5 py-1.5 rounded-lg border ${selectedRoles.includes('ALL') ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                  }`}
              >
                <Text className={`text-xs font-semibold ${selectedRoles.includes('ALL') ? 'text-orange-700' : 'text-gray-600'}`}>
                  All Roles
                </Text>
              </TouchableOpacity>
              {[
                { role: UserRole.SO, label: 'SO' },
                { role: UserRole.ASE, label: 'ASE' },
                { role: UserRole.ASM, label: 'ASM' },
                { role: UserRole.RSM, label: 'RSM' },
              ].filter((r) => rolesToFetch.includes(r.role)).map((r) => {
                const isSelected = selectedRoles.includes(r.role) && !selectedRoles.includes('ALL');
                return (
                  <TouchableOpacity
                    key={r.role}
                    onPress={() => {
                      setSelectedRoles((prev) => {
                        const clean = prev.filter((x) => x !== 'ALL');
                        if (clean.includes(r.role)) {
                          const res = clean.filter((x) => x !== r.role);
                          return res.length === 0 ? ['ALL'] : res;
                        } else {
                          return [...clean, r.role];
                        }
                      });
                      setSoSearch('');
                      setShowSoSuggestions(false);
                      setSelectAllSos(false);
                      setSelectedSoIds([]);
                      setSelectedSoId('');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg border ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
                      }`}
                  >
                    <Text className={`text-xs font-semibold ${isSelected ? 'text-orange-700' : 'text-gray-600'}`}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* User Search & Suggestions */}
          <View className="gap-2 relative">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search User</Text>
            <View className="flex-row items-center border border-gray-200 bg-gray-50 rounded-xl px-3 py-1.5">
              <Ionicons name="search-outline" size={18} color="#9ca3af" className="mr-2" />
              <TextInput
                placeholder="Select or type to search..."
                placeholderTextColor="#9ca3af"
                value={soSearch}
                onFocus={() => setShowSoSuggestions(true)}
                onChangeText={(text) => {
                  setSoSearch(text);
                  setShowSoSuggestions(true);
                }}
                className="flex-grow text-xs text-gray-800 p-0 py-1"
              />
              {soSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSoSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {showSoSuggestions && (
              <View className="absolute top-[68px] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-hidden">
                <ScrollView nestedScrollEnabled className="p-1">
                  {(searchLoading || allSoLoading) ? (
                    <Text className="text-xs text-gray-400 p-3 italic">Loading users...</Text>
                  ) : (soSearch.trim().length > 0 ? searchUsers : allSos).length === 0 ? (
                    <Text className="text-xs text-gray-400 p-3 italic">No matching users found.</Text>
                  ) : (
                    (soSearch.trim().length > 0 ? searchUsers : allSos).map((u) => {
                      const isSelected = selectedSoIds.includes(u.entityId);
                      return (
                        <TouchableOpacity
                          key={u.entityId}
                          onPress={() => {
                            toggleSoSelection(u.entityId);
                            setSoSearch('');
                            setShowSoSuggestions(false);
                          }}
                          className={`p-3 border-b border-gray-100 flex-row justify-between items-center ${isSelected ? 'bg-orange-50/50' : 'active:bg-gray-50'
                            }`}
                        >
                          <View>
                            <Text className="text-xs font-bold text-gray-800">{u.name}</Text>
                            <Text className="text-[10px] text-gray-400 mt-0.5">{u.entityId} · {u.role.toUpperCase()}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={16} color="#f37021" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Select all & Chips */}
          <View className="flex-row items-center justify-between mt-1">
            <TouchableOpacity
              onPress={() => {
                const next = !selectAllSos;
                setSelectAllSos(next);
                if (!next) {
                  setSelectedSoIds([]);
                }
              }}
              className={`px-3 py-1.5 border rounded-lg ${selectAllSos ? 'bg-orange-50 border-orange-200' : 'border-gray-200 bg-white'
                }`}
            >
              <Text className={`text-[10px] font-bold ${selectAllSos ? 'text-orange-700' : 'text-gray-500'}`}>
                Select All ({allSos.length})
              </Text>
            </TouchableOpacity>
            <Text className="text-[10px] font-bold text-gray-400">
              Selected: {selectAllSos ? allSos.length : selectedSoIds.length}
            </Text>
          </View>

          {/* Active Chips */}
          {!selectAllSos && selectedSoIds.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 py-0.5">
              {selectedSoIds.map((id) => {
                const u = userLookup.get(id);
                return (
                  <View
                    key={id}
                    className="bg-orange-50 border border-orange-100 rounded-full px-3 py-1 flex-row items-center gap-1.5"
                  >
                    <Text className="text-[10px] font-bold text-orange-800">{u?.name || id}</Text>
                    <TouchableOpacity onPress={() => toggleSoSelection(id)}>
                      <Ionicons name="close-circle" size={14} color="#f37021" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Date Ranges & Grouping Configuration */}
        <View className="mx-4 bg-white border border-gray-200 p-4 rounded-2xl gap-3.5 shadow-sm">
          <View className="flex-row items-center gap-2 border-b border-gray-100 pb-2">
            <Ionicons name="funnel-outline" size={16} color="#f37021" />
            <Text className="text-xs font-bold text-gray-800">Date Range Filters</Text>
          </View>

          {/* Range Shortcuts */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => applyRange('7d')}
              className="flex-1 items-center justify-center border border-gray-250 bg-white rounded-xl py-2"
            >
              <Text className="text-slate-700 text-xs font-semibold">Last 7 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyRange('30d')}
              className="flex-1 items-center justify-center border border-gray-250 bg-white rounded-xl py-2"
            >
              <Text className="text-slate-700 text-xs font-semibold">Last 30 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyRange('month')}
              className="flex-1 items-center justify-center border border-gray-250 bg-white rounded-xl py-2"
            >
              <Text className="text-slate-700 text-xs font-semibold">This month</Text>
            </TouchableOpacity>

            {(!!fromDate || !!toDate) && (
              <TouchableOpacity
                onPress={clearFilters}
                className="items-center justify-center border border-orange-250 bg-orange-50 rounded-xl px-3 py-2"
              >
                <Ionicons name="refresh-outline" size={16} color="#f37021" />
              </TouchableOpacity>
            )}
          </View>

          {/* Date Picker Manual Inputs */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">From</Text>
              <TouchableOpacity
                onPress={() => setShowStartCalendar(true)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white flex-row items-center justify-between"
              >
                <Text className="text-xs text-slate-700">
                  {fromDate ? fromDate.split('-').reverse().join('-') : 'YYYY-MM-DD'}
                </Text>
                <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">To</Text>
              <TouchableOpacity
                onPress={() => setShowEndCalendar(true)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white flex-row items-center justify-between"
              >
                <Text className="text-xs text-slate-700">
                  {toDate ? toDate.split('-').reverse().join('-') : 'YYYY-MM-DD'}
                </Text>
                <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Period Grouping Selector */}
          <TouchableOpacity
            onPress={() => setShowPeriodModal(true)}
            className="flex-row items-center justify-between border border-gray-250 rounded-xl px-4 py-2.5 bg-white mt-1"
          >
            <Text className="text-xs text-slate-700 capitalize">Grouping: {period}ly</Text>
            <Ionicons name="chevron-down" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* RESULTS PANEL */}
        {activeSoIds.length === 0 ? (
          <View className="mx-4 mt-6 bg-white border border-gray-200 rounded-2xl p-8 items-center justify-center shadow-sm">
            <Ionicons name="bar-chart-outline" size={48} color="#9ca3af" className="opacity-45" />
            <Text className="text-xs text-gray-500 mt-2 text-center">
              Select one or more Sales Officers above to view performance metrics.
            </Text>
          </View>
        ) : (dataLoading || allSoLoading) ? (
          <ActivityIndicator size="large" color="#f37021" className="my-12" />
        ) : isError ? (
          <View className="mx-4 mt-6 bg-white border border-red-150 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="text-xs text-red-500 mt-2 font-bold text-center">Failed to load performance analytics.</Text>
            <TouchableOpacity onPress={() => refetch()} className="mt-4 border border-gray-200 px-4 py-2 rounded-xl bg-gray-50">
              <Text className="text-[10px] font-bold text-gray-700">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !perfData ? (
          <View className="mx-4 mt-6 bg-white border border-gray-200 rounded-2xl p-8 items-center justify-center shadow-sm">
            <Text className="text-xs text-gray-500 text-center">No data found for the selected config.</Text>
          </View>
        ) : (
          <View className="mx-4 mt-6 gap-4 pb-24">
            {/* KPI Cards Grid */}
            <View className="gap-2.5">
              {hasSoOrAse && (
                <View className="flex-row flex-wrap gap-2.5 justify-between">
                  {/* Total Visited */}
                  <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOTAL VISITED</Text>
                    <Text className="text-lg font-black text-slate-800 mt-1">{perfData.summary.totalVisits.toLocaleString('en-IN')}</Text>
                    <Text className="text-[9px] text-slate-400 mt-0.5">For selected range</Text>
                  </View>

                  {/* Productive */}
                  <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-emerald-600">PRODUCTIVE</Text>
                    <Text className="text-lg font-black text-emerald-600 mt-1">{perfData.summary.productiveVisits.toLocaleString('en-IN')}</Text>
                    <Text className="text-[9px] text-slate-400 mt-0.5">Visit + Order same day</Text>
                  </View>

                  {/* Order Amount */}
                  <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ORDER AMOUNT</Text>
                    <Text className="text-lg font-black text-orange-600 mt-1">{formatCurrency(perfData.summary.productiveOrderAmount)}</Text>
                    <Text className="text-[9px] text-slate-400 mt-0.5">{perfData.summary.totalOrdersFromVisits} orders logged</Text>
                  </View>

                  {/* Total Time Spent */}
                  <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOTAL TIME SPENT</Text>
                    <Text className="text-lg font-black text-slate-800 mt-1">
                      {Math.floor(perfData.summary.totalTimeSpentMinutes / 60)}h {perfData.summary.totalTimeSpentMinutes % 60}m
                    </Text>
                    <Text className="text-[9px] text-slate-400 mt-0.5">Time inside outlets</Text>
                  </View>

                  {/* Average Time Spent */}
                  <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">AVERAGE TIME SPENT</Text>
                    <Text className="text-lg font-black text-slate-800 mt-1">
                      {Math.floor(Math.round(perfData.summary.averageTimeSpentMinutes / Math.max(1, activeSoIds.length)) / 60)}h {Math.round(perfData.summary.averageTimeSpentMinutes / Math.max(1, activeSoIds.length)) % 60}m
                    </Text>
                    <Text className="text-[9px] text-slate-400 mt-0.5">Per person average</Text>
                  </View>

                  {/* New Counters (Retailers) */}
                  <TouchableOpacity
                    onPress={() => {
                      setNewCountersType('retailer');
                      setShowNewCountersModal(true);
                    }}
                    className="flex-1 min-w-[45%] bg-white border border-blue-100 p-4 rounded-2xl shadow-sm active:bg-blue-50/50"
                  >
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="people-outline" size={12} color="#2563eb" />
                      <Text className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">NEW COUNTERS (RETAILERS)</Text>
                    </View>
                    <Text className="text-xl font-black text-blue-600 mt-1.5">{perfData.summary.newCountersAdded.toLocaleString('en-IN')}</Text>
                    <Text className="text-[9px] text-slate-400 mt-1">Click to view details</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasAsmOrRsm && (
                <View className="flex-row flex-wrap gap-2.5 justify-between">
                  {!hasSoOrAse && (
                    <>
                      {/* Total Time Spent */}
                      <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                        <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOTAL TIME SPENT</Text>
                        <Text className="text-lg font-black text-slate-800 mt-1">
                          {Math.floor(perfData.summary.totalTimeSpentMinutes / 60)}h {perfData.summary.totalTimeSpentMinutes % 60}m
                        </Text>
                        <Text className="text-[9px] text-slate-400 mt-0.5">Time inside outlets</Text>
                      </View>

                      {/* Average Time Spent */}
                      <View className="flex-1 min-w-[45%] bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
                        <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">AVERAGE TIME SPENT</Text>
                        <Text className="text-lg font-black text-slate-800 mt-1">
                          {Math.floor(Math.round(perfData.summary.averageTimeSpentMinutes / Math.max(1, activeSoIds.length)) / 60)}h {Math.round(perfData.summary.averageTimeSpentMinutes / Math.max(1, activeSoIds.length)) % 60}m
                        </Text>
                        <Text className="text-[9px] text-slate-400 mt-0.5">Per person average</Text>
                      </View>
                    </>
                  )}

                  {/* New Counters (Dist/Super) */}
                  <TouchableOpacity
                    onPress={() => {
                      setNewCountersType('distributor_super');
                      setShowNewCountersModal(true);
                    }}
                    className="flex-1 min-w-[45%] bg-white border border-emerald-150 p-4 rounded-2xl shadow-sm active:bg-emerald-50/50"
                  >
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="people-outline" size={12} color="#059669" />
                      <Text className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">NEW DIST/SUPER</Text>
                    </View>
                    <Text className="text-lg font-black text-emerald-600 mt-1">
                      {(perfData.summary.newDistributorsAdded + perfData.summary.newSupersAdded).toLocaleString('en-IN')}
                    </Text>
                    <Text className="text-[9px] text-slate-400 mt-0.5">Click to view details</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Timeline Bar Chart Breakdown */}
            <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-4">
              <View className="flex-row justify-between items-center border-b border-gray-100 pb-2.5">
                <Text className="text-xs font-bold text-slate-850">Timeline Breakdown</Text>
                <View className="flex-row gap-2">
                  <View className="flex-row items-center gap-1">
                    <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <Text className="text-[8px] text-slate-400">Prod</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <Text className="text-[8px] text-slate-400">Visit</Text>
                  </View>
                </View>
              </View>

              {perfData.buckets.length === 0 ? (
                <Text className="text-xs text-slate-400 py-3 text-center">No buckets logged</Text>
              ) : (
                perfData.buckets.map((b) => {
                  const totalWidth = maxVisits > 0 ? (b.visits / maxVisits) * 100 : 0;
                  const productivePct = b.visits > 0 ? b.productive / b.visits : 0;

                  return (
                    <View key={b.key} className="flex-row items-center gap-2">
                      <Text className="w-14 text-[9px] text-slate-400 font-bold" numberOfLines={1}>
                        {b.label}
                      </Text>
                      <View className="flex-1 h-3 bg-gray-100 rounded-full relative overflow-hidden">
                        <View
                          className="absolute left-0 top-0 h-full bg-slate-300 rounded-full"
                          style={{ width: `${totalWidth}%` }}
                        />
                        <View
                          className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full"
                          style={{ width: `${totalWidth * productivePct}%` }}
                        />
                      </View>
                      <Text className="w-16 text-[9px] text-slate-400 font-bold text-right">
                        {b.productive}/{b.visits}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Split Tab Container */}
            <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mt-1">
              <View className="flex-row border-b border-gray-150 bg-gray-50/50 p-1">
                <TouchableOpacity
                  onPress={() => setActiveTab('recent-visits')}
                  className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === 'recent-visits' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                >
                  <Text className={`text-xs font-bold ${activeTab === 'recent-visits' ? 'text-orange-600' : 'text-gray-500'}`}>
                    Recent Visits ({nonIAmHereVisits.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('iamhere-logs')}
                  className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === 'iamhere-logs' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                >
                  <Text className={`text-xs font-bold ${activeTab === 'iamhere-logs' ? 'text-orange-600' : 'text-gray-500'}`}>
                    I Am Here Logs ({iAmHereVisits.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content List */}
              <View className="p-4 gap-3">
                {activeTab === 'recent-visits' ? (
                  nonIAmHereVisits.length === 0 ? (
                    <Text className="text-xs text-gray-400 py-6 text-center">No visits logged</Text>
                  ) : (
                    nonIAmHereVisits.map((visit) => {
                      const isProductive = visit.classification === 'productive';
                      return (
                        <View key={visit.visitId} className="border border-gray-150 rounded-2xl p-3.5 bg-white gap-3 shadow-sm">
                          <View className="flex-row items-center gap-3">
                            <View className="h-10 w-10 rounded-xl bg-gray-100 justify-center items-center overflow-hidden border border-gray-100">
                              {visit.proofImageUrl ? (
                                <Image source={{ uri: visit.proofImageUrl }} className="h-full w-full" style={{ resizeMode: 'cover' }} />
                              ) : (
                                <Ionicons name="storefront-outline" size={18} color="#94a3b8" />
                              )}
                            </View>
                            <View className="flex-grow min-w-0">
                              <Text className="text-xs font-bold text-slate-800 truncate">{visit.retailerName}</Text>
                              <Text className="text-[9px] text-slate-400 mt-0.5">ID: {visit.retailerEntityId}</Text>
                              <Text className="text-[9px] text-slate-400 mt-0.5">Logged by: {visit.createdByName || visit.createdByEntityId}</Text>
                              <Text className="text-[8px] text-slate-400 mt-1 flex-row items-center gap-0.5">
                                <Ionicons name="time-outline" size={10} color="#94a3b8" /> {formatVisitTime(visit.visitedAt)}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row justify-between items-center border-t border-gray-100 pt-2.5 mt-0.5 flex-wrap gap-2">
                            <View className={`px-2 py-0.5 rounded-full border ${isProductive ? 'bg-emerald-50 border-emerald-150' : 'bg-orange-50 border-orange-100'
                              }`}>
                              <Text className={`text-[8px] font-extrabold uppercase ${isProductive ? 'text-emerald-700' : 'text-orange-700'
                                }`}>
                                {isProductive ? 'Productive' : 'Visited'}
                              </Text>
                            </View>

                            <View className="flex-row gap-2">
                              {visit.latitude && visit.longitude && (
                                <TouchableOpacity
                                  onPress={() => openMap(visit.latitude!, visit.longitude!)}
                                  className="flex-row items-center justify-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white gap-1"
                                >
                                  <Ionicons name="location-outline" size={11} color="#475569" />
                                  <Text className="text-[9px] font-bold text-slate-600">Location</Text>
                                </TouchableOpacity>
                              )}
                              {!!visit.proofImageUrl && (
                                <TouchableOpacity
                                  onPress={() =>
                                    setShowVisitImage({
                                      retailerName: visit.retailerName,
                                      visitDateKey: visit.visitDateKey,
                                      proofImageUrl: visit.proofImageUrl,
                                    })
                                  }
                                  className="flex-row items-center justify-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white gap-1"
                                >
                                  <Ionicons name="camera-outline" size={11} color="#475569" />
                                  <Text className="text-[9px] font-bold text-slate-600">Image</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )
                ) : (
                  iAmHereVisits.length === 0 ? (
                    <Text className="text-xs text-gray-400 py-6 text-center">No I Am Here logs recorded</Text>
                  ) : (
                    iAmHereVisits.map((v) => (
                      <View key={v.visitId} className="border border-gray-150 rounded-2xl p-3.5 bg-white gap-3 shadow-sm">
                        <View className="flex-row items-center gap-3">
                          <View className="h-9 w-9 rounded-full bg-blue-50 justify-center items-center border border-blue-100">
                            <Ionicons name="pin" size={16} color="#2563eb" />
                          </View>
                          <View className="flex-grow min-w-0">
                            <Text className="text-xs font-bold text-slate-800 truncate">
                              Logged by: {v.createdByName || v.createdByEntityId}
                            </Text>
                            <Text className="text-[9px] text-slate-400 mt-0.5">{formatVisitTime(v.visitedAt)}</Text>
                          </View>
                        </View>

                        <View className="flex-row justify-end gap-2 pt-2.5 border-t border-gray-100">
                          {v.latitude && v.longitude && (
                            <TouchableOpacity
                              onPress={() => openMap(v.latitude!, v.longitude!)}
                              className="flex-row items-center justify-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white gap-1"
                            >
                              <Ionicons name="location-outline" size={11} color="#475569" />
                              <Text className="text-[9px] font-bold text-slate-600">Location</Text>
                            </TouchableOpacity>
                          )}
                          {v.proofImageUrl && (
                            <TouchableOpacity
                              onPress={() =>
                                setShowVisitImage({
                                  retailerName: 'I Am Here log',
                                  visitDateKey: v.visitDateKey,
                                  proofImageUrl: v.proofImageUrl,
                                })
                              }
                              className="flex-row items-center justify-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white gap-1"
                            >
                              <Ionicons name="camera-outline" size={11} color="#475569" />
                              <Text className="text-[9px] font-bold text-slate-600">Photo</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => setShowRemark(v.notes || 'No notes provided')}
                            className="flex-row items-center justify-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white gap-1"
                          >
                            <Ionicons name="chatbox-ellipses-outline" size={11} color="#475569" />
                            <Text className="text-[9px] font-bold text-slate-600">Remark</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Period Selector Modal */}
      <Modal visible={showPeriodModal} transparent animationType="fade" onRequestClose={() => setShowPeriodModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Grouping</Text>
              <TouchableOpacity onPress={() => setShowPeriodModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            {[
              { value: 'day', label: 'Daily' },
              { value: 'week', label: 'Weekly' },
              { value: 'month', label: 'Monthly' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  setPeriod(item.value as any);
                  setShowPeriodModal(false);
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${period === item.value ? 'bg-orange-50' : ''
                  }`}
              >
                <Text className={`text-sm ${period === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {period === item.value && <Ionicons name="checkmark" size={18} color="#f37021" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Proof Image Viewer Modal */}
      {showVisitImage && (
        <Modal visible={!!showVisitImage} transparent animationType="fade" onRequestClose={() => setShowVisitImage(null)}>
          <View className="flex-1 bg-black/80 justify-center items-center p-6">
            <View className="bg-white rounded-2xl p-4 w-full max-w-sm gap-3 shadow-2xl relative">
              <TouchableOpacity
                onPress={() => setShowVisitImage(null)}
                className="absolute right-3 top-3 z-10 bg-white/80 p-1.5 rounded-full border border-gray-250 shadow-sm"
              >
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
              <Image source={{ uri: showVisitImage.proofImageUrl }} className="h-72 w-full rounded-xl mt-2" style={{ resizeMode: 'contain' }} />
              <Text className="text-xs text-gray-500 text-center font-semibold mt-1">
                {showVisitImage.retailerName} · {showVisitImage.visitDateKey}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Notes Remark Modal */}
      {showRemark && (
        <Modal visible={!!showRemark} transparent animationType="fade" onRequestClose={() => setShowRemark(null)}>
          <View className="flex-1 bg-black/60 justify-center items-center p-6">
            <View className="bg-white rounded-2xl p-5 w-full max-w-xs gap-4 shadow-xl">
              <Text className="font-bold text-gray-800 text-sm border-b border-gray-150 pb-2">Remark Note</Text>
              <Text className="text-xs text-gray-500 leading-relaxed">{showRemark}</Text>
              <TouchableOpacity
                onPress={() => setShowRemark(null)}
                className="bg-orange-500 py-2.5 rounded-xl items-center"
              >
                <Text className="text-white text-xs font-bold">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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

      {/* New Entities Modal */}
      <NewCountersModal
        visible={showNewCountersModal}
        onClose={() => setShowNewCountersModal(false)}
        activeSoIds={activeSoIds}
        allSoIds={allSos.map((u) => u.entityId)}
        period={period}
        fromDate={fromDate}
        toDate={toDate}
        stateParam={selectedStateParam}
        creatorName={activeSoIds.length === 1 ? (userLookup.get(activeSoIds[0])?.name || activeSoIds[0]) : 'Multiple Users'}
        creatorRoles={activeSoRoles}
        type={newCountersType}
      />
    </View>
  );
}
