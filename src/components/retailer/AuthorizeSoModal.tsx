import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { retailerAuthorizationService } from '@/services/retailerAuthorization.service';

interface AuthorizeSoModalProps {
  open: boolean;
  onClose: () => void;
  currentSoEntityId?: string;
}

export default function AuthorizeSoModal({
  open,
  onClose,
  currentSoEntityId,
}: AuthorizeSoModalProps) {
  const [selectedSoId, setSelectedSoId] = useState('');
  const [errorText, setErrorText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['available-sos'],
    queryFn: () => retailerAuthorizationService.getAvailableSos(),
    enabled: open,
  });

  const authorizeMutation = useMutation({
    mutationFn: (soId: string) => retailerAuthorizationService.authorizeSo({ soId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-so-info'] });
      void queryClient.invalidateQueries({ queryKey: ['retailer-authorization'] });
    },
  });

  const soOptions = data?.sos ?? [];

  const defaultSoId = useMemo(() => {
    if (!soOptions.length) return '';

    const preferred = soOptions.find((so) => so.entityId !== currentSoEntityId);
    return preferred?.entityId ?? soOptions[0]?.entityId ?? '';
  }, [soOptions, currentSoEntityId]);

  useEffect(() => {
    if (!open) return;
    setSelectedSoId(defaultSoId);
    setErrorText('');
    setShowDropdown(false);
  }, [open, defaultSoId]);

  if (!open) return null;

  const handleAuthorize = async () => {
    if (!selectedSoId) {
      setErrorText('Please select a Sales Officer.');
      return;
    }

    setErrorText('');
    try {
      await authorizeMutation.mutateAsync(selectedSoId);
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message;
      setErrorText(msg ?? 'Failed to authorize Sales Officer.');
    }
  };

  const selectedSoOption = soOptions.find((so) => so.entityId === selectedSoId);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end sm:justify-center p-0 sm:p-6">
        <View className="bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl w-full max-w-md mx-auto">
          
          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            className="absolute right-4 top-4 p-1 rounded-full bg-gray-50 active:bg-gray-150"
          >
            <Ionicons name="close" size={20} color="#4b5563" />
          </TouchableOpacity>

          {/* Icon + Title */}
          <View className="mb-4">
            <View className="flex-row items-center gap-2 text-orange-500">
              <Ionicons name="shield-checkmark" size={20} color="#f97316" />
              <Text className="text-lg font-bold text-gray-900">Authorize Sales Officer</Text>
            </View>
            <Text className="text-sm text-gray-500 mt-1 leading-5">
              Choose one connected SO to handle your order flow and communication.
            </Text>
          </View>

          {/* Selector / List */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-gray-500 mb-1.5">Available SOs</Text>

            {isLoading ? (
              <View className="flex-row items-center gap-2 border border-gray-200 bg-gray-50 rounded-xl px-4 py-3">
                <ActivityIndicator size="small" color="#f97316" />
                <Text className="text-xs text-gray-500 font-semibold">Loading available SOs...</Text>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  onPress={() => setShowDropdown(!showDropdown)}
                  className="border border-gray-200 bg-white rounded-xl px-4 py-3 flex-row justify-between items-center"
                >
                  <Text className="text-sm text-gray-800 font-semibold">
                    {selectedSoOption ? `${selectedSoOption.name} (${selectedSoOption.entityId})` : 'Select a Sales Officer'}
                  </Text>
                  <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#6b7280" />
                </TouchableOpacity>

                {showDropdown && (
                  <View className="border border-gray-200 bg-white rounded-xl overflow-hidden mt-1 shadow-sm max-h-48">
                    <ScrollView nestedScrollEnabled>
                      {soOptions.length === 0 && (
                        <View className="px-4 py-3">
                          <Text className="text-xs text-gray-400 italic">No connected SO available</Text>
                        </View>
                      )}
                      {soOptions.map((so) => (
                        <TouchableOpacity
                          key={so.entityId}
                          onPress={() => {
                            setSelectedSoId(so.entityId);
                            setShowDropdown(false);
                          }}
                          className={`px-4 py-3.5 border-b border-gray-50 flex-row justify-between items-center ${
                            selectedSoId === so.entityId ? 'bg-orange-50' : 'active:bg-gray-50'
                          }`}
                        >
                          <View>
                            <Text className={`text-sm ${selectedSoId === so.entityId ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                              {so.name}
                            </Text>
                            <Text className="text-[10px] text-gray-400 font-semibold mt-0.5">{so.entityId} • {so.phone}</Text>
                          </View>
                          {selectedSoId === so.entityId && (
                            <Ionicons name="checkmark" size={16} color="#ea580c" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {errorText ? (
              <Text className="mt-2 text-xs text-red-600 font-medium">{errorText}</Text>
            ) : null}
          </View>

          {/* Footer Actions */}
          <View className="mt-4 flex-row justify-end gap-3 border-t border-gray-100 pt-4">
            <TouchableOpacity
              onPress={onClose}
              className="border border-gray-250 bg-white rounded-lg px-4 py-2.5 active:bg-gray-50"
            >
              <Text className="text-xs font-bold text-gray-700">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAuthorize}
              disabled={isLoading || soOptions.length === 0 || authorizeMutation.isPending}
              className="bg-orange-500 disabled:opacity-60 rounded-lg px-4 py-2.5 active:bg-orange-600 flex-row items-center gap-1.5"
            >
              {authorizeMutation.isPending && <ActivityIndicator size="small" color="white" />}
              <Text className="text-xs font-bold text-white">Authorize</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}
