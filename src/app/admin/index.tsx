import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Dimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

const { width } = Dimensions.get('window');

interface MenuOption {
  title: string;
  description: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function AdminDashboardIndex() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (user?.role !== UserRole.ADMIN) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          You do not have administrative permissions to view this portal.
        </Text>
        <TouchableOpacity
          className="mt-6 bg-blue-500 px-6 py-2.5 rounded-lg"
          onPress={() => router.replace('/')}
        >
          <Text className="text-white font-semibold">Go to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Sidebar navigation options matching screenshot 2
  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/skus' },
    { name: 'Stock Movements', icon: 'cube-outline' as const, route: '/stock-movements' },
    { name: 'Orders', icon: 'cart-outline' as const, route: '/admin/performance' },
    { name: 'Leaderboard', icon: 'trophy-outline' as const, route: '/leaderboard' },
    { name: 'Outlet Report', icon: 'home-outline' as const, route: '/outlet-wise' },
    { name: 'SKU Report', icon: 'bar-chart-outline' as const, route: '/admin/inventory' },
    { name: 'Notifications', icon: 'notifications-outline' as const, route: '/announcement' },
    { name: 'Performance Track', icon: 'stats-chart-outline' as const, route: '/admin/performance' },
    { name: 'Attendance Track', icon: 'clipboard-outline' as const, route: '/admin/attendance' },
    { name: 'Summary', icon: 'grid-outline' as const, route: '/admin/summary' },
    { name: 'Admin Inventory', icon: 'archive-outline' as const, route: '/admin/inventory' },
    { name: 'Announcements', icon: 'megaphone-outline' as const, route: '/announcement' },
    // { name: 'Role Permissions', icon: 'shield-checkmark-outline' as const, route: '/admin/role-permissions' },
  ];

  return (
    <View className="flex-1 bg-gray-50">

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Good afternoon greeting */}
        <View className="px-5 pt-5 pb-3">
          <Text className="text-2xl font-bold text-gray-900">Good afternoon</Text>
          <View className="flex-row items-center flex-wrap mt-1">
            <Text className="text-sm text-gray-500">Here's what's happening in your network today – </Text>
            <Text className="text-sm font-semibold text-gray-800 mr-2">Admin</Text>
            <View className="flex-row items-center bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <Ionicons name="location-outline" size={12} color="#10b981" />
              <Text className="text-xs font-bold text-green-600 ml-1">BIHAR</Text>
            </View>
          </View>
        </View>

        {/* Stat Cards */}
        <View className="px-5 gap-3">
          {/* TOTAL USERS */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm">
            <View>
              <Text className="text-xs font-bold text-gray-400 tracking-wider">TOTAL USERS</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">23,577</Text>
            </View>
            <View className="w-10 h-10 bg-orange-50 rounded-lg items-center justify-center border border-orange-100">
              <Ionicons name="people-outline" size={20} color="#f97316" />
            </View>
          </View>

          {/* TOTAL ORDERS */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm">
            <View>
              <Text className="text-xs font-bold text-gray-400 tracking-wider">TOTAL ORDERS</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">12,093</Text>
            </View>
            <View className="w-10 h-10 bg-green-50 rounded-lg items-center justify-center border border-green-100">
              <Ionicons name="cube-outline" size={20} color="#10b981" />
            </View>
          </View>

          {/* PENDING ORDERS */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm">
            <View>
              <Text className="text-xs font-bold text-gray-400 tracking-wider">PENDING ORDERS</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">11,697</Text>
            </View>
            <View className="w-10 h-10 bg-yellow-50 rounded-lg items-center justify-center border border-yellow-100">
              <Ionicons name="time-outline" size={20} color="#f59e0b" />
            </View>
          </View>

          {/* ACTIVE ROLES */}
          <View className="bg-white border border-gray-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm">
            <View>
              <Text className="text-xs font-bold text-gray-400 tracking-wider">ACTIVE ROLES</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">11</Text>
            </View>
            <View className="w-10 h-10 bg-orange-50 rounded-lg items-center justify-center border border-orange-100">
              <Ionicons name="person-outline" size={20} color="#f97316" />
            </View>
          </View>
        </View>

        {/* User Breakdown Section */}
        <View className="mx-5 mt-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-base font-bold text-gray-900">User Breakdown</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Users by role</Text>
            </View>
            <TouchableOpacity className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-medium text-gray-600 mr-1">View All</Text>
              <Ionicons name="chevron-forward" size={12} color="#4b5563" />
            </TouchableOpacity>
          </View>

          {/* Roles Grid */}
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {[
              { label: 'ADMIN', count: '1' },
              { label: 'FINANCE', count: '1' },
              { label: 'DISPATCH', count: '1' },
              { label: 'NSM', count: '1' },
              { label: 'SUPER STOCKIST', count: '28' },
              { label: 'RSM', count: '4' },
              { label: 'DISTRIBUTOR', count: '618' },
              { label: 'ASM', count: '16' },
              { label: 'SO', count: '42' },
              { label: 'ASE', count: '13' },
              { label: 'RETAILER', count: '22,852', fullWidth: true }
            ].map((role, idx) => (
              <View
                key={idx}
                style={{ width: role.fullWidth ? '100%' : '48%' }}
                className="bg-white border border-gray-100 rounded-xl p-3 items-center justify-center"
              >
                <Text className="text-[10px] font-bold text-gray-400 tracking-wider uppercase text-center">{role.label}</Text>
                <Text className="text-lg font-bold text-gray-900 mt-1">{role.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Order Pipeline Section */}
        <View className="mx-5 mt-6 mb-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-base font-bold text-gray-900">Order Pipeline</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Current order status breakdown</Text>
            </View>
            <TouchableOpacity className="border border-gray-200 px-3 py-1.5 rounded-lg flex-row items-center">
              <Text className="text-xs font-medium text-gray-600 mr-1">All Orders</Text>
              <Ionicons name="chevron-forward" size={12} color="#4b5563" />
            </TouchableOpacity>
          </View>

          {/* Pipeline Items */}
          <View className="gap-3.5">
            {[
              { label: 'Pending', count: 11698, icon: 'time-outline' as const, color: '#f97316', bgLight: 'bg-orange-50' },
              { label: 'In Finance', count: 3, icon: 'card-outline' as const, color: '#8b5cf6', bgLight: 'bg-purple-50' },
              { label: 'Approved', count: 20, icon: 'checkmark-circle-outline' as const, color: '#10b981', bgLight: 'bg-green-50' },
              { label: 'Dispatched', count: 150, icon: 'bus-outline' as const, color: '#f59e0b', bgLight: 'bg-yellow-50' },
              { label: 'Delivered', count: 162, icon: 'cube-outline' as const, color: '#10b981', bgLight: 'bg-emerald-50' },
              { label: 'Cancelled', count: 61, icon: 'close-circle-outline' as const, color: '#ef4444', bgLight: 'bg-red-50' }
            ].map((item, idx) => {
              const total = 12094;
              const percentage = Math.max(1, (item.count / total) * 100);
              return (
                <View key={idx} className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className={`w-7 h-7 rounded-lg items-center justify-center ${item.bgLight}`}>
                        <Ionicons name={item.icon} size={14} color={item.color} />
                      </View>
                      <Text className="text-sm font-semibold text-gray-800">{item.label}</Text>
                    </View>
                    <Text className="text-sm font-bold text-gray-900">{item.count.toLocaleString()}</Text>
                  </View>
                  {/* Progress Bar */}
                  <View className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                      className="h-full rounded-full"
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Divider */}
          <View className="border-t border-gray-100 my-4" />

          {/* Total Orders Footer */}
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-gray-500 font-medium">Total Orders</Text>
            <Text className="text-base font-black text-gray-900">12,094</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

