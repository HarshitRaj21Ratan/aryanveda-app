import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

import { useAuthStore } from '@/store/auth.store';
import { NAV_ITEMS } from './nav-items';
import { resolveUserRole } from '@/lib/role-utils';

const { width } = Dimensions.get('window');

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ collapsed = false, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const effectiveRole = user ? resolveUserRole(user.role, user.entityId) : null;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !!effectiveRole && item.roles.includes(effectiveRole)
  ).filter((item, index, items) => {
    const itemKey = `${item.label}-${item.href}`;
    return index === items.findIndex((candidate) => `${candidate.label}-${candidate.href}` === itemKey);
  });

  const handleNavigate = (href: string) => {
    router.push(href as any);
    if (onClose) {
      requestAnimationFrame(() => onClose());
    }
  };

  return (
    <View className="h-full bg-[#181d2a] p-4 justify-between" style={{ width: collapsed ? 80 : width * 0.78 }}>
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row justify-between items-center pb-4 mb-4 border-b border-gray-800">
          <View className="flex-row items-center flex-1 mr-2">
            <View className="w-10 h-10 bg-orange-500 rounded-2xl items-center justify-center mr-3 shadow-md">
              <Text className="text-white font-bold text-lg">N</Text>
            </View>
            {!collapsed && (
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Nimson DMS</Text>
                <Text className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mt-0.5">OPERATIONS PANEL</Text>
              </View>
            )}
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Navigation Items List */}
        <ScrollView className="flex-grow mb-4" showsVerticalScrollIndicator={false}>
          {!collapsed && (
            <Text className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
              Navigation
            </Text>
          )}
          <View className="gap-1">
            {visibleItems.map((item, idx) => {
              // Exact match or matches start
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleNavigate(item.href)}
                  className={`flex-row items-center justify-between px-3 py-3 rounded-xl ${
                    isActive ? 'bg-[#2c3144] border border-gray-700' : 'active:bg-[#202637]'
                  }`}
                  style={{ justifyContent: collapsed ? 'center' : 'space-between' }}
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? '#ffffff' : '#9ca3af'}
                    />
                    {!collapsed && (
                      <Text
                        className={`text-sm ${
                          isActive ? 'text-white font-semibold' : 'text-gray-300'
                        }`}
                      >
                        {item.label}
                      </Text>
                    )}
                  </View>
                  {!collapsed && (
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={isActive ? '#ffffff' : '#4b5563'}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* User Info */}
        {user && !collapsed && (
          <View className="border border-gray-800 rounded-xl p-3 bg-[#1e2332] items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-500 tracking-widest uppercase">ROLE</Text>
            <Text className="text-white font-bold text-sm mt-1">{user?.role || 'User'}</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
