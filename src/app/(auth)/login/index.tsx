import { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

const appStorage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error('Local storage set error:', e);
      }
    } else {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(key, value);
      } catch {
        // Fallback
      }
    }
  },
};

const loginSchema = z.object({
  mobile: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [deactivated, setDeactivated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (params?.reason === 'deactivated') {
      setDeactivated(true);
    }
  }, [params]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mobile: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const res = await authService.login(values.mobile, values.password);
      const role = res.data?.user?.role;
      const rolesRequiringLocation = ['SO', 'ASM', 'RSM', 'NSM', 'DISTRIBUTOR', 'MERCHANDISER'];
      if (role && rolesRequiringLocation.includes(role)) {
        try {
          if (Platform.OS === 'web') {
            const geoAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator;
            if (geoAvailable) {
              await new Promise<void>((resolve) => {
                navigator.geolocation.getCurrentPosition(
                  () => resolve(),
                  () => resolve(),
                  { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
                );
              });
            }
          } else {
            if (navigator?.geolocation) {
              await new Promise<void>((resolve) => {
                navigator.geolocation.getCurrentPosition(
                  () => resolve(),
                  () => resolve(),
                  { timeout: 15000, enableHighAccuracy: true }
                );
              });
            }
          }
        } catch {
          // Location check failed
        }
      }

      if (res.data.token) {
        await appStorage.setItem('auth_token', res.data.token);
        await appStorage.setItem('auth_login_time', Date.now().toString());
        setToken(res.data.token);
      }
      setUser(res.data.user);
      router.push('/');
    } catch (err: unknown) {
      const rawMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed. Please try again.';
      const message = /invalid email or password/i.test(rawMessage)
        ? 'Invalid mobile number or password'
        : rawMessage;
      setServerError(message);
    }
  }

  if (isLoading || user) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
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
            <View>
              <Text className="text-lg font-bold text-gray-800">
                Nimson <Text className="text-orange-500">DMS</Text>
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Sign in to your account
              </Text>
            </View>
          </View>

          {/* Account-deactivated notice */}
          {deactivated && (
            <View className="flex-row bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <Ionicons name="warning-outline" size={18} color="#b45309" className="mr-2 mt-0.5" />
              <Text className="flex-1 text-xs text-amber-700 leading-4">
                Your account has been deactivated by your manager. Please contact your Super Stockist or Distributor to reactivate.
              </Text>
            </View>
          )}

          {/* Server error */}
          {serverError && (
            <View className="flex-row bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" className="mr-2 mt-0.5" />
              <Text className="flex-1 text-xs text-red-700">{serverError}</Text>
            </View>
          )}

          {/* Form */}
          <View className="gap-4">
            {/* Mobile Input */}
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-gray-700">Mobile number</Text>
              <Controller
                control={control}
                name="mobile"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`h-11 border rounded-lg px-3 text-sm bg-gray-50 ${errors.mobile ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    maxLength={10}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.mobile && (
                <Text className="text-xs text-red-500 mt-0.5">{errors.mobile.message}</Text>
              )}
            </View>

            {/* Password Input */}
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-gray-700">Password</Text>
              <View className="relative justify-center">
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={`h-11 border rounded-lg pl-3 pr-10 text-sm bg-gray-50 ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPassword}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
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
              {errors.password && (
                <Text className="text-xs text-red-500 mt-0.5">{errors.password.message}</Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className="h-11 bg-orange-500 rounded-lg justify-center items-center mt-2"
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              style={isSubmitting && { opacity: 0.7 }}
            >
              {isSubmitting ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text className="text-white text-sm font-semibold">Signing in…</Text>
                </View>
              ) : (
                <Text className="text-white text-sm font-semibold">Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              className="items-center mt-2"
            >
              <Text className="text-sm font-medium text-orange-500">
                Forgot your password?
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
