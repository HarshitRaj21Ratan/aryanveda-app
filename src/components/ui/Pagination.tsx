import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

function buildPageList(currentPage: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = currentPage - 1; p <= currentPage + 1; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const output: Array<number | '...'> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && prev !== undefined && page - prev > 1) {
      output.push('...');
    }
    output.push(page);
  }
  return output;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  const safePage = Math.max(1, currentPage);
  const safeTotalPages = Math.max(1, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const end = Math.min(totalItems, safePage * itemsPerPage);

  const pages = useMemo(() => buildPageList(safePage, safeTotalPages), [safePage, safeTotalPages]);

  if (safeTotalPages <= 1) return null;

  return (
    <View className="mt-4 flex-col gap-3 py-3 border-t border-gray-100 bg-white items-center">
      <Text className="text-xs text-gray-500 font-semibold">
        Showing {start}-{end} of {totalItems} results
      </Text>

      <View className="flex-row items-center gap-1.5">
        <TouchableOpacity
          onPress={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className={`p-2 border rounded-lg ${
            safePage <= 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white active:bg-gray-50'
          }`}
        >
          <Ionicons name="chevron-back" size={14} color="#374151" />
        </TouchableOpacity>

        {pages.map((item, idx) =>
          item === '...' ? (
            <Text key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400 font-bold">...</Text>
          ) : (
            <TouchableOpacity
              key={item}
              onPress={() => onPageChange(item)}
              className={`w-8 h-8 rounded-lg items-center justify-center border ${
                item === safePage
                  ? 'bg-orange-500 border-orange-500'
                  : 'border-gray-200 bg-white active:bg-gray-50'
              }`}
            >
              <Text className={`text-xs font-bold ${item === safePage ? 'text-white' : 'text-gray-700'}`}>
                {item}
              </Text>
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity
          onPress={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className={`p-2 border rounded-lg ${
            safePage >= safeTotalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white active:bg-gray-50'
          }`}
        >
          <Ionicons name="chevron-forward" size={14} color="#374151" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
