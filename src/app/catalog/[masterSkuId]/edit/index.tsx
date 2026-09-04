import React, { useState, useEffect, useMemo } from 'react';
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

import { catalogService } from '@/services/catalog.service';
import { formatCurrencyDecimal as formatCurrency } from '@/lib/format-utils';

export default function EditSkuCatalogScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { masterSkuId } = useLocalSearchParams<{ masterSkuId: string }>();

  // Form states for SKU Creation / Editing
  const [skuName, setSkuName] = useState('');
  const [skuPrincipal, setSkuPrincipal] = useState('');
  const [skuWeight, setSkuWeight] = useState('');
  const [skuMrpPerUnit, setSkuMrpPerUnit] = useState('');
  const [skuOfferRateNew, setSkuOfferRateNew] = useState('');
  const [skuPerPcPrice, setSkuPerPcPrice] = useState('');
  const [skuPackQty, setSkuPackQty] = useState('');
  const [skuMasterPackUnit, setSkuMasterPackUnit] = useState('');
  const [skuSchemePercent, setSkuSchemePercent] = useState('');
  const [skuSsMarginPercent, setSkuSsMarginPercent] = useState('7');
  const [skuDistMarginPercent, setSkuDistMarginPercent] = useState('10');
  const [skuGstCategory, setSkuGstCategory] = useState<'18' | '5' | '0'>('18');
  const [skuIsActive, setSkuIsActive] = useState(true);
  const [skuSchemeEligible, setSkuSchemeEligible] = useState(false);
  const [skuDisplayRequiredQty, setSkuDisplayRequiredQty] = useState(0);

  // Fetch SKU details
  const { data: skuRes, isLoading, isError } = useQuery({
    queryKey: ['catalog-sku', masterSkuId],
    queryFn: () => catalogService.getById(masterSkuId),
    enabled: !!masterSkuId,
  });

  const sku = skuRes?.data?.sku;

  // Initialize form with fetched details
  useEffect(() => {
    if (sku) {
      setSkuName(sku.name || '');
      setSkuPrincipal(sku.principal || '');
      setSkuWeight(sku.weight || '');
      setSkuMrpPerUnit(String(sku.mrpPerUnit ?? sku.unitPrice ?? 0));
      setSkuOfferRateNew(String(sku.offerRateNew ?? sku.unitPrice ?? 0));
      setSkuPerPcPrice(String(sku.perPcPrice ?? 1));
      setSkuPackQty(String(sku.masterPackQty ?? sku.displayRequiredQty ?? 1));
      setSkuMasterPackUnit(sku.masterPackUnit || 'Doz');
      setSkuSchemePercent(String(sku.schemePercent || 0));
      if (sku.tax5 && sku.tax5 > 0) {
        setSkuGstCategory('5');
      } else if (sku.tax18 && sku.tax18 > 0) {
        setSkuGstCategory('18');
      } else {
        setSkuGstCategory(sku.tax18 === 0 && sku.tax5 === 0 ? '0' : '18');
      }
      setSkuIsActive(sku.isActive !== false);
      setSkuSchemeEligible(sku.schemeEligible || false);
      setSkuDisplayRequiredQty(sku.displayRequiredQty || 0);
    }
  }, [sku]);

  // Live Auto-Calculation Engine
  const calculated = useMemo(() => {
    const round2 = (num: number) => Math.round(num * 100) / 100;
    const numOfferRateNew = Number(skuOfferRateNew) >= 0 ? Number(skuOfferRateNew) : (Number(skuMrpPerUnit) || 0);
    const numSchemePercent = Number(skuSchemePercent) || 0;
    const numPerPcPrice = Number(skuPerPcPrice) || 1;
    const numMasterPackQty = Number(skuPackQty) || 1;
    const numSsMarginPercent = Number(skuSsMarginPercent) || 7;
    const numDistMarginPercent = Number(skuDistMarginPercent) || 10;

    const packQty = numMasterPackQty > 0 ? numMasterPackQty : 1;
    const pcMult = numPerPcPrice > 0 ? numPerPcPrice : 1;

    const calcSchemeAmount = round2(numOfferRateNew * (numSchemePercent / 100));
    const calcBilling = round2(numOfferRateNew - calcSchemeAmount);
    const calcPerPcBilling = round2(calcBilling / pcMult);

    let calcTax18 = 0;
    let calcTax5 = 0;
    let calcTaxText = "₹0.00";
    if (skuGstCategory === '18') {
      calcTax18 = round2(calcBilling * 0.18);
      calcTaxText = `₹${calcTax18.toFixed(2)}`;
    } else if (skuGstCategory === '5') {
      calcTax5 = round2(calcBilling * 0.05);
      calcTaxText = `₹${calcTax5.toFixed(2)}`;
    }

    const calcSuperTotal = round2(calcBilling + calcTax18 + calcTax5);
    const calcSsMargin = round2(calcSuperTotal * (numSsMarginPercent / 100));
    const calcDistributorTotal = round2(calcSuperTotal + calcSsMargin);
    const calcDistMargin = round2(calcDistributorTotal * (numDistMarginPercent / 100));
    const calcRetailTotal = round2(calcDistributorTotal + calcDistMargin);

    const calcBoxQty = round2(packQty * pcMult);
    const calcBoxRate = round2(numOfferRateNew * packQty);
    const calcBoxPrice = calcBoxRate;

    const calcPricePerDozenSS = round2((calcSuperTotal / pcMult) * 12);
    const calcPricePerDozenDist = round2((calcDistributorTotal / pcMult) * 12);
    const calcPricePerDozenRetail = round2((calcRetailTotal / pcMult) * 12);

    const calcRetailPerPiece = round2(calcRetailTotal / pcMult);
    const calcDistPerBox = round2(calcDistributorTotal * packQty);
    const calcRetailPerBox = round2(calcRetailTotal * packQty);
    const calcSuperPerBox = round2(calcSuperTotal * packQty);

    return {
      schemeAmount: calcSchemeAmount,
      billing: calcBilling,
      perPcBilling: calcPerPcBilling,
      tax18: calcTax18,
      tax5: calcTax5,
      taxText: calcTaxText,
      superTotal: calcSuperTotal,
      ssMargin: calcSsMargin,
      distributorTotal: calcDistributorTotal,
      distMargin: calcDistMargin,
      retailTotal: calcRetailTotal,
      boxQty: calcBoxQty,
      boxRate: calcBoxRate,
      boxPrice: calcBoxPrice,
      pricePerDozenSS: calcPricePerDozenSS,
      pricePerDozenDist: calcPricePerDozenDist,
      pricePerDozenRetail: calcPricePerDozenRetail,
      retailPerPiece: calcRetailPerPiece,
      distPerBox: calcDistPerBox,
      retailPerBox: calcRetailPerBox,
      superPerBox: calcSuperPerBox,
    };
  }, [
    skuOfferRateNew,
    skuMrpPerUnit,
    skuSchemePercent,
    skuPerPcPrice,
    skuPackQty,
    skuSsMarginPercent,
    skuDistMarginPercent,
    skuGstCategory,
  ]);

  const updateSkuMutation = useMutation({
    mutationFn: (payload: any) => catalogService.adminUpdateSku(masterSkuId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-rows-scoped'] });
      Alert.alert('Success', 'SKU updated successfully');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update SKU');
    },
  });

  const handleUpdateSku = () => {
    if (!skuName.trim() || !skuMrpPerUnit) {
      Alert.alert('Error', 'Name and MRP per Unit are required');
      return;
    }

    const payload = {
      name: skuName.trim(),
      principal: skuPrincipal.trim(),
      weight: skuWeight.trim(),
      unitPrice: Number(skuMrpPerUnit),
      mrpPerUnit: Number(skuMrpPerUnit),
      offerRateNew: Number(skuOfferRateNew) >= 0 ? Number(skuOfferRateNew) : (Number(skuMrpPerUnit) || 0),
      perPcPrice: Number(skuPerPcPrice) || 1,
      masterPackQty: Number(skuPackQty) || 1,
      masterPackUnit: skuMasterPackUnit,
      schemePercent: Number(skuSchemePercent) || 0,
      schemeAmount: calculated.schemeAmount,
      billing: calculated.billing,
      tax18: calculated.tax18,
      tax5: calculated.tax5,
      superTotal: calculated.superTotal,
      ssMargin: calculated.ssMargin,
      distributorTotal: calculated.distributorTotal,
      distMargin: calculated.distMargin,
      retailTotal: calculated.retailTotal,
      boxQty: calculated.boxQty,
      boxRate: calculated.boxRate,
      boxPrice: calculated.boxPrice,
      pricePerDozenSS: calculated.pricePerDozenSS,
      pricePerDozenDist: calculated.pricePerDozenDist,
      pricePerDozenRetail: calculated.pricePerDozenRetail,
      retailPerPiece: calculated.retailPerPiece,
      distPerBox: calculated.distPerBox,
      retailPerBox: calculated.retailPerBox,
      superPerBox: calculated.superPerBox,
      displayRequiredQty: skuDisplayRequiredQty,
      schemeEligible: skuSchemeEligible,
      isActive: skuIsActive,
    };

    updateSkuMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#f37021" />
      </SafeAreaView>
    );
  }

  if (isError || !sku) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Load Error</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          Failed to retrieve SKU details from system.
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">
          <Text className="text-xs font-semibold text-gray-700">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-6 py-4 border-b border-gray-250 flex-row items-center justify-between bg-white shadow-xs">
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text className="text-lg font-bold text-gray-850">Edit SKU & Pricing Catalog</Text>
          <View className="bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
            <Text className="text-[10px] font-bold text-orange-700">{masterSkuId}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
      </View>
      <Text className="px-6 pt-3 text-[11px] text-gray-500 bg-white pb-3">
        Edit non-calculative price inputs below. All calculated prices update in real-time.
      </Text>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* PRODUCT INFO SECTION */}
        <View className="border border-gray-200 rounded-xl p-4 bg-white mb-6 shadow-sm">
          <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Product Info</Text>
          <View className="gap-3">
            <View>
              <Text className="text-[10px] font-bold text-slate-400 mb-1">Product Name *</Text>
              <TextInput
                value={skuName}
                onChangeText={setSkuName}
                placeholder="Product Name"
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50"
              />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-slate-400 mb-1">Weight / Size</Text>
                <TextInput
                  value={skuWeight}
                  onChangeText={setSkuWeight}
                  placeholder="e.g. 25gm"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-slate-400 mb-1">Principal</Text>
                <TextInput
                  value={skuPrincipal}
                  onChangeText={setSkuPrincipal}
                  placeholder="e.g. Nimson"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50"
                />
              </View>
            </View>
          </View>
        </View>

        {/* NON-CALCULATIVE PRICE INPUTS */}
        <View className="border border-blue-100 rounded-xl p-4 bg-white mb-6 shadow-sm">
          <View className="flex-row justify-between items-center mb-3 flex-wrap gap-1">
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <Text className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Non-Calculative Price Inputs (Editable)</Text>
            </View>
            <View className="bg-blue-50 px-2 py-0.5 rounded">
              <Text className="text-[8px] font-semibold text-blue-600">Modifications auto-recalculate</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-x-3 gap-y-2.5 mb-4">
            <View style={{ width: '48%' }}>
              <Text className="text-[10px] font-semibold text-gray-500 mb-1">MRP per Unit (₹)</Text>
              <TextInput
                value={skuMrpPerUnit}
                onChangeText={setSkuMrpPerUnit}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '48%' }}>
              <Text className="text-[10px] font-semibold text-gray-500 mb-1">Offer Rate NEW (₹)</Text>
              <TextInput
                value={skuOfferRateNew}
                onChangeText={setSkuOfferRateNew}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '48%' }}>
              <Text className="text-[10px] font-semibold text-gray-500 mb-1">for per/pc (Multiplier)</Text>
              <TextInput
                value={skuPerPcPrice}
                onChangeText={setSkuPerPcPrice}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '48%' }}>
              <Text className="text-[10px] font-semibold text-gray-500 mb-1">Master Pack Qty</Text>
              <TextInput
                value={skuPackQty}
                onChangeText={setSkuPackQty}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '48%' }}>
              <Text className="text-[10px] font-semibold text-gray-550 mb-1">Case Qty (pcs)</Text>
              <TextInput
                value={String(calculated.boxQty)}
                onChangeText={(text) => {
                  const val = parseFloat(text) || 0;
                  const numPerPcPrice = Number(skuPerPcPrice) || 1;
                  if (numPerPcPrice > 0) {
                    setSkuPackQty(String(val / numPerPcPrice));
                  }
                }}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '48%' }}>
              <Text className="text-[10px] font-semibold text-gray-550 mb-1">Master Pack Unit</Text>
              <TextInput
                value={skuMasterPackUnit}
                onChangeText={setSkuMasterPackUnit}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '31%' }}>
              <Text className="text-[10px] font-semibold text-gray-550 mb-1">Scheme %</Text>
              <TextInput
                value={skuSchemePercent}
                onChangeText={setSkuSchemePercent}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '31%' }}>
              <Text className="text-[10px] font-semibold text-gray-550 mb-1">SS Margin %</Text>
              <TextInput
                value={skuSsMarginPercent}
                onChangeText={setSkuSsMarginPercent}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>

            <View style={{ width: '31%' }}>
              <Text className="text-[10px] font-semibold text-gray-550 mb-1">Dist. Margin %</Text>
              <TextInput
                value={skuDistMarginPercent}
                onChangeText={setSkuDistMarginPercent}
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50"
              />
            </View>
          </View>

          {/* GST Tax Selector */}
          <View className="border-t border-gray-100 pt-3 flex-row items-center gap-4 flex-wrap">
            <Text className="text-[10px] font-bold text-slate-500">GST Tax Category:</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => setSkuGstCategory('18')} className="flex-row items-center gap-1.5">
                <Ionicons name={skuGstCategory === '18' ? 'radio-button-on' : 'radio-button-off'} size={14} color="#2563eb" />
                <Text className="text-[10px] font-semibold text-gray-700">18% GST</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSkuGstCategory('5')} className="flex-row items-center gap-1.5">
                <Ionicons name={skuGstCategory === '5' ? 'radio-button-on' : 'radio-button-off'} size={14} color="#2563eb" />
                <Text className="text-[10px] font-semibold text-gray-700">5% GST</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSkuGstCategory('0')} className="flex-row items-center gap-1.5">
                <Ionicons name={skuGstCategory === '0' ? 'radio-button-on' : 'radio-button-off'} size={14} color="#2563eb" />
                <Text className="text-[10px] font-semibold text-gray-700">0% GST</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* AUTO-CALCULATED PRICING (LIVE OUTPUT) */}
        <View className="border border-emerald-100 rounded-xl p-4 bg-white mb-12 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <Text className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Auto-Calculated Pricing (Live Output)</Text>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded flex-row items-center gap-1">
              <Ionicons name="flash-outline" size={10} color="#059669" />
              <Text className="text-[9px] font-semibold text-emerald-600">Auto Formulas</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-x-2.5 gap-y-2">
            {[
              { label: 'Scheme Amount', val: formatCurrency(calculated.schemeAmount) },
              { label: 'Billing Rate', val: formatCurrency(calculated.billing) },
              { label: 'Per / pc (Billing / pc)', val: formatCurrency(calculated.perPcBilling), highlight: true },
              { label: `GST Tax (${skuGstCategory}%)`, val: calculated.taxText },
              { label: 'Super Total / pc', val: formatCurrency(calculated.superTotal), orange: true },
              { label: 'Super Total / case', val: formatCurrency(calculated.superPerBox), orange: true },
              { label: `SS Margin (${skuSsMarginPercent}%)`, val: formatCurrency(calculated.ssMargin) },
              { label: 'Distributor Total / pc', val: formatCurrency(calculated.distributorTotal), green: true },
              { label: 'Distributor Total / case', val: formatCurrency(calculated.distPerBox), green: true },
              { label: `Dist. Margin (${skuDistMarginPercent}%)`, val: formatCurrency(calculated.distMargin) },
              { label: 'Retail Total / pc', val: formatCurrency(calculated.retailTotal), yellow: true },
              { label: 'Retail Total / case', val: formatCurrency(calculated.retailPerBox), yellow: true },
              { label: 'Case Qty (pcs)', val: String(calculated.boxQty) },
              { label: 'SS Price / Doz', val: formatCurrency(calculated.pricePerDozenSS) },
              { label: 'Dist Price / Doz', val: formatCurrency(calculated.pricePerDozenDist) },
              { label: 'Retail Price / Doz', val: formatCurrency(calculated.pricePerDozenRetail) },
              { label: 'Box Rate / Value', val: formatCurrency(calculated.boxRate) },
            ].map((item, idx) => {
              let textStyle = "text-gray-800";
              let bgStyle = "bg-gray-50 border-gray-100";
              if (item.highlight) {
                textStyle = "text-blue-700 font-bold";
                bgStyle = "bg-blue-50/20 border-blue-100";
              } else if (item.orange) {
                textStyle = "text-orange-700 font-bold";
                bgStyle = "bg-orange-50/20 border-orange-100";
              } else if (item.green) {
                textStyle = "text-emerald-700 font-bold";
                bgStyle = "bg-emerald-50/20 border-emerald-100";
              } else if (item.yellow) {
                textStyle = "text-amber-700 font-bold";
                bgStyle = "bg-amber-50/20 border-amber-100";
              }
              return (
                <View key={idx} className={`p-2 border rounded-lg ${bgStyle}`} style={{ width: '48%' }}>
                  <Text className="text-[9px] font-semibold text-gray-400 mb-0.5">{item.label}</Text>
                  <Text className={`text-xs ${textStyle}`}>{item.val}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions footer bar */}
      <View className="border-t border-gray-200 px-6 py-4 flex-row items-center justify-between bg-white shadow-lg">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setSkuSchemeEligible(!skuSchemeEligible)} className="flex-row items-center gap-1.5">
            <Ionicons name={skuSchemeEligible ? 'checkbox' : 'square-outline'} size={16} color={skuSchemeEligible ? '#f37021' : '#9ca3af'} />
            <Text className="text-xs text-gray-700 font-semibold">Scheme Eligible</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSkuIsActive(!skuIsActive)} className="flex-row items-center gap-1.5">
            <Ionicons name={skuIsActive ? 'checkbox' : 'square-outline'} size={16} color={skuIsActive ? '#f37021' : '#9ca3af'} />
            <Text className="text-xs text-gray-700 font-semibold">Active Product</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2.5">
          <TouchableOpacity
            onPress={() => router.back()}
            className="px-4 py-2 border border-gray-250 rounded-xl bg-white"
          >
            <Text className="text-xs font-semibold text-gray-600">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUpdateSku}
            disabled={updateSkuMutation.isPending}
            className="px-4 py-2 bg-[#f37021] rounded-xl flex-row items-center gap-1"
          >
            {updateSkuMutation.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="save-outline" size={14} color="white" />
            )}
            <Text className="text-xs font-bold text-white">Save SKU & Pricing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
