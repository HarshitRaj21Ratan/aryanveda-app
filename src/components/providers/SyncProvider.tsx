import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

const SyncContext = createContext<SyncContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
});

export const useSync = () => useContext(SyncContext);

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  // Safe default connection indicators for React Native (can integrate NetInfo later)
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing }}>
      {children}

      {/* Floating Network Status Badge for Mobile */}
      {!isOnline && (
        <View className="absolute bottom-4 right-4 z-50 flex-row items-center gap-2 rounded-xl border border-amber-250 bg-amber-50 px-4 py-2.5 shadow-lg">
          <Ionicons name="wifi-outline" size={14} color="#d97706" />
          <Text className="text-xs font-bold text-amber-800">
            {pendingCount > 0
              ? `Offline | ${pendingCount} pending upload${pendingCount !== 1 ? 's' : ''}`
              : 'Offline | Working locally'}
          </Text>
        </View>
      )}
    </SyncContext.Provider>
  );
}
