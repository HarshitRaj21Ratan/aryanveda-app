import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { capabilityManagementService } from '@/services/capabilityManagement.service';

const { width } = Dimensions.get('window');

function deepClone(matrix: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(matrix)) {
    out[k] = [...v];
  }
  return out;
}

function countDiffs(
  saved: Record<string, string[]>,
  pending: Record<string, string[]>
): number {
  let count = 0;
  for (const role of Object.keys(pending)) {
    const savedSet = new Set(saved[role] ?? []);
    const pendingSet = new Set(pending[role] ?? []);
    for (const cap of pendingSet) {
      if (!savedSet.has(cap)) count++;
    }
    for (const cap of savedSet) {
      if (!pendingSet.has(cap)) count++;
    }
  }
  return count;
}

export default function AdminRolePermissionsScreen() {
  /*
  const router = useRouter();
  const queryClient = useQueryClient();

  const [savedMatrix, setSavedMatrix] = useState<Record<string, string[]>>({});
  const [pendingMatrix, setPendingMatrix] = useState<Record<string, string[]>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Queries
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['capabilities-matrix'],
    queryFn: async () => {
      const res = await capabilityManagementService.getMatrix();
      setSavedMatrix(deepClone(res.matrix));
      setPendingMatrix(deepClone(res.matrix));
      return res;
    },
  });

  const diffCount = useMemo(() => countDiffs(savedMatrix, pendingMatrix), [savedMatrix, pendingMatrix]);
  const isDirty = diffCount > 0;

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (matrix: Record<string, string[]>) => capabilityManagementService.saveMatrix(matrix),
    onSuccess: () => {
      setSavedMatrix(deepClone(pendingMatrix));
      queryClient.invalidateQueries({ queryKey: ['capabilities-matrix'] });
      Alert.alert('Success', 'Permissions saved successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save permissions');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => capabilityManagementService.resetToDefaults(),
    onSuccess: () => {
      setShowResetConfirm(false);
      refetch();
      Alert.alert('Success', 'Permissions reset to system defaults');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to reset permissions');
    },
  });

  const toggleCapability = useCallback((role: string, cap: string) => {
    setPendingMatrix((prev) => {
      const current = new Set(prev[role] ?? []);
      if (current.has(cap)) {
        current.delete(cap);
      } else {
        current.add(cap);
      }
      return { ...prev, [role]: Array.from(current) };
    });
  }, []);

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#f37021" />
        <Text className="text-xs text-gray-400 mt-3 font-semibold">Loading permissions matrix...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-sm text-gray-500 mt-2 text-center">Failed to load permissions matrix.</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 border border-gray-200 px-5 py-2.5 rounded-lg bg-gray-50"
        >
          <Text className="text-xs font-bold text-gray-700">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { groups, roles } = data;
  const totalCapabilities = groups.reduce((acc, g) => acc + g.capabilities.length, 0);

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 py-3 border-b border-gray-150 flex-row items-center justify-between bg-white">
        <View className="flex-row items-center gap-2 flex-1 mr-3">
          <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100 mr-1">
            <Ionicons name="shield-checkmark-outline" size={22} color="#f97316" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-800">Role Permissions</Text>
            <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
              {totalCapabilities} capabilities × {roles.length} roles
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setShowResetConfirm(true)}
          className="border border-red-200 bg-red-50 rounded-lg px-2.5 py-1.5 flex-row items-center gap-1"
        >
          <Ionicons name="refresh" size={12} color="#dc2626" />
          <Text className="text-[10px] font-bold text-red-600">Reset Defaults</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
          <View style={{ minWidth: 1100 }}>
            <View className="flex-row bg-gray-50 border-b border-gray-200 py-3">
              <View className="w-[300px] px-4 justify-center">
                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Capability</Text>
              </View>
              {roles.map((role) => (
                <View key={role.key} className="w-[85px] items-center justify-center">
                  <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-wider text-center">{role.shortLabel}</Text>
                  <Text className="text-[8px] text-gray-400 mt-0.5 text-center px-1" numberOfLines={1}>{role.label}</Text>
                </View>
              ))}
            </View>

            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.name);

              return (
                <View key={group.name} className="border-b border-gray-100">
                  <TouchableOpacity
                    onPress={() => toggleGroup(group.name)}
                    activeOpacity={0.7}
                    className="flex-row bg-gray-100/70 border-b border-gray-100 py-2.5 items-center"
                  >
                    <View className="w-[300px] px-4 flex-row items-center gap-2">
                      <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={12}
                        color="#6b7280"
                      />
                      <Text className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">{group.name}</Text>
                      <View className="bg-gray-250 px-1.5 py-0.2 rounded-full">
                        <Text className="text-[8px] font-bold text-gray-600">{group.capabilities.length}</Text>
                      </View>
                    </View>
                    {roles.map((role) => (
                      <View key={role.key} className="w-[85px]" />
                    ))}
                  </TouchableOpacity>

                  {!isCollapsed &&
                    group.capabilities.map((cap, idx) => (
                      <View
                        key={cap.key}
                        className={`flex-row border-b border-gray-50 items-center py-2.5 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'
                        }`}
                      >
                        <View className="w-[300px] px-4">
                          <Text className="text-[11px] font-medium text-gray-700">{cap.label}</Text>
                          <Text className="text-[8px] font-mono text-gray-300 mt-0.5">{cap.key}</Text>
                        </View>

                        {roles.map((role) => {
                          const isChecked = (pendingMatrix[role.key] ?? []).includes(cap.key);
                          const wasChecked = (savedMatrix[role.key] ?? []).includes(cap.key);
                          const isDifferent = isChecked !== wasChecked;

                          return (
                            <TouchableOpacity
                              key={role.key}
                              onPress={() => toggleCapability(role.key, cap.key)}
                              className={`w-[85px] items-center justify-center py-1 ${
                                isDifferent ? (isChecked ? 'bg-emerald-50/70' : 'bg-amber-50/70') : ''
                              }`}
                            >
                              <View
                                className={`w-5 h-5 rounded items-center justify-center border-2 ${
                                  isChecked
                                    ? 'bg-[#f37021] border-[#f37021]'
                                    : 'bg-white border-gray-350'
                                }`}
                              >
                                {isChecked && (
                                  <Ionicons name="checkmark" size={12} color="#ffffff" />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {isDirty && (
        <View className="absolute bottom-6 left-4 right-4 bg-white border border-orange-200 p-4 rounded-2xl flex-row items-center justify-between shadow-xl">
          <View className="flex-row items-center gap-2">
            <View className="w-6 h-6 bg-orange-50 rounded-full items-center justify-center">
              <Ionicons name="warning" size={14} color="#f37021" />
            </View>
            <Text className="text-xs font-bold text-gray-700">
              {diffCount} unsaved change{diffCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setPendingMatrix(deepClone(savedMatrix))}
              className="px-3.5 py-2 border border-gray-200 rounded-xl"
            >
              <Text className="text-xs font-semibold text-gray-600">Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => saveMutation.mutate(pendingMatrix)}
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-[#f37021] rounded-xl flex-row items-center gap-1.5"
            >
              {saveMutation.isPending && <ActivityIndicator size="small" color="white" />}
              <Text className="text-xs font-bold text-white">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showResetConfirm} transparent animationType="fade" onRequestClose={() => setShowResetConfirm(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View className="bg-white rounded-2xl p-6 gap-4 w-full max-w-sm shadow-2xl">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center shrink-0">
                <Ionicons name="alert-circle" size={24} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">Reset to Defaults?</Text>
                <Text className="text-xs text-gray-500 mt-1 leading-relaxed">
                  This will replace ALL custom permissions with system defaults. This action cannot be undone.
                </Text>
              </View>
            </View>

            <View className="flex-row justify-end gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setShowResetConfirm(false)}
                disabled={resetMutation.isPending}
                className="px-4 py-2 border border-gray-200 rounded-lg"
              >
                <Text className="text-xs font-semibold text-gray-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="px-4 py-2 bg-red-600 rounded-lg flex-row items-center gap-1.5"
              >
                {resetMutation.isPending && <ActivityIndicator size="small" color="white" />}
                <Text className="text-xs font-bold text-white">Reset All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
  */
  return null;
}
