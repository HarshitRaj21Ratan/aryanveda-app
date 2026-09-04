import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/store/auth.store';
import { userService } from '@/services/user.service';
import { orderService } from '@/services/order.service';

interface SearchResult {
  type: 'user' | 'order';
  id: string;
  label: string;
  subLabel: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const searchData = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      const newResults: SearchResult[] = [];

      try {
        const [usersRes, ordersRes] = await Promise.all([
          userService.listManagement({ search: query, limit: 5 }),
          orderService.list({ search: query, limit: 5 }).catch(() => null),
        ]);

        if (usersRes?.data) {
          usersRes.data.forEach((u: any) => {
            newResults.push({
              type: 'user',
              id: u.entityId,
              label: u.name,
              subLabel: `${u.role.replace(/_/g, ' ')} • ${u.email}`,
            });
          });
        }

        if (ordersRes?.data) {
          ordersRes.data.forEach((o: any) => {
            newResults.push({
              type: 'order',
              id: o.orderId,
              label: o.orderId,
              subLabel: `₹${o.totalAmount.toLocaleString('en-IN')} • ${o.status}`,
            });
          });
        }
      } catch {
        // ignore errors
      }

      setResults(newResults);
      setIsLoading(false);
    };

    const timer = setTimeout(searchData, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    if (result.type === 'user') {
      router.push('/users' as any);
    } else if (result.type === 'order') {
      router.push(`/admin/performance` as any); // fallback target for orders detail or panel
    }
  };

  return (
    <View className="relative w-full">
      <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
        <Ionicons name="search-outline" size={18} color="#9ca3af" className="mr-2" />
        <TextInput
          placeholder="Search users, orders..."
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="flex-1 text-sm text-gray-800 p-0 h-8"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setResults([]);
            }}
            className="p-1"
          >
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {isOpen && query.length >= 2 && (
        <View className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden max-h-56">
          {isLoading ? (
            <View className="flex-row items-center justify-center gap-2 px-4 py-4">
              <ActivityIndicator size="small" color="#f97316" />
              <Text className="text-xs text-gray-500 font-semibold">Searching...</Text>
            </View>
          ) : results.length === 0 ? (
            <View className="px-4 py-4">
              <Text className="text-xs text-gray-400 font-semibold text-center">No results found</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  className="px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                >
                  <Text className="text-sm font-bold text-gray-800">{item.label}</Text>
                  <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">{item.subLabel}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}
