import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { catalogService } from '@/services/catalog.service';
import type { CreateMasterSkuPayload } from '@/services/catalog.service';
import { formatCurrencyDecimal as formatCurrency } from '@/lib/format-utils';

interface AddSkuModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddSkuModal({ visible, onClose, onSuccess }: AddSkuModalProps) {
  const queryClient = useQueryClient();

  const [masterSkuId, setMasterSkuId] = useState('');
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [weight, setWeight] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [offerRateNew, setOfferRateNew] = useState('');
  const [schemePercent, setSchemePercent] = useState('');
  const [masterPackQty, setMasterPackQty] = useState('1');
  const [masterPackUnit, setMasterPackUnit] = useState('Doz');
  const [perPcPrice, setPerPcPrice] = useState('12');
  const [taxType, setTaxType] = useState<'tax18' | 'tax5' | 'none'>('tax18');
  const [schemeEligible, setSchemeEligible] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setMasterSkuId('');
    setName('');
    setPrincipal('');
    setWeight('');
    setUnitPrice('');
    setOfferRateNew('');
    setSchemePercent('');
    setMasterPackQty('1');
    setMasterPackUnit('Doz');
    setPerPcPrice('12');
    setTaxType('tax18');
    setSchemeEligible(false);
    setError('');
  };

  const calculated = useMemo(() => {
    const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;
    const numPackQty = parseFloat(masterPackQty) || 1;
    const packQty = numPackQty > 0 ? numPackQty : 1;
    const numPerPc = parseFloat(perPcPrice) || 12;
    const pcMult = numPerPc > 0 ? numPerPc : 12;
    const mrp = parseFloat(unitPrice) || 0;
    const rawOfferRate = parseFloat(offerRateNew);
    const offerRate = !isNaN(rawOfferRate) && rawOfferRate >= 0 ? rawOfferRate : mrp;
    const schemePct = parseFloat(schemePercent) || 0;
    const schemeAmt = round2(offerRate * (schemePct / 100));
    const billingRate = round2(offerRate - schemeAmt);

    let t18 = 0;
    let t5 = 0;
    if (taxType === 'tax18') {
      t18 = round2(billingRate * 0.18);
    } else if (taxType === 'tax5') {
      t5 = round2(billingRate * 0.05);
    }

    const superTot = round2(billingRate + t18 + t5);
    const ssMarg = round2(superTot * 0.07);
    const distTot = round2(superTot + ssMarg);
    const distMarg = round2(distTot * 0.10);
    const retailTot = round2(distTot + distMarg);

    const caseQty = round2(packQty * pcMult);
    const boxRate = round2(offerRate * packQty);
    const perPcRate = round2(billingRate / (pcMult > 0 ? pcMult : 1));

    const superPerBox = round2(superTot * packQty);
    const distPerBox = round2(distTot * packQty);
    const retailPerBox = round2(retailTot * packQty);

    const perPcDivisor = pcMult > 0 ? pcMult : 1;
    const pDozenSS = round2((superTot / perPcDivisor) * 12);
    const pDozenDist = round2((distTot / perPcDivisor) * 12);
    const pDozenRetail = round2((retailTot / perPcDivisor) * 12);

    return {
      offerRate,
      schemeAmount: schemeAmt,
      billing: billingRate,
      tax18: t18,
      tax5: t5,
      superTotal: superTot,
      ssMargin: ssMarg,
      distributorTotal: distTot,
      distMargin: distMarg,
      retailTotal: retailTot,
      superPerBox,
      distPerBox,
      retailPerBox,
      pricePerDozenSS: pDozenSS,
      pricePerDozenDist: pDozenDist,
      pricePerDozenRetail: pDozenRetail,
      boxQty: caseQty,
      boxRate,
      perPcRate,
    };
  }, [unitPrice, offerRateNew, schemePercent, taxType, masterPackQty, perPcPrice]);

  const createMutation = useMutation({
    mutationFn: () => {
      const mrpNum = parseFloat(unitPrice) || 0;
      const payload: CreateMasterSkuPayload = {
        masterSkuId: masterSkuId.trim(),
        name: name.trim(),
        principal: principal.trim() || 'N/A',
        weight: weight.trim() || 'N/A',
        unitPrice: mrpNum,
        mrpPerUnit: mrpNum,
        offerRateNew: calculated.offerRate,
        masterPackQty: parseFloat(masterPackQty) || 1,
        masterPackUnit: masterPackUnit.trim() || 'Doz',
        perPcPrice: parseFloat(perPcPrice) || 12,
        schemePercent: parseFloat(schemePercent) || 0,
        schemeAmount: calculated.schemeAmount,
        billing: calculated.billing,
        tax18: calculated.tax18,
        tax5: calculated.tax5,
        superTotal: calculated.superTotal,
        ssMargin: calculated.ssMargin,
        distributorTotal: calculated.distributorTotal,
        distMargin: calculated.distMargin,
        retailTotal: calculated.retailTotal,
        pricePerDozenSS: calculated.pricePerDozenSS,
        pricePerDozenDist: calculated.pricePerDozenDist,
        pricePerDozenRetail: calculated.pricePerDozenRetail,
        superPerBox: calculated.superPerBox,
        distPerBox: calculated.distPerBox,
        retailPerBox: calculated.retailPerBox,
        boxQty: calculated.boxQty,
        boxRate: calculated.boxRate,
        boxPrice: calculated.boxRate,
        retailPerPiece: calculated.perPcRate,
        displayRequiredQty: 0,
        schemeEligible,
      };
      return catalogService.adminCreateSku(payload);
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-principals'] });
      queryClient.invalidateQueries({ queryKey: ['skus'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.message || 'Failed to create SKU');
    },
  });

  const handleSubmit = () => {
    setError('');
    const mrp = parseFloat(unitPrice);
    if (!masterSkuId.trim() || !name.trim() || isNaN(mrp) || mrp <= 0) {
      setError('Product Code, Product Name, and MRP per Unit are required');
      return;
    }
    createMutation.mutate();
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="px-5 py-3.5 border-b border-gray-200 flex-row items-center justify-between bg-white">
          <View className="flex-1 pr-3">
            <Text className="text-lg font-bold text-gray-900">Add New SKU</Text>
            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
              Enter base product details. Case Qty, Box Rate, Scheme Amount, 1-Pc Rate, and Totals calculate automatically.
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} className="p-1.5 rounded-full bg-gray-100">
            <Ionicons name="close" size={20} color="#4b5563" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {error ? (
            <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 flex-row items-center gap-2">
              <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
              <Text className="text-xs font-semibold text-red-700 flex-1">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3.5 pb-24">
            {/* Product Code & Product Name */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Product Code *</Text>
                <TextInput
                  value={masterSkuId}
                  onChangeText={setMasterSkuId}
                  placeholder="e.g. SKU-001"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Product Name *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Nimson Hair Oil 200ml"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>
            </View>

            {/* Principal / Brand & Weight / Size */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Principal / Brand</Text>
                <TextInput
                  value={principal}
                  onChangeText={setPrincipal}
                  placeholder="e.g. Nimson"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Weight / Size</Text>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="e.g. 200ml"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>
            </View>

            {/* MRP / Unit, Offer Rate NEW, Scheme % */}
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">MRP / Unit (INR) *</Text>
                <TextInput
                  value={unitPrice}
                  onChangeText={(val) => {
                    setUnitPrice(val);
                    if (!offerRateNew || offerRateNew === unitPrice) {
                      setOfferRateNew(val);
                    }
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Offer Rate NEW</Text>
                <TextInput
                  value={offerRateNew}
                  onChangeText={setOfferRateNew}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Scheme %</Text>
                <TextInput
                  value={schemePercent}
                  onChangeText={setSchemePercent}
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>
            </View>

            {/* Master Pack Qty, Master Pkg Unit, FOR PER/PC */}
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Master Pack Qty</Text>
                <TextInput
                  value={masterPackQty}
                  onChangeText={setMasterPackQty}
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Master Pkg Unit</Text>
                <TextInput
                  value={masterPackUnit}
                  onChangeText={setMasterPackUnit}
                  placeholder="Doz"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">FOR PER/PC (Pcs/Pack)</Text>
                <TextInput
                  value={perPcPrice}
                  onChangeText={setPerPcPrice}
                  placeholder="12"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 bg-white"
                />
              </View>
            </View>

            {/* Tax Rate Radio Selection */}
            <View>
              <Text className="text-xs font-semibold text-gray-700 mb-1.5">Tax Rate</Text>
              <View className="flex-row items-center gap-4 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <TouchableOpacity
                  onPress={() => setTaxType('tax18')}
                  className="flex-row items-center gap-1.5"
                >
                  <Ionicons
                    name={taxType === 'tax18' ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={taxType === 'tax18' ? '#f97316' : '#9ca3af'}
                  />
                  <Text className="text-xs font-medium text-gray-800">18% GST</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setTaxType('tax5')}
                  className="flex-row items-center gap-1.5"
                >
                  <Ionicons
                    name={taxType === 'tax5' ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={taxType === 'tax5' ? '#f97316' : '#9ca3af'}
                  />
                  <Text className="text-xs font-medium text-gray-800">5% GST</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setTaxType('none')}
                  className="flex-row items-center gap-1.5"
                >
                  <Ionicons
                    name={taxType === 'none' ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={taxType === 'none' ? '#f97316' : '#9ca3af'}
                  />
                  <Text className="text-xs font-medium text-gray-800">No Tax</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Pricing Breakdown Card */}
            <View className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 gap-2.5">
              <View className="flex-row items-center justify-between border-b border-amber-200/70 pb-2">
                <Text className="text-xs font-bold text-amber-900">
                  Auto-Calculated Pricing & Case Breakdown
                </Text>
                <View className="flex-row gap-2">
                  <Text className="text-[10px] text-amber-800">
                    FOR PER/PC: <Text className="font-bold text-amber-950">{perPcPrice || '12'}</Text>
                  </Text>
                  <Text className="text-[10px] text-amber-800">
                    CASE QTY: <Text className="font-bold text-amber-950">{calculated.boxQty} pcs</Text>
                  </Text>
                </View>
              </View>

              {/* 4 Cards: Box Rate, Scheme Amt, Billing Rate, 1-Pc Rate */}
              <View className="flex-row flex-wrap gap-2">
                <View className="flex-1 min-w-[45%] bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-gray-600">Box Rate</Text>
                  <Text className="text-xs font-bold text-gray-900 mt-0.5">
                    {formatCurrency(calculated.boxRate)}
                  </Text>
                  <Text className="text-[9px] text-gray-500 mt-0.5">Offer Rate × Master Pack</Text>
                </View>

                <View className="flex-1 min-w-[45%] bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-gray-600">Scheme Amount</Text>
                  <Text className="text-xs font-bold text-gray-900 mt-0.5">
                    {formatCurrency(calculated.schemeAmount)}
                  </Text>
                  <Text className="text-[9px] text-gray-500 mt-0.5">{schemePercent || 0}% of Offer Rate</Text>
                </View>

                <View className="flex-1 min-w-[45%] bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-gray-600">Billing Rate</Text>
                  <Text className="text-xs font-bold text-gray-900 mt-0.5">
                    {formatCurrency(calculated.billing)}
                  </Text>
                  <Text className="text-[9px] text-gray-500 mt-0.5">Offer Rate - Scheme</Text>
                </View>

                <View className="flex-1 min-w-[45%] bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-gray-600">1-Pc Rate (PER/PC)</Text>
                  <Text className="text-xs font-bold text-gray-900 mt-0.5">
                    {formatCurrency(calculated.perPcRate)}
                  </Text>
                  <Text className="text-[9px] text-gray-500 mt-0.5">Billing ÷ For Per/Pc</Text>
                </View>
              </View>

              {/* 3 Cards: Super Total, Distributor Total, Retail Total */}
              <View className="flex-row gap-2">
                <View className="flex-1 bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-amber-700">Super Total</Text>
                  <Text className="text-xs font-bold text-amber-900 mt-0.5">
                    {formatCurrency(calculated.superTotal)} <Text className="text-[9px] font-normal text-amber-700">/ Pack</Text>
                  </Text>
                  <Text className="text-[9px] text-amber-700 mt-0.5">
                    {formatCurrency(calculated.superPerBox)} / Case
                  </Text>
                </View>

                <View className="flex-1 bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-emerald-700">Distributor Total</Text>
                  <Text className="text-xs font-bold text-emerald-900 mt-0.5">
                    {formatCurrency(calculated.distributorTotal)} <Text className="text-[9px] font-normal text-emerald-700">/ Pack</Text>
                  </Text>
                  <Text className="text-[9px] text-emerald-700 mt-0.5">
                    {formatCurrency(calculated.distPerBox)} / Case
                  </Text>
                </View>

                <View className="flex-1 bg-white/90 p-2 rounded-lg border border-amber-200/60">
                  <Text className="text-[10px] font-semibold text-indigo-700">Retail Total</Text>
                  <Text className="text-xs font-bold text-indigo-900 mt-0.5">
                    {formatCurrency(calculated.retailTotal)} <Text className="text-[9px] font-normal text-indigo-700">/ Pack</Text>
                  </Text>
                  <Text className="text-[9px] text-indigo-700 mt-0.5">
                    {formatCurrency(calculated.retailPerBox)} / Case
                  </Text>
                </View>
              </View>

              {/* Principal Value Footer */}
              <View className="pt-2 flex-row justify-between items-center border-t border-amber-200/70">
                <Text className="text-xs font-semibold text-amber-900">
                  Principal Value (Super Total × Pack Qty):
                </Text>
                <Text className="text-xs font-bold text-amber-950">
                  {formatCurrency(calculated.superPerBox)}
                </Text>
              </View>
            </View>

            {/* Scheme Eligible Checkbox */}
            <TouchableOpacity
              onPress={() => setSchemeEligible((prev) => !prev)}
              className="flex-row items-center gap-2.5 py-1"
            >
              <Ionicons
                name={schemeEligible ? 'checkbox' : 'square-outline'}
                size={20}
                color={schemeEligible ? '#f97316' : '#9ca3af'}
              />
              <Text className="text-xs font-semibold text-gray-800">Scheme Eligible</Text>
            </TouchableOpacity>

            <Text className="text-[11px] text-gray-500 italic">
              All Super Stockists will be notified when a new SKU is added.
            </Text>

            {/* Form Actions */}
            <View className="flex-row justify-end gap-3 pt-3 border-t border-gray-200">
              <TouchableOpacity
                onPress={handleClose}
                disabled={createMutation.isPending}
                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white"
              >
                <Text className="text-xs font-semibold text-gray-600">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={createMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-orange-500 flex-row items-center gap-2 shadow-xs"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : null}
                <Text className="text-xs font-bold text-white">Create SKU</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
