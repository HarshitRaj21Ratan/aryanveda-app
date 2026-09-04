import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

type Step = 'email' | 'otp' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const logoutStore = useAuthStore((s) => s.logout);

  const [step, setStep] = useState<Step>('email');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    logoutStore();
    void authService.logout();
  }, [logoutStore]);

  async function goToLogin() {
    logoutStore();
    await authService.logout();
    router.replace('/(auth)/login');
  }

  async function handleSendOtp() {
    setError('');
    const normalized = mobile.replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalized)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      await authService.sendOtp(normalized);
      setStep('otp');
      startResendCooldown();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError('');
    if (!otp.trim()) {
      setError('OTP is required');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(mobile.replace(/\D/g, ''), otp.trim(), newPassword);
      setStep('success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) {
          clearInterval(interval);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      await authService.sendOtp(mobile.replace(/\D/g, ''));
      startResendCooldown();
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}
        keyboardShouldPersistTaps="handled"
        className="bg-white"
      >
        <View className="w-full max-w-[400px] rounded-xl p-6 bg-white shadow-sm border border-gray-100">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <View className="w-9 h-9 rounded-lg bg-orange-500 items-center justify-center">
              <Text className="text-white text-base font-bold">N</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">
                Nimson <Text className="text-orange-500">DMS</Text>
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {step === 'email' && 'Reset your password'}
                {step === 'otp' && 'Enter OTP sent to your phone'}
                {step === 'success' && 'Password changed successfully'}
              </Text>
            </View>
          </View>

          {error ? (
            <View className="flex-row bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" className="mr-2 mt-0.5" />
              <Text className="flex-1 text-xs text-red-700">{error}</Text>
            </View>
          ) : null}

          {/* Step content */}
          {step === 'success' && (
            <View className="gap-4">
              <Ionicons name="checkmark-circle" size={48} color="#10b981" className="self-center mb-4" />
              <Text className="text-sm text-center text-gray-600 leading-5 mb-2">
                Your password has been updated. You can now sign in with your new password.
              </Text>
              <TouchableOpacity className="h-11 bg-orange-500 rounded-lg justify-center items-center" onPress={goToLogin}>
                <Text className="text-white text-sm font-semibold">Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'email' && (
            <View className="gap-4">
              <Text className="text-sm text-gray-600 leading-5">
                Enter the mobile number linked to your account and we'll send a one-time code to your registered channels.
              </Text>

              <View className="gap-1.5">
                <Text className="text-sm font-semibold text-gray-700">Mobile number</Text>
                <TextInput
                  className="h-11 border border-gray-200 rounded-lg px-3 text-sm bg-gray-50"
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobile}
                  onChangeText={(val) => setMobile(val.replace(/\D/g, ''))}
                />
              </View>

              <TouchableOpacity className="h-11 bg-orange-500 rounded-lg justify-center items-center mt-2" onPress={handleSendOtp} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white text-sm font-semibold">Send OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={goToLogin} className="flex-row items-center justify-center gap-1 mt-4">
                <Ionicons name="arrow-back-outline" size={16} color="#f97316" />
                <Text className="text-sm font-medium text-orange-500">Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'otp' && (
            <View className="gap-4">
              <Text className="text-sm text-gray-600 leading-5">
                A 6-digit code was sent to your registered channels for mobile {mobile}.
              </Text>

              <View className="gap-1.5">
                <Text className="text-sm font-semibold text-gray-700">One-time OTP</Text>
                <TextInput
                  className="h-11 border border-gray-200 rounded-lg px-3 text-center text-base tracking-widest bg-gray-50"
                  placeholder="123456"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(val) => setOtp(val.replace(/\D/g, ''))}
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-semibold text-gray-700">New Password</Text>
                <View className="relative justify-center">
                  <TextInput
                    className="h-11 border border-gray-200 rounded-lg pl-3 pr-10 text-sm bg-gray-50"
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity
                    className="absolute right-3 p-1"
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-semibold text-gray-700">Confirm New Password</Text>
                <TextInput
                  className="h-11 border border-gray-200 rounded-lg px-3 text-sm bg-gray-50"
                  placeholder="Repeat password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <TouchableOpacity className="h-11 bg-orange-500 rounded-lg justify-center items-center mt-2" onPress={handleResetPassword} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white text-sm font-semibold">Set New Password</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-between mt-4">
                <TouchableOpacity onPress={() => { setStep('email'); setError(''); setOtp(''); }}>
                  <Text className="text-sm font-medium text-orange-500">Change mobile</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0 || loading}>
                  <Text className={`text-sm font-medium text-orange-500 ${resendCooldown > 0 ? 'opacity-50' : ''}`}>
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
