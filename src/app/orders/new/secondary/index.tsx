import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { downloadXlsxReport } from '@/lib/xlsx-export';
import { useAuthStore } from '@/store/auth.store';
import { orderService } from '@/services/order.service';
import { skuService } from '@/services/sku.service';
import { retailerAuthorizationService } from '@/services/retailerAuthorization.service';
import { userService } from '@/services/user.service';
import { visitService } from '@/services/visit.service';
import { type ISku, UserRole, OrderType } from '@/types';
import { formatCurrency } from '@/lib/order-helpers';

function generateKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickPositivePrice(...candidates: Array<number | undefined>): number {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }
  return 0;
}

function formatSkuNameWithWeight(sku?: Pick<ISku, 'name' | 'weight'>): string {
  if (!sku?.name) return 'Unknown Product';
  const weight = sku.weight?.trim();
  return weight ? `${sku.name} (${weight})` : sku.name;
}

function getSkuPackPcs(sku?: Pick<ISku, 'perPcPrice'>): string {
  if (!sku) return '-';
  if (sku.perPcPrice && sku.perPcPrice > 0) return String(sku.perPcPrice);
  return '12';
}

function getSkuCasePcs(sku?: Pick<ISku, 'boxQty' | 'masterPackQty' | 'perPcPrice'>): string {
  if (!sku) return '-';
  if (sku.boxQty && sku.boxQty > 0) return String(sku.boxQty);
  if (sku.masterPackQty && sku.masterPackQty > 0) {
    return String(sku.masterPackQty * (sku.perPcPrice || 12));
  }
  return '288';
}

interface LineItem {
  id: string;
  skuId: string;
  qty: string;
  unitMode: 'piece' | 'dozen' | 'box';
  searchQuery: string;
  showDropdown: boolean;
  showUnitDropdown: boolean;
}

export default function NewSecondaryOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onBehalfOf?: string; retailerId?: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const isRetailer = user?.role === UserRole.RETAILER;
  const isSO = user?.role === UserRole.SO || user?.role === UserRole.ASE;

  const initialRetailerId = params.onBehalfOf || params.retailerId || '';
  const [selectedRetailerId, setSelectedRetailerId] = useState(initialRetailerId);
  const [showRetailerModal, setShowRetailerModal] = useState(false);

  const [items, setItems] = useState<LineItem[]>([
    { id: generateKey(), skuId: '', qty: '', unitMode: 'piece', searchQuery: '', showDropdown: false, showUnitDropdown: false },
  ]);

  const [idempotencyKey] = useState(() => generateKey());

  // Fetch Authorized Retailers for SO
  const { data: soAuthRetailersData } = useQuery({
    queryKey: ['so-authorized-retailers-secondary-new', user?.entityId],
    queryFn: () => retailerAuthorizationService.getMyRetailers(),
    enabled: !!user && isSO,
  });

  // Fetch Assigned Retailers fallback for SO
  const { data: allRetailersData } = useQuery({
    queryKey: ['so-all-retailers-secondary-new', user?.entityId],
    queryFn: () => userService.listRetailers({ limit: 1000 }),
    enabled: !!user && isSO,
  });

  // Fetch Today's Visit Performance for TC/PC badges (SO/ASE only)
  const { data: todayPerformanceData } = useQuery({
    queryKey: ['visit-performance-today', user?.entityId],
    queryFn: () => visitService.getPerformance('day'),
    enabled: !!user && isSO,
  });

  // Fetch Today's Secondary Orders for TC/PC badges (SO/ASE only)
  const { data: todayOrdersData } = useQuery({
    queryKey: ['so-today-secondary-orders', user?.entityId],
    queryFn: () => orderService.list({ type: OrderType.SECONDARY, limit: 500 }),
    enabled: !!user && isSO,
  });

  const todayCallStatusMap = useMemo(() => {
    const map: Record<string, 'PC' | 'TC'> = {};
    if (!isSO) return map;

    const visits = (todayPerformanceData as any)?.recentVisits ?? [];
    for (const v of visits) {
      const rId = v.retailerEntityId || v.retailerId;
      if (rId) {
        if (v.productive) {
          map[rId] = 'PC';
        } else if (!map[rId]) {
          map[rId] = 'TC';
        }
      }
    }

    const orders = (todayOrdersData as any)?.data ?? [];
    const todayStr = new Date().toISOString().split('T')[0];
    for (const order of orders) {
      const orderDateStr = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '';
      if (orderDateStr === todayStr) {
        const retailerId = order.fromEntityId || order.onBehalfOfEntityId || order.onBehalfOf;
        if (retailerId) {
          map[retailerId] = 'PC';
        }
      }
    }

    return map;
  }, [isSO, todayPerformanceData, todayOrdersData]);

  const retailers = useMemo(() => {
    const authRetailers = (soAuthRetailersData as any)?.retailers ?? (soAuthRetailersData as any)?.data?.retailers ?? [];
    if (Array.isArray(authRetailers) && authRetailers.length > 0) return authRetailers;
    const allRet = (allRetailersData as any)?.data ?? (allRetailersData as any)?.retailers ?? [];
    if (Array.isArray(allRet)) {
      return allRet.map((r: any) => ({
        retailerId: r.entityId || String(r._id),
        entityId: r.entityId,
        name: r.name,
        phone: r.phone ?? '',
      }));
    }
    return [];
  }, [soAuthRetailersData, allRetailersData]);

  const selectedRetailerName = useMemo(() => {
    if (isRetailer) return user?.name || '';
    const r = retailers.find((ret: any) => ret.entityId === selectedRetailerId || ret.retailerId === selectedRetailerId);
    return r ? r.name : '';
  }, [retailers, selectedRetailerId, isRetailer, user?.name]);

  const effectiveRetailerId = isRetailer ? (user?.entityId ?? '') : selectedRetailerId;

  // Fetch SKUs
  const { data: skusData, isLoading: skusLoading } = useQuery({
    queryKey: ['skus-secondary-selection-new-orders', isSO ? effectiveRetailerId : user?.entityId],
    queryFn: () => skuService.list({ limit: 500, isActive: 'true' }),
    enabled: !!user,
  });

  const skus: ISku[] = skusData?.data ?? [];
  const skuMap = useMemo(() => new Map(skus.map((s) => [s.skuId, s])), [skus]);

  const handleDownloadTemplate = async () => {
    try {
      const templateRows = skus.map((sku) => ({
        'SKU ID': sku.masterSkuId || sku.skuId,
        'Product Name': formatSkuNameWithWeight(sku),
        'Weight': sku.weight || '',
        'Unit Mode (piece/dozen)': 'piece',
        'Quantity': '',
      }));
      await downloadXlsxReport(templateRows, {
        fileName: 'nimson-secondary-order-template.xlsx',
        sheetName: 'Secondary Order Template',
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to download template');
    }
  };

  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      Alert.alert('Success', 'File selected successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select file');
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: generateKey(), skuId: '', qty: '', unitMode: 'piece', searchQuery: '', showDropdown: false, showUnitDropdown: false },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof LineItem, val: any) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  };

  // Line computations
  const computedLines = useMemo(() => {
    return items.map((item) => {
      const sku = skuMap.get(item.skuId);
      const qtyVal = parseInt(item.qty, 10) || 0;

      const packPcsStr = getSkuPackPcs(sku);
      const casePcsStr = getSkuCasePcs(sku);

      const packPcsNum = packPcsStr !== '-' ? parseInt(packPcsStr, 10) : 12;
      const casePcsNum = casePcsStr !== '-' ? parseInt(casePcsStr, 10) : 288;

      let unitMultiplier = 1;
      if (item.unitMode === 'dozen') unitMultiplier = packPcsNum;
      if (item.unitMode === 'box') unitMultiplier = casePcsNum;

      const quantityInPieces = qtyVal * unitMultiplier;

      const packPrice = pickPositivePrice(sku?.pricePerDozenRetail, sku?.boxPrice, sku?.price);
      let unitPrice = 0;
      if (sku?.retailTotal && sku?.perPcPrice) {
        unitPrice = Math.round((sku.retailTotal / sku.perPcPrice) * 100) / 100;
      } else if (packPrice > 0) {
        unitPrice = Math.round((packPrice / 12) * 100) / 100;
      }

      const bill = Math.round(quantityInPieces * unitPrice * 100) / 100;

      const modeLabel =
        item.unitMode === 'dozen'
          ? `Pack (${packPcsStr} pcs)`
          : item.unitMode === 'box'
          ? `Case (${casePcsStr} pcs)`
          : 'Piece';

      return {
        ...item,
        sku,
        qtyVal,
        quantityInPieces,
        unitPrice,
        bill,
        modeLabel,
        packPcsStr,
        casePcsStr,
      };
    });
  }, [items, skuMap]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBill = 0;
    for (const l of computedLines) {
      totalQty += l.quantityInPieces;
      totalBill += l.bill;
    }
    return {
      totalQty,
      totalBill: Math.round(totalBill * 100) / 100,
    };
  }, [computedLines]);

  const hasValidItem = useMemo(() => {
    return !!effectiveRetailerId && computedLines.some((l) => l.skuId && l.qtyVal > 0);
  }, [computedLines, effectiveRetailerId]);

  // Submit Mutation
  const mutation = useMutation({
    mutationFn: () => {
      const payloadItems = computedLines
        .filter((l) => l.skuId && l.qtyVal > 0)
        .map((l) => ({
          skuId: l.skuId,
          quantity: l.qtyVal,
          unitMode: l.unitMode,
        }));

      return orderService.createSecondary({
        onBehalfOf: isSO ? effectiveRetailerId : undefined,
        retailerId: isRetailer ? effectiveRetailerId : undefined,
        items: payloadItems,
        idempotencyKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      Alert.alert('Success', 'Order created successfully');
      router.push('/orders');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to place secondary order');
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50/50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View className="px-6 pt-6 pb-4">
          <TouchableOpacity onPress={() => router.push('/orders')} className="flex-row items-center gap-1 mb-1">
            <Ionicons name="chevron-back" size={16} color="#64748b" />
            <Text className="text-slate-500 text-sm">Back to Orders</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-800">New Secondary Order</Text>
          <Text className="text-slate-500 text-xs mt-1">
            {isRetailer
              ? 'Book stock for your outlet - enter quantity per SKU'
              : 'Book stock for an authorized retailer - enter quantity per SKU'}
          </Text>
        </View>

        {skusLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : (
          <View className="px-6 pb-24">
            {/* Card Wrap */}
            <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 mb-6">
              {/* Retailer Selector for SO */}
              {isSO && (
                <View className="mb-6">
                  <Text className="text-[10px] text-slate-400 font-bold uppercase mb-1">Retailer</Text>
                  <TouchableOpacity
                    onPress={() => setShowRetailerModal(true)}
                    className="flex-row items-center justify-between border border-slate-200 rounded-xl bg-white px-3 py-2.5"
                  >
                    <Text className="text-sm text-slate-700 font-medium">
                      {selectedRetailerName || 'Select Retailer'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" className="opacity-60" />
                  </TouchableOpacity>
                  {selectedRetailerName ? (
                    <Text className="text-[10px] text-slate-400 mt-1.5">
                      Creating order for: <Text className="font-semibold text-slate-700">{selectedRetailerName}</Text>
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Card Items Header */}
              <View className="flex-row justify-between items-center border-b border-slate-100 pb-4 mb-4">
                <Text className="text-base font-bold text-slate-800">Order Items</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity onPress={handleUploadFile} className="flex-row items-center gap-1">
                    <Ionicons name="cloud-upload-outline" size={15} color="#f97316" />
                    <Text className="text-[#f97316] text-xs font-semibold">Upload CSV/XLS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDownloadTemplate} className="flex-row items-center gap-1">
                    <Ionicons name="download-outline" size={15} color="#f97316" />
                    <Text className="text-[#f97316] text-xs font-semibold">Download Nimson Template</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddItem} className="flex-row items-center gap-1">
                    <Ionicons name="add" size={16} color="#f97316" />
                    <Text className="text-[#f97316] text-xs font-semibold">Add Item</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items List */}
              <View
                className="gap-6 mb-6"
                style={{
                  zIndex: computedLines.some((l) => l.showDropdown || l.showUnitDropdown) ? 100 : 10,
                  elevation: computedLines.some((l) => l.showDropdown || l.showUnitDropdown) ? 100 : 10,
                }}
              >
                {computedLines.map((line, idx) => {
                  const filteredSkus = skus.filter(
                    (s) =>
                      (s.name || '').toLowerCase().includes((line.searchQuery || '').toLowerCase()) ||
                      (s.skuId || '').toLowerCase().includes((line.searchQuery || '').toLowerCase()) ||
                      (s.weight || '').toLowerCase().includes((line.searchQuery || '').toLowerCase())
                  );

                  return (
                    <View
                      key={line.id}
                      className="relative gap-2.5 border-b border-slate-100/60 pb-6 last:border-b-0 last:pb-0"
                      style={{
                        zIndex: (line.showDropdown || line.showUnitDropdown) ? 100 : (computedLines.length - idx),
                        elevation: (line.showDropdown || line.showUnitDropdown) ? 100 : 1,
                      }}
                    >
                      {/* Item index & delete */}
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm font-bold text-slate-400">Item {idx + 1}</Text>
                        {items.length > 1 && (
                          <TouchableOpacity onPress={() => handleRemoveItem(line.id)} className="p-1">
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Product search box */}
                      <View className="relative" style={{ zIndex: line.showDropdown ? 120 : 1, elevation: line.showDropdown ? 120 : 1 }}>
                        <View className="flex-row items-center border border-slate-200 rounded-xl px-3 py-2.5 bg-white gap-2">
                          <Ionicons name="search-outline" size={16} color="#94a3b8" />
                          <TextInput
                            value={line.searchQuery}
                            onChangeText={(val) => {
                              handleUpdateItem(line.id, 'searchQuery', val);
                              handleUpdateItem(line.id, 'skuId', '');
                              handleUpdateItem(line.id, 'showDropdown', true);
                            }}
                            onFocus={() => {
                              if (!line.skuId) handleUpdateItem(line.id, 'showDropdown', true);
                            }}
                            placeholder="Search product by name, weight, or SKU code..."
                            placeholderTextColor="#94a3b8"
                            className="flex-1 text-sm text-slate-700 p-0"
                          />
                          {line.skuId ? (
                            <TouchableOpacity
                              onPress={() => {
                                handleUpdateItem(line.id, 'skuId', '');
                                handleUpdateItem(line.id, 'searchQuery', '');
                              }}
                            >
                              <Ionicons name="close-circle" size={16} color="#cbd5e1" />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {/* Dropdown list */}
                        {line.showDropdown && !line.skuId && (
                          <ScrollView
                            nestedScrollEnabled={true}
                            className="absolute top-[44px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg"
                            style={{ zIndex: 120, elevation: 120, maxHeight: 192, backgroundColor: 'white' }}
                          >
                            {filteredSkus.length === 0 ? (
                              <Text className="p-3 text-xs text-slate-400 text-center">No products found</Text>
                            ) : (
                              filteredSkus.map((sku) => (
                                <TouchableOpacity
                                  key={sku.skuId}
                                  onPress={() => {
                                    handleUpdateItem(line.id, 'skuId', sku.skuId);
                                    handleUpdateItem(line.id, 'searchQuery', formatSkuNameWithWeight(sku));
                                    handleUpdateItem(line.id, 'showDropdown', false);
                                  }}
                                  className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                                >
                                  <Text className="text-xs text-slate-700 font-medium">
                                    {formatSkuNameWithWeight(sku)}
                                  </Text>
                                </TouchableOpacity>
                              ))
                            )}
                          </ScrollView>
                        )}
                      </View>

                      {/* Inputs Row: Unit Mode & Qty */}
                      <View className="flex-row gap-3 items-center" style={{ zIndex: line.showUnitDropdown ? 120 : 1, elevation: line.showUnitDropdown ? 120 : 1 }}>
                        {/* Unit Mode dropdown */}
                        <View className="relative flex-1" style={{ zIndex: line.showUnitDropdown ? 120 : 1, elevation: line.showUnitDropdown ? 120 : 1 }}>
                          <TouchableOpacity
                            onPress={() => handleUpdateItem(line.id, 'showUnitDropdown', !line.showUnitDropdown)}
                            className="flex-row items-center justify-between border border-slate-200 rounded-xl bg-white px-3 py-2 h-[42px]"
                          >
                            <Text className="text-xs font-semibold text-slate-700" numberOfLines={1}>
                              {line.modeLabel}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color="#64748b" />
                          </TouchableOpacity>

                          {line.showUnitDropdown && (
                            <View
                              className="absolute top-[46px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg"
                              style={{ zIndex: 120, elevation: 120, backgroundColor: 'white' }}
                            >
                              <TouchableOpacity
                                onPress={() => {
                                  handleUpdateItem(line.id, 'unitMode', 'piece');
                                  handleUpdateItem(line.id, 'showUnitDropdown', false);
                                }}
                                className="p-3 border-b border-slate-50 active:bg-slate-50"
                              >
                                <Text className="text-xs text-slate-700 font-medium">Piece (1 pc)</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  handleUpdateItem(line.id, 'unitMode', 'dozen');
                                  handleUpdateItem(line.id, 'showUnitDropdown', false);
                                }}
                                className="p-3 active:bg-slate-50"
                              >
                                <Text className="text-xs text-slate-700 font-medium">Pack ({line.packPcsStr} pcs)</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Qty Input */}
                        <View className="flex-1 flex-row items-center border border-slate-200 rounded-xl bg-white px-3 h-[42px]">
                          <TextInput
                            value={line.qty}
                            onChangeText={(val) => handleUpdateItem(line.id, 'qty', val.replace(/\D/g, ''))}
                            keyboardType="numeric"
                            placeholder="Qty"
                            placeholderTextColor="#94a3b8"
                            className="flex-1 text-sm font-semibold text-slate-700 h-full p-0"
                          />
                        </View>
                      </View>

                      {/* Live line calculation */}
                      {line.skuId && line.qtyVal > 0 ? (
                        <View className="mt-1 flex-row items-center justify-between px-1">
                          <Text className="text-xs text-slate-500 font-medium">
                            {line.qtyVal} {line.modeLabel} = {line.quantityInPieces} pcs
                          </Text>
                          <Text className="text-xs font-bold text-orange-600">
                            {formatCurrency(line.bill)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {/* Warning Banner */}
              {!hasValidItem && (
                <View
                  className="flex-row items-start gap-2 bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 mb-6"
                  style={{ zIndex: 1, elevation: 0 }}
                >
                  <Ionicons name="alert-circle-outline" size={18} color="#d97706" className="mt-0.5" />
                  <Text className="flex-1 text-[#b45309] text-xs font-semibold leading-relaxed">
                    Add at least one product and enter a quantity of 1 or more.
                  </Text>
                </View>
              )}

              {/* Summary Statistics */}
              <View className="gap-3 border-t border-slate-100 pt-6">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="cube-outline" size={18} color="#64748b" />
                  <Text className="text-slate-500 text-sm font-semibold">Total Pieces:</Text>
                  <Text className="text-slate-800 text-sm font-bold">{totals.totalQty.toLocaleString('en-IN')}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="cash-outline" size={18} color="#64748b" />
                  <Text className="text-slate-500 text-sm font-semibold">Total Bill:</Text>
                  <Text className="text-slate-800 text-sm font-bold">{formatCurrency(totals.totalBill)}</Text>
                </View>
              </View>
            </View>

            {/* Bottom Actions Row */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/orders')}
                className="flex-1 py-4 border border-slate-200 rounded-xl items-center justify-center bg-white shadow-sm"
              >
                <Text className="text-slate-600 text-sm font-bold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => mutation.mutate()}
                disabled={mutation.isPending || !hasValidItem}
                className="flex-[2] py-4 rounded-xl items-center justify-center shadow-sm"
                style={{ backgroundColor: hasValidItem ? '#f97316' : '#fed7aa' }}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-bold">Review & Place Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Retailer Selection Modal */}
      {isSO && (
        <Modal visible={showRetailerModal} animationType="slide" transparent={true}>
          <SafeAreaView className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[70%] p-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-base font-bold text-slate-800">Select Retailer</Text>
                <TouchableOpacity onPress={() => setShowRetailerModal(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView className="gap-2" showsVerticalScrollIndicator={false}>
                {retailers.map((r: any) => {
                  const rId = r.entityId || r.retailerId;
                  const callStatus = todayCallStatusMap[rId];
                  return (
                    <TouchableOpacity
                      key={rId}
                      onPress={() => {
                        setSelectedRetailerId(rId);
                        setShowRetailerModal(false);
                      }}
                      className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                        selectedRetailerId === rId
                          ? 'border-orange-500 bg-orange-50/50'
                          : 'border-slate-100 bg-transparent'
                      }`}
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-semibold text-slate-800">{r.name}</Text>
                        <Text className="text-xs text-slate-400 mt-0.5">{rId}</Text>
                      </View>
                      {callStatus && (
                        <View className={`px-1.5 py-0.5 rounded border ${
                          callStatus === 'PC' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'
                        }`}>
                          <Text className={`text-[10px] font-bold ${
                            callStatus === 'PC' ? 'text-emerald-700' : 'text-blue-700'
                          }`}>
                            {callStatus}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}
