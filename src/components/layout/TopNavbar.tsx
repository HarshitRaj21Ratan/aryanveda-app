import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';
import NotificationBell from './NotificationBell';

interface TopNavbarProps {
  onOpenEmailPrompt?: () => void;
  onMenuPress?: () => void;
}

export default function TopNavbar({ onOpenEmailPrompt, onMenuPress }: TopNavbarProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  async function handleLogout() {
    try {
      await authService.logout();
    } catch (e) {
      // Ignore API errors to ensure logout completes locally
    } finally {
      try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_login_time');
      } catch {}
      logout();
      router.replace('/(auth)/login' as any);
    }
  }




  return (
    <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row items-center justify-between">
      {/* Left Menu Icon + Search Bar */}
      <View className="flex-row items-center flex-1 mr-4">
        {onMenuPress && (
          <TouchableOpacity onPress={onMenuPress} className="p-2 mr-2">
            <Ionicons name="menu-outline" size={26} color="#374151" />
          </TouchableOpacity>
        )}

        {/* Search bar */}
        <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
          <Ionicons name="search-outline" size={18} color="#9ca3af" className="mr-2" />
          <TextInput
            placeholder="Search users, orders..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-sm text-gray-800 p-0 h-8"
          />
        </View>
      </View>

      {/* Right Actions */}
      <View className="flex-row items-center gap-3">
        {onOpenEmailPrompt && (
          <TouchableOpacity
            onPress={onOpenEmailPrompt}
            className="p-1.5"
          >
            <Ionicons name="mail-unread-outline" size={22} color="#4b5563" />
          </TouchableOpacity>
        )}

        {/* Live notification bell */}
        <NotificationBell />

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="p-1.5"
        >
          <Ionicons name="log-out-outline" size={22} color="#4b5563" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
