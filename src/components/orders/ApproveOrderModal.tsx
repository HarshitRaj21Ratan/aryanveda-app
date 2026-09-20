import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService } from '@/services/order.service';

interface ApproveOrderModalProps {
  visible: boolean;
  orderId: string | null;
  onClose: () => void;
  onApproved?: () => void;
}

export default function ApproveOrderModal({
  visible,
  orderId,
  onClose,
  onApproved,
}: ApproveOrderModalProps) {
  const queryClient = useQueryClient();

  const {
    data: previewRes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['order-approval-preview', orderId],
    queryFn: () => orderService.getApprovalPreview(orderId!),
    enabled: !!orderId && visible,
  });

  const preview = previewRes?.data;

  const approveMutation = useMutation({
    mutationFn: (id: string) => orderService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app', orderId] });
      Alert.alert('Success', 'Order approved successfully');
      onApproved?.();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to approve order');
    },
  });

  if (!visible || !orderId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[85%] border border-slate-100">
          {/* Header */}
          <View className="p-4 border-b border-slate-150 bg-white">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Ionicons name="warning-outline" size={20} color="#f97316" />
                <Text className="text-base font-bold text-slate-800">Approve Order</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-slate-500 mt-1 leading-relaxed">
              Approve this order? Stock will be deducted from your inventory and transferred to the distributor.
            </Text>
          </View>

          {/* Body */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={true} contentContainerStyle={{ padding: 16 }}>
            {isLoading ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator size="large" color="#f97316" />
                <Text className="text-xs text-slate-400 mt-2 font-medium">Checking stock in pieces...</Text>
              </View>
            ) : isError || !preview ? (
              <View className="py-8 items-center justify-center">
                <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
                <Text className="text-xs text-red-500 font-semibold mt-2">Could not load stock preview</Text>
              </View>
            ) : (
              <View className="gap-3">
                {/* SKU Line Items Grid */}
                <View className="flex-row flex-wrap justify-between gap-2.5">
                  {preview.lines.map((line) => {
                    const isEnough = line.enoughStock;
                    return (
                      <View
                        key={line.skuId}
                        className={`w-[48%] p-3 rounded-xl border ${
                          isEnough ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'
                        }`}
                      >
                        <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                          {line.skuId}
                        </Text>
                        <Text className="text-[11px] text-slate-500 mt-1">
                          Current: <Text className="font-bold text-slate-700">{line.availablePieces.toLocaleString('en-IN')} pcs</Text>
                        </Text>
                        <Text className="text-[11px] text-slate-500">
                          Order: <Text className="font-bold text-slate-700">{line.requiredPieces.toLocaleString('en-IN')} pcs</Text>
                        </Text>
                        <Text className={`text-[11px] font-bold mt-1 ${isEnough ? 'text-emerald-700' : 'text-red-600'}`}>
                          Remaining after approval: {line.remainingPieces.toLocaleString('en-IN')} pcs
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Stock Shortage Alert */}
                {!preview.canApprove && (
                  <View className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-center gap-2">
                    <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                    <Text className="flex-1 text-xs font-semibold text-red-700 leading-relaxed">
                      Some SKUs do not have enough stock in pieces. Refill inventory before approval.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View className="p-4 border-t border-slate-150 flex-row justify-end items-center gap-3 bg-slate-50/60">
            <TouchableOpacity
              onPress={onClose}
              disabled={approveMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white"
            >
              <Text className="text-xs font-bold text-slate-600">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => approveMutation.mutate(orderId)}
              disabled={approveMutation.isPending || isLoading}
              className={`px-5 py-2.5 rounded-xl flex-row items-center gap-1.5 bg-[#f97316] ${
                isLoading || approveMutation.isPending ? 'opacity-60' : 'active:opacity-80'
              }`}
            >
              {approveMutation.isPending && <ActivityIndicator size="small" color="white" />}
              <Text className="text-xs font-bold text-white">Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
