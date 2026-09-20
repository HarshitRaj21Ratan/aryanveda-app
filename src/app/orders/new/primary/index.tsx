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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { orderService } from '@/services/order.service';
import { skuService } from '@/services/sku.service';
import { UserRole, type ISku } from '@/types';
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
  unitMode: 'dozen' | 'piece' | 'box';
  searchQuery: string;
  showDropdown: boolean;
  showUnitDropdown: boolean;
}

export default function NewPrimaryOrderScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const isSS = user?.role === UserRole.SUPER_STOCKIST;

  const [items, setItems] = useState<LineItem[]>([
    {
      id: generateKey(),
      skuId: '',
      qty: '',
      unitMode: isSS ? 'box' : 'dozen',
      searchQuery: '',
      showDropdown: false,
      showUnitDropdown: false,
    },
  ]);

  const [idempotencyKey] = useState(() => generateKey());
  const [hoveredQtyId, setHoveredQtyId] = useState<string | null>(null);
  const [focusedQtyId, setFocusedQtyId] = useState<string | null>(null);

  // Fetch SKUs
  const { data: skusData, isLoading: skusLoading } = useQuery({
    queryKey: ['skus-primary-selection-orders'],
    queryFn: () => skuService.list({ limit: 500, isActive: 'true' }),
    enabled: !!user,
  });

  const skus: ISku[] = skusData?.data ?? [];
  const skuMap = useMemo(() => new Map(skus.map((s) => [s.skuId, s])), [skus]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateKey(),
        skuId: '',
        qty: '',
        unitMode: isSS ? 'box' : 'dozen',
        searchQuery: '',
        showDropdown: false,
        showUnitDropdown: false,
      },
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
      const normalizedUnitMode = isSS ? 'box' : item.unitMode === 'box' ? 'box' : 'dozen';
      const qtyVal = parseInt(item.qty, 10) || 0;

      const packPcsStr = getSkuPackPcs(sku);
      const casePcsStr = getSkuCasePcs(sku);

      const packPcsNum = packPcsStr !== '-' ? parseInt(packPcsStr, 10) : 12;
      const casePcsNum = casePcsStr !== '-' ? parseInt(casePcsStr, 10) : 288;

      const unitMultiplier =
        normalizedUnitMode === 'dozen' ? packPcsNum : casePcsNum;
      const quantityInPieces = qtyVal * unitMultiplier;

      const basePackPrice = isSS
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
  }, [items, skuMap, isSS]);

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
    return computedLines.some((line) => line.skuId && line.qtyVal > 0);
  }, [computedLines]);

  // Mutations
  const mutation = useMutation({
    mutationFn: () => {
      const validLines = computedLines.filter((l) => l.skuId && l.qtyVal > 0);

      if (isSS) {
        // Stock-in amount-based format
        const amountItems = validLines.map((l) => ({
          skuId: l.skuId,
          inputAmount: l.bill,
        }));
        return orderService.createAmountPrimary({ items: amountItems, idempotencyKey });
      }

      const payloadItems = validLines.map((l) => ({
        skuId: l.skuId,
        quantity: l.qtyVal,
        unitMode: l.normalizedUnitMode,
      }));
      return orderService.createPrimary({ items: payloadItems, idempotencyKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      Alert.alert('Success', 'Order created successfully');
      router.push('/orders');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to place order');
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
          <Text className="text-2xl font-bold text-slate-800">
            {isSS ? 'New Stock-In Order' : 'New Primary Order'}
          </Text>
          <Text className="text-slate-500 text-xs mt-1">
            {isSS
              ? 'Select SKUs and enter quantity in dozen (or jar where applicable)'
              : 'Select SKUs, choose Pack / Case, and enter quantity'}
          </Text>
        </View>

        {skusLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : (
          <View className="px-6 pb-24">
            {/* Card Wrap */}
            <View className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 mb-6">
              {/* Card Header */}
              <View className="flex-row justify-between items-center border-b border-slate-100 pb-4 mb-4">
                <Text className="text-base font-bold text-slate-800">Order Items</Text>
                <View className="flex-row items-center gap-4">
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
                      className="relative gap-2 border-b border-slate-100/60 pb-6 last:border-b-0 last:pb-0"
                      style={{ zIndex: (line.showDropdown || line.showUnitDropdown) ? 50 : 1 }}
                    >
                      {/* Top bar of row: Number and Trash */}
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm font-bold text-slate-400">{idx + 1}.</Text>
                        {items.length > 1 && (
                          <TouchableOpacity onPress={() => handleRemoveItem(line.id)} className="p-1">
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Main fields row */}
                      <View className="flex-col gap-3 sm:flex-row sm:items-center" style={{ zIndex: (line.showDropdown || line.showUnitDropdown) ? 60 : 1 }}>
                        {/* Search Product */}
                        <View className="flex-1 relative" style={{ zIndex: line.showDropdown ? 70 : 1 }}>
                          <View className="flex-row items-center border border-slate-200 rounded-xl px-3 py-2 bg-white gap-2">
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
                              placeholder="Search product..."
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

                        {/* Package selector and Qty row */}
                        <View className="flex-row gap-3 items-center" style={{ zIndex: line.showUnitDropdown ? 70 : 1 }}>
                          {/* Unit / Pack Dropdown */}
                          <View className="relative">
                            <TouchableOpacity
                              onPress={() => handleUpdateItem(line.id, 'showUnitDropdown', !line.showUnitDropdown)}
                              className="flex-row items-center justify-between border border-slate-200 rounded-xl bg-white px-3 py-2 min-w-[130px] h-[40px]"
                            >
                              <Text className="text-sm text-slate-700 font-medium">
                                {line.modeLabel}
                              </Text>
                              <Ionicons name="chevron-down" size={14} color="#64748b" />
                            </TouchableOpacity>

                            {line.showUnitDropdown && (
                              <View
                                className="absolute top-[44px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg min-w-[140px]"
                                style={{ zIndex: 100, backgroundColor: 'white' }}
                              >
                                {!isSS && (
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

                          {/* Quantity selector */}
                          <View
                            className="flex-row items-center border border-slate-200 rounded-xl bg-white px-2.5 h-[40px] w-[80px]"
                          >
                            <TextInput
                              value={line.qty}
                              onChangeText={(val) => handleUpdateItem(line.id, 'qty', val.replace(/\D/g, ''))}
                              onFocus={() => setFocusedQtyId(line.id)}
                              onBlur={() => setFocusedQtyId(null)}
                              keyboardType="numeric"
                              placeholder="Qty"
                              placeholderTextColor="#94a3b8"
                              className="w-10 text-sm font-semibold text-slate-700 h-full p-0"
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
                            ) : (
                              <View className="w-5" />
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Live calculation row */}
                      {line.skuId && line.qtyVal > 0 && (
                        <View className="mt-2 flex-row flex-wrap items-center gap-3 pl-1">
                          <Text className="text-xs text-slate-500">
                            Price: <Text className="font-semibold text-slate-700">{formatCurrency(line.unitPrice)}/pc</Text>
                          </Text>
                          <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex-row items-center gap-1">
                            <Ionicons name="cube-outline" size={12} color="#047857" />
                            <Text className="text-[10px] font-bold text-emerald-700">{line.quantityInPieces} pcs</Text>
                          </View>
                          <Text className="text-xs text-slate-500">
                            Bill: <Text className="font-bold text-slate-800">{formatCurrency(line.bill)}</Text>
                          </Text>
                        </View>
                      )}
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
                <View className="flex-row items-center gap-1">
                  <Text className="text-slate-500 text-sm font-semibold">₹ Total Bill:</Text>
                  <Text className="text-slate-800 text-sm font-bold">{formatCurrency(totals.totalBill)}</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="cube-outline" size={16} color="#64748b" />
                  <Text className="text-slate-500 text-sm font-semibold">Total Pieces:</Text>
                  <Text className="text-slate-800 text-sm font-bold">{totals.totalQty.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>

            {/* Place Order Submit Button */}
            <TouchableOpacity
              onPress={() => mutation.mutate()}
              disabled={mutation.isPending || !hasValidItem}
              className={`py-4 rounded-xl items-center justify-center shadow-sm ${
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
