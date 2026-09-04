import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore } from '@/store/auth.store';
import { visitService } from '@/services/visit.service';
import { UserRole } from '@/types';

const ALLOWED_ROLES = new Set([UserRole.SO, UserRole.ASE, UserRole.ASM, UserRole.RSM, UserRole.NSM]);

export default function IAmHereScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const canAccess = Boolean(user && ALLOWED_ROLES.has(user.role as UserRole));

  // States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remark, setRemark] = useState('');
  const [photo, setPhoto] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationSkipped, setLocationSkipped] = useState(false);

  // GPS Coordinate States
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setAccuracy(loc.coords.accuracy);
    } catch (err: any) {
      setLocationError(err?.message || 'Failed to acquire GPS coords');
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to take verification photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'selfie.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleSubmit = async () => {
    if (!remark.trim()) {
      Alert.alert('Validation Error', 'Please enter your remarks.');
      return;
    }

    if (!photo) {
      Alert.alert('Validation Error', 'Please capture a verification photo.');
      return;
    }

    if (!locationSkipped && (latitude === null || longitude === null)) {
      Alert.alert('Validation Error', 'GPS Location is required. Alternatively, you can Skip GPS.');
      return;
    }

    setSubmitting(false);
    setSubmitting(true);
    try {
      await visitService.createIAmHere(
        remark.trim(),
        photo,
        locationSkipped ? undefined : { latitude: latitude!, longitude: longitude! }
      );
      Alert.alert('Success', 'Form submitted successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setRemark('');
            setPhoto(null);
            setLatitude(null);
            setLongitude(null);
            setLocationSkipped(false);
            router.push('/');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      requestLocation();
    }
  }, [canAccess]);

  if (!canAccess) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white p-6">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          This check-in form is restricted to SO, ASE, ASM, RSM, and NSM roles only.
        </Text>
      </SafeAreaView>
    );
  }

  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/admin/inventory' },
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
      <ScrollView className="flex-grow" showsVerticalScrollIndicator={false}>
        {/* Title block */}
        <View className="px-6 pt-5 pb-2 flex-row items-center gap-3">
          <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
            <Ionicons name="location-outline" size={22} color="#f97316" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-800">I Am Here</Text>
            <Text className="text-xs text-slate-400 mt-0.5">Log your current location, upload a photo, and submit remarks. This will be visible in the performance reports.</Text>
          </View>
        </View>

        {/* Check-In Card Container */}
        <View className="mx-6 mt-4 mb-24 bg-white border border-gray-200 p-5 rounded-2xl gap-5 shadow-sm">
          {/* GPS Coordinates Bar */}
          <View className={`border rounded-xl p-3 flex-row items-center justify-between ${
            locationSkipped
              ? 'bg-gray-50 border-gray-200'
              : locationLoading
                ? 'bg-blue-50 border-blue-100'
                : locationError
                  ? 'bg-amber-50 border-amber-100'
                  : latitude
                    ? 'bg-[#ecfdf5] border-[#a7f3d0]'
                    : 'bg-gray-50 border-gray-150'
          }`}>
            <View className="flex-row items-center gap-2 flex-1 mr-3">
              <Ionicons
                name="send-outline"
                size={16}
                color={locationSkipped ? '#6b7280' : locationLoading ? '#3b82f6' : locationError ? '#d97706' : '#10b981'}
              />
              <View className="flex-1">
                <Text className={`text-xs font-semibold ${
                  locationSkipped ? 'text-gray-600' : locationLoading ? 'text-blue-700' : locationError ? 'text-amber-700' : 'text-[#065f46]'
                }`}>
                  {locationSkipped
                    ? 'Location Skipped'
                    : locationLoading
                      ? 'Acquiring GPS location...'
                      : locationError
                        ? 'Location Error'
                        : `Location: ${latitude?.toFixed(5)}, ${longitude?.toFixed(5)} ${accuracy ? `(±${Math.round(accuracy)}m)` : ''}`}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-1.5">
              {locationSkipped ? (
                <TouchableOpacity
                  onPress={() => {
                    setLocationSkipped(false);
                    requestLocation();
                  }}
                  className="bg-purple-600 px-2.5 py-1 rounded-lg"
                >
                  <Text className="text-white text-[10px] font-bold">Use GPS</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setLocationSkipped(true)}
                    className="border border-gray-300 bg-white px-2.5 py-1 rounded-lg"
                  >
                    <Text className="text-gray-600 text-[10px] font-bold">Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={requestLocation}
                    className="bg-purple-600 px-2.5 py-1 rounded-lg"
                  >
                    <Text className="text-white text-[10px] font-bold">Retry</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Photo capture block */}
          <View className="gap-2">
            <Text className="text-sm font-bold text-slate-800">Photo (Mandatory)</Text>
            {photo ? (
              <View className="relative w-full h-56 border border-gray-150 rounded-xl overflow-hidden bg-gray-50">
                <Image source={{ uri: photo.uri }} className="w-full h-full" resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setPhoto(null)}
                  className="absolute top-2 right-2 bg-red-500 p-1.5 rounded-full shadow"
                >
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="w-full h-44 bg-gray-100 rounded-xl items-center justify-center border border-gray-150 p-4">
                <TouchableOpacity
                  onPress={handlePickPhoto}
                  className="bg-[#f97316] rounded-xl px-5 py-3 shadow-sm"
                >
                  <Text className="text-white text-sm font-bold">Start Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Remarks block */}
          <View className="gap-2">
            <Text className="text-sm font-bold text-slate-800">Remarks (Mandatory)</Text>
            <TextInput
              value={remark}
              onChangeText={setRemark}
              placeholder="What are you doing here?"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              style={{ textAlignVertical: 'top' }}
              className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm text-slate-700 min-h-[100px]"
            />
          </View>

          {/* Submit action */}
          <TouchableOpacity
            disabled={submitting}
            onPress={handleSubmit}
            className="w-full py-3.5 bg-[#f97316] active:bg-[#ea580c] rounded-xl items-center justify-center flex-row gap-2"
            style={{ backgroundColor: '#f97316' }}
          >
            {submitting && <ActivityIndicator size="small" color="white" />}
            <Text className="text-white font-black text-sm">Submit Location</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
