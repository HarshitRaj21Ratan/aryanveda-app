import { create } from 'zustand';
import type { IUser } from '@/types';
import { resolveUserRole } from '@/lib/role-utils';

type AuthUser = Pick<IUser, 'entityId' | 'name' | 'email' | 'role' | 'parentId' | 'isActive' | 'phone' | 'state' | 'beat'>;

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user) =>
    set({
      user: user
        ? {
            ...user,
            role: resolveUserRole(user.role, user.entityId) ?? user.role,
          }
        : null,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setToken: (token) => set({ token }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: () =>
    set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
}));
