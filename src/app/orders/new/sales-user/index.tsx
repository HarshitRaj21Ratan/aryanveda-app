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
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { orderService } from '@/services/order.service';
import { skuService } from '@/services/sku.service';
import { type ISku } from '@/types';
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
  unitMode: 'dozen' | 'piece' | 'jar' | 'box';
  searchQuery: string;
  showDropdown: boolean;
  showUnitDropdown: boolean;
}

export default function NewSalesUserOrderScreen() {
  const router = useRouter();
  const { distributorId, distributorName: paramDistributorName, targetRole } = useLocalSearchParams<{
    distributorId: string;
    distributorName?: string;
    targetRole?: string;
  }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const isSuperStockistTarget = targetRole === 'SUPER_STOCKIST';

  const [selectedDistributorId, setSelectedDistributorId] = useState(distributorId || '');
  const [showDistributorModal, setShowDistributorModal] = useState(false);

  const [items, setItems] = useState<LineItem[]>([
    { id: generateKey(), skuId: '', qty: '', unitMode: isSuperStockistTarget ? 'box' : 'dozen', searchQuery: '', showDropdown: false, showUnitDropdown: false },
  ]);

  const [idempotencyKey] = useState(() => generateKey());
  const [hoveredQtyId, setHoveredQtyId] = useState<string | null>(null);
  const [focusedQtyId, setFocusedQtyId] = useState<string | null>(null);

  // Fetch SKUs
  const { data: skusData, isLoading: skusLoading } = useQuery({
    queryKey: ['skus-sales-selection-orders'],
    queryFn: () => skuService.list({ limit: 500, isActive: 'true' }),
    enabled: !!user,
  });

  // Fetch Connected Entities (Distributors or Super Stockists depending on targetRole)
  const { data: connectedEntitiesData } = useQuery({
    queryKey: ['connected-entities-new-sales', targetRole],
    queryFn: () => isSuperStockistTarget ? orderService.getConnectedSuperStockists() : orderService.getConnectedDistributors(),
    enabled: !!user,
  });

  const skus: ISku[] = skusData?.data ?? [];
  const skuMap = useMemo(() => new Map(skus.map((s) => [s.skuId, s])), [skus]);

  const connectedEntities = isSuperStockistTarget
    ? ((connectedEntitiesData?.data as any)?.superStockists ?? [])
    : ((connectedEntitiesData?.data as any)?.distributors ?? []);

  const selectedDistributorName = useMemo(() => {
    if (paramDistributorName) return paramDistributorName;
    const found = connectedEntities.find((e: any) => e.entityId === selectedDistributorId);
    return found ? found.name : '';
  }, [connectedEntities, selectedDistributorId, paramDistributorName]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: generateKey(), skuId: '', qty: '', unitMode: isSuperStockistTarget ? 'box' : 'dozen', searchQuery: '', showDropdown: false, showUnitDropdown: false },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof LineItem, val: any) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  };

  // Calculations
  const computedLines = useMemo(() => {
    return items.map((item) => {
      const sku = skuMap.get(item.skuId);
      const normalizedUnitMode = isSuperStockistTarget ? 'box' : item.unitMode === 'box' ? 'box' : 'dozen';
      const qtyVal = parseInt(item.qty, 10) || 0;

      const packPcsStr = getSkuPackPcs(sku);
      const casePcsStr = getSkuCasePcs(sku);

      const packPcsNum = packPcsStr !== '-' ? parseInt(packPcsStr, 10) : 12;
      const casePcsNum = casePcsStr !== '-' ? parseInt(casePcsStr, 10) : 288;

      const unitMultiplier =
        normalizedUnitMode === 'dozen' ? packPcsNum : casePcsNum;
      const quantityInPieces = qtyVal * unitMultiplier;

      const basePackPrice = isSuperStockistTarget
        ? pickPositivePrice(sku?.pricePerDozenSS, sku?.boxPrice, sku?.price)
        : pickPositivePrice(sku?.pricePerDozenDist, sku?.boxPrice, sku?.price);
      const unitPrice = basePackPrice > 0 ? Math.round((basePackPrice / 12) * 100) / 100 : 0;
      const bill = Math.round(quantityInPieces * unitPrice * 100) / 100;

      const modeLabel =
        normalizedUnitMode === 'dozen'
          ? `Pack (${packPcsStr} pcs)`
          : `Case (${casePcsStr} pcs)`;

      return {
        ...item,
        sku,
        qtyVal,
        quantityInPieces,
        unitPrice,
        bill,
        modeLabel,
        normalizedUnitMode,
        packPcsStr,
        casePcsStr,
      };
    });
  }, [items, skuMap, isSuperStockistTarget]);

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
    return selectedDistributorId && computedLines.some((l) => l.skuId && l.qtyVal > 0);
  }, [computedLines, selectedDistributorId]);

  // Mutations
  const mutation = useMutation({
    mutationFn: () => {
      const payloadItems = computedLines
        .filter((l) => l.skuId && l.qtyVal > 0)
        .map((l) => ({
          skuId: l.skuId,
          quantity: l.qtyVal,
          unitMode: l.normalizedUnitMode,
        }));

      const payload: any = {
        items: payloadItems,
        idempotencyKey,
      };

      if (isSuperStockistTarget) {
        payload.superStockistId = selectedDistributorId;
      } else {
        payload.distributorId = selectedDistributorId;
      }

      return orderService.createSalesUserOrder(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      Alert.alert('Success', 'Order created successfully');
      router.push('/orders');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || `Failed to place ${isSuperStockistTarget ? 'Super Stockist' : 'Distributor'} order`);
    },
  });

  const targetLabel = isSuperStockistTarget ? 'Super Stockist' : 'Distributor';

  return (
    <SafeAreaView className="flex-1 bg-slate-50/50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View className="px-6 pt-6 pb-4">
          <TouchableOpacity onPress={() => router.push('/orders')} className="flex-row items-center gap-1 mb-1">
            <Ionicons name="chevron-back" size={16} color="#64748b" />
            <Text className="text-slate-500 text-sm">Back to Orders</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-800">
            {selectedDistributorName ? `New Order from ${selectedDistributorName}` : `New ${targetLabel} Order`}
          </Text>
          <Text className="text-slate-500 text-xs mt-1">
            Select SKUs, choose Pack / Case, and enter quantity
          </Text>
        </View>

        {skusLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : (
          <View className="px-6 pb-24">
            {/* Card Wrap */}
            <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 mb-6">
              {/* Entity dropdown */}
              <View className="mb-6">
                <Text className="text-[10px] text-slate-400 font-bold uppercase mb-1">{targetLabel}</Text>
                <TouchableOpacity
                  onPress={() => setShowDistributorModal(true)}
                  className="flex-row items-center justify-between border border-slate-200 rounded-xl bg-white px-3 py-2.5"
                >
                  <Text className="text-sm text-slate-700 font-medium">
                    {selectedDistributorName || `Select ${targetLabel}`}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#64748b" className="opacity-60" />
                </TouchableOpacity>
                {selectedDistributorName ? (
                  <Text className="text-[10px] text-slate-400 mt-1.5">
                    Creating order for: <Text className="font-semibold text-slate-700">{selectedDistributorName}</Text>
                  </Text>
                ) : null}
              </View>

              {/* Card Items Header */}
              <View className="flex-row justify-between items-center border-b border-slate-100 pb-4 mb-4">
                <Text className="text-base font-bold text-slate-800">Order Items</Text>
                <View className="flex-row items-center gap-4">
                  <TouchableOpacity className="flex-row items-center gap-1">
                    <Ionicons name="cloud-upload-outline" size={16} color="#f97316" />
                    <Text className="text-[#f97316] text-xs font-semibold">Upload CSV/XLS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddItem} className="flex-row items-center gap-1">
                    <Ionicons name="add" size={16} color="#f97316" />
                    <Text className="text-[#f97316] text-xs font-semibold">Add Item</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items List */}
              <View className="gap-6 mb-6" style={{ zIndex: 10 }}>
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
                      style={{ zIndex: (line.showDropdown || line.showUnitDropdown) ? 50 : 1 }}
                    >
                      {/* Top bar of row: Number and Trash */}
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm font-bold text-slate-400">Item {idx + 1}</Text>
                        {items.length > 1 && (
                          <TouchableOpacity onPress={() => handleRemoveItem(line.id)} className="p-1">
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Search Product */}
                      <View className="relative" style={{ zIndex: line.showDropdown ? 70 : 1 }}>
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
                              if (!line.skuId) {
                                handleUpdateItem(line.id, 'showDropdown', true);
                              }
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

                        {/* Autocomplete Dropdown List */}
                        {line.showDropdown && !line.skuId && (
                          <ScrollView
                            nestedScrollEnabled={true}
                            className="absolute top-[44px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg"
                            style={{ zIndex: 100, maxHeight: 192, backgroundColor: 'white' }}
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

                      {/* Inputs Row: Quantity on Left, Dropdown on Right */}
                      <View className="flex-row gap-3 items-center" style={{ zIndex: line.showUnitDropdown ? 70 : 1 }}>
                        {/* Quantity selector with Up/Down buttons */}
                        <View className="flex-1 flex-row items-center border border-slate-200 rounded-xl bg-white px-3 h-[42px]">
                          <TextInput
                            value={line.qty}
                            onChangeText={(val) => handleUpdateItem(line.id, 'qty', val.replace(/\D/g, ''))}
                            onFocus={() => setFocusedQtyId(line.id)}
                            onBlur={() => setFocusedQtyId(null)}
                            keyboardType="numeric"
                            placeholder="Qty"
                            placeholderTextColor="#94a3b8"
                            className="flex-1 text-sm font-semibold text-slate-700 h-full p-0"
                          />
                          {(hoveredQtyId === line.id || focusedQtyId === line.id || !!line.qty) ? (
                            <View className="flex-col justify-center items-center gap-0.5 h-full w-5">
                              <TouchableOpacity
                                onPress={() => {
                                  const currentVal = parseInt(line.qty, 10) || 0;
                                  handleUpdateItem(line.id, 'qty', String(currentVal + 1));
                                }}
                                hitSlop={{ top: 10, bottom: 5, left: 10, right: 10 }}
                              >
                                <Ionicons name="caret-up" size={10} color="#64748b" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  const currentVal = parseInt(line.qty, 10) || 0;
                                  if (currentVal > 0) {
                                    handleUpdateItem(line.id, 'qty', String(currentVal - 1));
                                  }
                                }}
                                hitSlop={{ top: 5, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="caret-down" size={10} color="#64748b" />
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>

                        {/* Unit / Pack Dropdown */}
                        <View className="relative flex-1">
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
                              className="absolute top-[46px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg"
                              style={{ zIndex: 100, backgroundColor: 'white' }}
                            >
                                {!isSuperStockistTarget && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      handleUpdateItem(line.id, 'unitMode', 'dozen');
                                      handleUpdateItem(line.id, 'showUnitDropdown', false);
                                    }}
                                    className="p-3 border-b border-slate-50 active:bg-slate-50"
                                  >
                                    <Text className="text-xs text-slate-700 font-medium">
                                      Pack ({line.packPcsStr} pcs)
                                    </Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                  onPress={() => {
                                    handleUpdateItem(line.id, 'unitMode', 'box');
                                    handleUpdateItem(line.id, 'showUnitDropdown', false);
                                  }}
                                  className="p-3 active:bg-slate-50"
                                >
                                  <Text className="text-xs text-slate-700 font-medium">
                                    Case ({line.casePcsStr} pcs)
                                  </Text>
                                </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Live calculation row */}
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
                <View className="flex-row items-start gap-2 bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 mb-6">
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
                className={`flex-[2] py-4 rounded-xl items-center justify-center shadow-sm ${
                  hasValidItem ? 'bg-orange-500' : 'bg-orange-200'
                }`}
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

      {/* Entity Selection Modal */}
      <Modal visible={showDistributorModal} animationType="slide" transparent={true}>
        <SafeAreaView className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-bold text-slate-800">Select {targetLabel}</Text>
              <TouchableOpacity onPress={() => setShowDistributorModal(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView className="gap-2" showsVerticalScrollIndicator={false}>
              {connectedEntities.map((d: any) => (
                <TouchableOpacity
                  key={d.entityId}
                  onPress={() => {
                    setSelectedDistributorId(d.entityId);
                    setShowDistributorModal(false);
                  }}
                  className={`p-3.5 rounded-xl border ${
                    selectedDistributorId === d.entityId
                      ? 'border-orange-500 bg-orange-50/50'
                      : 'border-slate-100 bg-transparent'
                  }`}
                >
                  <Text className="text-sm font-semibold text-slate-800">{d.name}</Text>
                  <Text className="text-xs text-slate-400 mt-0.5">{d.entityId}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

