import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { useAuthStore } from '@/store/auth.store';
import { locationService } from '@/services/location.service';
import { UserRole } from '@/types';

const TRACKABLE_ROLES = new Set<UserRole>([UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM]);
const TRACK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function formatTimestamp(ts: string | Date): string {
  const date = new Date(ts);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function activityLabel(type: string): string {
  const labels: Record<string, string> = {
    attendance: 'Attendance',
    beat_visit: 'Beat Visit',
    outlet_visit: 'Outlet Visit',
    market_visit: 'Market Visit',
    periodic_track: 'Auto Track',
    manual_checkin: 'Manual Check-in',
  };
  return labels[type] ?? type;
}

function activityColor(type: string): string {
  const colors: Record<string, string> = {
    attendance: 'text-blue-700 bg-blue-50 border-blue-100',
    beat_visit: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    outlet_visit: 'text-violet-700 bg-violet-50 border-violet-100',
    market_visit: 'text-amber-700 bg-amber-50 border-amber-100',
    periodic_track: 'text-gray-600 bg-gray-50 border-gray-100',
    manual_checkin: 'text-indigo-700 bg-indigo-50 border-indigo-100',
  };
  return colors[type] ?? 'text-gray-600 bg-gray-50 border-gray-100';
}

export default function GPSTrackingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = user?.role as UserRole | undefined;
  const canAccess = Boolean(role && TRACKABLE_ROLES.has(role));

  const [isTracking, setIsTracking] = useState(false);
  const [lastTrack, setLastTrack] = useState<any | null>(null);
  const [trackCount, setTrackCount] = useState(0);

  // Live coords
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const watchSubscriptionRef = useRef<any>(null);
  const periodicTimerRef = useRef<any>(null);

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['my-location-history'],
    queryFn: () => locationService.getMyLocationHistory({ page: 1, limit: 20 }),
    enabled: canAccess,
  });

  const { data: geofenceStatus } = useQuery({
    queryKey: ['check-geofence-status', latitude, longitude],
    queryFn: () => locationService.checkGeofence(latitude!, longitude!),
    enabled: !!latitude && !!longitude,
  });

  // Track submission mutation
  const trackMutation = useMutation({
    mutationFn: (activityType: string) => {
      if (latitude === null || longitude === null) {
        return Promise.reject(new Error('Location coords not available'));
      }
      return locationService.submitTrack({
        latitude,
        longitude,
        accuracy: accuracy ?? undefined,
        activityType,
      });
    },
    onSuccess: (result) => {
      setLastTrack({
        ...result,
        timestamp: new Date().toISOString(),
      });
      setTrackCount((c) => c + 1);
      refetchHistory();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Telemetry submission failed');
    },
  });

  // Acquire single coordinate
  const requestLocation = async () => {
    setGeoLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permissions are required for GPS tracking');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setAccuracy(loc.coords.accuracy);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to acquire location');
    } finally {
      setGeoLoading(false);
    }
  };

  // Start watching location updates
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permissions are required');
      return;
    }

    setIsTracking(true);
    await requestLocation();

    // Subscribe to location updates
    watchSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10,
      },
      (loc) => {
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
        setAccuracy(loc.coords.accuracy);
      }
    );

    // Initial checkin
    if (latitude && longitude) {
      trackMutation.mutate('periodic_track');
    }

    // Set up periodic sync timer
    periodicTimerRef.current = setInterval(() => {
      trackMutation.mutate('periodic_track');
    }, TRACK_INTERVAL_MS);
  };

  // Stop watching location updates
  const stopTracking = () => {
    setIsTracking(false);
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    if (periodicTimerRef.current) {
      clearInterval(periodicTimerRef.current);
      periodicTimerRef.current = null;
    }
  };

  useEffect(() => {
    requestLocation();
    return () => {
      if (watchSubscriptionRef.current) watchSubscriptionRef.current.remove();
      if (periodicTimerRef.current) clearInterval(periodicTimerRef.current);
    };
  }, []);

  if (!canAccess) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          GPS Live Tracking is only available for SO, ASE, ASM, and RSM roles.
        </Text>
      </SafeAreaView>
    );
  }

  const historyRecords = historyData?.data ?? [];
  const totalCount = historyRecords.length;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Search and Notification Header (Matching top navbar of Web Dashboard) */}
      <View className="px-5 py-3 border-b border-gray-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.push('/')} className="p-1">
          <Ionicons name="menu" size={24} color="#4b5563" />
        </TouchableOpacity>

        {/* Search Bar */}
        <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          <Ionicons name="search-outline" size={16} color="#9ca3af" />
          <TextInput
            placeholder="Search users, orders..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-1.5 text-xs text-gray-800 py-0"
          />
        </View>

        {/* Icons Bar */}
        <TouchableOpacity className="p-1">
          <Ionicons name="mail-outline" size={20} color="#4b5563" />
        </TouchableOpacity>

        <TouchableOpacity className="p-1 relative">
          <Ionicons name="notifications-outline" size={20} color="#4b5563" />
          <View className="absolute top-0 right-0 bg-orange-500 rounded-full min-w-[14px] h-[14px] items-center justify-center px-0.5">
            <Text className="text-[8px] font-bold text-white leading-none">99+</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => useAuthStore.getState().logout()} className="p-1">
          <Ionicons name="log-out-outline" size={20} color="#4b5563" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Title and Subtitle with GPS/Locate Icon */}
        <View className="mb-4 flex-row items-start gap-3">
          <View className="mt-1 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
            <Ionicons name="locate-outline" size={22} color="#2563eb" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-800">GPS Tracking</Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              Track live location telemetry checkpoints
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View className="flex-row gap-2.5 mb-5 flex-wrap">
          <TouchableOpacity
            onPress={() => refetchHistory()}
            className="flex-row items-center gap-1.5 bg-white border border-gray-200 px-4 py-2.5 rounded-lg"
          >
            <Ionicons name="refresh-outline" size={15} color="#4b5563" />
            <Text className="text-xs font-semibold text-gray-600">Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isTracking ? stopTracking : startTracking}
            className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-lg ${
              isTracking ? 'bg-red-500' : 'bg-emerald-600'
            }`}
          >
            <Ionicons name={isTracking ? 'pause-outline' : 'play-outline'} size={15} color="white" />
            <Text className="text-white font-semibold text-xs">
              {isTracking ? 'Stop Sync' : 'Start Sync'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={trackMutation.isPending || geoLoading}
            onPress={() => trackMutation.mutate('manual_checkin')}
            className="flex-row items-center gap-1.5 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg"
          >
            <Ionicons name="pin-outline" size={15} color="#374151" />
            <Text className="text-gray-700 font-semibold text-xs">Manual Check-In</Text>
          </TouchableOpacity>
        </View>

        {/* Status Panels Grid */}
        <View className="flex-row flex-wrap gap-3 mb-6 justify-between">
          {/* Coord Panel */}
          <View className="w-[48%] border border-gray-150 p-4 rounded-xl bg-white shadow-sm gap-1">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location Coords</Text>
              <Ionicons name="locate" size={14} color="#3b82f6" />
            </View>
            {geoLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : latitude ? (
              <View>
                <Text className="text-base font-bold text-gray-800">{latitude.toFixed(5)}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{longitude?.toFixed(5)}</Text>
                {accuracy && (
                  <Text className="text-[9px] text-gray-400 mt-1 font-semibold">
                    Accuracy: ±{Math.round(accuracy)}m
                  </Text>
                )}
              </View>
            ) : (
              <Text className="text-xs text-gray-400 font-semibold">Unavailable</Text>
            )}
          </View>

          {/* Tracking status */}
          <View className="w-[48%] border border-gray-150 p-4 rounded-xl bg-white shadow-sm gap-1">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Live Tracking</Text>
              <Ionicons
                name="radio-button-on"
                size={14}
                color={isTracking ? '#10b981' : '#9ca3af'}
              />
            </View>
            <Text className={`text-base font-bold ${isTracking ? 'text-emerald-600' : 'text-gray-400'}`}>
              {isTracking ? 'Active' : 'Paused'}
            </Text>
            <Text className="text-[9px] text-gray-400 mt-1 font-semibold">
              {trackCount} checkpoints today
            </Text>
          </View>

          {/* Geofence panel */}
          <View className="w-[48%] border border-gray-150 p-4 rounded-xl bg-white shadow-sm gap-1">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Geofence boundary</Text>
              <Ionicons name="shield-checkmark" size={14} color="#10b981" />
            </View>
            <Text className={`text-base font-bold ${geofenceStatus?.inside ? 'text-emerald-600' : 'text-amber-600'}`}>
              {geofenceStatus ? (geofenceStatus.inside ? 'Inside Territory' : 'Outstation') : 'Checking...'}
            </Text>
            {geofenceStatus?.geofenceName && (
              <Text className="text-[9px] text-gray-400 mt-0.5" numberOfLines={1}>
                Near: {geofenceStatus.geofenceName}
              </Text>
            )}
          </View>

          {/* Last sync */}
          <View className="w-[48%] border border-gray-150 p-4 rounded-xl bg-white shadow-sm gap-1">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Server Update</Text>
              <Ionicons name="time" size={14} color="#8b5cf6" />
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-1" numberOfLines={1}>
              {lastTrack ? formatTimestamp(lastTrack.timestamp) : 'None'}
            </Text>
          </View>
        </View>

        {/* History records Card Container */}
        <View className="bg-white border border-gray-155 rounded-xl overflow-hidden shadow-sm mb-24">
          {/* Card Header */}
          <View className="px-4 py-3.5 border-b border-gray-100 flex-row items-center gap-2">
            <Text className="text-sm font-bold text-gray-800">Tracking Log History</Text>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <Text className="text-[10px] font-bold text-emerald-700 uppercase">
                {totalCount} Logs
              </Text>
            </View>
          </View>

          {/* Card Body */}
          {historyLoading ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          ) : historyRecords.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Text className="text-xs text-gray-400">No location checkpoints synced yet.</Text>
            </View>
          ) : (
            <View className="p-4 gap-3">
              {historyRecords.map((rec) => (
                <View key={rec.trackId} className="flex-row items-center justify-between py-2.5 border-b border-gray-50">
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <View className={`px-2 py-0.5 rounded-full border ${activityColor(rec.activityType)}`}>
                        <Text className="text-[8px] font-bold uppercase">{activityLabel(rec.activityType)}</Text>
                      </View>
                      <Text className="text-[9px] text-gray-400 font-semibold">
                        {formatTimestamp(rec.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-gray-600 font-semibold mt-1">
                      Coords: {rec.latitude.toFixed(5)}, {rec.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
