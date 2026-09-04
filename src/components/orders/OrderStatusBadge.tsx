import React from 'react';
import { View, Text } from 'react-native';
import { STATUS_CONFIG } from '@/lib/order-helpers';
import { OrderType } from '@/types';

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'bg-gray-50 border border-gray-200',
    text: 'text-gray-650',
  };

  return (
    <View className={`px-2.5 py-0.5 rounded-full ${cfg.bg}`}>
      <Text className={`text-[10px] font-bold uppercase ${cfg.text}`}>
        {cfg.label}
      </Text>
    </View>
  );
}

interface OrderTypeBadgeProps {
  type: string;
}

export function OrderTypeBadge({ type }: OrderTypeBadgeProps) {
  const label = type === OrderType.PRIMARY ? 'Primary' : type === OrderType.PRIMARY_HANDOVER ? 'Primary Handover' : 'Secondary';
  return (
    <View className="bg-[#fff7ed] px-2 py-0.5 rounded-full border border-orange-100">
      <Text className="text-[10px] font-bold text-[#f97316] uppercase">
        {label}
      </Text>
    </View>
  );
}
