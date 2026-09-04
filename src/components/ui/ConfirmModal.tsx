import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  size?: 'md' | 'lg' | 'xl';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: 'alert-circle-outline' as const,
    iconColor: '#dc2626',
    btnBg: 'bg-red-600 active:bg-red-700',
  },
  warning: {
    icon: 'warning-outline' as const,
    iconColor: '#d97706',
    btnBg: 'bg-amber-600 active:bg-amber-705',
  },
  info: {
    icon: 'information-circle-outline' as const,
    iconColor: '#f97316',
    btnBg: 'bg-orange-500 active:bg-orange-600',
  },
};

export default function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/60 justify-center items-center p-6">
        <View className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          {/* Close button */}
          <TouchableOpacity
            onPress={onCancel}
            disabled={loading}
            className="absolute right-4 top-4 p-1 rounded-full bg-gray-50 active:bg-gray-150"
          >
            <Ionicons name="close" size={20} color="#4b5563" />
          </TouchableOpacity>

          {/* Header */}
          <View className="flex-row items-start gap-3 mt-2 mb-4">
            <Ionicons name={styles.icon} size={28} color={styles.iconColor} />
            <View className="flex-1 pr-4">
              <Text className="text-base font-bold text-gray-900">{title}</Text>
              {description && (
                <Text className="text-xs text-gray-500 mt-1 leading-4">{description}</Text>
              )}
            </View>
          </View>

          {/* Optional Children */}
          {children && (
            <ScrollView className="max-h-48 mb-4" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          )}

          {/* Actions */}
          <View className="flex-row justify-end gap-3 border-t border-gray-100 pt-4 mt-2">
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              className="border border-gray-250 bg-white rounded-lg px-4 py-2 active:bg-gray-50"
            >
              <Text className="text-xs font-bold text-gray-600">{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              className={`${styles.btnBg} rounded-lg px-4 py-2 flex-row items-center gap-1.5`}
            >
              {loading && <ActivityIndicator size="small" color="white" />}
              <Text className="text-xs font-bold text-white">{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
