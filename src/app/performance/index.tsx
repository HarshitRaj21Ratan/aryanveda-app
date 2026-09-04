import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { visitService, type VisitPerformancePeriod } from '@/services/visit.service';
import { retailerAuthorizationService } from '@/services/retailerAuthorization.service';
import { CalendarModal } from '@/components/ui/CalendarModal';
import {
  lastNDaysRange,
  thisMonthRange,
  formatCurrency,
  KpiCard,
  TimelineBreakdown,
  VisitCard,
  IAmHereCard,
  ProofImageModal,
  RemarkModal,
} from '@/components/performance/PerformanceComponents';

const FIELD_STAFF_ROLES = new Set([
  UserRole.SO,
  UserRole.ASE,
  UserRole.ASM,
  UserRole.RSM,
  UserRole.NSM,
  UserRole.ADMIN,
]);

export default function PerformanceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const viewerRole = user?.role as UserRole | undefined;

  const isAllowed = !!user && FIELD_STAFF_ROLES.has(viewerRole!);
  const isManager = viewerRole === UserRole.RSM || viewerRole === UserRole.ASM || viewerRole === UserRole.NSM || viewerRole === UserRole.ADMIN;

  // Redirect managers to /admin/performance
  useEffect(() => {
    if (user && isManager) {
      router.replace('/admin/performance' as any);
    }
  }, [user, isManager, router]);

  const initialRange = useMemo(() => lastNDaysRange(30), []);

  const [period, setPeriod] = useState<VisitPerformancePeriod>('day');
  const [fromDate, setFromDate] = useState<string>(initialRange.from);
  const [toDate, setToDate] = useState<string>(initialRange.to);

  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const [activeTab, setActiveTab] = useState<'recent-visits' | 'iamhere-logs'>('recent-visits');
  const [beatFilter, setBeatFilter] = useState('');

  // Modals
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showBeatModal, setShowBeatModal] = useState(false);
  const [selectedVisitImage, setSelectedVisitImage] = useState<{ retailerName: string; visitDateKey: string; proofImageUrl: string } | null>(null);
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);

  // SO Authorized Retailers Query
  const { data: soRetailersData } = useQuery({
    queryKey: ['so-authorized-retailers-dashboard', user?.entityId],
    queryFn: () => retailerAuthorizationService.getMyRetailers(),
    enabled: user?.role === UserRole.SO || user?.role === UserRole.ASE,
  });

  // Personal Visit Performance Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visit-performance-dashboard-v2', period, fromDate, toDate, beatFilter],
    queryFn: () => visitService.getPerformance(period, fromDate || undefined, toDate || undefined, beatFilter || undefined),
    enabled: isAllowed && !isManager,
  });

  const maxVisits = useMemo(() => {
    const vals = data?.buckets.map((b) => b.visits) ?? [];
    return vals.length ? Math.max(1, ...vals) : 1;
  }, [data]);

  const beatOptions = useMemo(() => {
    const beats = new Set<string>();
    for (const retailer of soRetailersData?.retailers ?? []) {
      const beat = (retailer.beat ?? '').trim().toLowerCase();
      if (beat) beats.add(beat);
    }
    return Array.from(beats).sort((a, b) => a.localeCompare(b));
  }, [soRetailersData]);

  const applyRange = (type: '7d' | '30d' | 'month') => {
    const range = type === 'month' ? thisMonthRange() : lastNDaysRange(type === '7d' ? 7 : 30);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const clearFilters = () => {
    setFromDate(initialRange.from);
    setToDate(initialRange.to);
    setBeatFilter('');
  };

  if (!isAllowed) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4 text-center">Access Denied</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Performance analytics is only available for field staff roles.
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

  const recentVisitsList = data?.recentVisits ?? [];
  const nonIAmHereVisits = recentVisitsList.filter((v) => !v.isIAmHere);
  const iAmHereVisits = recentVisitsList.filter((v) => v.isIAmHere);

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        {/* Title block */}
        <View className="px-6 pt-5 pb-2 flex-row items-center gap-3">
          <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
            <Ionicons name="stats-chart-outline" size={22} color="#f97316" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-800">My Performance</Text>
            <Text className="text-xs text-slate-400 mt-0.5">Track your store visit productivity. Resets daily at 00:00 IST.</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 py-3 flex-row gap-2.5">
          <TouchableOpacity
            onPress={() => router.push('/beat-visits' as any)}
            className="flex-row items-center border border-emerald-250 bg-emerald-50/50 rounded-xl py-2 px-4 gap-2"
          >
            <Ionicons name="walk-outline" size={16} color="#059669" />
            <Text className="text-emerald-700 text-xs font-semibold">Beat Visits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/leaderboard' as any)}
            className="flex-row items-center border border-amber-250 bg-amber-50/50 rounded-xl py-2 px-4 gap-2"
          >
            <Ionicons name="trophy-outline" size={16} color="#d97706" />
            <Text className="text-amber-700 text-xs font-semibold">Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/outlet-wise' as any)}
            className="flex-row items-center border border-purple-250 bg-purple-50/50 rounded-xl py-2 px-4 gap-2"
          >
            <Ionicons name="home-outline" size={16} color="#7c3aed" />
            <Text className="text-purple-700 text-xs font-semibold">Outlet Report</Text>
          </TouchableOpacity>

          {viewerRole === UserRole.ASE && (
            <TouchableOpacity
              onPress={() => router.push('/admin/performance' as any)}
              className="flex-row items-center border border-blue-250 bg-blue-50/50 rounded-xl py-2 px-4 gap-2"
            >
              <Ionicons name="stats-chart-outline" size={16} color="#2563eb" />
              <Text className="text-blue-700 text-xs font-semibold">Team Performance</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => refetch()}
            className="flex-row items-center border border-gray-200 bg-white rounded-xl py-2 px-4 gap-2"
          >
            <Ionicons name="refresh" size={16} color="#475569" />
            <Text className="text-slate-700 text-xs font-semibold">Refresh</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Filters Card */}
        <View className="mx-6 mt-3 bg-white border border-gray-200 p-5 rounded-2xl gap-4 shadow-sm">
          <View className="flex-row items-center gap-2 border-b border-gray-100 pb-3">
            <Ionicons name="funnel-outline" size={18} color="#f97316" />
            <Text className="text-sm font-bold text-slate-800">Filters</Text>
          </View>

          {/* Quick ranges */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => applyRange('7d')}
              className="flex-1 items-center justify-center border border-gray-200 bg-white rounded-xl py-2"
            >
              <Text className="text-slate-700 text-xs font-semibold">Last 7 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyRange('30d')}
              className="flex-1 items-center justify-center border border-gray-200 bg-white rounded-xl py-2"
            >
              <Text className="text-slate-700 text-xs font-semibold">Last 30 days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyRange('month')}
              className="flex-1 items-center justify-center border border-gray-200 bg-white rounded-xl py-2"
            >
              <Text className="text-slate-700 text-xs font-semibold">This month</Text>
            </TouchableOpacity>

            {(!!fromDate || !!toDate || !!beatFilter) && (
              <TouchableOpacity
                onPress={clearFilters}
                className="items-center justify-center border border-gray-200 bg-[#fff7ed] rounded-xl px-3 py-2"
              >
                <Ionicons name="refresh-circle-outline" size={18} color="#ea580c" />
              </TouchableOpacity>
            )}
          </View>

          {/* From Date input */}
          <View className="gap-1.5">
            <Text className="text-xs text-slate-500 font-semibold">From</Text>
            <TouchableOpacity
              onPress={() => setShowStartCalendar(true)}
              className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row items-center justify-between"
            >
              <Text className="text-sm text-slate-700">
                {fromDate ? fromDate.split('-').reverse().join('-') : 'YYYY-MM-DD'}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* To Date input */}
          <View className="gap-1.5">
            <Text className="text-xs text-slate-500 font-semibold">To</Text>
            <TouchableOpacity
              onPress={() => setShowEndCalendar(true)}
              className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row items-center justify-between"
            >
              <Text className="text-sm text-slate-700">
                {toDate ? toDate.split('-').reverse().join('-') : 'YYYY-MM-DD'}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Grouping / Beat selectors */}
          <View className="flex-row gap-2 mt-1">
            <TouchableOpacity
              onPress={() => setShowPeriodModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-xs text-slate-700 capitalize">
                Grouping: {period}ly
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>

            {beatOptions.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowBeatModal(true)}
                className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
              >
                <Text className="text-xs text-slate-700 truncate">
                  {beatFilter ? beatFilter.toUpperCase() : 'All Beats'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Loading / Error states */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : isError ? (
          <View className="mx-6 mt-6 bg-white border border-red-150 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={36} color="#ef4444" />
            <Text className="text-sm text-red-500 mt-2 font-semibold">Failed to load performance data</Text>
          </View>
        ) : !data ? (
          <View className="mx-6 mt-6 bg-white border border-gray-250 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="bar-chart-outline" size={36} color="#9ca3af" className="opacity-40" />
            <Text className="text-sm text-gray-500 mt-2">No visit data available</Text>
          </View>
        ) : (
          <View className="mx-6 mt-6 gap-4">
            {/* KPI Cards: Exactly 4 cards matching Web Frontend My Performance page */}
            <View className="gap-3">
              {/* Card 1: TOTAL VISITED */}
              <KpiCard
                label="TOTAL VISITED"
                value={data.summary.totalVisits.toLocaleString('en-IN')}
                sub="For selected date range"
                icon="storefront-outline"
              />

              {/* Card 2: VISITED */}
              <KpiCard
                label="VISITED"
                value={data.summary.visitedOnlyVisits.toLocaleString('en-IN')}
                sub="Visit without order"
                valueColorClass="text-slate-600"
                icon="storefront-outline"
                iconColor="#64748b"
              />

              {/* Card 3: PRODUCTIVE */}
              <KpiCard
                label="PRODUCTIVE"
                value={data.summary.productiveVisits.toLocaleString('en-IN')}
                sub="Visit + Order or Direct Order"
                valueColorClass="text-emerald-600"
                icon="trending-up-outline"
                iconColor="#10b981"
              />

              {/* Card 4: ORDER AMOUNT */}
              <KpiCard
                label="ORDER AMOUNT"
                value={formatCurrency(data.summary.productiveOrderAmount)}
                sub={`${data.summary.totalOrdersFromVisits.toLocaleString('en-IN')} orders`}
                valueColorClass="text-orange-500"
                icon="cart-outline"
                iconColor="#f97316"
              />
            </View>

            {/* Timeline Breakdown progress card */}
            <TimelineBreakdown buckets={data.buckets} maxVisits={maxVisits} />

            {/* Split Tab Controls */}
            <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mt-3 mb-10">
              <View className="flex-row border-b border-gray-150 bg-gray-50/50 p-1">
                <TouchableOpacity
                  onPress={() => setActiveTab('recent-visits')}
                  className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'recent-visits' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                >
                  <Text className={`text-xs font-bold ${activeTab === 'recent-visits' ? 'text-[#f97316]' : 'text-gray-500'}`}>
                    Recent Visits ({nonIAmHereVisits.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('iamhere-logs')}
                  className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'iamhere-logs' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                >
                  <Text className={`text-xs font-bold ${activeTab === 'iamhere-logs' ? 'text-[#f97316]' : 'text-gray-500'}`}>
                    I Am Here Logs ({iAmHereVisits.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Card List Area */}
              <View className="p-4 bg-white gap-3">
                {activeTab === 'recent-visits' ? (
                  nonIAmHereVisits.length === 0 ? (
                    <Text className="text-xs text-gray-400 py-6 text-center">No visits logged</Text>
                  ) : (
                    nonIAmHereVisits.map((visit) => (
                      <VisitCard
                        key={visit.visitId}
                        visit={visit}
                        onViewImage={(v) =>
                          setSelectedVisitImage({
                            retailerName: v.retailerName,
                            visitDateKey: v.visitDateKey,
                            proofImageUrl: v.proofImageUrl,
                          })
                        }
                      />
                    ))
                  )
                ) : (
                  iAmHereVisits.length === 0 ? (
                    <Text className="text-xs text-gray-400 py-6 text-center">No I Am Here logs recorded</Text>
                  ) : (
                    iAmHereVisits.map((v) => (
                      <IAmHereCard
                        key={v.visitId}
                        visit={v}
                        onViewImage={(row) =>
                          setSelectedVisitImage({
                            retailerName: 'I Am Here Photo',
                            visitDateKey: row.visitDateKey,
                            proofImageUrl: row.proofImageUrl,
                          })
                        }
                        onViewRemark={setSelectedRemark}
                      />
                    ))
                  )
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Period Selector Modal */}
      <Modal
        visible={showPeriodModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPeriodModal(false)}
      >
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
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${period === item.value ? 'bg-purple-50' : ''
                  }`}
              >
                <Text className={`text-sm ${period === item.value ? 'font-bold text-purple-700' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {period === item.value && <Ionicons name="checkmark" size={18} color="#7c3aed" />}
              </TouchableOpacity>
            ))}
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
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${beatFilter === item ? 'bg-purple-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${beatFilter === item ? 'font-bold text-purple-700' : 'text-gray-700'}`}>
                    {item ? item.toUpperCase() : 'All Beats'}
                  </Text>
                  {beatFilter === item && <Ionicons name="checkmark" size={18} color="#7c3aed" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Shared Modals */}
      <ProofImageModal
        selectedVisitImage={selectedVisitImage}
        onClose={() => setSelectedVisitImage(null)}
      />

      <RemarkModal
        selectedRemark={selectedRemark}
        onClose={() => setSelectedRemark(null)}
      />

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
