import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated && user) {
          router.replace('/dashboard');
        } else {
          router.replace('/(auth)/login');
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, user, router]);


  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );
}
