import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';
import { attendanceService } from '@/services/attendance.service';
import type { ITodayAttendanceStatus } from '@/services/attendance.service';
import AttendanceGateModal from '../attendance/AttendanceGateModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

const ATTENDANCE_GATED_ROLES = new Set(['so', 'ase', 'asm', 'rsm']);
const { width } = Dimensions.get('window');

function getRoleDisplayName(role: string): string {
  switch (role?.toLowerCase()) {
    case 'admin': return 'Admin';
    case 'finance': return 'Finance';
    case 'dispatch': return 'Dispatch';
    case 'nsm': return 'National Sales Manager';
    case 'rsm': return 'Regional Sales Manager';
    case 'asm': return 'Area Sales Manager';
    case 'super_stockist': return 'Super Stockist';
    case 'distributor': return 'Distributor';
    case 'so': return 'Sales Officer';
    case 'ase': return 'Area Sales Executive';
    case 'retailer': return 'Retailer';
    default: return String(role || '');
  }
}

// ── Deactivated Account Screen ──
function DeactivatedScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-gray-50 p-6 text-center">
      <View className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mb-6">
        <Ionicons name="shield-outline" size={32} color="#dc2626" />
      </View>
      <Text className="text-xl font-bold text-gray-900">Account Deactivated</Text>
      <Text className="mt-2 text-center text-sm text-gray-500 max-w-xs leading-5">
        Your account has been deactivated by an administrator. Please contact your manager or the support team to restore access.
      </Text>
      {user && (
        <Text className="mt-4 rounded-lg bg-gray-200 px-4 py-2 font-mono text-xs text-gray-600">
          {user.name} · {getRoleDisplayName(user.role)}
        </Text>
      )}

      <View className="flex-row gap-3 mt-8">
        <TouchableOpacity
          onPress={() => router.push('/notifications' as any)}
          className="flex-row items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2"
        >
          <Ionicons name="notifications-outline" size={16} color="#4b5563" />
          <Text className="text-sm font-semibold text-gray-700">Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            try {
              await AsyncStorage.removeItem('auth_token');
              await AsyncStorage.removeItem('auth_login_time');
            } catch { }
            logout();
            router.replace('/(auth)/login' as any);
          }}
          className="flex-row items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2"
        >
          <Ionicons name="log-out-outline" size={16} color="white" />
          <Text className="text-sm font-semibold text-white">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Email Prompt Modal ──
function EmailPromptModal({
  open,
  onClose,
  forceChoice,
}: {
  open: boolean;
  onClose: () => void;
  forceChoice: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? '');
      setError(null);
    }
  }, [open, user?.email]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const trimmed = email.trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError('Please enter a valid email address');
        return;
      }
      const res = await authService.saveEmailPreference(trimmed || undefined);
      setUser(res.data.user);
      onClose();
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message;
      setError(message ?? 'Failed to save email preference');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!forceChoice) {
      onClose();
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await authService.saveEmailPreference(undefined);
      if (res?.data?.user) {
        setUser(res.data.user);
      } else if (user) {
        setUser({ ...user, hasSeenEmailPrompt: true });
      }
      onClose();
    } catch {
      if (user) {
        setUser({ ...user, hasSeenEmailPrompt: true });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent={true}>
      <View className="flex-1 bg-black/60 justify-end sm:justify-center p-0 sm:p-6">
        <View className="bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl w-full max-w-md mx-auto">
          <Text className="text-lg font-bold text-gray-900">Add email for notifications</Text>
          <Text className="mt-2 text-sm text-gray-500 leading-5">
            Share your email to receive important notifications. You can skip now and add it later from the top bar icon.
          </Text>

          {error && (
            <View className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <Text className="text-sm text-red-700 font-medium">{error}</Text>
            </View>
          )}

          <View className="mt-4 gap-1.5">
            <Text className="text-xs font-semibold text-gray-500">Email (Optional)</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800"
            />
          </View>

          <View className="mt-6 flex-row gap-3 justify-end">
            <TouchableOpacity
              onPress={handleSkip}
              disabled={saving}
              className="border border-gray-200 bg-white rounded-lg px-4 py-2.5 active:bg-gray-50"
            >
              <Text className="text-xs font-bold text-gray-600">
                {forceChoice ? 'Continue without email' : 'Close'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="bg-orange-500 rounded-lg px-4 py-2.5 active:bg-orange-600 flex-row items-center gap-1.5"
            >
              {saving && <ActivityIndicator size="small" color="white" />}
              <Text className="text-xs font-bold text-white">Save & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main AppLayout Component ──
export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<ITodayAttendanceStatus | null>(null);

  const isAuthRoute = pathname?.includes('login') || pathname?.includes('forgot-password');

  useEffect(() => {
    if (!isLoading && !user && !isAuthRoute) {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login' as any);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, router, isAuthRoute]);


  const toggleDrawer = useCallback(() => setMobileDrawerOpen((v) => !v), []);

  const userRole = user?.role ?? '';
  const attendanceRequiredRole = ATTENDANCE_GATED_ROLES.has(userRole.toLowerCase());

  const refreshAttendanceStatus = useCallback(async () => {
    if (!user || !attendanceRequiredRole) {
      setAttendanceStatus(null);
      return;
    }

    try {
      const result = await attendanceService.getTodayStatus();
      setAttendanceStatus(result);
    } catch {
      setAttendanceStatus(null);
    }
  }, [user, attendanceRequiredRole]);

  const handleSignOut = useCallback(() => {
    logout();
    router.replace('/(auth)/login' as any);
  }, [logout, router]);

  useEffect(() => {
    if (user && !(user as any).hasSeenEmailPrompt && user.role?.toLowerCase() !== 'retailer') {
      setEmailPromptOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (isLoading || !user || user.isActive === false) return;
    void refreshAttendanceStatus();
  }, [isLoading, user, refreshAttendanceStatus]);

  const attendanceModalOpen = Boolean(
    attendanceRequiredRole &&
    (attendanceStatus as any)?.applicable &&
    (attendanceStatus as any)?.mustMark
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (user && user.isActive === false && !isAuthRoute) {
    return <DeactivatedScreen />;
  }



  return (
    <View className="flex-1 bg-gray-50">

      {!isAuthRoute && user && (
        <>
          {/* Sidebar Drawer Navigation Modal Overlay */}
          <Modal
            visible={mobileDrawerOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setMobileDrawerOpen(false)}
          >
            <View className="flex-1 flex-row">
              <Sidebar collapsed={false} onClose={() => setMobileDrawerOpen(false)} />
              <TouchableOpacity
                style={{ width: width * 0.22 }}
                className="h-full bg-black/50"
                activeOpacity={1}
                onPress={() => setMobileDrawerOpen(false)}
              />
            </View>
          </Modal>

          {/* Top navbar */}
          <SafeAreaView edges={['top']} className="bg-white">
            <TopNavbar
              onOpenEmailPrompt={() => setEmailPromptOpen(true)}
              onMenuPress={() => setMobileDrawerOpen(true)}
            />
          </SafeAreaView>
        </>
      )}

      {/* Content wrapper - structure stays exact same for auth & non-auth */}
      <View className="flex-1">
        {children}
      </View>

      {!isAuthRoute && user && (
        <>
          <EmailPromptModal
            open={emailPromptOpen && !attendanceModalOpen}
            onClose={() => setEmailPromptOpen(false)}
            forceChoice={Boolean(user && !(user as any).hasSeenEmailPrompt)}
          />

          <AttendanceGateModal
            open={attendanceModalOpen}
            status={attendanceStatus}
            roleLabel={getRoleDisplayName(user.role)}
            onMarked={refreshAttendanceStatus}
            onSignOut={handleSignOut}
          />
        </>
      )}
    </View>
  );
}


