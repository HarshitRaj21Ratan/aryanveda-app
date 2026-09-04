import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { attendanceService } from '@/services/attendance.service';
import type { AttendanceStatus, WorkingType, ITodayAttendanceStatus } from '@/services/attendance.service';

const attendanceOptions: Array<{ label: string; value: AttendanceStatus }> = [
  { label: 'Present', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Half Day', value: 'half_day' },
  { label: 'Leave', value: 'leave' },
];

const workingTypeOptions: Array<{ label: string; value: WorkingType }> = [
  { label: 'Market Working', value: 'market_working' },
  { label: 'Joint Working', value: 'joint_working' },
  { label: 'Distribution Point Visit', value: 'distribution_point_visit' },
  { label: 'Super Point Visit', value: 'super_point_visit' },
  { label: 'Other', value: 'other' },
];

interface AttendanceGateModalProps {
  open: boolean;
  roleLabel: string;
  status: (ITodayAttendanceStatus & { currentIstTime?: string; windowStartsAtIst?: string; canMarkNow?: boolean; attendanceDateKey?: string }) | null;
  onMarked: () => Promise<void>;
  onSignOut: () => void;
}

export default function AttendanceGateModal({
  open,
  roleLabel,
  status,
  onMarked,
  onSignOut,
}: AttendanceGateModalProps) {
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('present');
  const [workingType, setWorkingType] = useState<WorkingType>('market_working');
  const [town, setTown] = useState('');
  const [remark, setRemark] = useState('');
  const [gpsErrorOverride, setGpsErrorOverride] = useState(false);
  const [gpsErrorReason, setGpsErrorReason] = useState('');
  const [selfie, setSelfie] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GPS Coordinate States
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Dropdown states for mobile UI
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWorkingTypeDropdown, setShowWorkingTypeDropdown] = useState(false);

  const requestLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') {
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
    const { status: permissionStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to take verification photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets) {
      const asset = result.assets[0];
      setSelfie({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'selfie.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      setError(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setAttendanceStatus('present');
    setWorkingType('market_working');
    setTown('');
    setRemark('');
    setGpsErrorOverride(false);
    setGpsErrorReason('');
    setSelfie(null);
    setError(null);
    setLatitude(null);
    setLongitude(null);
    setAccuracy(null);
    requestLocation();
  }, [open]);

  if (!open || !status) return null;

  const handleSubmit = async () => {
    const isAbsentOrLeave = attendanceStatus === 'absent' || attendanceStatus === 'leave';

    if (!isAbsentOrLeave && !selfie) {
      setError('Selfie is mandatory to mark attendance.');
      return;
    }
    
    if (!town || !town.trim()) {
      setError('Town field is mandatory to mark attendance.');
      return;
    }

    if (latitude === null || longitude === null) {
      if (!gpsErrorOverride) {
        setError('GPS location is required to mark attendance. If GPS is failing, please use the override option.');
        return;
      }
      if (gpsErrorOverride && !gpsErrorReason.trim()) {
        setError('A reason is mandatory when overriding GPS location.');
        return;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      await attendanceService.markTodayAttendance({
        attendanceStatus,
        workingType,
        town: town.trim(),
        remark: remark.trim() || undefined,
        selfie,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        gpsErrorOverride,
        gpsErrorReason: gpsErrorOverride ? gpsErrorReason.trim() : undefined,
      });
      await onMarked();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message;
      setError(message ?? 'Unable to mark attendance right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent={false}>
      <View className="flex-1 bg-gray-50">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View className="bg-white border-b border-gray-200 px-6 pt-14 pb-5 flex-row justify-between items-start">
            <View className="flex-1 mr-4">
              <View className="mb-2 self-start flex-row items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1">
                <Ionicons name="shield-checkmark-outline" size={12} color="#c2410c" />
                <Text className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Attendance Required</Text>
              </View>
              <Text className="text-xl font-bold text-gray-900">Mark attendance first</Text>
              <Text className="text-xs text-gray-500 mt-1 leading-5">
                Role: <Text className="font-semibold text-gray-700">{roleLabel}</Text> · Date: {status?.record?.attendanceDateKey || new Date().toISOString().slice(0, 10)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onSignOut}
              className="flex-row items-center gap-1 border border-gray-200 rounded-lg px-3 py-2 bg-white active:bg-gray-50"
            >
              <Ionicons name="log-out-outline" size={14} color="#4b5563" />
              <Text className="text-gray-700 text-xs font-semibold">Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* Form Container */}
          <View className="p-6 gap-5">
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start gap-2">
                <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                <Text className="flex-1 text-sm text-red-700 font-medium">{error}</Text>
              </View>
            )}

            {/* GPS Location Status Card */}
            <View className={`border rounded-xl p-3 flex-row items-center justify-between ${
              locationLoading
                ? 'bg-blue-50 border-blue-100'
                : locationError
                  ? 'bg-amber-50 border-amber-100'
                  : latitude
                    ? 'bg-[#ecfdf5] border-[#a7f3d0]'
                    : 'bg-gray-50 border-gray-150'
            }`}>
              <View className="flex-row items-center gap-2.5 flex-1 mr-3">
                <Ionicons
                  name={locationLoading ? 'sync-outline' : locationError ? 'alert-circle-outline' : 'navigate-outline'}
                  size={18}
                  color={locationLoading ? '#2563eb' : locationError ? '#d97706' : '#059669'}
                  className={locationLoading ? 'animate-spin' : ''}
                />
                <View className="flex-1">
                  <Text className={`text-xs font-bold uppercase tracking-wider ${
                    locationLoading ? 'text-blue-700' : locationError ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {locationLoading ? 'Locating...' : locationError ? 'GPS Error' : 'GPS Signal'}
                  </Text>
                  <Text className={`text-xs mt-0.5 ${
                    locationLoading ? 'text-blue-600' : locationError ? 'text-amber-600' : 'text-emerald-800'
                  }`}>
                    {locationLoading
                      ? 'Acquiring GPS location...'
                      : locationError
                        ? locationError
                        : `Location: ${latitude?.toFixed(5)}, ${longitude?.toFixed(5)} ${accuracy ? `(±${Math.round(accuracy)}m)` : ''}`}
                  </Text>
                </View>
              </View>

              {!locationLoading && (
                <TouchableOpacity
                  onPress={requestLocation}
                  className="bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg px-2.5 py-1.5"
                >
                  <Text className="text-gray-700 text-[10px] font-bold uppercase">Retry</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* GPS Override Block */}
            {(locationError || (latitude === null && !locationLoading)) && (
              <View className="border border-amber-200 bg-amber-50 rounded-xl p-4 gap-3">
                <TouchableOpacity
                  onPress={() => setGpsErrorOverride(!gpsErrorOverride)}
                  className="flex-row items-center gap-2"
                >
                  <Ionicons
                    name={gpsErrorOverride ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={gpsErrorOverride ? '#d97706' : '#4b5563'}
                  />
                  <Text className="text-sm font-bold text-amber-900">GPS Error - Override Requirement</Text>
                </TouchableOpacity>
                
                {gpsErrorOverride && (
                  <View className="gap-1">
                    <Text className="text-xs font-semibold text-amber-800">Reason for override (Mandatory)</Text>
                    <TextInput
                      value={gpsErrorReason}
                      onChangeText={setGpsErrorReason}
                      placeholder="e.g. Device GPS broken, inside a basement, etc."
                      placeholderTextColor="#92400e"
                      className="border border-amber-300 bg-white rounded-lg px-3 py-2 text-sm text-amber-900"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Selfie Block (Visible when present/half day) */}
            {!['absent', 'leave'].includes(attendanceStatus) && (
              <View className="gap-2">
                <Text className="text-sm font-bold text-gray-800">Selfie (Required)*</Text>
                {selfie ? (
                  <View className="relative w-full h-64 border border-gray-200 rounded-xl overflow-hidden bg-black">
                    <Image source={{ uri: selfie.uri }} className="w-full h-full" resizeMode="contain" />
                    <TouchableOpacity
                      onPress={() => setSelfie(null)}
                      className="absolute top-3 right-3 bg-red-500/80 active:bg-red-600 p-2 rounded-full shadow"
                    >
                      <Ionicons name="trash-outline" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickPhoto}
                    className="w-full h-44 border-2 border-dashed border-gray-300 bg-white rounded-xl items-center justify-center p-4 active:bg-gray-50"
                  >
                    <View className="w-12 h-12 bg-orange-50 rounded-full items-center justify-center border border-orange-100 mb-2">
                      <Ionicons name="camera-outline" size={24} color="#f97316" />
                    </View>
                    <Text className="text-sm font-bold text-gray-700">Capture Verification Selfie</Text>
                    <Text className="text-xs text-gray-400 mt-1">Open camera to take today's selfie</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Attendance Status Selector */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-800">Attendance Status</Text>
              <TouchableOpacity
                onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                className="border border-gray-200 bg-white rounded-xl px-4 py-3 flex-row justify-between items-center"
              >
                <Text className="text-sm text-gray-800 font-semibold">
                  {attendanceOptions.find((o) => o.value === attendanceStatus)?.label}
                </Text>
                <Ionicons name={showStatusDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#6b7280" />
              </TouchableOpacity>

              {showStatusDropdown && (
                <View className="border border-gray-200 bg-white rounded-xl overflow-hidden mt-1 shadow-sm">
                  {attendanceOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        setAttendanceStatus(option.value);
                        setShowStatusDropdown(false);
                      }}
                      className={`px-4 py-3 border-b border-gray-100 flex-row justify-between items-center ${
                        attendanceStatus === option.value ? 'bg-orange-50' : 'active:bg-gray-50'
                      }`}
                    >
                      <Text className={`text-sm ${attendanceStatus === option.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                        {option.label}
                      </Text>
                      {attendanceStatus === option.value && (
                        <Ionicons name="checkmark" size={16} color="#ea580c" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Working Type Selector */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-800">Working Type</Text>
              <TouchableOpacity
                onPress={() => setShowWorkingTypeDropdown(!showWorkingTypeDropdown)}
                className="border border-gray-200 bg-white rounded-xl px-4 py-3 flex-row justify-between items-center"
              >
                <Text className="text-sm text-gray-800 font-semibold">
                  {workingTypeOptions.find((o) => o.value === workingType)?.label}
                </Text>
                <Ionicons name={showWorkingTypeDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#6b7280" />
              </TouchableOpacity>

              {showWorkingTypeDropdown && (
                <View className="border border-gray-200 bg-white rounded-xl overflow-hidden mt-1 shadow-sm">
                  {workingTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        setWorkingType(option.value);
                        setShowWorkingTypeDropdown(false);
                      }}
                      className={`px-4 py-3 border-b border-gray-100 flex-row justify-between items-center ${
                        workingType === option.value ? 'bg-orange-50' : 'active:bg-gray-50'
                      }`}
                    >
                      <Text className={`text-sm ${workingType === option.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                        {option.label}
                      </Text>
                      {workingType === option.value && (
                        <Ionicons name="checkmark" size={16} color="#ea580c" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Town Input */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-800">Town (Required)*</Text>
              <TextInput
                value={town}
                onChangeText={setTown}
                placeholder="Enter town name"
                placeholderTextColor="#9ca3af"
                className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 font-medium"
              />
            </View>

            {/* Remark Input */}
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold text-gray-800">Remark (Optional)</Text>
                <Text className="text-xs text-gray-400">{remark.length}/500</Text>
              </View>
              <TextInput
                value={remark}
                onChangeText={(text) => setRemark(text.slice(0, 500))}
                placeholder="Add any note for today's attendance"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
                className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 min-h-[80px]"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              disabled={submitting}
              onPress={handleSubmit}
              className={`w-full py-4 rounded-xl flex-row justify-center items-center gap-2 mt-4 bg-orange-500 active:bg-orange-600`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
              )}
              <Text className="text-white font-bold text-base">
                {submitting ? 'Marking attendance...' : 'Mark Attendance'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
