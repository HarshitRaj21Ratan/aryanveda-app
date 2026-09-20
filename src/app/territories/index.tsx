import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useAuthStore } from '@/store/auth.store';
import { UserRole, type IUser } from '@/types';
import { STATE_OPTIONS } from '@/lib/states';
import { territoryService } from '@/services/territory.service';
import { userService } from '@/services/user.service';
import Pagination from '@/components/ui/Pagination';

const { width } = Dimensions.get('window');

function getRoleDisplayName(roleStr: string): string {
  switch (roleStr) {
    case UserRole.ADMIN: return 'Admin';
    case UserRole.NSM: return 'NSM';
    case UserRole.RSM: return 'RSM';
    case UserRole.ASM: return 'ASM';
    case UserRole.SO: return 'SO';
    case UserRole.ASE: return 'ASE';
    case UserRole.DISTRIBUTOR: return 'Distributor';
    case UserRole.SUPER_STOCKIST: return 'Super Stockist';
    case UserRole.RETAILER: return 'Retailer';
    default: return roleStr;
  }
}

export default function TerritoriesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Filter & Search states
  const [nameInput, setNameInput] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [dateRoleFilter, setDateRoleFilter] = useState('');
  const [suggestionPage, setSuggestionPage] = useState(1);
  const [sheetPage, setSheetPage] = useState(1);
  const sheetPageSize = 20;

  // UI state
  const [showStateModal, setShowStateModal] = useState(false);
  const [showDateRoleModal, setShowDateRoleModal] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);

  const justToggledRef = useRef(false);
  const lastToggleTimeRef = useRef(0);

  const handleToggleSuggestions = () => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 200) {
      return;
    }
    lastToggleTimeRef.current = now;
    justToggledRef.current = true;
    setIsSuggestionsOpen((prev) => !prev);
  };

  const handleInputFocus = () => {
    if (justToggledRef.current) {
      justToggledRef.current = false;
      return;
    }
    setIsSuggestionsOpen(true);
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!stateFilter && !selectedEntityId) {
      Alert.alert('Info', 'Please select a State or search for a person to filter network data before exporting.');
      return;
    }
    setIsExporting(true);
    try {
      const allDataRes = await territoryService.getSheet({
        state: stateFilter || undefined,
        entityId: selectedEntityId || undefined,
        page: 1,
        limit: 10000,
      });

      if (!allDataRes.data || allDataRes.data.length === 0) {
        Alert.alert('No Data', 'There is no network data to export for current filter criteria.');
        return;
      }

      const csvRows = [];
      // Headers
      csvRows.push([
        'Retailer Name',
        'Retailer Mobile',
        'Beat',
        'State',
        'SO Name',
        'SO Mobile',
        'ASE Name',
        'ASE Mobile',
        'Distributor Name',
        'Distributor Mobile',
        'Super Stockist Name',
        'Super Stockist Mobile',
        'ASM Name',
        'RSM Name',
        'NSM Name'
      ].join(','));

      // Rows
      for (const row of allDataRes.data) {
        const clean = (val: string | undefined) => {
          if (!val) return '""';
          return `"${val.replace(/"/g, '""')}"`;
        };
        csvRows.push([
          clean(row.retailerName),
          clean(row.retailerMobile),
          clean(row.beat),
          clean(row.state),
          clean(row.soName),
          clean(row.soMobile),
          clean(row.aseName),
          clean(row.aseMobile),
          clean(row.dbName),
          clean(row.dbMobile),
          clean(row.superName),
          clean(row.superMobile),
          clean(row.asmName),
          clean(row.rsmName),
          clean(row.nsmName)
        ].join(','));
      }
      const csvString = csvRows.join('\n');
      const filename = `Territory_Network_Export_${new Date().toISOString().slice(0, 10)}.csv`;

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
              dialogTitle: 'Export Territory Data',
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
      console.error('Export error:', err);
      Alert.alert('Error', err.message || 'Failed to export territory data.');
    } finally {
      setIsExporting(false);
    }
  };

  const role = user?.role as UserRole | undefined;
  const isAdmin = role === UserRole.ADMIN;

  // Suggestions query
  const { data: agentOptionsData, isLoading: agentOptionsLoading } = useQuery({
    queryKey: ['territory-agent-options-app', role, isAdmin, stateFilter, nameInput, suggestionPage],
    queryFn: async () => {
      const search = nameInput.trim() || undefined;
      const limit = 10;
      const state = stateFilter || undefined;

      let usersPromise;
      if (isAdmin) {
        usersPromise = userService.listAll({
          page: suggestionPage,
          limit,
          search,
          state,
        });
      } else if (role === UserRole.NSM || role === UserRole.RSM || role === UserRole.ASM || role === UserRole.ASE || role === UserRole.SO) {
        usersPromise = userService.listSubordinates({
          page: suggestionPage,
          limit,
          search,
          state,
        });
      } else {
        usersPromise = Promise.resolve({ success: true, data: [], total: 0, page: 1, limit });
      }

      const retailersPromise = userService.listRetailers({
        page: suggestionPage,
        limit,
        search,
        state,
      });

      const [usersRes, retailersRes] = await Promise.all([usersPromise, retailersPromise]);
      const combined = [...(usersRes?.data || []), ...(retailersRes?.data || [])];
      const total = (usersRes?.total || 0) + (retailersRes?.total || 0);

      return {
        success: true,
        data: combined,
        total,
        page: suggestionPage,
        limit,
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Sheet data query
  const { data: sheetData, isLoading: sheetLoading } = useQuery({
    queryKey: ['territory-sheet-app', stateFilter, selectedEntityId, sheetPage, sheetPageSize],
    queryFn: () =>
      territoryService.getSheet({
        state: stateFilter || undefined,
        entityId: selectedEntityId || undefined,
        page: sheetPage,
        limit: sheetPageSize,
      }),
    enabled: !!(stateFilter || selectedEntityId),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const suggestions = useMemo(() => {
    const raw = agentOptionsData?.data ?? [];
    const byEntityId = new Map<string, IUser>();
    for (const agent of raw) {
      if (!byEntityId.has(agent.entityId)) {
        byEntityId.set(agent.entityId, agent as any);
      }
    }
    return Array.from(byEntityId.values());
  }, [agentOptionsData]);

  const suggestionTotal = agentOptionsData?.total ?? 0;
  const suggestionLimit = agentOptionsData?.limit ?? 10;
  const suggestionTotalPages = Math.max(1, Math.ceil(suggestionTotal / suggestionLimit));

  const sheet = sheetData?.data ?? [];
  const sheetTotal = sheetData?.total ?? 0;
  const sheetTotalPages = Math.max(1, Math.ceil(sheetTotal / sheetPageSize));

  const getJoiningDate = (row: any, rFilter: string) => {
    switch (rFilter) {
      case UserRole.SUPER_STOCKIST: return row.superJoinedAt;
      case UserRole.DISTRIBUTOR: return row.dbJoinedAt;
      case UserRole.ASE: return row.aseJoinedAt;
      case UserRole.SO: return row.soJoinedAt;
      case UserRole.ASM: return row.asmJoinedAt;
      case UserRole.RSM: return row.rsmJoinedAt;
      case UserRole.NSM: return row.nsmJoinedAt;
      default: return row.retailerJoinedAt;
    }
  };

  const clearFilters = () => {
    setNameInput('');
    setSelectedEntityId('');
    setStateFilter('');
    setDateRoleFilter('');
    setSheetPage(1);
    setSuggestionPage(1);
    setIsSuggestionsOpen(false);
  };

  if (user?.role !== UserRole.ADMIN) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed" size={48} color="#ef4444" />
        <Text className="text-sm text-gray-500 mt-4">Access Denied. Admins Only.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ flex: 1 }}>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ zIndex: 10 }}>
        {/* Title block */}
        <View className="px-6 pt-5 pb-1">
          <Text className="text-xl font-bold text-slate-800">Territory Network</Text>
          <Text className="text-xs text-slate-400 mt-1">Select a state or search a person to view their network</Text>
        </View>

        {/* Filters */}
        <View className="px-6 pt-4 gap-3" style={{ zIndex: 50 }}>
          {/* Person name search */}
          <View className="relative z-10">
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleToggleSuggestions}
              className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Ionicons name="search-outline" size={18} color="#94a3b8" className="mr-2.5" />
              <TextInput
                value={nameInput}
                onChangeText={(val) => {
                  setNameInput(val);
                  setSelectedEntityId('');
                  setSuggestionPage(1);
                  setIsSuggestionsOpen(true);
                }}
                onFocus={handleInputFocus}
                onPressIn={handleToggleSuggestions}
                placeholder="Search person name"
                placeholderTextColor="#94a3b8"
                className="flex-1 text-sm text-slate-700 p-0"
              />
              {!!nameInput && (
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    setNameInput('');
                    setSelectedEntityId('');
                    setSuggestionPage(1);
                    setIsSuggestionsOpen(false);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Suggestions list */}
            {isSuggestionsOpen && suggestions.length > 0 && (
              <View className="absolute left-0 right-0 top-14 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-hidden z-20">
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.entityId}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 200 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedEntityId(item.entityId);
                        setNameInput(item.name);
                        setStateFilter('');
                        setSheetPage(1);
                        setIsSuggestionsOpen(false);
                      }}
                      className="p-3 border-b border-gray-100 flex-row justify-between items-center"
                    >
                      <Text className="text-xs text-gray-800 font-semibold">{item.name}</Text>
                      <Text className="text-[10px] text-gray-400 font-bold uppercase">{getRoleDisplayName(item.role)}</Text>
                    </TouchableOpacity>
                  )}
                />
                {suggestionTotalPages > 1 && (
                  <View className="flex-row items-center justify-between border-t border-gray-200 px-3 py-2 bg-gray-50">
                    <TouchableOpacity
                      disabled={suggestionPage <= 1}
                      onPress={() => setSuggestionPage((p) => Math.max(1, p - 1))}
                      className={`px-3 py-1.5 border rounded-lg ${
                        suggestionPage <= 1 ? 'border-gray-100 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Text className="text-[10px] font-bold text-gray-600">Prev</Text>
                    </TouchableOpacity>
                    <Text className="text-[10px] text-gray-500 font-semibold">Page {suggestionPage} of {suggestionTotalPages}</Text>
                    <TouchableOpacity
                      disabled={suggestionPage >= suggestionTotalPages}
                      onPress={() => setSuggestionPage((p) => Math.min(suggestionTotalPages, p + 1))}
                      className={`px-3 py-1.5 border rounded-lg ${
                        suggestionPage >= suggestionTotalPages ? 'border-gray-100 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Text className="text-[10px] font-bold text-gray-600">Next</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* State filter */}
          <TouchableOpacity
            onPress={() => setShowStateModal(true)}
            className="w-full flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white"
          >
            <Ionicons name="funnel-outline" size={16} color="#64748b" className="mr-3" />
            <Text className="text-sm text-slate-700 flex-1">
              State: {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" className="opacity-0" />
          </TouchableOpacity>

          {/* Date Role filter */}
          <TouchableOpacity
            onPress={() => setShowDateRoleModal(true)}
            className="w-full flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white"
          >
            <Ionicons name="funnel-outline" size={16} color="#64748b" className="mr-3" />
            <Text className="text-sm text-slate-700 flex-1">
              {dateRoleFilter ? `Role: ${getRoleDisplayName(dateRoleFilter)}` : 'All Role'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" className="opacity-0" />
          </TouchableOpacity>

          {/* Reset Filters button */}
          <TouchableOpacity
            onPress={clearFilters}
            className="w-full items-center justify-center border border-gray-200 bg-white rounded-xl py-3 mt-1"
          >
            <Text className="text-slate-700 text-sm font-semibold">Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Network Data Sheet Section Header */}
        <View className="px-6 pt-7 pb-4 flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Ionicons name="git-network-outline" size={18} color="#475569" />
            <Text className="text-sm font-semibold text-slate-750">Network Data Sheet</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-slate-500 font-medium">{sheetTotal} total rows</Text>
            <TouchableOpacity
              onPress={handleExport}
              disabled={isExporting}
              className="flex-row items-center border border-gray-200 bg-white rounded-lg px-2.5 py-1 gap-1"
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={13} color="#475569" />
                  <Text className="text-slate-700 text-[11px] font-semibold">Export</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Network display area sheet */}
        {sheetLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : !stateFilter && !selectedEntityId ? (
          <View className="mx-6 bg-white border border-gray-200 p-8 rounded-2xl items-center justify-center min-h-[220px]">
            <Text className="text-sm text-slate-400 text-center leading-relaxed px-4">
              Please select a State or search for a person to view network sheet.
            </Text>
          </View>
        ) : sheet.length === 0 ? (
          <View className="mx-6 bg-white border border-gray-200 p-8 rounded-2xl items-center justify-center min-h-[220px]">
            <Ionicons name="alert-circle-outline" size={36} color="#ef4444" className="opacity-70 mb-2" />
            <Text className="text-sm text-red-500 text-center font-medium">No downstream connections found</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true} className="mx-6 mb-24">
            <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Table Header */}
              <View className="flex-row bg-gray-50 border-b border-gray-200">
                <Text className="w-40 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Retailer</Text>
                <Text className="w-24 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Beat</Text>
                <Text className="w-40 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">SO</Text>
                <Text className="w-40 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">ASE</Text>
                <Text className="w-44 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Distributor</Text>
                <Text className="w-44 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Super Stockist</Text>
                <Text className="w-40 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">ASM</Text>
                <Text className="w-40 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">RSM</Text>
                <Text className="w-40 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">NSM</Text>
                <Text className="w-28 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">State</Text>
                <Text className="w-32 px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Joined {getRoleDisplayName(dateRoleFilter) || 'Retailer'}</Text>
              </View>

              {/* Table Body */}
              {sheet.map((row, index) => {
                const joinedDateRaw = getJoiningDate(row, dateRoleFilter);
                const joinedDate = joinedDateRaw ? new Date(joinedDateRaw).toLocaleDateString('en-IN') : '—';
                return (
                  <View key={index} className="flex-row border-b border-gray-100 last:border-0 bg-white items-center">
                    <View className="w-40 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.retailerName || '—'}</Text>
                      {row.retailerMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.retailerMobile}</Text> : null}
                    </View>
                    <View className="w-24 px-3 py-2.5">
                      <Text className="text-xs text-slate-700">{row.beat || '—'}</Text>
                    </View>
                    <View className="w-40 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.soName || '—'}</Text>
                      {row.soMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.soMobile}</Text> : null}
                    </View>
                    <View className="w-40 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.aseName || '—'}</Text>
                      {row.aseMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.aseMobile}</Text> : null}
                    </View>
                    <View className="w-44 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.dbName || '—'}</Text>
                      {row.dbMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.dbMobile}</Text> : null}
                    </View>
                    <View className="w-44 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.superName || '—'}</Text>
                      {row.superMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.superMobile}</Text> : null}
                    </View>
                    <View className="w-40 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.asmName || '—'}</Text>
                      {row.asmMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.asmMobile}</Text> : null}
                    </View>
                    <View className="w-40 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.rsmName || '—'}</Text>
                      {row.rsmMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.rsmMobile}</Text> : null}
                    </View>
                    <View className="w-40 px-3 py-2.5">
                      <Text className="text-xs font-bold text-slate-800">{row.nsmName || '—'}</Text>
                      {row.nsmMobile ? <Text className="text-[10px] text-slate-400 mt-0.5">{row.nsmMobile}</Text> : null}
                    </View>
                    <View className="w-28 px-3 py-2.5">
                      <Text className="text-xs text-slate-700 capitalize">{row.state || '—'}</Text>
                    </View>
                    <View className="w-32 px-3 py-2.5">
                      <Text className="text-xs text-slate-500 font-semibold">{joinedDate}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>

      {/* Pagination Footer */}

      <View style={{ zIndex: 1 }}>
        <Pagination
          currentPage={sheetPage}
          totalPages={sheetTotalPages}
          onPageChange={setSheetPage}
          totalItems={sheetTotal}
          itemsPerPage={sheetPageSize}
        />
      </View>

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
                    if (item.value) {
                      setSelectedEntityId('');
                      setNameInput('');
                    }
                    setSheetPage(1);
                    setShowStateModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    stateFilter === item.value ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-sm ${stateFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {stateFilter === item.value && <Ionicons name="checkmark" size={18} color="#f37021" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Date Role Filter Modal */}
      <Modal
        visible={showDateRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateRoleModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Joined Date Role</Text>
              <TouchableOpacity onPress={() => setShowDateRoleModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            {[
              { value: '', label: 'All Role' },
              { value: UserRole.RETAILER, label: 'Retailer' },
              { value: UserRole.SUPER_STOCKIST, label: 'Super Stockist' },
              { value: UserRole.DISTRIBUTOR, label: 'Distributor' },
              { value: UserRole.NSM, label: 'NSM' },
              { value: UserRole.RSM, label: 'RSM' },
              { value: UserRole.ASM, label: 'ASM' },
              { value: UserRole.SO, label: 'SO' },
              { value: UserRole.ASE, label: 'ASE' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  setDateRoleFilter(item.value);
                  setShowDateRoleModal(false);
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                  dateRoleFilter === item.value ? 'bg-orange-50' : ''
                }`}
              >
                <Text className={`text-sm ${dateRoleFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {dateRoleFilter === item.value && <Ionicons name="checkmark" size={18} color="#f37021" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
