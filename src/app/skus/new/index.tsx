import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { skuService } from '@/services/sku.service';

export default function NewSkuScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [skuId, setSkuId] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [displayRequired, setDisplayRequired] = useState('');
  const [schemeEligible, setSchemeEligible] = useState(false);

  const createSkuMutation = useMutation({
    mutationFn: () =>
      skuService.create({
        skuId: skuId.trim(),
        name: name.trim(),
        price: Number(price),
        displayRequired: Number(displayRequired) || undefined,
        schemeEligible,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] });
      Alert.alert('Success', 'SKU created successfully');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create SKU');
    },
  });

  const handleCreate = () => {
    if (!skuId.trim() || !name.trim() || !price.trim()) {
      Alert.alert('Required Fields', 'Please fill in SKU Code, Name, and Price');
      return;
    }
    createSkuMutation.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 py-4 border-b border-gray-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="close-outline" size={26} color="#374151" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold text-gray-800">Add New SKU</Text>
          <Text className="text-xs text-gray-500 mt-0.5">Register a new product in the system</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        <View className="gap-5">
          <View>
            <Text className="text-xs font-semibold text-gray-500 mb-1.5">Product Code (SKU ID) *</Text>
            <TextInput
              value={skuId}
              onChangeText={setSkuId}
              placeholder="e.g. SKU-001"
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
            />
          </View>

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

          {/* Action Buttons */}
          <View className="mt-8 gap-3">
            <TouchableOpacity
              onPress={handleCreate}
              disabled={createSkuMutation.isPending}
              className="w-full bg-purple-600 rounded-xl py-3.5 items-center justify-center flex-row gap-2 shadow-sm"
            >
              {createSkuMutation.isPending && <ActivityIndicator size="small" color="white" />}
              <Text className="text-sm font-bold text-white">Create SKU</Text>
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
    </SafeAreaView>
  );
}
