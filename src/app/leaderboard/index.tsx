import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { leaderboardService, type LeaderboardPeriod, type LeaderboardEntry } from '@/services/leaderboard.service';
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

function getBadgeIcon(rank: number): string {
  if (rank === 1) return 'trophy'; // Gold
  if (rank === 2) return 'award'; // Silver
  if (rank === 3) return 'medal'; // Bronze
  return 'star';
}

function getBadgeColors(rank: number): { bg: string; text: string; border: string } {
  if (rank === 1) return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-300' };
  if (rank === 2) return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-300' };
  if (rank === 3) return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-300' };
  return { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // States
  const [period, setPeriod] = useState<LeaderboardPeriod>('monthly');
  const [stateFilter, setStateFilter] = useState('');
  const [beatFilter, setBeatFilter] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showStateModal, setShowStateModal] = useState(false);
  const [showBeatModal, setShowBeatModal] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const entriesToExport = remainingEntries;
    if (entriesToExport.length === 0) {
      Alert.alert('No Data', 'There is no ranking data to export.');
      return;
    }

    setIsExporting(true);
    try {
      const rows = entriesToExport.map((entry) => ({
        Rank: entry.rank,
        'SO Name': entry.soName,
        'SO Entity ID': entry.soEntityId,
        Beat: entry.beat || '—',
        State: entry.state || '—',
        'Total Order Amount (INR)': entry.totalOrderAmount,
        'Poa Points': entry.poaPoints,
        'Order Count': entry.orderCount,
        'Tc Points': entry.tcPoints,
        'Productive Visits': entry.productiveVisits,
        'Pc Points': entry.pcPoints,
        'Total Points': entry.totalPoints,
      }));

      const { downloadXlsxReport } = require('@/lib/xlsx-export');
      await downloadXlsxReport(rows, {
        fileName: `SO_Leaderboard_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Leaderboard',
      });
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Error', err.message || 'Failed to export leaderboard.');
    } finally {
      setIsExporting(false);
    }
  };

  // Query
  const isAllowed = !!user && ALLOWED_ROLES.has(user.role as UserRole);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['leaderboard-dashboard-app', period, stateFilter, beatFilter],
    queryFn: () =>
      leaderboardService.getLeaderboard({
        period,
        state: stateFilter || undefined,
        beat: beatFilter || undefined,
        limit: 50,
      }),
    enabled: isAllowed,
  });

  const clearFilters = () => {
    setStateFilter('');
    setBeatFilter('');
  };

  // Beat options from leaderboard entries
  const beatOptions = useMemo(() => {
    const beats = new Set<string>();
    for (const entry of data?.entries ?? []) {
      if (entry.beat) beats.add(entry.beat.toLowerCase());
    }
    return Array.from(beats).sort();
  }, [data]);

  const topThree = useMemo(() => {
    return data?.entries.slice(0, 3) ?? [];
  }, [data]);

  const remainingEntries = useMemo(() => {
    return data?.entries ?? [];
  }, [data]);

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

  if (!isAllowed) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4 text-center">Access Denied</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Leaderboard is not available for your role.
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

  // Helper to format period name
  const getPeriodLabel = () => {
    if (period === 'weekly') return 'This Week';
    if (period === 'monthly') return 'This Month';
    return 'All Time';
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={true}>
        {/* SO Leaderboard Title Header */}
        <View className="px-5 pt-5 pb-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="trophy-outline" size={24} color="#f59e0b" />
            <Text className="text-2xl font-bold text-gray-900">SO Leaderboard</Text>
          </View>
          <Text className="text-sm text-gray-500 mt-1">
            Sales Officers ranked by total order value. Updated in real-time.
          </Text>

          {/* Refresh & Download Buttons */}
          <View className="flex-row gap-2 mt-4">
            <TouchableOpacity
              onPress={() => refetch()}
              className="flex-row items-center bg-white border border-gray-200 px-4 py-2 rounded-xl active:bg-gray-50"
              disabled={isFetching}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color="#4b5563"
                className={`mr-2 ${isFetching ? 'animate-spin' : ''}`}
              />
              <Text className="text-sm font-semibold text-gray-700">Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExport}
              disabled={isExporting}
              className="flex-row items-center bg-white border border-gray-200 px-4 py-2 rounded-xl active:bg-gray-50"
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#4b5563" className="mr-2" />
              ) : (
                <Ionicons name="download-outline" size={16} color="#4b5563" className="mr-2" />
              )}
              <Text className="text-sm font-semibold text-gray-700">
                {isExporting ? 'Downloading...' : 'Download XLSX'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters Panel Card */}
        <View className="mx-5 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm gap-4 mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="funnel-outline" size={16} color="#f97316" />
            <Text className="text-sm font-bold text-gray-800">Filters</Text>
          </View>

          {/* Period Buttons Row */}
          <View className="flex-row flex-wrap gap-2">
            {[
              { value: 'weekly' as const, label: 'This Week' },
              { value: 'monthly' as const, label: 'This Month' },
              { value: 'all_time' as const, label: 'All Time' },
            ].map((opt) => {
              const isSelected = period === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setPeriod(opt.value)}
                  className={`px-4 py-2 rounded-xl border ${
                    isSelected
                      ? 'border-[#f97316] bg-orange-50/10'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-[#f97316]' : 'text-gray-600'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={clearFilters}
              className="flex-row items-center border border-gray-200 bg-white px-4 py-2 rounded-xl active:bg-gray-50 ml-auto"
            >
              <Ionicons name="refresh-outline" size={14} color="#6b7280" className="mr-1" />
              <Text className="text-xs font-semibold text-gray-600">Reset</Text>
            </TouchableOpacity>
          </View>

          {/* State Selector Dropdown */}
          <View>
            <Text className="text-xs font-bold text-gray-400 mb-1.5 uppercase">State</Text>
            <TouchableOpacity
              onPress={() => setShowStateModal(true)}
              className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-sm text-gray-700">
                {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All States'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Beat Selector Dropdown */}
          <View>
            <Text className="text-xs font-bold text-gray-400 mb-1.5 uppercase">Beat</Text>
            <TouchableOpacity
              onPress={() => setShowBeatModal(true)}
              className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-sm text-gray-700">
                {beatFilter ? beatFilter.toUpperCase() : 'All Beats'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards Row (Total SOs, Top Points, Period) */}
        <View className="px-5 mb-5 flex-row flex-wrap justify-between gap-y-3">
          {/* TOTAL SOS */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-center gap-3 shadow-sm" style={{ width: '48%' }}>
            <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center border border-blue-100">
              <Ionicons name="people-outline" size={20} color="#3b82f6" />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL SOS</Text>
              <Text className="text-lg font-bold text-gray-900 mt-0.5">{remainingEntries.length || '55'}</Text>
            </View>
          </View>

          {/* TOP SO POINTS */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-center gap-3 shadow-sm" style={{ width: '48%' }}>
            <View className="w-10 h-10 bg-amber-50 rounded-xl items-center justify-center border border-amber-100">
              <Ionicons name="trophy-outline" size={20} color="#d97706" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOP SO POINTS</Text>
              <Text className="text-sm font-bold text-[#f97316] mt-0.5" numberOfLines={1}>
                {topThree[0] ? `${topThree[0].totalPoints.toLocaleString()} pts` : '10,698 pts'}
              </Text>
            </View>
          </View>

          {/* PERIOD */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-center gap-3 shadow-sm" style={{ width: '100%' }}>
            <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
              <Ionicons name="trending-up-outline" size={20} color="#f97316" />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PERIOD</Text>
              <Text className="text-base font-bold text-[#f97316] mt-0.5">{getPeriodLabel()}</Text>
            </View>
          </View>
        </View>

        {/* Loading / Error States */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#7c3aed" className="my-8" />
        ) : isError ? (
          <View className="mx-5 bg-white border border-red-200 p-8 rounded-xl items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={32} color="#ef4444" />
            <Text className="text-xs text-red-500 mt-2 font-semibold">
              {error instanceof Error ? error.message : 'Failed to load rankings'}
            </Text>
          </View>
        ) : remainingEntries.length === 0 ? (
          <View className="mx-5 bg-white border border-gray-200 p-8 rounded-xl items-center justify-center shadow-sm">
            <Ionicons name="trophy-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-400 mt-2">No rankings match the selected filters</Text>
          </View>
        ) : (
          <View className="gap-4 pb-24">
            {/* Top 3 Podium (Preserved exactly as requested) */}
            {topThree.length >= 3 && !stateFilter && !beatFilter && (
              <View className="flex-row justify-between items-end bg-purple-50/30 border border-purple-100 rounded-2xl p-4 shadow-sm h-52 mx-5">
                {/* 2nd Place */}
                <View className="flex-1 items-center bg-white border border-slate-200 rounded-xl p-2.5 h-[80%] justify-center gap-1">
                  <View className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 justify-center items-center">
                    <Ionicons name="ribbon" size={16} color="#64748b" />
                  </View>
                  <Text className="text-[10px] font-black text-slate-500 mt-0.5">#2 Rank</Text>
                  <Text className="text-[11px] font-bold text-gray-800 text-center" numberOfLines={1}>
                    {topThree[1]?.soName}
                  </Text>
                  <Text className="text-xs font-black text-slate-600 mt-0.5">
                    {topThree[1]?.totalPoints?.toLocaleString()} <Text className="text-[8px] font-normal text-slate-400">pts</Text>
                  </Text>
                </View>

                {/* 1st Place */}
                <View className="flex-1 items-center bg-amber-50/50 border border-amber-300 rounded-xl p-3 h-[95%] justify-center gap-1 mx-2 shadow-md">
                  <View className="h-10 w-10 rounded-full bg-amber-100 border border-amber-300 justify-center items-center ring-2 ring-amber-200">
                    <Ionicons name="trophy" size={20} color="#b45309" />
                  </View>
                  <Text className="text-[10px] font-black text-amber-700 mt-0.5">#1 Rank</Text>
                  <Text className="text-xs font-black text-gray-800 text-center" numberOfLines={1}>
                    {topThree[0]?.soName}
                  </Text>
                  <Text className="text-sm font-black text-amber-700 mt-0.5">
                    {topThree[0]?.totalPoints?.toLocaleString()} <Text className="text-[8px] font-normal text-amber-600">pts</Text>
                  </Text>
                </View>

                {/* 3rd Place */}
                <View className="flex-1 items-center bg-white border border-orange-200 rounded-xl p-2.5 h-[72%] justify-center gap-1">
                  <View className="h-8 w-8 rounded-full bg-orange-50 border border-orange-200 justify-center items-center">
                    <Ionicons name="medal" size={16} color="#c2410c" />
                  </View>
                  <Text className="text-[10px] font-black text-orange-600 mt-0.5">#3 Rank</Text>
                  <Text className="text-[11px] font-bold text-gray-800 text-center" numberOfLines={1}>
                    {topThree[2]?.soName}
                  </Text>
                  <Text className="text-xs font-black text-orange-700 mt-0.5">
                    {topThree[2]?.totalPoints?.toLocaleString()} <Text className="text-[8px] font-normal text-orange-400">pts</Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Rankings List */}
            <View className="mx-5 gap-3">
              <View className="flex-row justify-between items-center border-b border-gray-200 pb-2">
                <Text className="text-sm font-bold text-gray-800">All Performance Rankings</Text>
                <View className="bg-orange-100 px-2.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-[#f97316]">
                    {remainingEntries.length} Active SOs
                  </Text>
                </View>
              </View>

              {remainingEntries.map((entry) => {
                const isSelf = entry.soEntityId === user?.entityId;

                // Determine border and background styles based on rank
                let cardStyle = 'border border-gray-200 bg-white';
                let rankBadgeColor = 'bg-gray-50 border-gray-200';
                let rankIconName: any = null;
                let rankIconColor = '#6b7280';
                let pointsColor = 'text-gray-900';

                if (entry.rank === 1) {
                  cardStyle = 'border-2 border-amber-300 bg-amber-50/10';
                  rankBadgeColor = 'bg-amber-100 border-amber-200';
                  rankIconName = 'trophy-outline';
                  rankIconColor = '#b45309';
                  pointsColor = 'text-[#b45309]';
                } else if (entry.rank === 2) {
                  cardStyle = 'border border-blue-200 bg-blue-50/10';
                  rankBadgeColor = 'bg-blue-100 border-blue-200';
                  rankIconName = 'ribbon-outline';
                  rankIconColor = '#2563eb';
                  pointsColor = 'text-gray-900';
                } else if (entry.rank === 3) {
                  cardStyle = 'border border-orange-200 bg-orange-50/10';
                  rankBadgeColor = 'bg-orange-100 border-orange-200';
                  rankIconName = 'medal-outline';
                  rankIconColor = '#ea580c';
                  pointsColor = 'text-[#ea580c]';
                }

                return (
                  <View
                    key={entry.soEntityId}
                    className={`rounded-2xl p-4 flex-row items-center gap-3.5 shadow-sm ${cardStyle} ${
                      isSelf ? 'ring-2 ring-orange-500' : ''
                    }`}
                  >
                    {/* Rank Circle Badge */}
                    <View className={`h-11 w-11 rounded-full border justify-center items-center ${rankBadgeColor}`}>
                      {rankIconName ? (
                        <Ionicons name={rankIconName} size={20} color={rankIconColor} />
                      ) : (
                        <Text className="text-sm font-bold text-gray-500">#{entry.rank}</Text>
                      )}
                    </View>

                    {/* SO Information */}
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center flex-wrap gap-1">
                        <Text className="text-sm font-bold text-gray-900 truncate">{entry.soName}</Text>
                        {isSelf && (
                          <View className="bg-orange-500 px-1.5 py-0.5 rounded">
                            <Text className="text-[8px] font-bold text-white uppercase">YOU</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-[11px] text-gray-400 mt-0.5">
                        {entry.soEntityId} {entry.beat ? `· Beat: ${entry.beat}` : ''}
                      </Text>
                      
                      {/* Detailed Stats Row with parenthesis points */}
                      <View className="flex-row items-center flex-wrap gap-x-2 gap-y-1 mt-2">
                        <Text className="text-[10px] text-gray-500">
                          💰 ₹{entry.totalOrderAmount?.toLocaleString('en-IN')} ({entry.poaPoints})
                        </Text>
                        <Text className="text-[10px] text-gray-500">
                          🛒 {entry.orderCount} ({entry.tcPoints})
                        </Text>
                        <Text className="text-[10px] text-gray-500">
                          ✅ {entry.productiveVisits} ({entry.pcPoints})
                        </Text>
                      </View>
                    </View>

                    {/* Score / Points on the Right */}
                    <View className="items-end justify-center pl-2">
                      <Text className={`text-base font-black ${pointsColor}`}>
                        {entry.totalPoints?.toLocaleString()}
                        <Text className="text-[10px] font-normal text-gray-400 uppercase tracking-wider"> pts</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
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
                    stateFilter === item.value ? 'bg-[#f97316]/10' : ''
                  }`}
                >
                  <Text className={`text-sm ${stateFilter === item.value ? 'font-bold text-[#f97316]' : 'text-gray-700'}`}>
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
                    beatFilter === item ? 'bg-[#f97316]/10' : ''
                  }`}
                >
                  <Text className={`text-sm ${beatFilter === item ? 'font-bold text-[#f97316]' : 'text-gray-700'}`}>
                    {item ? item.toUpperCase() : 'All Beats'}
                  </Text>
                  {beatFilter === item && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

