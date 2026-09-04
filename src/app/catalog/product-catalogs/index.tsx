import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';

const TYPE_LABELS: Record<string, string> = {
  product_catalog: 'Product Catalog',
  promotional_video: 'Promotional Video',
  pdf_brochure: 'PDF Brochure',
  new_product_launch: 'New Product Launch',
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  product_catalog: 'image-outline',
  promotional_video: 'videocam-outline',
  pdf_brochure: 'document-text-outline',
  new_product_launch: 'star-outline',
};

interface ProductCatalogItem {
  catalogId: string;
  title: string;
  description?: string;
  catalogType: string;
  images: string[];
  videoUrl?: string;
  pdfUrl?: string;
  publishedAt?: string;
  isActive: boolean;
  createdAt: string;
}

export default function ProductCatalogsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [selectedCatalog, setSelectedCatalog] = useState<ProductCatalogItem | null>(null);
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['product-catalogs', typeFilter],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { data: ProductCatalogItem[]; total: number } }>(
        '/catalog/product-catalogs',
        { params: typeFilter ? { type: typeFilter } : {} }
      );
      return res.data.data;
    },
    enabled: !!user,
  });

  const catalogs = data?.data ?? [];

  const handleOpenPdf = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Error', 'Unable to open PDF link');
    }
  };

  const handleOpenVideo = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Error', 'Unable to play video link');
    }
  };

  if (selectedCatalog) {
    const isGallery = selectedCatalog.catalogType === 'product_catalog';
    return (
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="px-6 py-4 border-b border-gray-100 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => setSelectedCatalog(null)} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800 flex-1 mr-4" numberOfLines={1}>
            {selectedCatalog.title}
          </Text>
        </View>

        <ScrollView className="flex-grow p-6" showsVerticalScrollIndicator={false}>
          {selectedCatalog.description && (
            <Text className="text-sm text-gray-600 mb-6 leading-6">{selectedCatalog.description}</Text>
          )}

          {/* Image Gallery */}
          {isGallery && selectedCatalog.images.length > 0 && (
            <View className="flex-row flex-wrap gap-3 mb-6">
              {selectedCatalog.images.map((img, i) => (
                <Image
                  key={i}
                  source={{ uri: img }}
                  className="w-[47%] h-36 border border-gray-150 rounded-xl bg-gray-50"
                  resizeMode="cover"
                />
              ))}
            </View>
          )}

          {/* Video Attachment */}
          {selectedCatalog.videoUrl && (
            <View className="mb-6">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Promotional Video</Text>
              <TouchableOpacity
                onPress={() => handleOpenVideo(selectedCatalog.videoUrl!)}
                className="bg-red-50 border border-red-100 rounded-xl p-4 flex-row items-center gap-3"
              >
                <Ionicons name="logo-youtube" size={24} color="#ef4444" />
                <Text className="text-xs text-red-600 font-bold flex-1" numberOfLines={1}>
                  Play Video Link
                </Text>
                <Ionicons name="open-outline" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* PDF Attachment */}
          {selectedCatalog.pdfUrl && (
            <View className="mb-6">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-2">PDF Document</Text>
              <TouchableOpacity
                onPress={() => handleOpenPdf(selectedCatalog.pdfUrl!)}
                className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex-row items-center gap-3"
              >
                <Ionicons name="document-text-outline" size={24} color="#3b82f6" />
                <Text className="text-xs text-blue-600 font-bold flex-1" numberOfLines={1}>
                  Open PDF Brochure
                </Text>
                <Ionicons name="open-outline" size={14} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.push('/')} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-800">Product Catalogs</Text>
            <Text className="text-xs text-gray-500 mt-0.5">Browse brochures and product media</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => refetch()}
          className="p-2 border border-gray-150 rounded-lg bg-gray-50"
        >
          <Ionicons name="refresh" size={18} color="#4b5563" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-grow p-6" showsVerticalScrollIndicator={false}>
        {/* Type filter */}
        <View className="mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 py-1">
            <TouchableOpacity
              onPress={() => setTypeFilter('')}
              className={`px-4 py-2 rounded-full border ${
                typeFilter === '' ? 'bg-orange-500 border-orange-500' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${typeFilter === '' ? 'text-white' : 'text-gray-600'}`}>All Types</Text>
            </TouchableOpacity>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <TouchableOpacity
                key={val}
                onPress={() => setTypeFilter(val)}
                className={`px-4 py-2 rounded-full border ${
                  typeFilter === val ? 'bg-orange-500 border-orange-500' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`text-xs font-bold ${typeFilter === val ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-8" />
        ) : catalogs.length === 0 ? (
          <View className="bg-gray-50 border border-gray-100 rounded-xl p-8 items-center justify-center">
            <Ionicons name="folder-open-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-500 mt-2">No catalogs available currently</Text>
          </View>
        ) : (
          <View className="gap-4 pb-24">
            {catalogs.map((cat) => {
              const iconName = TYPE_ICONS[cat.catalogType] || 'image-outline';
              return (
                <TouchableOpacity
                  key={cat.catalogId}
                  onPress={() => setSelectedCatalog(cat)}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm"
                >
                  {cat.images.length > 0 ? (
                    <Image
                      source={{ uri: cat.images[0] }}
                      className="w-full h-40 bg-gray-50"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-40 bg-gray-50 items-center justify-center border-b border-gray-100">
                      <Ionicons name={iconName} size={36} color="#9ca3af" className="opacity-40" />
                    </View>
                  )}
                  <View className="p-4">
                    <Text className="text-base font-bold text-gray-800">{cat.title}</Text>
                    <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <View className="bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
                        <Text className="text-[9px] font-bold text-orange-700 uppercase">
                          {TYPE_LABELS[cat.catalogType] || cat.catalogType}
                        </Text>
                      </View>
                      {cat.publishedAt && (
                        <Text className="text-[10px] text-gray-400">
                          {new Date(cat.publishedAt).toLocaleDateString('en-IN')}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
