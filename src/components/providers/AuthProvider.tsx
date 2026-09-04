import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';

const SESSION_KEY = 'auth_token';
const LOGIN_TIME_KEY = 'auth_login_time';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let active = true;

    const hydrateAuth = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(SESSION_KEY);
        const loginTime = await AsyncStorage.getItem(LOGIN_TIME_KEY);

        // Enforce 1-day session
        if (savedToken && loginTime && Date.now() - parseInt(loginTime, 10) > ONE_DAY_MS) {
          await AsyncStorage.removeItem(SESSION_KEY);
          await AsyncStorage.removeItem(LOGIN_TIME_KEY);
          if (active) {
            setUser(null);
          }
          return;
        }

        if (!savedToken) {
          if (active) {
            setUser(null);
          }
          return;
        }

        if (active) {
          setToken(savedToken);
          setLoading(true);
        }

        const res = await authService.me();
        if (active) {
          setUser(res.data.user);
        }
      } catch (err) {
        if (!active) return;
        // Token is invalid or expired
        if (!useAuthStore.getState().user) {
          await AsyncStorage.removeItem(SESSION_KEY);
          await AsyncStorage.removeItem(LOGIN_TIME_KEY);
          setToken(null);
          setUser(null);
        } else {
          setLoading(false);
        }
      }
    };

    hydrateAuth();

    return () => {
      active = false;
    };
  }, [setUser, setToken, setLoading]);

  return <>{children}</>;
}
