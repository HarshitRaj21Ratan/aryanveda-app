import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { retailerTransferService } from '@/services/retailerTransfer.service';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

type Tab = 'beat' | 'ase' | 'asm' | 'rsm' | 'distributor' | 'ss';

export default function AdminTransferScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('beat');

  // Single centralized mapping modal state to avoid rendering multiple modals simultaneously
  const [activeMappingModal, setActiveMappingModal] = useState<{
    title: string;
    data: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (val: string) => void;
  } | null>(null);

  if (user?.role !== UserRole.ADMIN) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed" size={48} color="#ef4444" />
        <Text className="text-sm text-gray-500 mt-4">Access Denied. Admins Only.</Text>
      </View>
    );
  }

  const openMappingModal = (
    title: string,
    data: { value: string; label: string }[],
    selectedValue: string,
    onSelect: (val: string) => void
  ) => {
    setActiveMappingModal({ title, data, selectedValue, onSelect });
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-150 bg-white flex-row items-center gap-3">
        <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
          <Ionicons name="swap-horizontal" size={22} color="#f97316" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800">Business Partner & Hierarchy Transfer</Text>
          <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
            Admin tool to transfer sales force hierarchy and partners
          </Text>
        </View>
      </View>

      {/* Tabs Row (Scrollable to support all 6 tabs cleanly on mobile screens) */}
      <View className="bg-white border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {(['beat', 'ase', 'asm', 'rsm', 'distributor', 'ss'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            const label =
              tab === 'beat'
                ? 'Transfer Beat (SO)'
                : tab === 'ase'
                ? 'Transfer ASE'
                : tab === 'asm'
                ? 'Transfer ASM'
                : tab === 'rsm'
                ? 'Transfer RSM'
                : tab === 'distributor'
                ? 'Transfer Distributor'
                : 'Transfer Super Stockist';
            return (
              <TouchableOpacity
                key={tab}
                className={`py-3.5 px-4 items-center border-b-2 ${
                  isSelected ? 'border-[#f37021]' : 'border-transparent'
                }`}
                onPress={() => setActiveTab(tab)}
              >
                <Text className={`text-xs font-bold ${isSelected ? 'text-[#f37021]' : 'text-gray-500'}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {activeTab === 'beat' && <TransferBeatTab />}
        {activeTab === 'ase' && <TransferAseTab onOpenMapping={openMappingModal} />}
        {activeTab === 'asm' && <TransferAsmTab onOpenMapping={openMappingModal} />}
        {activeTab === 'rsm' && <TransferRsmTab onOpenMapping={openMappingModal} />}
        {activeTab === 'distributor' && <TransferDistributorTab />}
        {activeTab === 'ss' && <TransferSuperStockistTab onOpenMapping={openMappingModal} />}
      </ScrollView>

      {/* Centralized Mapping Selector Modal */}
      {activeMappingModal && (
        <SelectorModal
          visible={true}
          onClose={() => setActiveMappingModal(null)}
          title={activeMappingModal.title}
          data={activeMappingModal.data}
          selectedValue={activeMappingModal.selectedValue}
          onSelect={activeMappingModal.onSelect}
        />
      )}
    </View>
  );
}

// -- Shared Helper Components ------------------------------------------------

function PickerTrigger({
  label,
  placeholder,
  onPress,
  loading,
  selectedValues = [],
  options = [],
  onUnselect,
  onClear,
  showOrderNumbers = false,
}: any) {
  const selectedOptions = useMemo(() => {
    return selectedValues
      .map((val: string) => options.find((opt: any) => opt.value === val))
      .filter((opt: any) => opt !== undefined);
  }, [selectedValues, options]);

  return (
    <View className="gap-1.5 mb-3.5">
      <Text className="text-xs font-bold text-slate-500">{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
        className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white min-h-[50px]"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#f37021" />
        ) : selectedOptions.length === 0 ? (
          <Text className="text-xs text-gray-400">{placeholder}</Text>
        ) : (
          <View className="flex-row flex-wrap gap-1.5 flex-1 mr-2 py-0.5">
            {selectedOptions.map((opt: any, index: number) => (
              <View
                key={opt.value}
                className="flex-row items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-2 py-0.5"
              >
                {showOrderNumbers && (
                  <View className="w-4 h-4 rounded-full bg-[#f37021] items-center justify-center">
                    <Text className="text-white text-[9px] font-bold">{index + 1}</Text>
                  </View>
                )}
                <Text className="text-[11px] font-semibold text-[#f37021] max-w-[150px]" numberOfLines={1}>
                  {opt.label}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    if (onUnselect) onUnselect(opt.value);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="p-0.5"
                >
                  <Ionicons name="close" size={13} color="#f37021" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View className="flex-row items-center gap-2 shrink-0">
          {selectedOptions.length > 0 && onClear && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onClear();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="p-1"
            >
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-down" size={16} color="#6b7280" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function MappingSelectorTrigger({ value, onPress, disabled }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-between border rounded-lg px-3 py-2 ${
        disabled ? 'border-gray-150 bg-gray-50 opacity-50' : 'border-gray-200 bg-white'
      }`}
    >
      <Text className={`text-xs font-medium flex-1 mr-2 ${disabled ? 'text-gray-400' : 'text-gray-700'}`} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="chevron-down" size={14} color={disabled ? '#d1d5db' : '#6b7280'} />
    </TouchableOpacity>
  );
}

function SelectorModal({ visible, onClose, data, selectedValue, onSelect, title }: any) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = (data || []).filter((item: any) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setSearchQuery(''); onClose(); }}>
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[70%]">
          <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
            <Text className="font-bold text-gray-800 text-base">{title}</Text>
            <TouchableOpacity onPress={() => { setSearchQuery(''); onClose(); }} className="p-1">
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-2 border-b border-gray-100 bg-white">
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Ionicons name="search-outline" size={16} color="#6b7280" className="mr-2" />
              <TextInput
                placeholder="Search..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-xs text-gray-800 p-0"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item.value);
                  setSearchQuery('');
                  onClose();
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                  selectedValue === item.value ? 'bg-orange-50' : ''
                }`}
              >
                <Text className={`text-xs ${selectedValue === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`} style={{ flex: 1, marginRight: 8 }}>
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

function MultiSelectorModal({ visible, onClose, data, selectedValues = [], onSelect, title }: any) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = (data || []).filter((item: any) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (value: string) => {
    const idx = selectedValues.indexOf(value);
    if (idx > -1) {
      const newVals = selectedValues.filter((v: string) => v !== value);
      onSelect(newVals);
    } else {
      onSelect([...selectedValues, value]);
    }
  };

  const isAllSelected = filteredData.length > 0 && filteredData.every((item: any) => selectedValues.includes(item.value));

  const handleSelectAllToggle = () => {
    const filteredValues = filteredData.map((d: any) => d.value);
    if (isAllSelected) {
      onSelect(selectedValues.filter((v: string) => !filteredValues.includes(v)));
    } else {
      onSelect(Array.from(new Set([...selectedValues, ...filteredValues])));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setSearchQuery(''); onClose(); }}>
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[70%]">
          <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
            <Text className="font-bold text-gray-800 text-base">{title}</Text>
            <TouchableOpacity onPress={() => { setSearchQuery(''); onClose(); }} className="p-1">
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-2 border-b border-gray-100 bg-white">
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Ionicons name="search-outline" size={16} color="#6b7280" className="mr-2" />
              <TextInput
                placeholder="Search..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-xs text-gray-800 p-0"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Selected Info & Select All */}
          <View className="px-4 py-2.5 border-b border-gray-100 flex-row justify-between items-center bg-white">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Selected: {selectedValues.length} / {data.length}
            </Text>
            <TouchableOpacity onPress={handleSelectAllToggle}>
              <Text className="text-xs font-bold text-orange-600">
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const selectedIdx = selectedValues.indexOf(item.value);
              const isSelected = selectedIdx > -1;
              return (
                <TouchableOpacity
                  onPress={() => handleToggle(item.value)}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                    isSelected ? 'bg-orange-50' : ''
                  }`}
                >
                  <Text className={`text-xs ${isSelected ? 'font-bold text-orange-600' : 'text-gray-700'}`} style={{ flex: 1, marginRight: 8 }}>
                    {item.label}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {isSelected && (
                      <View className="w-5 h-5 bg-orange-500 rounded-full items-center justify-center">
                        <Text className="text-white text-[10px] font-bold">{selectedIdx + 1}</Text>
                      </View>
                    )}
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={isSelected ? '#f37021' : '#9ca3af'}
                    />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// -- Beat Tab ----------------------------------------------------

function TransferBeatTab() {
  const [sourceSoIds, setSourceSoIds] = useState<string[]>([]);
  const [targetSoIds, setTargetSoIds] = useState<string[]>([]);
  const [selectedBeats, setSelectedBeats] = useState<string[]>([]);
  const [isMultiBeat, setIsMultiBeat] = useState(true);

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showBeatModal, setShowBeatModal] = useState(false);

  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: ['admin-sos'],
    queryFn: () => userService.listAll({ role: 'so,ase', limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const sourceSoKey = useMemo(() => sourceSoIds.slice().sort().join(','), [sourceSoIds]);
  const { data: soBeats, isLoading: beatsLoading } = useQuery({
    queryKey: ['admin-so-beats-multi', sourceSoKey],
    queryFn: () => retailerTransferService.getMultiSoBeats(sourceSoIds),
    enabled: sourceSoIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const soOptions = (soData?.data ?? []).map((so) => ({
    value: so.entityId,
    label: `${so.name} (${so.entityId})`,
  }));

  const beatOptions = (soBeats ?? []).map((b) => ({
    value: b,
    label: b,
  }));

  const isSingleTargetMode = targetSoIds.length === 1;
  const isPairedMode = targetSoIds.length > 1;

  const pairs = useMemo(() => {
    if (!isPairedMode) return [];
    const list = [];
    const maxLen = Math.max(sourceSoIds.length, targetSoIds.length);
    for (let i = 0; i < maxLen; i++) {
      const srcId = sourceSoIds[i] || '';
      const tgtId = targetSoIds[i] || targetSoIds[0] || '';
      const srcOpt = soOptions.find((o) => o.value === srcId);
      const tgtOpt = soOptions.find((o) => o.value === tgtId);
      list.push({
        index: i + 1,
        sourceId: srcId,
        targetId: tgtId,
        sourceName: srcOpt ? srcOpt.label : 'Select Source SO...',
        targetName: tgtOpt ? tgtOpt.label : 'Select Target SO...',
        isValid: Boolean(srcId && tgtId),
      });
    }
    return list;
  }, [isPairedMode, sourceSoIds, targetSoIds, soOptions]);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (isSingleTargetMode) {
        const targetSoId = targetSoIds[0];
        const beatsToTransfer = isMultiBeat ? selectedBeats : selectedBeats.slice(0, 1);
        await retailerTransferService.transferBulkBeat(
          sourceSoIds,
          targetSoId,
          beatsToTransfer.length > 0 ? beatsToTransfer : undefined
        );
      } else {
        const maxLen = Math.max(sourceSoIds.length, targetSoIds.length);
        for (let i = 0; i < maxLen; i++) {
          const srcId = sourceSoIds[i];
          const tgtId = targetSoIds[i] || targetSoIds[0];
          if (!srcId || !tgtId) continue;
          await retailerTransferService.transferBulkBeat([srcId], tgtId);
        }
      }
    },
    onSuccess: () => {
      Alert.alert('Success', 'Beat/SO transfer completed successfully');
      setSourceSoIds([]);
      setTargetSoIds([]);
      setSelectedBeats([]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Transfer failed');
    },
  });

  const handleSourceSoChange = (val: string[]) => {
    setSourceSoIds(val);
    setSelectedBeats([]);
  };

  const beatLabels = selectedBeats.join(', ');

  const targetOptionsFiltered = useMemo(() => {
    return soOptions.filter((o) => !sourceSoIds.includes(o.value));
  }, [soOptions, sourceSoIds]);

  const targetLabels = targetSoIds
    .map((id) => soData?.data?.find((so) => so.entityId === id)?.name || id)
    .join(', ');

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm gap-4 mb-8">
      <View className="flex-row items-center gap-2 border-b border-gray-100 pb-3">
        <Ionicons name="location-outline" size={18} color="#f97316" className="mr-1" />
        <Text className="text-sm font-bold text-slate-800">Transfer Beat(s) / SO(s) to New Hierarchy</Text>
      </View>
      <Text className="text-xs text-slate-400 leading-relaxed -mt-2">
        Select Source SO(s), optional Beat(s), and Target SO(s). Transfer beats from multiple SOs to a single Target SO, or pair SOs 1-to-1.
      </Text>

      <PickerTrigger
        label="Source SO(s) * (Numbered Order)"
        placeholder="Search & Select Source SOs..."
        onPress={() => setShowSourceModal(true)}
        loading={soLoading}
        selectedValues={sourceSoIds}
        options={soOptions}
        onUnselect={(val: string) => handleSourceSoChange(sourceSoIds.filter((id) => id !== val))}
        onClear={() => handleSourceSoChange([])}
        showOrderNumbers={true}
      />

      {sourceSoIds.length > 0 && (
        <View className="gap-1.5 mb-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-slate-500">
              {isMultiBeat ? 'Select Beat(s) (Optional - Multi-Select Enabled)' : 'Select Beat (Optional)'}
            </Text>
            <TouchableOpacity onPress={() => { setIsMultiBeat(!isMultiBeat); setSelectedBeats([]); }}>
              <Text className="text-[10px] font-bold text-orange-600">
                Toggle {isMultiBeat ? 'Single-Select' : 'Multi-Select'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setShowBeatModal(true)}
            disabled={beatsLoading}
            className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
          >
            {beatsLoading ? (
              <ActivityIndicator size="small" color="#f37021" />
            ) : (
              <Text className={`text-xs ${beatLabels ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
                {beatLabels || (beatOptions.length === 0 ? 'No beats assigned (All retailers will be transferred)' : 'Search & Select Beats (Leave empty for all beats)...')}
              </Text>
            )}
            <Ionicons name="chevron-down" size={16} color="#6b7280" />
          </TouchableOpacity>
          {!beatsLoading && beatOptions.length === 0 && (
            <Text className="text-xs text-slate-400 mt-1">No specific beats assigned. Transfer will move all retailers under selected SO(s).</Text>
          )}
        </View>
      )}

      <PickerTrigger
        label="Target SO(s) *"
        placeholder="Search & Select Target SO(s)..."
        onPress={() => setShowTargetModal(true)}
        loading={soLoading}
        selectedValues={targetSoIds}
        options={targetOptionsFiltered}
        onUnselect={(val: string) => setTargetSoIds(targetSoIds.filter((id) => id !== val))}
        onClear={() => setTargetSoIds([])}
      />
      <Text className="text-[10px] text-gray-400 -mt-3.5 leading-relaxed">
        Select 1 Target SO to transfer to a single target, or select multiple for paired transfer.
      </Text>

      {/* Transfer Preview */}
      {isSingleTargetMode && sourceSoIds.length > 0 && (
        <View className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 gap-1">
          <Text className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Transfer Summary (Many-to-One)</Text>
          <Text className="text-xs text-blue-900 leading-relaxed">
            Transferring <Text className="font-bold">{selectedBeats.length > 0 ? `Beat(s): "${beatLabels}"` : 'ALL Beats'}</Text> from <Text className="font-bold">{sourceSoIds.length} Source SO(s)</Text> to <Text className="font-bold">{targetLabels.split(',')[0]}</Text>.
          </Text>
        </View>
      )}

      {isPairedMode && (
        <View className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 gap-2">
          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pair Mapping Preview</Text>
          {pairs.map((pair) => (
            <View key={pair.index} className="flex-row items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0 gap-2">
              <View className="flex-row items-center gap-1.5 flex-1 max-w-[45%]">
                <View className="w-4 h-4 rounded-full bg-gray-200 items-center justify-center">
                  <Text className="text-[9px] font-bold text-gray-700">{pair.index}</Text>
                </View>
                <Text className="text-[11px] font-semibold text-gray-800 truncate">{pair.sourceName.split('(')[0]}</Text>
              </View>
              <Text className="text-gray-400 text-xs">➔</Text>
              <Text className="text-[11px] font-semibold text-gray-800 text-right flex-1 max-w-[45%] truncate">
                {pair.targetName.split('(')[0]}
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={() => transferMutation.mutate()}
        disabled={sourceSoIds.length === 0 || targetSoIds.length === 0 || transferMutation.isPending}
        className="bg-[#f37021] py-3 rounded-xl flex-row justify-center items-center gap-2 mt-2"
        style={(sourceSoIds.length === 0 || targetSoIds.length === 0 || transferMutation.isPending) && { opacity: 0.5 }}
      >
        {transferMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="swap-horizontal" size={14} color="#fff" />
            <Text className="color-white font-bold text-xs">
              {isSingleTargetMode
                ? `Transfer ${selectedBeats.length > 0 ? `Beat(s) (${selectedBeats.length})` : 'All Beats'}`
                : `Transfer SOs (${sourceSoIds.length} Paired Pairs)`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <MultiSelectorModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        data={soOptions}
        selectedValues={sourceSoIds}
        onSelect={handleSourceSoChange}
        title="Select Source SOs"
      />

      <MultiSelectorModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        data={targetOptionsFiltered}
        selectedValues={targetSoIds}
        onSelect={setTargetSoIds}
        title="Select Target SOs"
      />

      {isMultiBeat ? (
        <MultiSelectorModal
          visible={showBeatModal}
          onClose={() => setShowBeatModal(false)}
          data={beatOptions}
          selectedValues={selectedBeats}
          onSelect={setSelectedBeats}
          title="Select Beats"
        />
      ) : (
        <SelectorModal
          visible={showBeatModal}
          onClose={() => setShowBeatModal(false)}
          data={beatOptions}
          selectedValue={selectedBeats[0] || ''}
          onSelect={(val: string) => setSelectedBeats(val ? [val] : [])}
          title="Select Beat"
        />
      )}
    </View>
  );
}

// -- ASE Tab -----------------------------------------------------
function AsePairSoMappingPreview({
  pairIndex,
  sourceAseId,
  targetAseId,
  sourceAseName,
  targetAseName,
  pairSoMapping,
  onMappingChange,
  onOpenMapping,
  selectedChildIds,
  onSelectedChildrenChange,
}: any) {
  const { data: previewData, isLoading } = useQuery({
    queryKey: ['ase-preview', sourceAseId, targetAseId],
    queryFn: () => retailerTransferService.previewAseTransfer(sourceAseId, targetAseId),
    enabled: Boolean(sourceAseId && targetAseId && sourceAseId !== targetAseId),
    staleTime: 5 * 60 * 1000,
  });

  const sourceSos = previewData?.sourceSos || [];
  const targetSos = previewData?.targetSos || [];

  React.useEffect(() => {
    if (sourceSos.length > 0 && !selectedChildIds) {
      onSelectedChildrenChange(sourceSos.map((s: any) => s.entityId));
    }
  }, [sourceSos, selectedChildIds, onSelectedChildrenChange]);

  const toggleChild = (entityId: string) => {
    const current = selectedChildIds || [];
    if (current.includes(entityId)) {
      onSelectedChildrenChange(current.filter((id: string) => id !== entityId));
    } else {
      onSelectedChildrenChange([...current, entityId]);
    }
  };

  const isAllSelected = sourceSos.length > 0 && (selectedChildIds || []).length === sourceSos.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectedChildrenChange([]);
    } else {
      onSelectedChildrenChange(sourceSos.map((s: any) => s.entityId));
    }
  };

  return (
    <View className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 gap-2 mb-3">
      <View className="flex-row items-center justify-between border-b border-gray-200 pb-2">
        <View className="flex-row items-center gap-1.5 flex-1 max-w-[70%]">
          <View className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-700">{pairIndex}</Text>
          </View>
          <Text className="text-xs font-bold text-gray-800 truncate">
            SO Mapping: {sourceAseName.split('(')[0]} ➔ {targetAseName.split('(')[0]}
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleSelectAll}
          className="flex-row items-center gap-1 shrink-0"
        >
          <Ionicons
            name={isAllSelected ? 'checkbox' : 'square-outline'}
            size={14}
            color={isAllSelected ? '#f37021' : '#9ca3af'}
          />
          <Text className="text-[10px] text-gray-500 font-bold select-none">Select All</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color="#f37021" />
          <Text className="text-xs text-gray-500">Fetching SOs under source ASE...</Text>
        </View>
      ) : sourceSos.length === 0 ? (
        <Text className="text-xs text-gray-500 italic py-1 leading-relaxed">
          No SOs currently report under {sourceAseId}. Retailers (if any) will connect directly to Target ASE.
        </Text>
      ) : (
        <View className="gap-3 mt-1">
          {sourceSos.map((sSo) => {
            const currentSelected =
              pairSoMapping[sSo.entityId] ||
              previewData?.suggestedMapping[sSo.entityId] ||
              targetSos[0]?.entityId ||
              targetAseId;

            const isChecked = (selectedChildIds || []).includes(sSo.entityId);

            const selectedLabel =
              currentSelected === targetAseId
                ? `Directly to Target ASE (${targetAseId})`
                : targetSos.find((t) => t.entityId === currentSelected)?.name || currentSelected;

            const modalData = [
              ...targetSos.map((tSo) => ({
                value: tSo.entityId,
                label: `Assign to Target SO: ${tSo.name} (${tSo.entityId})`,
              })),
              {
                value: targetAseId,
                label: `Assign Directly to Target ASE (${targetAseId})`,
              },
            ];

            return (
              <View key={sSo.entityId} className="flex-row items-center justify-between gap-3">
                <TouchableOpacity
                  onPress={() => toggleChild(sSo.entityId)}
                  className="flex-row items-center gap-2 flex-1 max-w-[45%]"
                >
                  <Ionicons
                    name={isChecked ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={isChecked ? '#f37021' : '#9ca3af'}
                  />
                  <Text className={`text-xs truncate ${isChecked ? 'text-gray-800 font-semibold' : 'text-gray-400 line-through'}`} numberOfLines={1}>
                    {sSo.name} ({sSo.entityId})
                  </Text>
                </TouchableOpacity>
                <Text className="text-gray-400 text-xs shrink-0">➔</Text>
                <View className="flex-1">
                  <MappingSelectorTrigger
                    value={isChecked ? selectedLabel : `Directly to Target ASE (${targetAseId})`}
                    disabled={!isChecked}
                    onPress={() =>
                      onOpenMapping(
                        `Map SO: ${sSo.name}`,
                        modalData,
                        currentSelected,
                        (val: string) => onMappingChange(sSo.entityId, val)
                      )
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TransferAseTab({ onOpenMapping }: { onOpenMapping: any }) {
  const [sourceAseIds, setSourceAseIds] = useState<string[]>([]);
  const [targetAseIds, setTargetAseIds] = useState<string[]>([]);
  const [customPairSoMappings, setCustomPairSoMappings] = useState<Record<string, Record<string, string>>>({});
  const [selectedSourceChildIds, setSelectedSourceChildIds] = useState<Record<string, string[]>>({});

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  const { data: aseData, isLoading: aseLoading } = useQuery({
    queryKey: ['admin-ases'],
    queryFn: () => userService.listAll({ role: UserRole.ASE, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const aseOptions = (aseData?.data ?? []).map((ase) => ({
    value: ase.entityId,
    label: `${ase.name} (${ase.entityId})`,
  }));

  const pairs = useMemo(() => {
    const list = [];
    const maxLen = Math.max(sourceAseIds.length, targetAseIds.length);
    for (let i = 0; i < maxLen; i++) {
      const srcId = sourceAseIds[i] || '';
      const tgtId = targetAseIds[i] || targetAseIds[0] || '';
      const srcOpt = aseOptions.find((o) => o.value === srcId);
      const tgtOpt = aseOptions.find((o) => o.value === tgtId);
      list.push({
        index: i + 1,
        sourceId: srcId,
        targetId: tgtId,
        sourceName: srcOpt ? srcOpt.label : 'Select Source ASE...',
        targetName: tgtOpt ? tgtOpt.label : 'Select Target ASE...',
        isValid: Boolean(srcId && tgtId),
      });
    }
    return list;
  }, [sourceAseIds, targetAseIds, aseOptions]);

  const handleSourceAseChange = (val: string[]) => {
    setSourceAseIds(val);
    setCustomPairSoMappings({});
    setSelectedSourceChildIds({});
  };

  const handleTargetAseChange = (val: string[]) => {
    setTargetAseIds(val);
    setCustomPairSoMappings({});
    setSelectedSourceChildIds({});
  };

  const handleMappingChange = (pairKey: string, sSoId: string, tSoId: string) => {
    setCustomPairSoMappings((prev) => ({
      ...prev,
      [pairKey]: {
        ...(prev[pairKey] || {}),
        [sSoId]: tSoId,
      },
    }));
  };

  const handleSelectedChildrenChange = (pairKey: string, ids: string[]) => {
    setSelectedSourceChildIds((prev) => ({
      ...prev,
      [pairKey]: ids,
    }));
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const maxLen = Math.max(sourceAseIds.length, targetAseIds.length);
      for (let i = 0; i < maxLen; i++) {
        const srcId = sourceAseIds[i];
        const tgtId = targetAseIds[i] || targetAseIds[0];
        if (!srcId || !tgtId) continue;
        const pairKey = `${srcId}_${tgtId}`;
        const mapping = customPairSoMappings[pairKey] || undefined;
        const selectedChildIds = selectedSourceChildIds[pairKey] || undefined;
        await retailerTransferService.transferAse(srcId, tgtId, mapping, undefined, selectedChildIds);
      }
    },
    onSuccess: () => {
      Alert.alert('Success', 'ASE transfer completed successfully');
      setSourceAseIds([]);
      setTargetAseIds([]);
      setCustomPairSoMappings({});
      setSelectedSourceChildIds({});
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'ASE transfer failed');
    },
  });

  const targetOptionsFiltered = useMemo(() => {
    return aseOptions.filter((o) => !sourceAseIds.includes(o.value));
  }, [aseOptions, sourceAseIds]);

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm gap-4 mb-8">
      <View className="flex-row items-center gap-2 border-b border-gray-150 pb-3">
        <Ionicons name="swap-horizontal" size={18} color="#f97316" className="mr-1" />
        <Text className="text-sm font-bold text-slate-800">Transfer ASE(s) to New Sales Hierarchy</Text>
      </View>
      <Text className="text-xs text-slate-400 leading-relaxed -mt-2">
        Search & select Source and Target ASEs. Paired selection numbers determine the transfer mapping.
      </Text>

      <PickerTrigger
        label="Source ASE(s) * (Numbered Order)"
        placeholder="Search & Select Source ASEs..."
        onPress={() => setShowSourceModal(true)}
        loading={aseLoading}
        selectedValues={sourceAseIds}
        options={aseOptions}
        onUnselect={(val: string) => handleSourceAseChange(sourceAseIds.filter((id) => id !== val))}
        onClear={() => handleSourceAseChange([])}
        showOrderNumbers={true}
      />

      <PickerTrigger
        label="Target ASE(s) * (Numbered Order)"
        placeholder="Search & Select Target ASEs..."
        onPress={() => setShowTargetModal(true)}
        loading={aseLoading}
        selectedValues={targetAseIds}
        options={targetOptionsFiltered}
        onUnselect={(val: string) => handleTargetAseChange(targetAseIds.filter((id) => id !== val))}
        onClear={() => handleTargetAseChange([])}
        showOrderNumbers={true}
      />

      {pairs
        .filter((p) => p.isValid)
        .map((pair) => {
          const pairKey = `${pair.sourceId}_${pair.targetId}`;
          return (
            <AsePairSoMappingPreview
              key={pairKey}
              pairIndex={pair.index}
              sourceAseId={pair.sourceId}
              targetAseId={pair.targetId}
              sourceAseName={pair.sourceName}
              targetAseName={pair.targetName}
              pairSoMapping={customPairSoMappings[pairKey] || {}}
              onMappingChange={(sSoId: string, tSoId: string) => handleMappingChange(pairKey, sSoId, tSoId)}
              onOpenMapping={onOpenMapping}
              selectedChildIds={selectedSourceChildIds[pairKey]}
              onSelectedChildrenChange={(ids: string[]) => handleSelectedChildrenChange(pairKey, ids)}
            />
          );
        })}

      <TouchableOpacity
        onPress={() => transferMutation.mutate()}
        disabled={sourceAseIds.length === 0 || targetAseIds.length === 0 || transferMutation.isPending}
        className="bg-[#f37021] py-3 rounded-xl flex-row justify-center items-center gap-2 mt-2"
        style={(sourceAseIds.length === 0 || targetAseIds.length === 0 || transferMutation.isPending) && { opacity: 0.5 }}
      >
        {transferMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="swap-horizontal" size={14} color="#fff" />
            <Text className="color-white font-bold text-xs">
              {sourceAseIds.length <= 1
                ? 'Transfer ASE Hierarchy'
                : `Transfer ASEs (${sourceAseIds.length} Paired Pairs)`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <MultiSelectorModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        data={aseOptions}
        selectedValues={sourceAseIds}
        onSelect={handleSourceAseChange}
        title="Select Source ASEs"
      />

      <MultiSelectorModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        data={targetOptionsFiltered}
        selectedValues={targetAseIds}
        onSelect={handleTargetAseChange}
        title="Select Target ASEs"
      />
    </View>
  );
}

// -- ASM Tab -----------------------------------------------------

function AsmPairAseMappingPreview({
  pairIndex,
  sourceAsmId,
  targetAsmId,
  sourceAsmName,
  targetAsmName,
  pairAseMapping,
  onMappingChange,
  onOpenMapping,
  selectedChildIds,
  onSelectedChildrenChange,
}: any) {
  const { data: previewData, isLoading } = useQuery({
    queryKey: ['asm-preview', sourceAsmId, targetAsmId],
    queryFn: () => retailerTransferService.previewAsmTransfer(sourceAsmId, targetAsmId),
    enabled: Boolean(sourceAsmId && targetAsmId && sourceAsmId !== targetAsmId),
    staleTime: 5 * 60 * 1000,
  });

  const sourceAsesList = previewData?.sourceAses || [];
  const targetAsesList = previewData?.targetAses || [];

  const ases = useMemo(() => sourceAsesList.filter(s => s.role === UserRole.ASE), [sourceAsesList]);
  const directSos = useMemo(() => sourceAsesList.filter(s => s.role === UserRole.SO && s.parentId === sourceAsmId), [sourceAsesList, sourceAsmId]);

  const getSosUnderAse = useCallback((aseId: string) => {
    return sourceAsesList.filter(s => s.role === UserRole.SO && s.parentId === aseId);
  }, [sourceAsesList]);

  // Initial load selection
  React.useEffect(() => {
    if (sourceAsesList.length > 0 && !selectedChildIds) {
      onSelectedChildrenChange(sourceAsesList.map((s) => s.entityId));
    }
  }, [sourceAsesList, selectedChildIds, onSelectedChildrenChange]);

  const getDescendants = useCallback((entityId: string): string[] => {
    const descendants: string[] = [];
    const children = sourceAsesList.filter(item => item.parentId === entityId);
    for (const child of children) {
      descendants.push(child.entityId);
      descendants.push(...getDescendants(child.entityId));
    }
    return descendants;
  }, [sourceAsesList]);

  const toggleNode = (entityId: string, parentId: string | null) => {
    const current = selectedChildIds || [];
    const isSelected = current.includes(entityId);
    const descendants = getDescendants(entityId);
    let nextSelection = current;

    if (isSelected) {
      nextSelection = current.filter(id => id !== entityId && !descendants.includes(id));
    } else {
      nextSelection = Array.from(new Set([...current, entityId, ...descendants]));
      let pId = parentId;
      while (pId && pId !== sourceAsmId) {
        nextSelection.push(pId);
        const pNode = sourceAsesList.find(n => n.entityId === pId);
        pId = pNode ? pNode.parentId : null;
      }
      nextSelection = Array.from(new Set(nextSelection));
    }
    onSelectedChildrenChange(nextSelection);
  };

  const isAllSelected = sourceAsesList.length > 0 && (selectedChildIds || []).length === sourceAsesList.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectedChildrenChange([]);
    } else {
      onSelectedChildrenChange(sourceAsesList.map((s) => s.entityId));
    }
  };

  const renderRow = (item: any, isNested: boolean = false) => {
    const currentSelected =
      pairAseMapping[item.entityId] ||
      previewData?.suggestedMapping[item.entityId] ||
      (targetAsesList[0]?.entityId || targetAsmId);

    const isChecked = (selectedChildIds || []).includes(item.entityId);

    const targetRoleLabel = targetAsmId.startsWith('RSM') ? 'RSM' : 'ASM';

    const filteredTargets = targetAsesList.filter((tAse: any) => {
      if (item.role === UserRole.SO || item.role === UserRole.ASE) {
        return tAse.role === UserRole.ASE;
      }
      return true;
    });

    const modalData = [
      ...filteredTargets.map((tAse: any) => ({
        value: tAse.entityId,
        label: `Assign to Target ${tAse.role === UserRole.ASE ? 'ASE' : 'SO'}: ${tAse.name} (${tAse.entityId})`,
      })),
      {
        value: targetAsmId,
        label: `Assign Directly to Target ${targetRoleLabel} (${targetAsmId})`,
      },
    ];

    const selectedLabel =
      currentSelected === targetAsmId
        ? `Directly to Target ${targetRoleLabel} (${targetAsmId})`
        : targetAsesList.find((t) => t.entityId === currentSelected)
        ? `Target ${targetAsesList.find((t) => t.entityId === currentSelected)?.role === UserRole.ASE ? 'ASE' : 'SO'}: ${targetAsesList.find((t) => t.entityId === currentSelected)?.name}`
        : currentSelected;

    return (
      <View
        key={item.entityId}
        className={`flex-row items-center justify-between gap-3 ${
          isNested ? 'pl-6 border-l border-dashed border-gray-200 ml-2 py-1.5' : 'py-1.5'
        }`}
      >
        <TouchableOpacity
          onPress={() => toggleNode(item.entityId, item.parentId)}
          className="flex-row items-center gap-2 flex-1 max-w-[45%]"
        >
          <Ionicons
            name={isChecked ? 'checkbox' : 'square-outline'}
            size={16}
            color={isChecked ? '#f37021' : '#9ca3af'}
          />
          <Text
            className={`text-xs truncate ${
              isChecked ? 'text-gray-800 font-semibold' : 'text-gray-400 line-through'
            }`}
            numberOfLines={1}
          >
            {item.name} ({item.entityId}){' '}
            <Text className="text-[9px] font-normal text-gray-400">
              [{item.role.toUpperCase()}]
            </Text>
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-400 text-xs shrink-0">➔</Text>

        <View className="flex-1">
          <MappingSelectorTrigger
            value={isChecked ? selectedLabel : `Directly to Target ${targetRoleLabel} (${targetAsmId})`}
            disabled={!isChecked}
            onPress={() =>
              onOpenMapping(
                `Map ${item.role.toUpperCase()}: ${item.name}`,
                modalData,
                currentSelected,
                (val: string) => onMappingChange(item.entityId, val)
              )
            }
          />
        </View>
      </View>
    );
  };

  return (
    <View className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 gap-2 mb-3">
      <View className="flex-row items-center justify-between border-b border-gray-200 pb-2">
        <View className="flex-row items-center gap-1.5 flex-1 max-w-[70%]">
          <View className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-700">{pairIndex}</Text>
          </View>
          <Text className="text-xs font-bold text-gray-800 truncate">
            ASE/SO Mapping: {sourceAsmName.split('(')[0]} ➔ {targetAsmName.split('(')[0]}
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleSelectAll}
          className="flex-row items-center gap-1 shrink-0"
        >
          <Ionicons
            name={isAllSelected ? 'checkbox' : 'square-outline'}
            size={14}
            color={isAllSelected ? '#f37021' : '#9ca3af'}
          />
          <Text className="text-[10px] text-gray-500 font-bold select-none">Select All</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color="#f37021" />
          <Text className="text-xs text-gray-500">Fetching agents under source ASM...</Text>
        </View>
      ) : sourceAsesList.length === 0 ? (
        <Text className="text-xs text-gray-500 italic py-1 leading-relaxed">
          No ASEs or SOs currently report under {sourceAsmId}.
        </Text>
      ) : (
        <View className="gap-3 mt-1">
          {/* Render ASEs and their child SOs */}
          {ases.map((ase) => {
            const childSos = getSosUnderAse(ase.entityId);
            return (
              <View key={ase.entityId} className="bg-white/40 p-2 rounded-xl border border-gray-100 mb-2">
                {renderRow(ase, false)}
                {childSos.length > 0 && (
                  <View className="gap-1 mt-1">
                    {childSos.map((so: any) => renderRow(so, true))}
                  </View>
                )}
              </View>
            );
          })}

          {/* Render direct SOs under the ASM */}
          {directSos.length > 0 && (
            <View className="bg-white/40 p-2 rounded-xl border border-gray-100">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Direct SOs
              </Text>
              {directSos.map((so: any) => renderRow(so, false))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function TransferAsmTab({ onOpenMapping }: { onOpenMapping: any }) {
  const [sourceAsmIds, setSourceAsmIds] = useState<string[]>([]);
  const [targetAsmIds, setTargetAsmIds] = useState<string[]>([]);
  const [customPairAseMappings, setCustomPairAseMappings] = useState<Record<string, Record<string, string>>>({});
  const [selectedSourceChildIds, setSelectedSourceChildIds] = useState<Record<string, string[]>>({});

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  const { data: asmData, isLoading: asmLoading } = useQuery({
    queryKey: ['admin-asms'],
    queryFn: () => userService.listAll({ role: UserRole.ASM, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rsmData, isLoading: rsmLoading } = useQuery({
    queryKey: ['admin-rsms'],
    queryFn: () => userService.listAll({ role: UserRole.RSM, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const asmOptions = (asmData?.data ?? []).map((asm) => ({
    value: asm.entityId,
    label: `${asm.name} (${asm.entityId})`,
  }));

  const targetOptions = useMemo(() => {
    const asms = (asmData?.data ?? []).map((asm) => ({
      value: asm.entityId,
      label: `${asm.name} (${asm.entityId}) [ASM]`,
    }));
    const rsms = (rsmData?.data ?? []).map((rsm) => ({
      value: rsm.entityId,
      label: `${rsm.name} (${rsm.entityId}) [RSM]`,
    }));
    return [...asms, ...rsms];
  }, [asmData, rsmData]);

  const pairs = useMemo(() => {
    const list = [];
    const maxLen = Math.max(sourceAsmIds.length, targetAsmIds.length);
    for (let i = 0; i < maxLen; i++) {
      const srcId = sourceAsmIds[i] || '';
      const tgtId = targetAsmIds[i] || targetAsmIds[0] || '';
      const srcOpt = asmOptions.find((o) => o.value === srcId);
      const tgtOpt = targetOptions.find((o) => o.value === tgtId);
      list.push({
        index: i + 1,
        sourceId: srcId,
        targetId: tgtId,
        sourceName: srcOpt ? srcOpt.label : 'Select Source ASM...',
        targetName: tgtOpt ? tgtOpt.label : 'Select Target ASM/RSM...',
        isValid: Boolean(srcId && tgtId),
      });
    }
    return list;
  }, [sourceAsmIds, targetAsmIds, asmOptions, targetOptions]);

  const handleSourceAsmChange = (val: string[]) => {
    setSourceAsmIds(val);
    setCustomPairAseMappings({});
    setSelectedSourceChildIds({});
  };

  const handleTargetAsmChange = (val: string[]) => {
    setTargetAsmIds(val);
    setCustomPairAseMappings({});
    setSelectedSourceChildIds({});
  };

  const handleMappingChange = (pairKey: string, sAseId: string, tAseId: string) => {
    setCustomPairAseMappings((prev) => ({
      ...prev,
      [pairKey]: {
        ...(prev[pairKey] || {}),
        [sAseId]: tAseId,
      },
    }));
  };

  const handleSelectedChildrenChange = (pairKey: string, ids: string[]) => {
    setSelectedSourceChildIds((prev) => ({
      ...prev,
      [pairKey]: ids,
    }));
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const maxLen = Math.max(sourceAsmIds.length, targetAsmIds.length);
      for (let i = 0; i < maxLen; i++) {
        const srcId = sourceAsmIds[i];
        const tgtId = targetAsmIds[i] || targetAsmIds[0];
        if (!srcId || !tgtId) continue;
        const pairKey = `${srcId}_${tgtId}`;
        const mapping = customPairAseMappings[pairKey] || undefined;
        const selectedChildIds = selectedSourceChildIds[pairKey] || undefined;
        await retailerTransferService.transferAsm(srcId, tgtId, mapping, undefined, selectedChildIds);
      }
    },
    onSuccess: () => {
      Alert.alert('Success', 'ASM transfer completed successfully');
      setSourceAsmIds([]);
      setTargetAsmIds([]);
      setCustomPairAseMappings({});
      setSelectedSourceChildIds({});
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'ASM transfer failed');
    },
  });

  const targetOptionsFiltered = useMemo(() => {
    return targetOptions.filter((o) => !sourceAsmIds.includes(o.value));
  }, [targetOptions, sourceAsmIds]);

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm gap-4 mb-8">
      <View className="flex-row items-center gap-2 border-b border-gray-150 pb-3">
        <Ionicons name="swap-horizontal" size={18} color="#f97316" className="mr-1" />
        <Text className="text-sm font-bold text-slate-800">Transfer ASM(s) to New Sales Hierarchy</Text>
      </View>
      <Text className="text-xs text-slate-400 leading-relaxed -mt-2">
        Search & select Source and Target ASMs. Paired selection numbers determine the transfer mapping.
      </Text>

      <PickerTrigger
        label="Source ASM(s) * (Numbered Order)"
        placeholder="Search & Select Source ASMs..."
        onPress={() => setShowSourceModal(true)}
        loading={asmLoading}
        selectedValues={sourceAsmIds}
        options={asmOptions}
        onUnselect={(val: string) => handleSourceAsmChange(sourceAsmIds.filter((id) => id !== val))}
        onClear={() => handleSourceAsmChange([])}
        showOrderNumbers={true}
      />

      <PickerTrigger
        label="Target ASM(s) / RSM(s) * (Numbered Order)"
        placeholder="Search & Select Target ASMs/RSMs..."
        onPress={() => setShowTargetModal(true)}
        loading={asmLoading || rsmLoading}
        selectedValues={targetAsmIds}
        options={targetOptionsFiltered}
        onUnselect={(val: string) => handleTargetAsmChange(targetAsmIds.filter((id) => id !== val))}
        onClear={() => handleTargetAsmChange([])}
        showOrderNumbers={true}
      />

      {pairs
        .filter((p) => p.isValid)
        .map((pair) => {
          const pairKey = `${pair.sourceId}_${pair.targetId}`;
          return (
            <AsmPairAseMappingPreview
              key={pairKey}
              pairIndex={pair.index}
              sourceAsmId={pair.sourceId}
              targetAsmId={pair.targetId}
              sourceAsmName={pair.sourceName}
              targetAsmName={pair.targetName}
              pairAseMapping={customPairAseMappings[pairKey] || {}}
              onMappingChange={(sAseId: string, tAseId: string) => handleMappingChange(pairKey, sAseId, tAseId)}
              onOpenMapping={onOpenMapping}
              selectedChildIds={selectedSourceChildIds[pairKey]}
              onSelectedChildrenChange={(ids: string[]) => handleSelectedChildrenChange(pairKey, ids)}
            />
          );
        })}

      <TouchableOpacity
        onPress={() => transferMutation.mutate()}
        disabled={sourceAsmIds.length === 0 || targetAsmIds.length === 0 || transferMutation.isPending}
        className="bg-[#f37021] py-3 rounded-xl flex-row justify-center items-center gap-2 mt-2"
        style={(sourceAsmIds.length === 0 || targetAsmIds.length === 0 || transferMutation.isPending) && { opacity: 0.5 }}
      >
        {transferMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="swap-horizontal" size={14} color="#fff" />
            <Text className="color-white font-bold text-xs">
              {sourceAsmIds.length <= 1
                ? 'Transfer ASM Hierarchy'
                : `Transfer ASMs (${sourceAsmIds.length} Paired Pairs)`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <MultiSelectorModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        data={asmOptions}
        selectedValues={sourceAsmIds}
        onSelect={handleSourceAsmChange}
        title="Select Source ASMs"
      />

      <MultiSelectorModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        data={targetOptionsFiltered}
        selectedValues={targetAsmIds}
        onSelect={handleTargetAsmChange}
        title="Select Target ASMs/RSMs"
      />
    </View>
  );
}

// -- RSM Tab -----------------------------------------------------

function RsmPairAsmMappingPreview({
  pairIndex,
  sourceRsmId,
  targetRsmId,
  sourceRsmName,
  targetRsmName,
  pairAsmMapping,
  onMappingChange,
  onOpenMapping,
  selectedChildIds,
  onSelectedChildrenChange,
}: any) {
  const { data: previewData, isLoading } = useQuery({
    queryKey: ['rsm-preview', sourceRsmId, targetRsmId],
    queryFn: () => retailerTransferService.previewRsmTransfer(sourceRsmId, targetRsmId),
    enabled: Boolean(sourceRsmId && targetRsmId && sourceRsmId !== targetRsmId),
    staleTime: 5 * 60 * 1000,
  });

  const sourceAsmsList = previewData?.sourceAsms || [];
  const targetAsmsList = previewData?.targetAsms || [];

  // Group reportees by level
  const asms = useMemo(() => sourceAsmsList.filter(s => s.role === UserRole.ASM && s.parentId === sourceRsmId), [sourceAsmsList, sourceRsmId]);
  const directAses = useMemo(() => sourceAsmsList.filter(s => s.role === UserRole.ASE && s.parentId === sourceRsmId), [sourceAsmsList, sourceRsmId]);
  const directSos = useMemo(() => sourceAsmsList.filter(s => s.role === UserRole.SO && s.parentId === sourceRsmId), [sourceAsmsList, sourceRsmId]);

  const getChildrenOf = useCallback((parentId: string) => {
    return sourceAsmsList.filter(s => s.parentId === parentId);
  }, [sourceAsmsList]);

  // Initial load selection
  React.useEffect(() => {
    if (sourceAsmsList.length > 0 && !selectedChildIds) {
      onSelectedChildrenChange(sourceAsmsList.map((s) => s.entityId));
    }
  }, [sourceAsmsList, selectedChildIds, onSelectedChildrenChange]);

  const getDescendants = useCallback((entityId: string): string[] => {
    const descendants: string[] = [];
    const children = sourceAsmsList.filter(item => item.parentId === entityId);
    for (const child of children) {
      descendants.push(child.entityId);
      descendants.push(...getDescendants(child.entityId));
    }
    return descendants;
  }, [sourceAsmsList]);

  const toggleNode = (entityId: string, parentId: string | null) => {
    const current = selectedChildIds || [];
    const isSelected = current.includes(entityId);
    const descendants = getDescendants(entityId);
    let nextSelection = current;

    if (isSelected) {
      // Deselect self and all descendants
      nextSelection = current.filter(id => id !== entityId && !descendants.includes(id));
    } else {
      // Select self and all descendants
      nextSelection = Array.from(new Set([...current, entityId, ...descendants]));
      // Also recursively select parents up to the root
      let pId = parentId;
      while (pId && pId !== sourceRsmId) {
        nextSelection.push(pId);
        const pNode = sourceAsmsList.find(n => n.entityId === pId);
        pId = pNode ? pNode.parentId : null;
      }
      nextSelection = Array.from(new Set(nextSelection));
    }
    onSelectedChildrenChange(nextSelection);
  };

  const isAllSelected = sourceAsmsList.length > 0 && (selectedChildIds || []).length === sourceAsmsList.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectedChildrenChange([]);
    } else {
      onSelectedChildrenChange(sourceAsmsList.map((s) => s.entityId));
    }
  };

  const renderRow = (item: any, level: number = 0) => {
    const currentSelected =
      pairAsmMapping[item.entityId] ||
      previewData?.suggestedMapping[item.entityId] ||
      (targetAsmsList[0]?.entityId || targetRsmId);

    const isChecked = (selectedChildIds || []).includes(item.entityId);

    const filteredTargets = targetAsmsList.filter((tAsm: any) => {
      if (item.role === UserRole.SO) {
        return tAsm.role === UserRole.ASE || tAsm.role === UserRole.ASM;
      }
      if (item.role === UserRole.ASE) {
        return tAsm.role === UserRole.ASE || tAsm.role === UserRole.ASM;
      }
      if (item.role === UserRole.ASM) {
        return tAsm.role === UserRole.ASM;
      }
      return true;
    });

    const modalData = [
      ...filteredTargets.map((tAsm: any) => ({
        value: tAsm.entityId,
        label: `Assign to Target ${tAsm.role === UserRole.ASM ? 'ASM' : tAsm.role === UserRole.ASE ? 'ASE' : 'SO'}: ${tAsm.name} (${tAsm.entityId})`,
      })),
      {
        value: targetRsmId,
        label: `Assign Directly to Target RSM (${targetRsmId})`,
      },
    ];

    const targetFind = targetAsmsList.find((t) => t.entityId === currentSelected);
    const selectedLabel =
      currentSelected === targetRsmId
        ? `Directly to Target RSM (${targetRsmId})`
        : targetFind
        ? `Target ${targetFind.role === UserRole.ASM ? 'ASM' : targetFind.role === UserRole.ASE ? 'ASE' : 'SO'}: ${targetFind.name}`
        : currentSelected;

    return (
      <View
        key={item.entityId}
        className={`flex-row items-center justify-between gap-3 py-1.5 ${
          level > 0 ? 'border-l border-dashed border-gray-200 ml-2' : ''
        }`}
        style={level > 0 ? { paddingLeft: level * 10 } : undefined}
      >
        <TouchableOpacity
          onPress={() => toggleNode(item.entityId, item.parentId)}
          className="flex-row items-center gap-2 flex-1 max-w-[45%]"
        >
          <Ionicons
            name={isChecked ? 'checkbox' : 'square-outline'}
            size={16}
            color={isChecked ? '#f37021' : '#9ca3af'}
          />
          <Text
            className={`text-xs truncate ${
              isChecked ? 'text-gray-800 font-semibold' : 'text-gray-400 line-through'
            }`}
            numberOfLines={1}
          >
            {item.name} ({item.entityId}){' '}
            <Text className="text-[9px] font-normal text-gray-400">
              [{item.role.toUpperCase()}]
            </Text>
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-400 text-xs shrink-0">➔</Text>

        <View className="flex-1">
          <MappingSelectorTrigger
            value={isChecked ? selectedLabel : `Directly to Target RSM (${targetRsmId})`}
            disabled={!isChecked}
            onPress={() =>
              onOpenMapping(
                `Map ${item.role.toUpperCase()}: ${item.name}`,
                modalData,
                currentSelected,
                (val: string) => onMappingChange(item.entityId, val)
              )
            }
          />
        </View>
      </View>
    );
  };

  const cleanSourceName = sourceRsmName.split('(')[0].trim();
  const cleanTargetName = targetRsmName.split('(')[0].trim();

  return (
    <View className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 gap-2 mb-3">
      <View className="flex-row items-center justify-between border-b border-gray-200 pb-2">
        <View className="flex-row items-center gap-1.5 flex-1 max-w-[70%]">
          <View className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-700">{pairIndex}</Text>
          </View>
          <Text className="text-xs font-bold text-gray-800 truncate">
            ASM/ASE/SO Mapping: {cleanSourceName} ➔ {cleanTargetName}
          </Text>
        </View>
        {sourceAsmsList.length > 0 && (
          <TouchableOpacity
            onPress={toggleSelectAll}
            className="flex-row items-center gap-1 shrink-0"
          >
            <Ionicons
              name={isAllSelected ? 'checkbox' : 'square-outline'}
              size={14}
              color={isAllSelected ? '#f37021' : '#9ca3af'}
            />
            <Text className="text-[10px] text-gray-500 font-bold select-none">Select All</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color="#f37021" />
          <Text className="text-xs text-gray-500">Fetching agents under source RSM...</Text>
        </View>
      ) : sourceAsmsList.length === 0 ? (
        <Text className="text-xs text-gray-500 italic py-1">
          No ASMs or Sales Agents currently report under {cleanSourceName}.
        </Text>
      ) : (
        <View className="gap-3 mt-1">
          {/* Render ASMs -> ASEs -> SOs */}
          {asms.map((asm: any) => {
            const level2Children = getChildrenOf(asm.entityId);
            return (
              <View key={asm.entityId} className="bg-white/40 p-2 rounded border border-gray-100 gap-1">
                {renderRow(asm, 0)}
                {level2Children.length > 0 && (
                  <View className="gap-1.5 mt-1">
                    {level2Children.map((lvl2: any) => {
                      const level3Children = getChildrenOf(lvl2.entityId);
                      return (
                        <View key={lvl2.entityId} className="gap-1">
                          {renderRow(lvl2, 1)}
                          {level3Children.length > 0 && (
                            <View className="gap-1 mt-0.5">
                              {level3Children.map((lvl3: any) => renderRow(lvl3, 2))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {/* Render Direct ASEs */}
          {directAses.length > 0 && (
            <View className="bg-white/40 p-2 rounded border border-gray-100 gap-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Direct ASEs</Text>
              {directAses.map((ase: any) => renderRow(ase, 0))}
            </View>
          )}

          {/* Render Direct SOs */}
          {directSos.length > 0 && (
            <View className="bg-white/40 p-2 rounded border border-gray-100 gap-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Direct SOs</Text>
              {directSos.map((so: any) => renderRow(so, 0))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function TransferRsmTab({ onOpenMapping }: { onOpenMapping: any }) {
  const [sourceRsmIds, setSourceRsmIds] = useState<string[]>([]);
  const [targetRsmIds, setTargetRsmIds] = useState<string[]>([]);
  const [customPairAsmMappings, setCustomPairAsmMappings] = useState<Record<string, Record<string, string>>>({});
  const [selectedSourceChildIds, setSelectedSourceChildIds] = useState<Record<string, string[]>>({});

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  const { data: rsmData, isLoading: rsmLoading } = useQuery({
    queryKey: ['admin-rsms'],
    queryFn: () => userService.listAll({ role: UserRole.RSM, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const rsmOptions = (rsmData?.data ?? []).map((rsm) => ({
    value: rsm.entityId,
    label: `${rsm.name} (${rsm.entityId})`,
  }));

  const pairs = useMemo(() => {
    const list = [];
    const maxLen = Math.max(sourceRsmIds.length, targetRsmIds.length);
    for (let i = 0; i < maxLen; i++) {
      const srcId = sourceRsmIds[i] || '';
      const tgtId = targetRsmIds[i] || targetRsmIds[0] || '';
      const srcOpt = rsmOptions.find((o) => o.value === srcId);
      const tgtOpt = rsmOptions.find((o) => o.value === tgtId);
      list.push({
        index: i + 1,
        sourceId: srcId,
        targetId: tgtId,
        sourceName: srcOpt ? srcOpt.label : 'Select Source RSM...',
        targetName: tgtOpt ? tgtOpt.label : 'Select Target RSM...',
        isValid: Boolean(srcId && tgtId),
      });
    }
    return list;
  }, [sourceRsmIds, targetRsmIds, rsmOptions]);

  const handleSourceRsmChange = (val: string[]) => {
    setSourceRsmIds(val);
    setCustomPairAsmMappings({});
    setSelectedSourceChildIds({});
  };

  const handleTargetRsmChange = (val: string[]) => {
    setTargetRsmIds(val);
    setCustomPairAsmMappings({});
    setSelectedSourceChildIds({});
  };

  const handleMappingChange = (pairKey: string, sAsmId: string, tAsmId: string) => {
    setCustomPairAsmMappings((prev) => ({
      ...prev,
      [pairKey]: {
        ...(prev[pairKey] || {}),
        [sAsmId]: tAsmId,
      },
    }));
  };

  const handleSelectedChildrenChange = (pairKey: string, ids: string[]) => {
    setSelectedSourceChildIds((prev) => ({
      ...prev,
      [pairKey]: ids,
    }));
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const maxLen = Math.max(sourceRsmIds.length, targetRsmIds.length);
      for (let i = 0; i < maxLen; i++) {
        const srcId = sourceRsmIds[i];
        const tgtId = targetRsmIds[i] || targetRsmIds[0];
        if (!srcId || !tgtId) continue;
        const pairKey = `${srcId}_${tgtId}`;
        const mapping = customPairAsmMappings[pairKey] || undefined;
        const selectedChildIds = selectedSourceChildIds[pairKey] || undefined;
        await retailerTransferService.transferRsm(srcId, tgtId, mapping, selectedChildIds);
      }
    },
    onSuccess: () => {
      Alert.alert('Success', 'RSM transfer completed successfully');
      setSourceRsmIds([]);
      setTargetRsmIds([]);
      setCustomPairAsmMappings({});
      setSelectedSourceChildIds({});
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'RSM transfer failed');
    },
  });

  const targetOptionsFiltered = useMemo(() => {
    return rsmOptions.filter((o) => !sourceRsmIds.includes(o.value));
  }, [rsmOptions, sourceRsmIds]);

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm gap-4 mb-8">
      <View className="flex-row items-center gap-2 border-b border-gray-100 pb-3">
        <Ionicons name="swap-horizontal" size={18} color="#f97316" className="mr-1" />
        <Text className="text-sm font-bold text-slate-800">Transfer RSM(s) to New Sales Hierarchy</Text>
      </View>
      <Text className="text-xs text-slate-400 leading-relaxed -mt-2">
        Search & select Source and Target RSMs. Paired selection numbers determine the transfer mapping.
      </Text>

      <PickerTrigger
        label="Source RSM(s) * (Numbered Order)"
        placeholder="Search & Select Source RSMs..."
        onPress={() => setShowSourceModal(true)}
        loading={rsmLoading}
        selectedValues={sourceRsmIds}
        options={rsmOptions}
        onUnselect={(val: string) => handleSourceRsmChange(sourceRsmIds.filter((id) => id !== val))}
        onClear={() => handleSourceRsmChange([])}
        showOrderNumbers={true}
      />

      <PickerTrigger
        label="Target RSM(s) * (Numbered Order)"
        placeholder="Search & Select Target RSMs..."
        onPress={() => setShowTargetModal(true)}
        loading={rsmLoading}
        selectedValues={targetRsmIds}
        options={targetOptionsFiltered}
        onUnselect={(val: string) => handleTargetRsmChange(targetRsmIds.filter((id) => id !== val))}
        onClear={() => handleTargetRsmChange([])}
        showOrderNumbers={true}
      />

      {pairs
        .filter((p) => p.isValid)
        .map((pair) => {
          const pairKey = `${pair.sourceId}_${pair.targetId}`;
          return (
            <RsmPairAsmMappingPreview
              key={pairKey}
              pairIndex={pair.index}
              sourceRsmId={pair.sourceId}
              targetRsmId={pair.targetId}
              sourceRsmName={pair.sourceName}
              targetRsmName={pair.targetName}
              pairAsmMapping={customPairAsmMappings[pairKey] || {}}
              onMappingChange={(sAsmId: string, tAsmId: string) => handleMappingChange(pairKey, sAsmId, tAsmId)}
              onOpenMapping={onOpenMapping}
              selectedChildIds={selectedSourceChildIds[pairKey]}
              onSelectedChildrenChange={(ids: string[]) => handleSelectedChildrenChange(pairKey, ids)}
            />
          );
        })}

      <TouchableOpacity
        onPress={() => transferMutation.mutate()}
        disabled={sourceRsmIds.length === 0 || targetRsmIds.length === 0 || transferMutation.isPending}
        className="bg-[#f37021] py-3 rounded-xl flex-row justify-center items-center gap-2 mt-2"
        style={(sourceRsmIds.length === 0 || targetRsmIds.length === 0 || transferMutation.isPending) && { opacity: 0.5 }}
      >
        {transferMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="swap-horizontal" size={14} color="#fff" />
            <Text className="color-white font-bold text-xs">
              {sourceRsmIds.length <= 1
                ? 'Transfer RSM Hierarchy'
                : `Transfer RSMs (${sourceRsmIds.length} Paired Pairs)`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <MultiSelectorModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        data={rsmOptions}
        selectedValues={sourceRsmIds}
        onSelect={handleSourceRsmChange}
        title="Select Source RSMs"
      />

      <MultiSelectorModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        data={targetOptionsFiltered}
        selectedValues={targetRsmIds}
        onSelect={handleTargetRsmChange}
        title="Select Target RSMs"
      />
    </View>
  );
}

// -- Distributor Tab ----------------------------------
function DistributorPairRetailerMappingPreview({
  pairIndex,
  sourceDistId,
  targetDistId,
  sourceDistName,
  targetDistName,
  filterBeats,
  selectedChildIds,
  onSelectedChildrenChange,
}: any) {
  const { data: retailerData, isLoading } = useQuery({
    queryKey: ['distributor-retailers', sourceDistId],
    queryFn: () => userService.listAll({ role: UserRole.RETAILER, parentId: sourceDistId, limit: 1000 }),
    enabled: Boolean(sourceDistId),
    staleTime: 5 * 60 * 1000,
  });

  const retailers = retailerData?.data || [];

  // Group retailers by Beat
  const beatGroups = useMemo(() => {
    const map: Record<string, typeof retailers> = {};
    retailers.forEach((r: any) => {
      const beatName = r.beat ? r.beat.trim() : 'Unassigned Beat';
      if (filterBeats && filterBeats.length > 0 && !filterBeats.includes(beatName)) {
        return;
      }
      if (!map[beatName]) {
        map[beatName] = [];
      }
      map[beatName].push(r);
    });
    return map;
  }, [retailers, filterBeats]);

  const beatNames = useMemo(() => Object.keys(beatGroups).sort((a, b) => a.localeCompare(b)), [beatGroups]);

  // Sync selected children when filterBeats or async retailers data changes
  const lastSyncedRef = React.useRef({ filterKey: '', count: -1 });

  React.useEffect(() => {
    const filterKey = (filterBeats || []).join(',');
    const count = retailers.length;
    if ((filterKey !== lastSyncedRef.current.filterKey || count !== lastSyncedRef.current.count) && count > 0) {
      lastSyncedRef.current = { filterKey, count };
      if (filterBeats && filterBeats.length > 0) {
        const filteredRetailerIds = retailers
          .filter((r: any) => filterBeats.includes(r.beat ? r.beat.trim() : 'Unassigned Beat'))
          .map((r: any) => r.entityId);
        onSelectedChildrenChange(filteredRetailerIds);
      } else if (!selectedChildIds || selectedChildIds.length === 0) {
        onSelectedChildrenChange(retailers.map((r: any) => r.entityId));
      }
    }
  }, [filterBeats, retailers, selectedChildIds, onSelectedChildrenChange]);

  // State to track collapsed/expanded beats
  const [collapsedBeats, setCollapsedBeats] = useState<Record<string, boolean>>({});

  const toggleBeatCollapse = (beatName: string) => {
    setCollapsedBeats((prev) => ({ ...prev, [beatName]: !prev[beatName] }));
  };

  const selectedSet = useMemo(() => new Set(selectedChildIds || []), [selectedChildIds]);

  const toggleRetailer = (entityId: string) => {
    const current = selectedChildIds || [];
    if (current.includes(entityId)) {
      onSelectedChildrenChange(current.filter((id: string) => id !== entityId));
    } else {
      onSelectedChildrenChange([...current, entityId]);
    }
  };

  const toggleBeatSelection = (beatName: string) => {
    const beatRetailerIds = beatGroups[beatName].map((r: any) => r.entityId);
    const isBeatFullySelected = beatRetailerIds.every((id) => selectedSet.has(id));

    let updated: string[];
    if (isBeatFullySelected) {
      updated = (selectedChildIds || []).filter((id) => !beatRetailerIds.includes(id));
    } else {
      const newIds = new Set(selectedChildIds || []);
      beatRetailerIds.forEach((id) => newIds.add(id));
      updated = Array.from(newIds);
    }
    onSelectedChildrenChange(updated);
  };

  const isAllSelected = retailers.length > 0 && selectedSet.size === retailers.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectedChildrenChange([]);
    } else {
      onSelectedChildrenChange(retailers.map((r: any) => r.entityId));
    }
  };

  const cleanSourceName = sourceDistName.split('(')[0].trim();
  const cleanTargetName = targetDistName.split('(')[0].trim();

  return (
    <View className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 gap-2 mb-3">
      <View className="flex-row items-center justify-between border-b border-gray-200 pb-2 flex-wrap gap-2">
        <View className="flex-row items-center gap-1.5 flex-1 max-w-[70%]">
          <View className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-700">{pairIndex}</Text>
          </View>
          <Text className="text-xs font-bold text-gray-800 truncate">
            Retailer Transfer: {cleanSourceName} ➔ {cleanTargetName}
          </Text>
        </View>
        <View className="flex-row items-center gap-2.5 shrink-0">
          <Text className="text-[10px] font-bold text-gray-500 bg-gray-200/60 px-2.5 py-0.5 rounded-full">
            {selectedSet.size} / {retailers.length}
          </Text>
          {retailers.length > 0 && (
            <TouchableOpacity
              onPress={toggleSelectAll}
              className="flex-row items-center gap-1 shrink-0"
            >
              <Ionicons
                name={isAllSelected ? 'checkbox' : 'square-outline'}
                size={14}
                color={isAllSelected ? '#f37021' : '#9ca3af'}
              />
              <Text className="text-[10px] text-gray-500 font-bold select-none">Select All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color="#f37021" />
          <Text className="text-xs text-gray-500">Fetching beats and retailers under source dist...</Text>
        </View>
      ) : retailers.length === 0 ? (
        <Text className="text-xs text-gray-500 italic py-1">
          No active retailers found under distributor {cleanSourceName}.
        </Text>
      ) : (
        <View className="gap-2.5 mt-1">
          {beatNames.map((beatName) => {
            const beatRetailers = beatGroups[beatName];
            const beatSelectedCount = beatRetailers.filter((r) => selectedSet.has(r.entityId)).length;
            const isBeatFullySelected = beatSelectedCount === beatRetailers.length;
            const isBeatPartiallySelected = beatSelectedCount > 0 && !isBeatFullySelected;
            const isCollapsed = Boolean(collapsedBeats[beatName]);

            return (
              <View key={beatName} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                {/* Beat Accordion Header */}
                <View className="flex-row items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-100">
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <TouchableOpacity
                      onPress={() => toggleBeatCollapse(beatName)}
                      className="p-1 rounded"
                    >
                      <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={14}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleBeatSelection(beatName)}
                      className="flex-row items-center gap-1.5 flex-1"
                    >
                      <Ionicons
                        name={
                          isBeatFullySelected
                            ? 'checkbox'
                            : isBeatPartiallySelected
                            ? 'remove-circle'
                            : 'square-outline'
                        }
                        size={16}
                        color={isBeatFullySelected || isBeatPartiallySelected ? '#f37021' : '#9ca3af'}
                      />
                      <Text className="font-bold text-gray-800 text-[11px] truncate flex-1" numberOfLines={1}>
                        {beatName}
                      </Text>
                    </TouchableOpacity>
                    <Text className="text-[9px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.5 rounded-full shrink-0">
                      {beatSelectedCount} / {beatRetailers.length}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleBeatCollapse(beatName)}>
                    <Text className="text-[10px] text-gray-400 font-semibold">
                      {isCollapsed ? 'Expand' : 'Collapse'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Nested Retailers List */}
                {!isCollapsed && (
                  <View className="p-2 gap-1.5 bg-white">
                    {beatRetailers.map((r: any) => {
                      const isChecked = selectedSet.has(r.entityId);
                      return (
                        <TouchableOpacity
                          key={r.entityId}
                          onPress={() => toggleRetailer(r.entityId)}
                          className={`flex-row items-center gap-2 rounded-lg border p-2 transition-colors ${
                            isChecked
                              ? 'border-blue-100 bg-blue-50/10'
                              : 'border-gray-100 bg-gray-50/30'
                          }`}
                        >
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={14}
                            color={isChecked ? '#f37021' : '#9ca3af'}
                          />
                          <View className="flex-1">
                            <Text className={`text-xs font-semibold ${isChecked ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                              {r.name}
                            </Text>
                            <View className="flex-row items-center gap-1.5 mt-0.5">
                              <Text className="text-[9px] text-gray-400">{r.phone}</Text>
                              {r.retailerType ? (
                                <>
                                  <Text className="text-[9px] text-gray-300">•</Text>
                                  <Text className="text-[9px] text-gray-400">{r.retailerType}</Text>
                                </>
                              ) : null}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TransferDistributorTab() {
  const [sourceDistIds, setSourceDistIds] = useState<string[]>([]);
  const [targetDistIds, setTargetDistIds] = useState<string[]>([]);
  const [selectedSourceChildIds, setSelectedSourceChildIds] = useState<Record<string, string[]>>({});
  const [selectedBeats, setSelectedBeats] = useState<string[]>([]);
  const [isMultiBeat, setIsMultiBeat] = useState(true);

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showBeatModal, setShowBeatModal] = useState(false);

  const { data: distData, isLoading: distLoading } = useQuery({
    queryKey: ['admin-distributors'],
    queryFn: () => userService.listAll({ role: UserRole.DISTRIBUTOR, limit: 10000 }),
    staleTime: 5 * 60 * 1000,
  });

  const distOptions = (distData?.data ?? []).map((d) => ({
    value: d.entityId,
    label: `${d.name} (${d.entityId})`,
  }));

  // Fetch unique beats under all selected Source Distributors in a single fast call
  const { data: distBeatsData, isLoading: beatsLoading } = useQuery({
    queryKey: ['distributor-beats-multi', sourceDistIds.join(',')],
    queryFn: async () => {
      if (sourceDistIds.length === 0) return [];
      return userService.getBeatsForDistributors(sourceDistIds);
    },
    enabled: sourceDistIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const distBeatOptions = useMemo(() => {
    if (!distBeatsData || distBeatsData.length === 0) return [];
    return distBeatsData.map((b) => ({ value: b, label: b }));
  }, [distBeatsData]);

  const pairs = useMemo(() => {
    const list = [];
    const maxLen = Math.max(sourceDistIds.length, targetDistIds.length);
    for (let i = 0; i < maxLen; i++) {
      const srcId = sourceDistIds[i] || '';
      const tgtId = targetDistIds[i] || targetDistIds[0] || '';
      const srcOpt = distOptions.find((o) => o.value === srcId);
      const tgtOpt = distOptions.find((o) => o.value === tgtId);
      list.push({
        index: i + 1,
        sourceId: srcId,
        targetId: tgtId,
        sourceName: srcOpt ? srcOpt.label : 'Select Source Distributor...',
        targetName: tgtOpt ? tgtOpt.label : 'Select Target Distributor...',
        isValid: Boolean(srcId && tgtId && srcId !== tgtId),
      });
    }
    return list;
  }, [sourceDistIds, targetDistIds, distOptions]);

  const isTransferDisabled = useMemo(() => {
    if (sourceDistIds.length === 0 || targetDistIds.length === 0) return true;
    return pairs.some((p) => !p.isValid);
  }, [sourceDistIds.length, targetDistIds.length, pairs]);

  const handleSourceDistChange = (val: string[]) => {
    setSourceDistIds(val);
    setSelectedSourceChildIds({});
    setSelectedBeats([]);
  };

  const handleTargetDistChange = (val: string[]) => {
    setTargetDistIds(val);
    setSelectedSourceChildIds({});
  };

  const handleSelectedChildrenChange = useCallback((pairKey: string, ids: string[]) => {
    setSelectedSourceChildIds((prev) => {
      const existing = prev[pairKey] || [];
      if (existing.length === ids.length && existing.every((v, i) => v === ids[i])) {
        return prev;
      }
      return {
        ...prev,
        [pairKey]: ids,
      };
    });
  }, []);

  const transferMutation = useMutation({
    mutationFn: async () => {
      let transferredCount = 0;
      for (const pair of pairs) {
        if (!pair.isValid) continue;
        const pairKey = `${pair.sourceId}_${pair.targetId}`;
        const selectedIds = selectedSourceChildIds[pairKey];
        if (!selectedIds || selectedIds.length === 0) {
          continue;
        }
        await retailerTransferService.transferDistributor(pair.sourceId, pair.targetId, selectedIds);
        transferredCount++;
      }
      if (transferredCount === 0) {
        throw new Error('No retailers or beats selected for transfer. Please select at least one beat or retailer.');
      }
    },
    onSuccess: () => {
      Alert.alert('Success', 'Distributor transfer completed successfully');
      setSourceDistIds([]);
      setTargetDistIds([]);
      setSelectedSourceChildIds({});
      setSelectedBeats([]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Distributor transfer failed');
    },
  });

  const targetOptionsFiltered = useMemo(() => {
    return distOptions.filter((o) => !sourceDistIds.includes(o.value));
  }, [distOptions, sourceDistIds]);

  const beatLabels = selectedBeats.join(', ');

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm gap-4 mb-8">
      <View className="flex-row items-center gap-2 border-b border-gray-100 pb-3">
        <Ionicons name="people-outline" size={18} color="#f97316" />
        <Text className="text-sm font-bold text-slate-800">Transfer Distributor (Retailers to New Dist.)</Text>
      </View>
      <Text className="text-xs text-slate-400 leading-relaxed -mt-2">
        Search and select Source and Target distributors. Retailers will be transferred from Source to Target distributor.
      </Text>

      <PickerTrigger
        label="Source Distributor(s) * (Numbered Order)"
        placeholder="Search & Select Source Distributors..."
        onPress={() => setShowSourceModal(true)}
        loading={distLoading}
        selectedValues={sourceDistIds}
        options={distOptions}
        onUnselect={(val: string) => handleSourceDistChange(sourceDistIds.filter((id) => id !== val))}
        onClear={() => handleSourceDistChange([])}
        showOrderNumbers={true}
      />

      {sourceDistIds.length > 0 && (
        <View className="gap-1.5 mb-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-slate-500">
              {isMultiBeat ? 'Select Beat(s) (Optional - Multi-Select Enabled)' : 'Select Beat (Optional)'}
            </Text>
            <TouchableOpacity onPress={() => { setIsMultiBeat(!isMultiBeat); setSelectedBeats([]); }}>
              <Text className="text-[10px] font-bold text-orange-600">
                Toggle {isMultiBeat ? 'Single-Select' : 'Multi-Select'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setShowBeatModal(true)}
            disabled={beatsLoading}
            className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
          >
            {beatsLoading ? (
              <ActivityIndicator size="small" color="#f37021" />
            ) : (
              <Text className={`text-xs ${beatLabels ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
                {beatLabels || (distBeatOptions.length === 0 ? 'Selected Distributor(s) have no beats assigned.' : 'Search & Select Beats (Leave empty for all beats)...')}
              </Text>
            )}
            <Ionicons name="chevron-down" size={16} color="#6b7280" />
          </TouchableOpacity>
          {!beatsLoading && distBeatOptions.length === 0 && (
            <Text className="text-xs text-amber-600 mt-1">Selected Distributor(s) have no beats assigned.</Text>
          )}
        </View>
      )}

      <PickerTrigger
        label="Target Distributor(s) * (Numbered Order)"
        placeholder="Search & Select Target Distributors..."
        onPress={() => setShowTargetModal(true)}
        loading={distLoading}
        selectedValues={targetDistIds}
        options={targetOptionsFiltered}
        onUnselect={(val: string) => handleTargetDistChange(targetDistIds.filter((id) => id !== val))}
        onClear={() => handleTargetDistChange([])}
        showOrderNumbers={true}
      />

      {pairs
        .filter((p) => p.isValid)
        .map((pair) => {
          const pairKey = `${pair.sourceId}_${pair.targetId}`;
          return (
            <DistributorPairRetailerMappingPreview
              key={pairKey}
              pairIndex={pair.index}
              sourceDistId={pair.sourceId}
              targetDistId={pair.targetId}
              sourceDistName={pair.sourceName}
              targetDistName={pair.targetName}
              filterBeats={selectedBeats}
              selectedChildIds={selectedSourceChildIds[pairKey]}
              onSelectedChildrenChange={(ids: string[]) => handleSelectedChildrenChange(pairKey, ids)}
            />
          );
        })}

      <TouchableOpacity
        onPress={() => transferMutation.mutate()}
        disabled={isTransferDisabled || transferMutation.isPending}
        className="bg-[#f37021] py-3 rounded-xl flex-row justify-center items-center gap-2 mt-2"
        style={(isTransferDisabled || transferMutation.isPending) && { opacity: 0.5 }}
      >
        {transferMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="swap-horizontal" size={14} color="#fff" />
            <Text className="color-white font-bold text-xs">
              Transfer Retailers ({sourceDistIds.length} Pairings)
            </Text>
          </>
        )}
      </TouchableOpacity>

      <MultiSelectorModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        data={distOptions}
        selectedValues={sourceDistIds}
        onSelect={handleSourceDistChange}
        title="Select Source Distributors"
      />

      <MultiSelectorModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        data={targetOptionsFiltered}
        selectedValues={targetDistIds}
        onSelect={handleTargetDistChange}
        title="Select Target Distributors"
      />

      {isMultiBeat ? (
        <MultiSelectorModal
          visible={showBeatModal}
          onClose={() => setShowBeatModal(false)}
          data={distBeatOptions}
          selectedValues={selectedBeats}
          onSelect={setSelectedBeats}
          title="Select Beats"
        />
      ) : (
        <SelectorModal
          visible={showBeatModal}
          onClose={() => setShowBeatModal(false)}
          data={distBeatOptions}
          selectedValue={selectedBeats[0] || ''}
          onSelect={(val: string) => setSelectedBeats(val ? [val] : [])}
          title="Select Beat"
        />
      )}
    </View>
  );
}

// -- Super Stockist Tab --------------------------------------------

function SsPairDistributorMappingPreview({ pairIndex, sourceSsId, targetSsId, sourceSsName, targetSsName, pairDistributorMapping, onMappingChange, onOpenMapping, selectedChildIds, onSelectedChildrenChange }: any) {
  const { data: distData, isLoading } = useQuery({
    queryKey: ['ss-distributors', sourceSsId],
    queryFn: () => userService.listAll({ role: UserRole.DISTRIBUTOR, parentId: sourceSsId, limit: 1000 }),
    enabled: Boolean(sourceSsId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: targetDistData, isLoading: targetLoading } = useQuery({
    queryKey: ['ss-target-distributors', targetSsId],
    queryFn: () => userService.listAll({ role: UserRole.DISTRIBUTOR, parentId: targetSsId, limit: 1000 }),
    enabled: Boolean(targetSsId),
    staleTime: 5 * 60 * 1000,
  });

  const distributors = distData?.data || [];
  const targetDistributors = targetDistData?.data || [];

  React.useEffect(() => {
    if (distributors.length > 0 && !selectedChildIds) {
      onSelectedChildrenChange(distributors.map((d: any) => d.entityId));
    }
  }, [distributors, selectedChildIds, onSelectedChildrenChange]);

  const toggleChild = (entityId: string) => {
    const current = selectedChildIds || [];
    if (current.includes(entityId)) {
      onSelectedChildrenChange(current.filter((id: string) => id !== entityId));
    } else {
      onSelectedChildrenChange([...current, entityId]);
    }
  };

  const isAllSelected = distributors.length > 0 && (selectedChildIds || []).length === distributors.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectedChildrenChange([]);
    } else {
      onSelectedChildrenChange(distributors.map((d: any) => d.entityId));
    }
  };

  return (
    <View className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 gap-2 mb-3">
      <View className="flex-row items-center justify-between border-b border-gray-200 pb-2">
        <View className="flex-row items-center gap-1.5 flex-1 max-w-[70%]">
          <View className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-700">{pairIndex}</Text>
          </View>
          <Text className="text-xs font-bold text-gray-800 truncate">
            Distributor Mapping: {sourceSsName.split('(')[0]} ➔ {targetSsName.split('(')[0]}
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleSelectAll}
          className="flex-row items-center gap-1 shrink-0"
        >
          <Ionicons
            name={isAllSelected ? 'checkbox' : 'square-outline'}
            size={14}
            color={isAllSelected ? '#f37021' : '#9ca3af'}
          />
          <Text className="text-[10px] text-gray-500 font-bold select-none">Select All</Text>
        </TouchableOpacity>
      </View>

      {isLoading || targetLoading ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color="#f37021" />
          <Text className="text-xs text-gray-500">Fetching distributors under SS...</Text>
        </View>
      ) : distributors.length === 0 ? (
        <Text className="text-xs text-gray-500 italic py-1">
          No active distributors found under Super Stockist {sourceSsName.split('(')[0]}.
        </Text>
      ) : (
        <View className="gap-3 mt-1">
          {distributors.map((sDist) => {
            const currentSelected =
              pairDistributorMapping[sDist.entityId] ||
              targetSsId;

            const isChecked = (selectedChildIds || []).includes(sDist.entityId);

            const selectedLabel =
              currentSelected === targetSsId
                ? `Directly to Target SS (${targetSsId})`
                : targetDistributors.find((t) => t.entityId === currentSelected)?.name || currentSelected;

            const modalData = [
              ...targetDistributors.map((tD) => ({
                value: tD.entityId,
                label: `Assign to Target Distributor: ${tD.name} (${tD.entityId})`,
              })),
              {
                value: targetSsId,
                label: `Assign Directly to Target Super Stockist (${targetSsId})`,
              },
            ];

            return (
              <View key={sDist.entityId} className="flex-row items-center justify-between gap-3">
                <TouchableOpacity
                  onPress={() => toggleChild(sDist.entityId)}
                  className="flex-row items-center gap-2 flex-1 max-w-[45%]"
                >
                  <Ionicons
                    name={isChecked ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={isChecked ? '#f37021' : '#9ca3af'}
                  />
                  <Text className={`text-xs truncate ${isChecked ? 'text-gray-800 font-semibold' : 'text-gray-400 line-through'}`} numberOfLines={1}>
                    {sDist.name} ({sDist.entityId})
                  </Text>
                </TouchableOpacity>
                <Text className="text-gray-400 text-xs shrink-0">➔</Text>
                <View className="flex-1">
                  <MappingSelectorTrigger
                    value={isChecked ? selectedLabel : `Directly to Target SS (${targetSsId})`}
                    disabled={!isChecked}
                    onPress={() =>
                      onOpenMapping(
                        `Map Distributor: ${sDist.name}`,
                        modalData,
                        currentSelected,
                        (val: string) => onMappingChange(sDist.entityId, val)
                      )
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TransferSuperStockistTab({ onOpenMapping }: { onOpenMapping: any }) {
  const [sourceSsIds, setSourceSsIds] = useState<string[]>([]);
  const [targetSsIds, setTargetSsIds] = useState<string[]>([]);
  const [customPairDistributorMappings, setCustomPairDistributorMappings] = useState<Record<string, Record<string, string>>>({});
  const [selectedSourceChildIds, setSelectedSourceChildIds] = useState<Record<string, string[]>>({});

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  const { data: ssData, isLoading: ssLoading } = useQuery({
    queryKey: ['admin-super-stockists'],
    queryFn: () => userService.listAll({ role: UserRole.SUPER_STOCKIST, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const ssOptions = (ssData?.data ?? []).map((ss) => ({
    value: ss.entityId,
    label: `${ss.name} (${ss.entityId})`,
  }));

  const pairs = useMemo(() => {
    const list = [];
    const maxLen = Math.max(sourceSsIds.length, targetSsIds.length);
    for (let i = 0; i < maxLen; i++) {
      const srcId = sourceSsIds[i] || '';
      const tgtId = targetSsIds[i] || targetSsIds[0] || '';
      const srcOpt = ssOptions.find((o) => o.value === srcId);
      const tgtOpt = ssOptions.find((o) => o.value === tgtId);
      list.push({
        index: i + 1,
        sourceId: srcId,
        targetId: tgtId,
        sourceName: srcOpt ? srcOpt.label : 'Select Source SS...',
        targetName: tgtOpt ? tgtOpt.label : 'Select Target SS...',
        isValid: Boolean(srcId && tgtId && srcId !== tgtId),
      });
    }
    return list;
  }, [sourceSsIds, targetSsIds, ssOptions]);

  const isTransferDisabled = useMemo(() => {
    if (sourceSsIds.length === 0 || targetSsIds.length === 0) return true;
    return pairs.some((p) => !p.isValid);
  }, [sourceSsIds.length, targetSsIds.length, pairs]);

  const handleSourceSsChange = (val: string[]) => {
    setSourceSsIds(val);
    setCustomPairDistributorMappings({});
    setSelectedSourceChildIds({});
  };

  const handleTargetSsChange = (val: string[]) => {
    setTargetSsIds(val);
    setCustomPairDistributorMappings({});
    setSelectedSourceChildIds({});
  };

  const handleSelectedChildrenChange = useCallback((pairKey: string, ids: string[]) => {
    setSelectedSourceChildIds((prev) => {
      const existing = prev[pairKey] || [];
      if (existing.length === ids.length && existing.every((v, i) => v === ids[i])) {
        return prev;
      }
      return {
        ...prev,
        [pairKey]: ids,
      };
    });
  }, []);

  const handleMappingChange = (pairKey: string, sDistId: string, tDistId: string) => {
    setCustomPairDistributorMappings((prev) => ({
      ...prev,
      [pairKey]: {
        ...(prev[pairKey] || {}),
        [sDistId]: tDistId,
      },
    }));
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const maxLen = Math.max(sourceSsIds.length, targetSsIds.length);
      for (let i = 0; i < maxLen; i++) {
        const srcId = sourceSsIds[i];
        const tgtId = targetSsIds[i] || targetSsIds[0];
        if (!srcId || !tgtId) continue;
        const pairKey = `${srcId}_${tgtId}`;
        const mapping = customPairDistributorMappings[pairKey] || undefined;
        const selectedIds = selectedSourceChildIds[pairKey] || undefined;
        await retailerTransferService.transferSuperStockist(srcId, tgtId, mapping, selectedIds);
      }
    },
    onSuccess: () => {
      Alert.alert('Success', 'Super Stockist transfer completed successfully');
      setSourceSsIds([]);
      setTargetSsIds([]);
      setCustomPairDistributorMappings({});
      setSelectedSourceChildIds({});
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Super Stockist transfer failed');
    },
  });

  const targetOptionsFiltered = useMemo(() => {
    return ssOptions.filter((o) => !sourceSsIds.includes(o.value));
  }, [ssOptions, sourceSsIds]);

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm gap-4 mb-8">
      <View className="flex-row items-center gap-2 border-b border-gray-100 pb-3">
        <Ionicons name="layers-outline" size={18} color="#f97316" />
        <Text className="text-sm font-bold text-slate-800">Transfer Super Stockist (Dist. to New SS)</Text>
      </View>
      <Text className="text-xs text-slate-400 leading-relaxed -mt-2">
        Search and select Super Stockist(s) to transfer downline distributors & retailers under a new Super Stockist.
      </Text>

      <PickerTrigger
        label="Select Super Stockist(s) * (Numbered Order)"
        placeholder="Search & Select Super Stockists..."
        onPress={() => setShowSourceModal(true)}
        loading={ssLoading}
        selectedValues={sourceSsIds}
        options={ssOptions}
        onUnselect={(val: string) => handleSourceSsChange(sourceSsIds.filter((id) => id !== val))}
        onClear={() => handleSourceSsChange([])}
        showOrderNumbers={true}
      />

      <PickerTrigger
        label="Target Super Stockist(s) * (Numbered Order)"
        placeholder="Search & Select Target Super Stockists..."
        onPress={() => setShowTargetModal(true)}
        loading={ssLoading}
        selectedValues={targetSsIds}
        options={targetOptionsFiltered}
        onUnselect={(val: string) => handleTargetSsChange(targetSsIds.filter((id) => id !== val))}
        onClear={() => handleTargetSsChange([])}
        showOrderNumbers={true}
      />

      {pairs
        .filter((p) => p.isValid)
        .map((pair) => {
          const pairKey = `${pair.sourceId}_${pair.targetId}`;
          return (
            <SsPairDistributorMappingPreview
              key={pairKey}
              pairIndex={pair.index}
              sourceSsId={pair.sourceId}
              targetSsId={pair.targetId}
              sourceSsName={pair.sourceName}
              targetSsName={pair.targetName}
              pairDistributorMapping={customPairDistributorMappings[pairKey] || {}}
              onMappingChange={(sDistId: string, tDistId: string) => handleMappingChange(pairKey, sDistId, tDistId)}
              onOpenMapping={onOpenMapping}
              selectedChildIds={selectedSourceChildIds[pairKey]}
              onSelectedChildrenChange={(ids: string[]) => handleSelectedChildrenChange(pairKey, ids)}
            />
          );
        })}

      <TouchableOpacity
        onPress={() => transferMutation.mutate()}
        disabled={isTransferDisabled || transferMutation.isPending}
        className="bg-[#f37021] py-3 rounded-xl flex-row justify-center items-center gap-2 mt-2"
        style={(isTransferDisabled || transferMutation.isPending) && { opacity: 0.5 }}
      >
        {transferMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="swap-horizontal" size={14} color="#fff" />
            <Text className="color-white font-bold text-xs">
              Transfer Super Stockist ({sourceSsIds.length} Pairings)
            </Text>
          </>
        )}
      </TouchableOpacity>

      <MultiSelectorModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        data={ssOptions}
        selectedValues={sourceSsIds}
        onSelect={handleSourceSsChange}
        title="Select Super Stockists"
      />

      <MultiSelectorModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        data={targetOptionsFiltered}
        selectedValues={targetSsIds}
        onSelect={handleTargetSsChange}
        title="Select Target Super Stockists"
      />
    </View>
  );
}
