import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { visitService, type VisitPerformanceBucket, type VisitPerformanceRecentRow } from '@/services/visit.service';
import { UserRole } from '@/types';
import { CalendarModal } from '@/components/ui/CalendarModal';

export { CalendarModal };

// ── Helpers ──
export function toInputDate(date: Date): string {
  try {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const localTime = date.getTime() + tzOffset;
    const localDate = new Date(localTime);
    return localDate.toISOString().slice(0, 10);
  }
}

export function lastNDaysRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

export function thisMonthRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: toInputDate(from), to: toInputDate(to) };
}

export function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0';
  if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(1) + 'L';
  }
  if (num >= 1000) {
    return '₹' + (num / 1000).toFixed(0) + 'k';
  }
  return '₹' + num.toString();
}

export function formatVisitTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function openMapLocation(lat: number, lng: number) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  Linking.openURL(url);
}

// ── KPI Card Component ──
interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  valueColorClass?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
}

export function KpiCard({
  label,
  value,
  sub,
  valueColorClass = 'text-slate-800',
  icon,
  iconColor = '#64748b',
  onPress,
}: KpiCardProps) {
  const content = (
    <View className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
      <View className="flex-row items-center gap-1.5">
        {icon && <Ionicons name={icon} size={14} color={iconColor} />}
        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</Text>
      </View>
      <Text className={`text-2xl font-black mt-2 ${valueColorClass}`}>{value}</Text>
      {sub && <Text className="text-xs text-slate-400 mt-1">{sub}</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// ── Timeline Breakdown Component ──
export function TimelineBreakdown({
  buckets,
  maxVisits,
}: {
  buckets: VisitPerformanceBucket[];
  maxVisits: number;
}) {
  return (
    <View className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm gap-4">
      <View className="flex-row justify-between items-center border-b border-gray-100 pb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={18} color="#f97316" />
          <Text className="text-sm font-bold text-slate-800">Timeline Breakdown</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Text className="text-[10px] text-slate-400">Productive</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-slate-300" />
            <Text className="text-[10px] text-slate-400">Visited only</Text>
          </View>
        </View>
      </View>

      {buckets.length === 0 ? (
        <Text className="text-xs text-gray-400 text-center py-4">No visits recorded in this window</Text>
      ) : (
        <View className="gap-3">
          {buckets.map((bucket) => {
            const totalWidth = maxVisits > 0 ? (bucket.visits / maxVisits) * 100 : 0;
            const productivePct = bucket.visits > 0 ? bucket.productive / bucket.visits : 0;
            const totalCount = bucket.visits || 0;
            const prodCount = bucket.productive || 0;
            const pctVal = totalCount > 0 ? ((prodCount / totalCount) * 100).toFixed(1) : '0.0';

            return (
              <View key={bucket.key} className="flex-row items-center gap-2.5">
                <Text className="w-14 text-[10px] text-slate-400 font-semibold">{bucket.label}</Text>
                <View className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden relative">
                  <View
                    className="absolute left-0 top-0 h-full bg-slate-300 rounded-full"
                    style={{ width: `${totalWidth}%` }}
                  />
                  <View
                    className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full"
                    style={{ width: `${totalWidth * productivePct}%` }}
                  />
                </View>
                <Text className="w-20 text-[9px] text-slate-400 font-bold text-right">
                  <Text className="text-emerald-600">{prodCount}</Text>/{totalCount} ({pctVal}%)
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Store Visit Card Component ──
export function VisitCard({
  visit,
  isManager,
  onViewImage,
}: {
  visit: VisitPerformanceRecentRow;
  isManager?: boolean;
  onViewImage: (visit: VisitPerformanceRecentRow) => void;
}) {
  let classBadgeBg = 'bg-slate-50 border-slate-200';
  let classBadgeText = 'text-slate-600';
  if (visit.classification === 'productive') {
    classBadgeBg = 'bg-green-50 border-green-200';
    classBadgeText = 'text-green-700';
  } else if (visit.classification === 'visited') {
    classBadgeBg = 'bg-orange-50 border-orange-100';
    classBadgeText = 'text-orange-700';
  } else if (visit.classification === 'out_store') {
    classBadgeBg = 'bg-red-50 border-red-200';
    classBadgeText = 'text-red-700';
  }

  return (
    <View className="border border-gray-150 rounded-2xl p-4 bg-white shadow-sm gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 rounded-xl bg-gray-100 justify-center items-center overflow-hidden border border-gray-100">
          {visit.proofImageUrl ? (
            <Image source={{ uri: visit.proofImageUrl }} className="h-full w-full object-cover" />
          ) : (
            <Ionicons name="storefront-outline" size={20} color="#94a3b8" />
          )}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-slate-800 truncate">{visit.retailerName}</Text>
          <Text className="text-[10px] text-slate-400 mt-0.5">ID: {visit.retailerEntityId}</Text>
          {isManager && (visit.createdByName || visit.createdByEntityId) ? (
            <Text className="text-[10px] text-slate-400 mt-0.5">
              Logged by: <Text className="text-blue-600 font-bold">{visit.createdByName || visit.createdByEntityId}</Text>
            </Text>
          ) : (
            visit.retailerBeat ? (
              <Text className="text-[10px] text-slate-400 mt-0.5">Beat: {visit.retailerBeat}</Text>
            ) : null
          )}
          <Text className="text-[9px] text-slate-400 mt-1 flex-row items-center gap-0.5">
            <Ionicons name="time-outline" size={10} color="#94a3b8" /> {formatVisitTime(visit.visitedAt)}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 flex-wrap gap-2">
        <View className="flex-row gap-1.5 flex-wrap">
          <View className={`px-2.5 py-0.5 rounded-full border ${classBadgeBg}`}>
            <Text className={`text-[9px] font-bold uppercase ${classBadgeText}`}>
              {visit.classification === 'visited' ? 'Visited' : visit.classification}
            </Text>
          </View>
          {visit.manualVerify && (
            <View className="px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50">
              <Text className="text-[8px] font-bold text-orange-700">GPS ERROR</Text>
            </View>
          )}
        </View>

        <View className="flex-row gap-1.5">
          {visit.latitude && visit.longitude ? (
            <TouchableOpacity
              onPress={() => openMapLocation(visit.latitude!, visit.longitude!)}
              className="flex-row items-center justify-center border border-gray-200 rounded-xl px-3 py-1.5 bg-white gap-1"
            >
              <Ionicons name="location-outline" size={12} color="#64748b" />
              <Text className="text-[10px] font-bold text-slate-600">Location</Text>
            </TouchableOpacity>
          ) : null}
          {visit.proofImageUrl ? (
            <TouchableOpacity
              onPress={() => onViewImage(visit)}
              className="flex-row items-center justify-center border border-gray-200 rounded-xl px-3 py-1.5 bg-white gap-1"
            >
              <Ionicons name="camera-outline" size={12} color="#64748b" />
              <Text className="text-[10px] font-bold text-slate-600">Image</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── I Am Here Log Card Component ──
export function IAmHereCard({
  visit,
  onViewImage,
  onViewRemark,
}: {
  visit: VisitPerformanceRecentRow;
  onViewImage: (visit: VisitPerformanceRecentRow) => void;
  onViewRemark: (remark: string) => void;
}) {
  return (
    <View className="border border-gray-150 rounded-2xl p-4 bg-white shadow-sm gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 rounded-full bg-blue-50 justify-center items-center border border-blue-100">
          <Ionicons name="pin" size={18} color="#2563eb" />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-slate-800 truncate">
            Logged by: <Text className="text-blue-600 font-bold">{visit.createdByName || visit.createdByEntityId || 'Me'}</Text>
          </Text>
          <Text className="text-[9px] text-slate-400 mt-0.5">{formatVisitTime(visit.visitedAt)}</Text>
        </View>
      </View>

      <View className="flex-row justify-end gap-1.5 pt-3 border-t border-gray-100">
        {visit.latitude && visit.longitude ? (
          <TouchableOpacity
            onPress={() => openMapLocation(visit.latitude!, visit.longitude!)}
            className="flex-row items-center justify-center border border-gray-200 rounded-xl px-3 py-1.5 bg-white gap-1"
          >
            <Ionicons name="location-outline" size={12} color="#64748b" />
            <Text className="text-[10px] font-bold text-slate-600">Location</Text>
          </TouchableOpacity>
        ) : null}
        {visit.proofImageUrl ? (
          <TouchableOpacity
            onPress={() => onViewImage(visit)}
            className="flex-row items-center justify-center border border-gray-200 rounded-xl px-3 py-1.5 bg-white gap-1"
          >
            <Ionicons name="camera-outline" size={12} color="#64748b" />
            <Text className="text-[10px] font-bold text-slate-600">Photo</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => onViewRemark(visit.notes || 'No notes provided')}
          className="flex-row items-center justify-center border border-gray-200 rounded-xl px-3 py-1.5 bg-white gap-1"
        >
          <Ionicons name="chatbox-ellipses-outline" size={12} color="#64748b" />
          <Text className="text-[10px] font-bold text-slate-600">Remark</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Proof Image Modal Component ──
export function ProofImageModal({
  selectedVisitImage,
  onClose,
}: {
  selectedVisitImage: { retailerName: string; visitDateKey: string; proofImageUrl: string } | null;
  onClose: () => void;
}) {
  if (!selectedVisitImage) return null;

  return (
    <Modal visible={!!selectedVisitImage} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 justify-center items-center p-6">
        <View className="bg-white rounded-2xl p-4 w-full max-w-sm gap-3 shadow-2xl relative">
          <TouchableOpacity
            onPress={onClose}
            className="absolute right-3 top-3 z-10 bg-white/80 p-1.5 rounded-full border border-gray-200 shadow-sm"
          >
            <Ionicons name="close" size={18} color="#374151" />
          </TouchableOpacity>
          <Image
            source={{ uri: selectedVisitImage.proofImageUrl }}
            className="h-72 w-full rounded-xl object-contain mt-2"
          />
          <Text className="text-xs text-gray-500 text-center font-semibold mt-1">
            {selectedVisitImage.retailerName} · {selectedVisitImage.visitDateKey}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Remark Modal Component ──
export function RemarkModal({
  selectedRemark,
  onClose,
}: {
  selectedRemark: string | null;
  onClose: () => void;
}) {
  if (!selectedRemark) return null;

  return (
    <Modal visible={!!selectedRemark} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-6">
        <View className="bg-white rounded-2xl p-5 w-full max-w-xs gap-4 shadow-xl">
          <Text className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-2">Remark Note</Text>
          <Text className="text-xs text-gray-500 leading-relaxed">{selectedRemark}</Text>
          <TouchableOpacity
            onPress={onClose}
            className="bg-orange-500 py-2.5 rounded-xl items-center"
          >
            <Text className="text-white text-xs font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── New Counters Modal Component ──
export function NewCountersModal({
  visible,
  onClose,
  activeSoIds,
  allSoIds,
  period,
  fromDate,
  toDate,
  stateParam,
  creatorName,
  creatorRoles,
  type = 'retailer',
}: {
  visible: boolean;
  onClose: () => void;
  activeSoIds: string[];
  allSoIds?: string[];
  period: any;
  fromDate?: string;
  toDate?: string;
  stateParam?: string;
  creatorName?: string;
  creatorRoles?: string[];
  type?: 'retailer' | 'distributor_super';
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const targetSoIds = React.useMemo(() => {
    if (activeSoIds && activeSoIds.length > 0) return activeSoIds;
    if (allSoIds && allSoIds.length > 0) return allSoIds;
    return [];
  }, [activeSoIds, allSoIds]);

  const { data: newEntities, isLoading } = useQuery({
    queryKey: ['admin-new-entities-modal', targetSoIds.join(','), period, fromDate, toDate, stateParam, type],
    queryFn: () =>
      visitService.getAdminNewEntities({
        soEntityId: targetSoIds,
        period,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        state: stateParam,
      }),
    enabled: visible && targetSoIds.length > 0,
  });

  const isDistSuperView = type === 'distributor_super';

  const filteredEntities = React.useMemo(() => {
    if (!newEntities) return [];
    let list = newEntities;

    if (type === 'retailer') {
      list = list.filter((e: any) => e.role === UserRole.RETAILER);
    } else if (type === 'distributor_super') {
      list = list.filter((e: any) => e.role === UserRole.DISTRIBUTOR || e.role === UserRole.SUPER_STOCKIST);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e: any) =>
        (e.name ?? '').toLowerCase().includes(q) ||
        (e.phone ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [newEntities, type, searchQuery]);

  const headerTitle = isDistSuperView ? 'New Distributors/Supers Added' : 'New Counters Added';
  const emptyText = isDistSuperView ? 'No new distributors/supers found.' : 'No new counters found.';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }} className="bg-gray-50">
        <View className="bg-white px-5 py-4 border-b border-gray-150 flex-row items-center gap-3.5 shadow-sm">
          <TouchableOpacity onPress={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <Ionicons name="arrow-back" size={22} color="#4b5563" />
          </TouchableOpacity>
          <View>
            <Text className="text-base font-bold text-gray-900">{headerTitle}</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Text className="text-[10px] text-slate-400 font-semibold">
                By {creatorName || 'Selected Field Staff'}
              </Text>
              {creatorRoles?.map((role) => (
                <View key={role} className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                  <Text className="text-[8px] font-bold text-gray-500 uppercase">{role}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View className="p-4 bg-white border-b border-gray-100 flex-row items-center gap-2">
          <Ionicons name="search" size={16} color="#9ca3af" />
          <TextInput
            placeholder="Search by name or phone..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-xs text-slate-800 p-0"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f37021" />
          </View>
        ) : !filteredEntities || filteredEntities.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6 gap-3">
            <Ionicons name="storefront-outline" size={48} color="#cbd5e1" />
            <Text className="text-xs text-slate-400 font-semibold">{emptyText}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 80 }}
            showsVerticalScrollIndicator={true}
          >
            <View className="gap-3.5 mb-16">
              {filteredEntities.map((entity: any, idx: number) => {
                const formattedDate = entity.createdAt
                  ? new Date(entity.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-';

                const roleBadgeText = entity.role === UserRole.RETAILER ? 'Counter' : entity.role === UserRole.DISTRIBUTOR ? 'Distributor' : 'Super';

                return (
                  <View key={`${entity.entityId}-${idx}`} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    {!isDistSuperView && (
                      <View className="h-32 bg-slate-100 items-center justify-center relative">
                        {entity.storeImageUrl ? (
                          <Image
                            source={{ uri: entity.storeImageUrl }}
                            className="h-full w-full"
                            style={{ resizeMode: 'cover' }}
                          />
                        ) : (
                          <Ionicons name="storefront-outline" size={40} color="#94a3b8" />
                        )}
                        <View className="absolute top-3.5 right-3.5 bg-white/90 px-2 py-0.5 rounded-full border border-gray-100">
                          <Text className="text-[8px] font-bold text-slate-500 uppercase">{roleBadgeText}</Text>
                        </View>
                      </View>
                    )}

                    <View className="p-4 gap-2.5">
                      <View className="flex-row justify-between items-start gap-2">
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-slate-800">{entity.name || 'Unnamed Entity'}</Text>
                          <Text className="text-[10px] text-slate-400 font-semibold mt-0.5">ID: {entity.entityId}</Text>
                        </View>
                        {isDistSuperView && (
                          <View className="bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                            <Text className="text-[9px] font-bold text-blue-600">
                              {entity.role === UserRole.DISTRIBUTOR ? 'Distributor' : 'Super'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="space-y-1.5 pt-2.5 border-t border-gray-100">
                        {entity.phone ? (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${entity.phone}`)}
                            className="flex-row items-center gap-2"
                          >
                            <Ionicons name="call-outline" size={12} color="#64748b" />
                            <Text className="text-xs text-slate-600 font-semibold">{entity.phone}</Text>
                          </TouchableOpacity>
                        ) : null}

                        <View className="flex-row items-start gap-2">
                          <Ionicons name="location-outline" size={12} color="#64748b" className="mt-0.5" />
                          <Text className="text-xs text-slate-500 flex-1 leading-tight">
                            {[entity.address, entity.city, entity.state].filter(Boolean).join(', ') || 'No address provided'}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2 pt-2 border-t border-gray-100 mt-1">
                          <Ionicons name="calendar-outline" size={12} color="#64748b" />
                          <Text className="text-xs text-slate-500">
                            Joined: <Text className="font-semibold text-slate-700">{formattedDate}</Text>
                          </Text>
                        </View>

                        {entity.createdByName ? (
                          <View className="flex-row justify-between items-center pt-2 border-t border-dashed border-gray-100 mt-1">
                            <View className="flex-row items-center gap-1">
                              <Ionicons name="people-outline" size={12} color="#64748b" />
                              <Text className="text-[10px] text-slate-400">Added by</Text>
                            </View>
                            <Text className="text-[10px] font-semibold text-slate-600">{entity.createdByName} ({entity.createdByRole})</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
