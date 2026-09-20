import { useRouter } from 'expo-router';
import type { EntityMovementSummary, SkuMovementRow } from '@/services/stock-movement.service';

function recalculateEntityCounts(entity: EntityMovementSummary, skus: SkuMovementRow[]): EntityMovementSummary {
  const noDataCount = skus.filter((s) => s.colorCode === 'gray').length;
  const redCount = skus.filter((s) => s.colorCode === 'red').length;
  const yellowCount = skus.filter((s) => s.colorCode === 'yellow').length;
  const greenCount = skus.filter((s) => s.colorCode === 'green').length;
  return {
    ...entity,
    skus,
    totalSkus: skus.length,
    noDataCount,
    redCount,
    yellowCount,
    greenCount,
  };
}

import React, { useState } from 'react';
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

import { STATE_OPTIONS } from '@/lib/states';
import { stockMovementService } from '@/services/stock-movement.service';
import type { EntityMovementSummary, SkuMovementRow, StockHealthColor } from '@/services/stock-movement.service';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

const { width } = Dimensions.get('window');

const COLOR_MAP: Record<StockHealthColor, { bg: string; border: string; text: string; label: string }> = {
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', label: 'No Data' },
  red: { bg: 'bg-red-50/60', border: 'border-red-100', text: 'text-red-500', label: 'Critical' },
  yellow: { bg: 'bg-amber-50/60', border: 'border-amber-100', text: 'text-amber-600', label: 'Warning' },
  green: { bg: 'bg-emerald-50/60', border: 'border-emerald-100', text: 'text-emerald-600', label: 'Healthy' },
};

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function SkuMobileCard({ row }: { row: SkuMovementRow }) {
  const c = COLOR_MAP[row.colorCode] || COLOR_MAP.gray;
  return (
    <View className={`rounded-xl border p-4 mb-3 ${c.bg} ${c.border}`}>
      <View className="flex-row items-start justify-between gap-2 mb-3">
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-800">{row.skuName}</Text>
          {row.weight ? (
            <Text className="text-xs text-gray-400 mt-0.5">{row.weight}</Text>
          ) : null}
        </View>
        <Text className={`text-xs font-bold ${c.text}`}>{c.label}</Text>
      </View>

      <View className="flex-row flex-wrap gap-y-3 mb-3">
        <View className="w-[33%] items-center">
          <Text className="text-[10px] text-gray-400 mb-0.5">First Order</Text>
          <Text className="text-xs font-bold text-gray-700">{row.firstOrderQuantity}</Text>
        </View>
        <View className="w-[33%] items-center">
          <Text className="text-[10px] text-gray-400 mb-0.5">Refill Qty</Text>
          <Text className="text-xs font-bold text-gray-700">{row.refillQuantity}</Text>
        </View>
        <View className="w-[33%] items-center">
          <Text className="text-[10px] text-gray-400 mb-0.5">Refill Count</Text>
          <Text className="text-xs font-bold text-gray-700">{row.refillCount}</Text>
        </View>
        <View className="w-[33%] items-center">
          <Text className="text-[10px] text-gray-400 mb-0.5">Sold Qty</Text>
          <Text className="text-xs font-bold text-gray-700">{row.soldQuantity}</Text>
        </View>
        <View className="w-[33%] items-center">
          <Text className="text-[10px] text-gray-400 mb-0.5">Sell %</Text>
          <Text className="text-xs font-bold text-gray-700">{row.sellPercentage}%</Text>
        </View>
        <View className="w-[33%] items-center">
          <Text className="text-[10px] text-gray-400 mb-0.5">Current</Text>
          <Text className="text-xs font-bold text-gray-800">{row.currentQuantity}</Text>
        </View>
      </View>

      <View className="flex-row border-t border-gray-200/50 pt-3 gap-2">
        <View className="flex-1">
          <Text className="text-[10px] text-gray-400 mb-0.5">Last Order In</Text>
          <Text className="text-xs font-semibold text-gray-700">{formatDateTime(row.lastInAt)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[10px] text-gray-400 mb-0.5">Last Order Out</Text>
          <Text className="text-xs font-semibold text-gray-700">{formatDateTime(row.lastOutAt)}</Text>
        </View>
      </View>
    </View>
  );
}

function EntityAccordion({ entity }: { entity: EntityMovementSummary }) {
  const [expanded, setExpanded] = useState(false);

  // Map database role uppercase strings to readable Title Case
  const getReadableRole = (role: string) => {
    if (role === UserRole.SUPER_STOCKIST) return 'Super Stockist';
    if (role === UserRole.DISTRIBUTOR) return 'Distributor';
    if (role === UserRole.RETAILER) return 'Retailer';
    return role.replace(/_/g, ' ');
  };

  // Warning count represents redCount + yellowCount or fallback to totalSkus if no data
  const warningCount = entity.redCount + entity.yellowCount || entity.totalSkus;

  return (
    <View className="border border-gray-200 rounded-2xl overflow-hidden mb-3 bg-white shadow-sm">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
        className="flex-row items-center p-4 bg-white justify-between"
      >
        <View className="flex-1 mr-2">
          <Text className="text-sm font-bold text-gray-800 uppercase">
            {entity.entityName || 'Unnamed Entity'}
          </Text>
          <Text className="text-[11px] text-gray-400 mt-0.5 font-semibold">
            {getReadableRole(entity.entityRole)} · {entity.totalSkus} SKUs
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="bg-red-50 rounded-full w-6 h-6 items-center justify-center">
            <Text className="text-[10px] font-black text-red-500">{warningCount}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color="#9ca3af"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="p-3 bg-gray-50/50 border-t border-gray-100 gap-1">
          {entity.skus.map((s) => (
            <SkuMobileCard key={s.skuId} row={s} />
          ))}
        </View>
      )}
    </View>
  );
}

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

export default function StockMovementsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const days = 45;
  const [entityRoleFilter, setEntityRoleFilter] = useState<'all' | UserRole.SUPER_STOCKIST | UserRole.DISTRIBUTOR | UserRole.RETAILER>('all');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showStateModal, setShowStateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.role === UserRole.ADMIN;
  const canDownloadReport =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.NSM ||
    user?.role === UserRole.RSM ||
    user?.role === UserRole.ASM;
  const canViewOwn = [UserRole.SUPER_STOCKIST, UserRole.DISTRIBUTOR, UserRole.RETAILER].includes(user?.role as UserRole);
  const canViewDownstream = isAdmin || [UserRole.NSM, UserRole.RSM, UserRole.ASM, UserRole.SUPER_STOCKIST, UserRole.DISTRIBUTOR, UserRole.SO, UserRole.ASE].includes(user?.role as UserRole);

  const { data: ownData, isLoading: ownLoading } = useQuery({
    queryKey: ['stock-movement-own', days, startDate, endDate],
    queryFn: () => stockMovementService.getOwnMovement(days, startDate || undefined, endDate || undefined),
    enabled: canViewOwn,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const { data: downstreamData, isLoading: downstreamLoading, error: downstreamError, isError: isDownstreamError } = useQuery({
    queryKey: ['stock-movement-downstream', days, stateFilter, startDate, endDate],
    queryFn: () => stockMovementService.getDownstreamMovement(days, undefined, stateFilter || undefined, startDate || undefined, endDate || undefined),
    enabled: canViewDownstream,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const isLoading = (canViewOwn && ownLoading) || (canViewDownstream && downstreamLoading);
  const allEntitiesRaw = [...(ownData?.entities ?? []), ...(downstreamData?.entities ?? [])];
  const allEntities = Array.from(new Map(allEntitiesRaw.map((e) => [e.entityId, e])).values());
  const roleFilteredEntities = entityRoleFilter === 'all'
    ? allEntities
    : allEntities.filter((entity) => entity.entityRole === entityRoleFilter);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredEntities = normalizedSearch
    ? roleFilteredEntities.flatMap((entity) => {
      const entityMatches =
        entity.entityName.toLowerCase().includes(normalizedSearch) ||
        entity.entityRole.toLowerCase().includes(normalizedSearch);

      if (entityMatches) {
        return [entity];
      }

      const matchingSkus = entity.skus.filter((sku) =>
        sku.skuName.toLowerCase().includes(normalizedSearch)
      );

      if (matchingSkus.length === 0) {
        return [];
      }

      return [recalculateEntityCounts(entity, matchingSkus)];
    })
    : roleFilteredEntities;

  const handleDownloadXlsx = async () => {
    const rows = filteredEntities.flatMap((entity) =>
      entity.skus.map((sku) => ({
        EntityName: entity.entityName || 'Unnamed Entity',
        EntityRole: entity.entityRole,
        State: entity.entityState ?? '-',
        SkuName: sku.skuName,
        FirstOrder: sku.firstOrderQuantity,
        RefillQty: sku.refillQuantity,
        RefillCount: sku.refillCount,
        SoldQty: sku.soldQuantity,
        SellPercent: sku.sellPercentage,
        CurrentQty: sku.currentQuantity,
        LastOrderIn: formatDateTime(sku.lastInAt),
        LastOrderOut: formatDateTime(sku.lastOutAt),
        Status: COLOR_MAP[sku.colorCode]?.label ?? 'No Data',
      }))
    );
    try {
      const { downloadXlsxReport } = require('@/lib/xlsx-export');
      await downloadXlsxReport(rows, {
        fileName: `stock-movements-report.xlsx`,
        sheetName: 'Stock Movement',
      });
    } catch (e) {
      console.error('Failed to export xlsx', e);
    }
  };

  // Helper function to get entity role filter label
  const getRoleLabel = () => {
    if (entityRoleFilter === UserRole.SUPER_STOCKIST) return 'Super Stockists';
    if (entityRoleFilter === UserRole.DISTRIBUTOR) return 'Distributors';
    if (entityRoleFilter === UserRole.RETAILER) return 'Retailers';
    return 'All Entities';
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
          <Text className="text-2xl font-bold text-gray-900">Stock Movements</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {filteredEntities.length} entit{filteredEntities.length !== 1 ? 'ies' : 'y'}
          </Text>
        </View>

        {/* Main Filters Controls (XLSX, Search, Dates, Dropdowns) */}
        <View className="mx-5 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm gap-3.5 mb-4">
          {/* Download & Search Input Row */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleDownloadXlsx}
              className="flex-row items-center justify-center bg-white border border-gray-200 px-3 py-2.5 rounded-xl active:bg-gray-50 flex-1"
            >
              <Ionicons name="download-outline" size={16} color="#4b5563" className="mr-1.5" />
              <Text className="text-xs font-semibold text-gray-700">Download Report as XLSX</Text>
            </TouchableOpacity>

            <View className="flex-1 flex-row items-center border border-gray-200 rounded-xl px-2.5 bg-white">
              <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-1.5" />
              <TextInput
                placeholder="Search entity or SKU..."
                placeholderTextColor="#9ca3af"
                value={searchTerm}
                onChangeText={setSearchTerm}
                className="flex-1 text-xs text-gray-800 p-0 h-9"
              />
            </View>
          </View>

          {/* Date Picker Input Row */}
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setShowStartCalendar(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-3 bg-white h-9"
            >
              <Text className="text-xs text-gray-700">
                {startDate ? startDate.split('-').reverse().join('-') : 'dd-mm-yyyy'}
              </Text>
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
            </TouchableOpacity>
            <Text className="text-xs text-gray-500">to</Text>
            <TouchableOpacity
              onPress={() => setShowEndCalendar(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-3 bg-white h-9"
            >
              <Text className="text-xs text-gray-700">
                {endDate ? endDate.split('-').reverse().join('-') : 'dd-mm-yyyy'}
              </Text>
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Dropdown Filters Row */}
          <View className="flex-row gap-2">
            {/* Entities Selector */}
            <TouchableOpacity
              onPress={() => setShowRoleModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
            >
              <Text className="text-xs text-gray-700 font-medium">{getRoleLabel()}</Text>
              <Ionicons name="chevron-down" size={14} color="#6b7280" />
            </TouchableOpacity>

            {/* State Selector */}
            <TouchableOpacity
              onPress={() => setShowStateModal(true)}
              className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
            >
              <Text className="text-xs text-gray-700 font-medium">
                {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All States'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Reset Filters Toggle */}
          {(!!startDate || !!endDate || !!stateFilter || entityRoleFilter !== 'all') && (
            <TouchableOpacity
              onPress={() => {
                setStartDate('');
                setEndDate('');
                setStateFilter('');
                setEntityRoleFilter('all');
              }}
              className="flex-row items-center justify-center border border-orange-200 bg-orange-50/20 py-2 rounded-xl active:bg-orange-50/40"
            >
              <Ionicons name="refresh-outline" size={14} color="#f97316" className="mr-1" />
              <Text className="text-xs font-semibold text-[#f97316]">Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Entities Accordion List */}
        {isLoading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : isDownstreamError ? (
          <View className="py-20 justify-center items-center px-4">
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="text-red-500 text-sm font-semibold mt-2 text-center">
              Error loading data: {downstreamError instanceof Error ? downstreamError.message : 'Unknown network error'}
            </Text>
          </View>
        ) : filteredEntities.length === 0 ? (
          <View className="py-20 justify-center items-center gap-2">
            <Ionicons name="cube-outline" size={48} color="#9ca3af" className="opacity-50" />
            <Text className="text-sm text-gray-500 font-medium">No stock movement data available</Text>
          </View>
        ) : (
          <View className="px-5 pb-24 gap-1">
            {filteredEntities.map((entity) => (
              <EntityAccordion key={entity.entityId} entity={entity} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Entities Role Selector Modal */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Entity Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { value: 'all', label: 'All Entities' },
                { value: UserRole.SUPER_STOCKIST, label: 'Super Stockists' },
                { value: UserRole.DISTRIBUTOR, label: 'Distributors' },
                { value: UserRole.RETAILER, label: 'Retailers' }
              ]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setEntityRoleFilter(item.value as any);
                    setShowRoleModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${entityRoleFilter === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${entityRoleFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {entityRoleFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
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
                    setStateFilter(item.value);
                    setShowStateModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${stateFilter === item.value ? 'bg-orange-50' : ''
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

      {/* Start Date Calendar Modal */}
      <CalendarModal
        visible={showStartCalendar}
        onClose={() => setShowStartCalendar(false)}
        onSelectDate={setStartDate}
        currentValue={startDate}
      />

      {/* End Date Calendar Modal */}
      <CalendarModal
        visible={showEndCalendar}
        onClose={() => setShowEndCalendar(false)}
        onSelectDate={setEndDate}
        currentValue={endDate}
      />
    </View>
  );
}

