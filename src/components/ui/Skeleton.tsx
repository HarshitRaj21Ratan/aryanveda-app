import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface SkeletonProps {
  className?: string;
  style?: any;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ opacity }, style]}
      className={`rounded-md bg-gray-200 ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <View className="w-full border border-gray-150 rounded-xl overflow-hidden bg-white">
      {/* Head */}
      <View className="bg-gray-50 px-4 py-3 flex-row justify-between border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </View>
      {/* Body */}
      <View className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <View key={rowIndex} className="px-4 py-3.5 flex-row justify-between">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 w-12" />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="rounded-xl border border-gray-250 p-4 bg-white shadow-sm">
          <Skeleton className="mb-2.5 h-5 w-3/4" />
          <Skeleton className="mb-2 h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </View>
      ))}
    </View>
  );
}

export function StatsCardSkeleton() {
  return (
    <View className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
      <Skeleton className="mb-2 h-4 w-16" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-2 h-3.5 w-20" />
    </View>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <View className="gap-4 w-full">
      {Array.from({ length: fields }).map((_, i) => (
        <View key={i} className="gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <View className="gap-2.5 w-full">
      {Array.from({ length: items }).map((_, i) => (
        <View
          key={i}
          className="flex-row items-center gap-3 rounded-xl border border-gray-150 p-3 bg-white shadow-sm"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-1/4" />
          </View>
        </View>
      ))}
    </View>
  );
}
