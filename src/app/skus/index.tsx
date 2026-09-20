import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { skuService } from '@/services/sku.service';
import { UserRole } from '@/types';
import type { ISku } from '@/types';

import AddSkuModal from '@/components/catalog/AddSkuModal';

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SkuMasterScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showAddSkuModal, setShowAddSkuModal] = useState(false);
  const limit = 10;

  const isAdmin = user?.role === UserRole.ADMIN;
  const isSS = user?.role === UserRole.SUPER_STOCKIST;
  const isDist = user?.role === UserRole.DISTRIBUTOR;
  const isSO = user?.role === UserRole.SO;
  const isRetailer = user?.role === UserRole.RETAILER;
  const isDownstreamRole = !isSS && !isAdmin;

  if (isSO) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          SKU Master access is not available for SO.
        </Text>
      </SafeAreaView>
    );
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skus', page, search],
    queryFn: () =>
      skuService.list({
        page,
        limit,
        search: search || undefined,
        isActive: 'true',
      }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const skus: ISku[] = (data?.data ?? []).filter(
    (sku: any) => sku.enabled !== false && sku.assortmentActive !== false
  );
  const total = data?.total ?? skus.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Page Title & Count */}
        <View className="mb-4">
          <Text className="text-xl font-bold text-gray-900">SKU Master</Text>
          <Text className="text-xs text-gray-500 mt-0.5">{total} products available in your network</Text>
        </View>

        {/* Manage Catalog & Add SKU Buttons */}
        {isAdmin && (
          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              onPress={() => setShowAddSkuModal(true)}
              className="flex-1 bg-orange-500 rounded-lg py-3 flex-row items-center justify-center gap-2 shadow-xs"
            >
              <Ionicons name="add-circle-outline" size={18} color="white" />
              <Text className="text-sm font-bold text-white">+ Add New SKU</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/catalog')}
              className="flex-1 bg-gray-800 rounded-lg py-3 flex-row items-center justify-center gap-2 shadow-xs"
            >
              <Ionicons name="book-outline" size={16} color="white" />
              <Text className="text-sm font-bold text-white">Manage Catalog</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSS && !isAdmin && (
          <TouchableOpacity
            onPress={() => router.push('/catalog')}
            className="bg-orange-500 rounded-lg py-3 flex-row items-center justify-center gap-2 mb-4"
          >
            <Ionicons name="book-outline" size={16} color="white" />
            <Text className="text-sm font-bold text-white">Manage Catalog</Text>
          </TouchableOpacity>
        )}

        {/* Empty state for downstream roles */}
        {!isLoading && !isError && skus.length === 0 && !search && isDownstreamRole && (
          <View className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-xs text-amber-800 font-semibold leading-relaxed">
              No products have been enabled by your Super Stockist yet. Products will appear here once they add items to their catalog.
            </Text>
          </View>
        )}

        {/* Search bar */}
        <View className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 flex-row items-center mb-4 shadow-sm">
          <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
          <TextInput
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setPage(1);
            }}
            placeholder="Search by product name..."
            placeholderTextColor="#9ca3af"
            className="flex-grow text-xs text-gray-800 p-0"
          />
        </View>

        {/* SKU List */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-8" />
        ) : isError ? (
          <View className="bg-red-50 border border-red-100 rounded-xl p-8 items-center justify-center">
            <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
            <Text className="text-xs text-red-600 mt-2">Failed to load SKUs. Please try again.</Text>
          </View>
        ) : skus.length === 0 ? (
          <View className="bg-gray-50 border border-gray-100 rounded-xl p-8 items-center justify-center">
            <Ionicons name="cube-outline" size={32} color="#9ca3af" className="opacity-40" />
            <Text className="text-xs text-gray-400 mt-2">No products found</Text>
          </View>
        ) : (
          <View className="pb-24">
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} className="border border-gray-200 rounded-xl bg-white shadow-sm">
              <View>
                {/* Table Header */}
                <View className="flex-row bg-gray-50 border-b border-gray-200 py-3 px-4">
                  {isRetailer ? (
                    <>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-44">Name of Product</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Weight</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">MASTER PKG.</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Master Pack</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">for per/pc</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Retail per/pc</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">Retail per/piece</Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-44">Product</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Weight</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">MRP</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Pack Qty</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Case Qty</Text>
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">For Per/Pc</Text>
                      {isAdmin && (
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">SS Price/Doz</Text>
                      )}
                      {(isAdmin || isSS) && (
                        <>
                          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Dist Price/Pc</Text>
                          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Dist Total/Case</Text>
                        </>
                      )}
                      {(isAdmin || isDist) && (
                        <>
                          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Retail Per/Pc</Text>
                          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Retail Price/Box</Text>
                        </>
                      )}
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Scheme</Text>
                    </>
                  )}
                </View>

                {/* Table Body */}
                {skus.map((sku, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <View key={sku._id ?? sku.skuId} className={`flex-row border-b border-gray-100 py-4 px-4 items-center ${isEven ? 'bg-white' : 'bg-orange-50/5'}`}>
                      {isRetailer ? (
                        <>
                          <Text className="text-xs font-semibold text-gray-800 w-44 leading-normal" numberOfLines={2}>{sku.name}</Text>
                          <Text className="text-xs font-semibold text-gray-500 w-20 text-center">{sku.weight || '-'}</Text>
                          <Text className="text-xs font-semibold text-gray-800 w-24 text-center">{sku.masterPackUnit || '-'}</Text>
                          <Text className="text-xs font-semibold text-gray-800 w-24 text-center">{sku.masterPackQty ?? '-'}</Text>
                          <Text className="text-xs font-semibold text-gray-800 w-24 text-center">{sku.perPcPrice ?? '-'}</Text>
                          <Text className="text-xs font-bold text-amber-600 w-28 text-center">
                            {sku.retailTotal ? formatCurrency(sku.retailTotal) : '-'}
                          </Text>
                          <Text className="text-xs font-bold text-orange-600 w-32 text-center">
                            {sku.retailPerPiece ? formatCurrency(sku.retailPerPiece) : '-'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text className="text-xs font-semibold text-gray-800 w-44 leading-normal" numberOfLines={2}>{sku.name}</Text>
                          <Text className="text-xs font-semibold text-gray-500 w-20 text-center">{sku.weight || '-'}</Text>
                          <Text className="text-xs font-semibold text-gray-800 w-20 text-center">
                            {formatCurrency(sku.mrpPerUnit ?? sku.unitPrice ?? sku.price)}
                          </Text>
                          <Text className="text-xs font-semibold text-gray-800 w-24 text-center">
                            {sku.masterPackQty ?? sku.displayRequired} {sku.masterPackUnit ?? 'Doz'}
                          </Text>
                          <Text className="text-xs font-semibold text-gray-800 w-24 text-center">
                            {sku.boxQty ?? '-'}
                          </Text>
                          <Text className="text-xs font-semibold text-gray-800 w-24 text-center">
                            {sku.perPcPrice ?? '-'}
                          </Text>
                          {isAdmin && (
                            <Text className="text-xs font-semibold text-orange-600 w-28 text-center">
                              {sku.pricePerDozenSS ? formatCurrency(sku.pricePerDozenSS) : '-'}
                            </Text>
                          )}
                          {(isAdmin || isSS) && (
                            <>
                              <Text className="text-xs font-semibold text-emerald-600 w-28 text-center">
                                {sku.distributorTotal ? formatCurrency(sku.distributorTotal) : '-'}
                              </Text>
                              <Text className="text-xs font-semibold text-emerald-600 w-36 text-center">
                                {sku.distPerBox ? formatCurrency(sku.distPerBox) : '-'}
                              </Text>
                            </>
                          )}
                          {(isAdmin || isDist) && (
                            <>
                              <Text className="text-xs font-semibold text-orange-600 w-28 text-center">
                                {sku.pricePerDozenRetail ? formatCurrency(sku.pricePerDozenRetail) : '-'}
                              </Text>
                              <Text className="text-xs font-semibold text-orange-600 w-36 text-center">
                                {sku.retailPerBox ? formatCurrency(sku.retailPerBox) : '-'}
                              </Text>
                            </>
                          )}
                          <View className="w-24 items-center">
                            {sku.schemeEligible ? (
                              <View className="bg-green-50 px-2 py-0.5 rounded-full">
                                <Text className="text-[10px] font-bold text-green-700">
                                  {sku.schemePercent ? `${sku.schemePercent}%` : 'Yes'}
                                </Text>
                              </View>
                            ) : (
                              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                                <Text className="text-[10px] font-bold text-gray-500">No</Text>
                              </View>
                            )}
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-center py-4 border-t border-gray-100 gap-4 bg-white">
          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            className={`p-2 border rounded-lg ${
              page === 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
            }`}
          >
            <Ionicons name="chevron-back" size={16} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xs text-gray-600 font-semibold">
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity
            disabled={page === totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`p-2 border rounded-lg ${
              page === totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
            }`}
          >
            <Ionicons name="chevron-forward" size={16} color="#374151" />
          </TouchableOpacity>
        </View>
      )}

      <AddSkuModal
        visible={showAddSkuModal}
        onClose={() => setShowAddSkuModal(false)}
      />
    </SafeAreaView>
  );
}
