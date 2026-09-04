import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { locationService } from '@/services/location.service';

export default function AdminTeamLocationScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: teamLocations, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-team-live-locations'],
    queryFn: () => locationService.getTeamLiveLocations(),
  });

  const list = teamLocations || [];

  const filtered = list.filter((it) =>
    it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    it.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openInGoogleMaps = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) {
      Alert.alert('Location unavailable', 'This agent has not logged any GPS coordinates yet.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open Google Maps.');
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-150 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.push('/admin' as any)} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-800">Team Locations</Text>
            <Text className="text-xs text-gray-500 mt-0.5">Live GPS location monitoring</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => void refetch()} disabled={isFetching} className="p-2">
          <Ionicons name="refresh" size={22} color={isFetching ? '#9ca3af' : '#374151'} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-grow p-4 gap-4">
        {/* Search */}
        <View className="flex-row items-center rounded-lg px-2.5 h-10 bg-gray-100 mb-2">
          <Ionicons name="search-outline" size={18} color="#9ca3af" className="mr-1.5" />
          <TextInput
            placeholder="Search agents..."
            placeholderTextColor="#9ca3af"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="flex-1 text-sm text-gray-800 py-0"
          />
        </View>

        {/* Live List */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#3c87f7" className="my-6" />
        ) : filtered.length === 0 ? (
          <Text className="text-xs text-gray-500 text-center p-4">No active coordinates logged</Text>
        ) : (
          filtered.map((it) => (
            <View key={it.entityId} className="p-3 border border-gray-100 rounded-lg bg-white shadow-sm flex-row justify-between items-center mb-2">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-bold text-gray-800">{it.name}</Text>
                <Text className="text-[10px] text-gray-500 mt-1">Role: {it.role.toUpperCase()} | State: {it.state ?? 'N/A'}</Text>
                {it.latitude !== null && it.longitude !== null ? (
                  <Text className="text-[9px] text-gray-400 mt-1">Lat: {it.latitude.toFixed(4)}, Lng: {it.longitude.toFixed(4)}</Text>
                ) : (
                  <Text className="text-[9px] text-red-400 mt-1">No GPS signal</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => openInGoogleMaps(it.latitude, it.longitude)}
                className="p-2 bg-blue-50 rounded-lg flex-row items-center gap-1"
              >
                <Ionicons name="navigate-outline" size={14} color="#3c87f7" />
                <Text className="text-[10px] font-bold text-blue-600">Track</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
