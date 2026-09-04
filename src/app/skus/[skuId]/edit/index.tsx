import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { skuService } from '@/services/sku.service';

export default function EditSkuScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { skuId } = useLocalSearchParams<{ skuId: string }>();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [displayRequired, setDisplayRequired] = useState('');
  const [schemeEligible, setSchemeEligible] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sku-detail', skuId],
    queryFn: () => skuService.getById(skuId),
    enabled: !!skuId,
  });

  const skuDetails = data?.data?.sku;

  useEffect(() => {
    if (skuDetails) {
      setName(skuDetails.name || '');
      setPrice(String(skuDetails.mrpPerUnit ?? skuDetails.unitPrice ?? skuDetails.price ?? ''));
      setDisplayRequired(String(skuDetails.masterPackQty ?? skuDetails.displayRequired ?? ''));
      setSchemeEligible(!!skuDetails.schemeEligible);
      setIsActive(skuDetails.isActive !== false);
    }
  }, [skuDetails]);

  const updateSkuMutation = useMutation({
    mutationFn: (payload: any) => skuService.update(skuId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] });
      queryClient.invalidateQueries({ queryKey: ['sku-detail', skuId] });
      Alert.alert('Success', 'SKU updated successfully');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update SKU');
    },
  });

  const handleSave = () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Required Fields', 'Please fill in Name and Price');
      return;
    }
    updateSkuMutation.mutate({
      name: name.trim(),
      price: Number(price),
      displayRequired: Number(displayRequired) || undefined,
      schemeEligible,
      isActive,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 py-4 border-b border-gray-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold text-gray-800">Edit SKU</Text>
          <Text className="text-xs text-gray-500 mt-0.5">Modify SKU #{skuId}</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center p-6 bg-white">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-bold text-gray-800 mt-4">Load Error</Text>
          <Text className="text-sm text-gray-500 text-center mt-2">
            Failed to retrieve SKU details from system.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          <View className="gap-5">
            <View>
              <Text className="text-xs font-semibold text-gray-500 mb-1.5">Product Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Nimson Jasmine Oil 200ml"
                placeholderTextColor="#9ca3af"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
              />
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-500 mb-1.5">MRP Unit Price *</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="INR"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-500 mb-1.5">Pack Quantity</Text>
                <TextInput
                  value={displayRequired}
                  onChangeText={setDisplayRequired}
                  placeholder="Per box"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                />
              </View>
            </View>

            <View className="flex-row justify-between items-center border-t border-b border-gray-50 py-4 mt-2">
              <View>
                <Text className="text-sm font-semibold text-gray-800">Scheme Eligible</Text>
                <Text className="text-xs text-gray-400 mt-0.5">Allow promotional schemes on this SKU</Text>
              </View>
              <Switch
                value={schemeEligible}
                onValueChange={setSchemeEligible}
                trackColor={{ false: '#d1d5db', true: '#c084fc' }}
                thumbColor={schemeEligible ? '#a855f7' : '#f3f4f6'}
              />
            </View>

            <View className="flex-row justify-between items-center border-b border-gray-50 pb-4">
              <View>
                <Text className="text-sm font-semibold text-gray-800">Status</Text>
                <Text className="text-xs text-gray-400 mt-0.5">Toggle catalog active status</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: '#d1d5db', true: '#c084fc' }}
                thumbColor={isActive ? '#a855f7' : '#f3f4f6'}
              />
            </View>

            {/* Action Buttons */}
            <View className="mt-8 gap-3">
              <TouchableOpacity
                onPress={handleSave}
                disabled={updateSkuMutation.isPending}
                className="w-full bg-purple-600 rounded-xl py-3.5 items-center justify-center flex-row gap-2 shadow-sm"
              >
                {updateSkuMutation.isPending && <ActivityIndicator size="small" color="white" />}
                <Text className="text-sm font-bold text-white">Save Changes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                className="w-full py-3.5 items-center justify-center"
              >
                <Text className="text-sm font-semibold text-gray-500">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
