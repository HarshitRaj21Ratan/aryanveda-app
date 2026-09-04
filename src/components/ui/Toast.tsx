import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(type: ToastType, message: string) {
  useToastStore.getState().addToast(type, message);
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const icons = {
    success: <Ionicons name="checkmark-circle" size={18} color="#16a34a" />,
    error: <Ionicons name="close-circle" size={18} color="#dc2626" />,
    warning: <Ionicons name="warning" size={18} color="#d97706" />,
    info: <Ionicons name="information-circle" size={18} color="#2563eb" />,
  };

  const styles = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  };

  if (toasts.length === 0) return null;

  return (
    <View className="absolute bottom-6 left-6 right-6 z-55 gap-2">
      {toasts.map((t) => (
        <View
          key={t.id}
          className={`flex-row items-center justify-between rounded-xl border px-4 py-3.5 shadow-lg bg-white ${styles[t.type]}`}
        >
          <View className="flex-row items-center flex-1 mr-3">
            {icons[t.type]}
            <Text className="text-xs font-bold text-gray-700 ml-2 flex-1 leading-4">{t.message}</Text>
          </View>
          <TouchableOpacity
            onPress={() => removeToast(t.id)}
            className="p-1"
          >
            <Ionicons name="close" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
