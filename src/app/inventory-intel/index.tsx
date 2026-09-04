import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { inventoryIntelService, type InventoryIntelImportRow } from '@/services/inventoryIntel.service';
import { userService } from '@/services/user.service';
import { catalogService } from '@/services/catalog.service';
import { downloadXlsxReport } from '@/lib/xlsx-export';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import type { InventoryWithLowStock, SkuAnalyticsRow } from '@/services/inventory.service';

type IntelTab = 'stock' | 'analytics' | 'alerts';
type LedgerEntry = {
  skuId: string;
  quantityChange: number;
  timestamp: string;
};

function formatCurrency(num: number): string {
  if (typeof num !== 'number') return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadgeBg(status: 'OK' | 'LOW' | 'CRITICAL'): string {
  if (status === 'CRITICAL') return 'bg-red-50 border-red-200';
  if (status === 'LOW') return 'bg-amber-50 border-amber-200';
  return 'bg-emerald-50 border-emerald-200';
}

function statusBadgeText(status: 'OK' | 'LOW' | 'CRITICAL'): string {
  if (status === 'CRITICAL') return 'text-red-700';
  if (status === 'LOW') return 'text-amber-700';
  return 'text-emerald-700';
}

function getStockStatus(item: InventoryWithLowStock): 'OK' | 'LOW' | 'CRITICAL' {
  if (item.quantity <= 0) return 'CRITICAL';
  if (item.quantity <= Math.max(1, Math.floor(item.lowStockThreshold / 2))) return 'CRITICAL';
  if (item.quantity <= item.lowStockThreshold) return 'LOW';
  return 'OK';
}

function daysSince(dateInput?: string | Date | null): number {
  if (!dateInput) return 9999;
  const date = new Date(dateInput);
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function aggregateDailyMovement(ledger: LedgerEntry[], startAt: Date, endAt: Date) {
  const dayMap = new Map<string, number>();
  const cursor = new Date(startAt);
  while (cursor <= endAt) {
    const key = cursor.toISOString().slice(0, 10);
    dayMap.set(key, 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of ledger) {
    const ts = new Date(row.timestamp);
    if (ts < startAt || ts > endAt) continue;
    const key = ts.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + Math.abs(Number(row.quantityChange ?? 0)));
  }

  return Array.from(dayMap.entries()).map(([day, value]) => ({ day, value }));
}

export default function InventoryIntelScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // App States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchHeaderQuery, setSearchHeaderQuery] = useState('');
  const [tab, setTab] = useState<IntelTab>('stock');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEntityId, setSelectedEntityId] = useState('');

  // Modals
  const [showSubordinateModal, setShowSubordinateModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState<{ entityId: string; skuId: string; skuName?: string } | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [thresholdModal, setThresholdModal] = useState<{ entityId: string; skuId: string; current: number; skuName?: string } | null>(null);
  const [newThreshold, setNewThreshold] = useState('');

  // Date range state
  const [rangePreset, setRangePreset] = useState<'7' | '30' | '90'>('30');
  const [subordinateSearchQuery, setSubordinateSearchQuery] = useState('');

  const [limit, setLimit] = useState(20);
  const entityId = user?.entityId ?? '';
  const role = user?.role as UserRole | undefined;

  const isManager = role === UserRole.ASM || role === UserRole.RSM;
  const isSO = role === UserRole.SO || role === UserRole.ASE;
  const isDistributor = role === UserRole.DISTRIBUTOR;

  const canAdjustStock = role === UserRole.SUPER_STOCKIST || role === UserRole.DISTRIBUTOR || isManager || isSO;
  const canEditThreshold = role === UserRole.SUPER_STOCKIST || role === UserRole.DISTRIBUTOR || role === UserRole.RETAILER || isManager || isSO;

  const activeEntityId = (isDistributor || isManager || isSO) ? (selectedEntityId || entityId) : entityId;
  const hasSelectedTarget = (isManager || isSO) ? !!selectedEntityId : true;
  const isQueryEnabled = !!activeEntityId && !!user && hasSelectedTarget;

  // Subordinate Data Queries
  const { data: retailersData } = useQuery({
    queryKey: ['inventory-intel-sub-retailers', entityId],
    queryFn: () => userService.listRetailers({ limit: 500 }),
    enabled: !!entityId && isDistributor,
  });

  const { data: superStockistsData } = useQuery({
    queryKey: ['inventory-intel-sub-super-stockists', entityId],
    queryFn: () => userService.listByRole(UserRole.SUPER_STOCKIST),
    enabled: !!entityId && isManager,
  });

  const { data: distributorsData } = useQuery({
    queryKey: ['inventory-intel-sub-distributors', entityId],
    queryFn: () => userService.listByRole(UserRole.DISTRIBUTOR),
    enabled: !!entityId && isSO,
  });

  // Intel Dashboard Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['inventory-intel-summary-data', activeEntityId],
    queryFn: () => inventoryIntelService.getInventoryIntelSummary(activeEntityId),
    enabled: isQueryEnabled,
  });

  const { data: stockData, isLoading: stockLoading, isError: stockError, error: stockQueryError, refetch } = useQuery({
    queryKey: ['inventory-intel-stock-data', activeEntityId, page, limit, search],
    queryFn: () =>
      inventoryIntelService.getStockOverview(activeEntityId, {
        page,
        limit,
        search: search || undefined,
      }),
    enabled: isQueryEnabled,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['inventory-intel-analytics-data', activeEntityId],
    queryFn: () => inventoryIntelService.getAnalytics({ entityId: activeEntityId, page: 1, limit: 100 }),
    enabled: isQueryEnabled,
  });

  const { data: ledgerData } = useQuery({
    queryKey: ['inventory-intel-ledger-data', activeEntityId],
    queryFn: () => inventoryIntelService.getLedger(activeEntityId, { limit: 1000, skip: 0 }),
    enabled: isQueryEnabled,
  });

  const analyticsRows: SkuAnalyticsRow[] = useMemo(() => analyticsData?.data?.skus ?? [], [analyticsData]);
  const ledgerRows: LedgerEntry[] = useMemo(() => (ledgerData?.data ?? []) as LedgerEntry[], [ledgerData]);

  // Fallback stock implementation when backend stock database doesn't exist yet but analytics are loaded
  const fallbackStock = useMemo(() => {
    let rows = analyticsRows.map<InventoryWithLowStock>((row) => ({
      _id: `${activeEntityId}-${row.masterSkuId}`,
      entityId: activeEntityId,
      skuId: row.masterSkuId,
      skuName: row.name,
      skuWeight: row.weight,
      quantity: row.quantityAvailable,
      lowStockThreshold: row.displayRequiredQty,
      isLowStock: row.lowStockFlag,
      refillCount: 0,
      lastRefillDate: null,
      lastRefillQuantity: 0,
      quantityAtLastRefill: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.skuId.toLowerCase().includes(q) ||
          (r.skuName && r.skuName.toLowerCase().includes(q))
      );
    }

    const start = (page - 1) * limit;
    return {
      total: rows.length,
      data: rows.slice(start, start + limit),
    };
  }, [analyticsRows, activeEntityId, page, limit, search]);

  const shouldUseStockFallback = (stockData?.total ?? 0) === 0 && fallbackStock.total > 0;
  const stockItems = shouldUseStockFallback ? fallbackStock.data : (stockData?.data ?? []);
  const stockTotal = shouldUseStockFallback ? fallbackStock.total : (stockData?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(stockTotal / limit));

  // Analytics tab calculations
  const principalBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of analyticsRows) {
      const key = row.principal || 'Uncategorized';
      map.set(key, (map.get(key) ?? 0) + row.totalValue);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [analyticsRows]);

  const topMoving = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    if (rangePreset === '7') from.setDate(from.getDate() - 7);
    else if (rangePreset === '30') from.setDate(from.getDate() - 30);
    else if (rangePreset === '90') from.setDate(from.getDate() - 90);

    const bySku = new Map<string, number>();
    for (const row of ledgerRows) {
      const ts = new Date(row.timestamp);
      if (ts < from || ts > now) continue;
      bySku.set(row.skuId, (bySku.get(row.skuId) ?? 0) + Math.abs(Number(row.quantityChange ?? 0)));
    }

    const nameMap = new Map(analyticsRows.map((r) => [r.masterSkuId, r.name]));
    return Array.from(bySku.entries())
      .map(([skuId, movement]) => ({ skuId, movement, name: nameMap.get(skuId) ?? skuId }))
      .sort((a, b) => b.movement - a.movement)
      .slice(0, 5);
  }, [ledgerRows, rangePreset, analyticsRows]);

  const lineSeries = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    if (rangePreset === '7') from.setDate(from.getDate() - 7);
    else if (rangePreset === '30') from.setDate(from.getDate() - 30);
    else if (rangePreset === '90') from.setDate(from.getDate() - 90);

    return aggregateDailyMovement(ledgerRows, from, now);
  }, [ledgerRows, rangePreset]);

  // Alerts calculations
  const slowMovingAlerts = useMemo(() => {
    const list = shouldUseStockFallback ? fallbackStock.data : (stockData?.data ?? []);
    return list
      .map((item) => {
        const last = item.lastRefillDate || item.updatedAt;
        const name = analyticsRows.find((x) => x.masterSkuId === item.skuId)?.name || item.skuName || item.skuId;
        return {
          skuId: item.skuId,
          name,
          quantity: item.quantity,
          threshold: item.lowStockThreshold,
          days: daysSince(last),
        };
      })
      .filter((r) => r.quantity > 0 && r.days >= 45)
      .sort((a, b) => b.days - a.days);
  }, [stockData, fallbackStock, shouldUseStockFallback, analyticsRows]);

  const lowStockAlerts = useMemo(() => {
    const list = shouldUseStockFallback ? fallbackStock.data : (stockData?.data ?? []);
    return list
      .filter((item) => item.isLowStock || item.quantity <= item.lowStockThreshold)
      .map((item) => {
        const name = analyticsRows.find((x) => x.masterSkuId === item.skuId)?.name || item.skuName || item.skuId;
        return {
          skuId: item.skuId,
          name,
          quantity: item.quantity,
          threshold: item.lowStockThreshold,
          deficit: Math.max(0, item.lowStockThreshold - item.quantity),
        };
      })
      .sort((a, b) => b.deficit - a.deficit);
  }, [stockData, fallbackStock, shouldUseStockFallback, analyticsRows]);

  // Mutations
  const adjustMutation = useMutation({
    mutationFn: ({ eId, sId, qty }: { eId: string; sId: string; qty: number }) =>
      inventoryIntelService.adjustStock(eId, sId, { quantityChange: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intel-stock-data'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-intel-summary-data'] });
      setAdjustModal(null);
      setAdjustQty('');
      Alert.alert('Success', 'Stock level adjusted successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to adjust stock');
    },
  });

  const thresholdMutation = useMutation({
    mutationFn: ({ eId, sId, threshold }: { eId: string; sId: string; threshold: number }) =>
      inventoryIntelService.updateThreshold(eId, sId, { lowStockThreshold: threshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intel-stock-data'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-intel-summary-data'] });
      setThresholdModal(null);
      setNewThreshold('');
      Alert.alert('Success', 'Alert threshold updated');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update threshold');
    },
  });

  // Action Handlers
  const handleAdjustStockSubmit = () => {
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty === 0) {
      Alert.alert('Error', 'Please enter a valid quantity change');
      return;
    }
    if (!adjustModal) return;
    adjustMutation.mutate({ eId: adjustModal.entityId, sId: adjustModal.skuId, qty });
  };

  const handleThresholdSubmit = () => {
    const threshold = Number(newThreshold);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Error', 'Please enter a valid non-negative threshold');
      return;
    }
    if (!thresholdModal) return;
    thresholdMutation.mutate({ eId: thresholdModal.entityId, sId: thresholdModal.skuId, threshold });
  };

  // Template Download, Stock Upload & Inventory Download Handlers
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isUploadingStock, setIsUploadingStock] = useState(false);
  const [isDownloadingInventory, setIsDownloadingInventory] = useState(false);

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      let activeSkus: any[] = [];
      try {
        const catalogRes = await catalogService.list({ limit: 1000 });
        if (catalogRes?.data && catalogRes.data.length > 0) {
          activeSkus = catalogRes.data;
        }
      } catch (err) {
        console.warn('Catalog list failed for template download:', err);
      }

      if (activeSkus.length === 0) {
        activeSkus = analyticsRows.map((r) => ({
          masterSkuId: r.masterSkuId,
          name: r.name,
          principal: r.principal,
          displayRequiredQty: r.displayRequiredQty || 20,
        }));
      }

      const templateRows = activeSkus.map((sku: any) => ({
        skuId: sku.masterSkuId || sku.skuId,
        skuName: sku.name || sku.skuName || '',
        category: sku.principal || sku.category || 'General',
        currentStock: '',
        lowStockThreshold: sku.displayRequiredQty || 20,
      }));

      await downloadXlsxReport(templateRows, {
        fileName: 'inventory-intel-template.xlsx',
        sheetName: 'Inventory Intel Template',
      });
    } catch (err: any) {
      console.error('Failed to download inventory template:', err);
      Alert.alert('Error', err.message || 'Failed to generate inventory template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleUploadStock = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      setIsUploadingStock(true);

      const base64Str = await FileSystem.readAsStringAsync(fileAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const workbook = XLSX.read(base64Str, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Uploaded file has no worksheets');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<Array<unknown>>(worksheet, {
        header: 1,
        blankrows: false,
        defval: '',
      }) as unknown[][];

      if (!matrix.length) {
        throw new Error('Uploaded file is empty');
      }

      // Detect header row
      let headerRowIndex = -1;
      let skuIdCol = -1;
      let skuNameCol = -1;
      let categoryCol = -1;
      let stockCol = -1;
      let thresholdCol = -1;

      for (let i = 0; i < Math.min(10, matrix.length); i++) {
        const row = matrix[i] ?? [];
        row.forEach((cell, colIdx) => {
          const text = String(cell ?? '').trim().toLowerCase();
          if (text === 'skuid' || text === 'sku' || text === 'master sku id' || text === 'product code' || text === 'unique') {
            skuIdCol = colIdx;
            headerRowIndex = i;
          }
          if (text === 'skuname' || text === 'name of product' || text === 'product name' || text === 'name') {
            skuNameCol = colIdx;
            if (headerRowIndex < 0) headerRowIndex = i;
          }
          if (text === 'category' || text === 'principal') {
            categoryCol = colIdx;
          }
          if (text === 'currentstock' || text === 'stock' || text === 'quantity' || text === 'current stock') {
            stockCol = colIdx;
            if (headerRowIndex < 0) headerRowIndex = i;
          }
          if (text === 'lowstockthreshold' || text === 'threshold' || text === 'min threshold' || text === 'low stock threshold') {
            thresholdCol = colIdx;
          }
        });
        if (headerRowIndex >= 0 && (skuIdCol >= 0 || skuNameCol >= 0) && stockCol >= 0) {
          break;
        }
      }

      if (headerRowIndex < 0 || (skuIdCol < 0 && skuNameCol < 0) || stockCol < 0) {
        throw new Error('Invalid stock file header. File must contain columns for SKU (skuId or skuName) and currentStock.');
      }

      const rows: InventoryIntelImportRow[] = [];
      for (let i = headerRowIndex + 1; i < matrix.length; i++) {
        const rawRow = matrix[i] ?? [];
        const rawSkuId = skuIdCol >= 0 ? String(rawRow[skuIdCol] ?? '').trim() : '';
        const rawSkuName = skuNameCol >= 0 ? String(rawRow[skuNameCol] ?? '').trim() : '';
        const rawCategory = categoryCol >= 0 ? String(rawRow[categoryCol] ?? '').trim() : '';
        const rawQty = stockCol >= 0 ? Number(rawRow[stockCol]) : 0;
        const rawThreshold = thresholdCol >= 0 ? Number(rawRow[thresholdCol]) : undefined;

        if (!rawSkuId && !rawSkuName) continue;
        if (isNaN(rawQty) || rawQty <= 0) continue;

        rows.push({
          entityId: activeEntityId,
          skuId: rawSkuId,
          skuName: rawSkuName,
          category: rawCategory,
          quantity: Math.round(rawQty),
          lowStockThreshold: rawThreshold && !isNaN(rawThreshold) ? Math.round(rawThreshold) : undefined,
        });
      }

      if (rows.length === 0) {
        throw new Error('No valid stock rows (quantity > 0) found in uploaded file.');
      }

      const res = await inventoryIntelService.importStock(rows);
      queryClient.invalidateQueries({ queryKey: ['inventory-intel-stock-data'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-intel-summary-data'] });
      refetch();

      Alert.alert(
        'Stock Import Successful',
        `Processed ${rows.length} item(s) from "${fileAsset.name}".\n${res?.message || 'Inventory updated successfully.'}`
      );
    } catch (err: any) {
      console.error('Inventory intel upload error:', err);
      Alert.alert('Upload Error', err.message || 'Failed to import stock file.');
    } finally {
      setIsUploadingStock(false);
    }
  };

  const handleDownloadInventory = async () => {
    if (!activeEntityId) {
      Alert.alert('Selection Required', 'Please select an entity first.');
      return;
    }
    setIsDownloadingInventory(true);
    try {
      const itemsToExport = stockItems.map((item, index) => {
        const analyticsMeta = analyticsRows.find((x) => x.masterSkuId === item.skuId);
        let boxQty = analyticsMeta?.boxQty || 0;
        if (!boxQty) {
          const masterPackQty = analyticsMeta?.masterPackQty || 1;
          const isDoz = analyticsMeta?.masterPackUnit?.toLowerCase() === 'doz';
          boxQty = masterPackQty * (isDoz ? 12 : 1);
        }
        const stockInBox = Math.round(item.quantity / (boxQty || 1));
        return {
          'S.No': index + 1,
          'SKU ID': item.skuId,
          'SKU Name': analyticsMeta?.name || item.skuName || item.skuId,
          'Category': analyticsMeta?.principal || 'General',
          'Unit': analyticsMeta?.weight || item.skuWeight || 'pcs',
          'Current Stock (Units)': item.quantity,
          'Current Stock (Boxes)': stockInBox,
          'Threshold (Min)': item.lowStockThreshold,
          'Status': getStockStatus(item),
        };
      });

      await downloadXlsxReport(itemsToExport, {
        fileName: `inventory-${activeEntityId}.xlsx`,
        sheetName: 'Current Inventory',
      });
    } catch (err: any) {
      console.error('Failed to download inventory:', err);
      Alert.alert('Download Error', err.message || 'Failed to download inventory report.');
    } finally {
      setIsDownloadingInventory(false);
    }
  };

  // Subordinate Selector mapping
  const subordinatesOptions = useMemo(() => {
    if (isManager) {
      return [
        { value: entityId, label: 'Select a Super Stockist' },
        ...(superStockistsData?.data ?? []).map((x) => ({ value: x.entityId, label: `${x.name} (SS)` })),
      ];
    }
    if (isSO) {
      return [
        { value: entityId, label: 'Select a Distributor' },
        ...(distributorsData?.data ?? []).map((x) => ({ value: x.entityId, label: `${x.name} (Distributor)` })),
      ];
    }
    if (isDistributor) {
      return [
        { value: entityId, label: 'My Inventory' },
        ...(retailersData?.data ?? []).map((x) => ({ value: x.entityId, label: `${x.name} (Retailer)` })),
      ];
    }
    return [];
  }, [isManager, isSO, isDistributor, entityId, superStockistsData, distributorsData, retailersData]);

  const activeSubordinateLabel = useMemo(() => {
    const selected = subordinatesOptions.find((x) => x.value === activeEntityId);
    if (isSO && activeEntityId === entityId) {
      return 'Select a Distributor';
    }
    if (isManager && activeEntityId === entityId) {
      return 'Select a Super Stockist';
    }
    return selected ? selected.label : 'Select Subordinate';
  }, [subordinatesOptions, activeEntityId, isSO, isManager, entityId]);

  const filteredSubordinates = useMemo(() => {
    return subordinatesOptions.filter(item => {
      const labelLower = item.label.toLowerCase();
      const isAtoZStore = labelLower.includes('a to z general store');
      const matchesSearch = labelLower.includes(subordinateSearchQuery.toLowerCase()) ||
        item.value.toLowerCase().includes(subordinateSearchQuery.toLowerCase());
      return matchesSearch && !isAtoZStore;
    });
  }, [subordinatesOptions, subordinateSearchQuery]);

  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/admin/inventory' },
    { name: 'Stock Movements', icon: 'cube-outline' as const, route: '/stock-movements' },
    { name: 'Orders', icon: 'cart-outline' as const, route: '/admin/performance' },
    { name: 'Leaderboard', icon: 'trophy-outline' as const, route: '/leaderboard' },
    { name: 'Outlet Report', icon: 'home-outline' as const, route: '/outlet-wise' },
    { name: 'SKU Report', icon: 'bar-chart-outline' as const, route: '/admin/inventory' },
    { name: 'Notifications', icon: 'notifications-outline' as const, route: '/announcement' },
    { name: 'Performance Track', icon: 'stats-chart-outline' as const, route: '/admin/performance' },
    { name: 'Attendance Track', icon: 'clipboard-outline' as const, route: '/admin/attendance' },
    { name: 'Summary', icon: 'grid-outline' as const, route: '/admin/summary' },
    { name: 'Admin Inventory', icon: 'archive-outline' as const, route: '/admin/inventory' },
    { name: 'Announcements', icon: 'megaphone-outline' as const, route: '/announcement' },
    // { name: 'Role Permissions', icon: 'shield-checkmark-outline' as const, route: '/admin/role-permissions' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-grow" showsVerticalScrollIndicator={false}>
        {/* Title block */}
        <View className="px-6 pt-5 pb-2">
          <Text className="text-xl font-bold text-slate-800">Inventory Intel</Text>
          <Text className="text-xs text-slate-400 mt-0.5">Stock levels, analytics, and alerts in one place</Text>
        </View>

        {/* Stacked KPI Cards (Matching Mockup) */}
        <View className="mx-6 mt-3 gap-3">
          <View className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
            <Text className="text-xs font-bold text-slate-400">Total SKUs</Text>
            <Text className="text-2xl font-black text-slate-800 mt-1">
              {summaryLoading ? '...' : (summary?.totalSKUs ?? 0)}
            </Text>
          </View>

          <View className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
            <Text className="text-xs font-bold text-slate-400">Low Stock</Text>
            <Text className="text-2xl font-black text-orange-500 mt-1">
              {summaryLoading ? '...' : (summary?.lowStockCount ?? 0)}
            </Text>
          </View>

          <View className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
            <Text className="text-xs font-bold text-slate-400">Slow Moving</Text>
            <Text className="text-2xl font-black text-red-500 mt-1">
              {summaryLoading ? '...' : (summary?.slowMovingCount ?? 0)}
            </Text>
          </View>

          <View className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
            <Text className="text-xs font-bold text-slate-400">Total Value</Text>
            <Text className="text-2xl font-black text-slate-850 mt-1">
              {summaryLoading ? '...' : formatCurrency(summary?.totalInventoryValue ?? 0)}
            </Text>
          </View>
        </View>

        {/* Subordinate Selector Dropdown */}
        {subordinatesOptions.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowSubordinateModal(true)}
            className="mx-6 mt-4 flex-row items-center justify-between border border-gray-200 rounded-2xl px-4 py-3 bg-white shadow-sm"
          >
            <Text className="text-xs text-slate-600 font-semibold">{activeSubordinateLabel}</Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>
        )}

        {(isManager || isSO) && !selectedEntityId ? (
          <View className="mx-6 mt-6 bg-white border border-dashed border-gray-200 rounded-2xl p-8 items-center justify-center shadow-sm">
            <Ionicons name="cube-outline" size={48} color="#9ca3af" className="opacity-40" />
            <Text className="text-sm font-bold text-gray-800 mt-3 text-center">
              {isManager ? 'No Super Stockist Selected' : 'No Distributor Selected'}
            </Text>
            <Text className="text-xs text-gray-400 mt-1 text-center">
              Please choose a {isManager ? 'super stockist' : 'distributor'} above to view inventory.
            </Text>
          </View>
        ) : (
          <View className="mx-6 mt-4 gap-4 pb-24">
            {/* Tab navigation bar */}
            <View className="flex-row gap-2 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
              {[
                { id: 'stock', label: 'Stock Overview' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'alerts', label: 'Alerts' },
              ].map((t) => {
                const isActive = tab === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setTab(t.id as IntelTab)}
                    className={`flex-1 py-2.5 rounded-xl items-center ${isActive ? 'bg-[#f97316]' : 'bg-transparent'
                      }`}
                  >
                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Template & Download Action Buttons Row - Only 3 Buttons */}
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="flex-row items-center border border-gray-200 bg-white rounded-xl py-2.5 px-3.5 gap-1.5 shadow-sm active:bg-gray-50"
              >
                {isDownloadingTemplate ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <Ionicons name="download-outline" size={14} color="#f97316" />
                )}
                <Text className="text-slate-700 text-xs font-semibold">
                  {isDownloadingTemplate ? 'Downloading...' : 'Download Template'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUploadStock}
                disabled={isUploadingStock}
                className="flex-row items-center border border-gray-200 bg-white rounded-xl py-2.5 px-3.5 gap-1.5 shadow-sm active:bg-gray-50"
              >
                {isUploadingStock ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={14} color="#f97316" />
                )}
                <Text className="text-slate-700 text-xs font-semibold">
                  {isUploadingStock ? 'Uploading...' : 'Add Your Current Stock'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadInventory}
                disabled={isDownloadingInventory}
                className="flex-row items-center border border-gray-200 bg-white rounded-xl py-2.5 px-3.5 gap-1.5 shadow-sm active:bg-gray-50"
              >
                {isDownloadingInventory ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <Ionicons name="download-outline" size={14} color="#f97316" />
                )}
                <Text className="text-slate-700 text-xs font-semibold">
                  {isDownloadingInventory ? 'Downloading...' : 'Download Inventory'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB CONTENT: STOCK */}
            {tab === 'stock' && (
              <View className="gap-4">
                {/* Search SKU and Page limits */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
                  <View className="flex-row items-center border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50">
                    <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
                    <TextInput
                      value={search}
                      onChangeText={(text) => {
                        setSearch(text);
                        setPage(1);
                      }}
                      placeholder="Search SKU"
                      placeholderTextColor="#9ca3af"
                      className="flex-1 text-xs text-gray-800 py-1"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => setShowLimitModal(true)}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white flex-row items-center justify-between shadow-xs active:bg-gray-50"
                  >
                    <Text className="text-xs font-semibold text-slate-750">{limit} / page</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {stockLoading ? (
                  <ActivityIndicator size="large" color="#f97316" className="my-8" />
                ) : stockError ? (
                  <View className="bg-white border border-red-200 p-6 rounded-2xl items-center justify-center shadow-sm">
                    <Text className="text-xs text-red-500 font-bold mb-1">Unable to load stock overview</Text>
                    <Text className="text-[10px] text-red-400 text-center font-medium">
                      {(stockQueryError as any)?.response?.data?.message || (stockQueryError as any)?.message || 'Unknown API error'}
                    </Text>
                  </View>
                ) : stockItems.length === 0 ? (
                  <View className="bg-white border border-gray-200 p-8 rounded-2xl items-center justify-center shadow-sm">
                    <Ionicons name="cube-outline" size={32} color="#9ca3af" className="opacity-40" />
                    <Text className="text-xs text-gray-400 mt-2">No matching inventory records</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden min-w-[850px]">
                      {/* Grid Headers */}
                      <View className="flex-row bg-gray-50 border-b border-gray-150 px-4 py-3">
                        <Text className="w-36 text-[10px] font-bold text-slate-600 uppercase">SKU</Text>
                        <Text className="w-24 text-[10px] font-bold text-slate-600 uppercase">Category</Text>
                        <Text className="w-16 text-[10px] font-bold text-slate-600 uppercase">Unit</Text>
                        <Text className="w-28 text-[10px] font-bold text-slate-600 uppercase">Current Stock</Text>
                        <Text className="w-36 text-[10px] font-bold text-slate-600 uppercase">Current Stock in Case</Text>
                        <Text className="w-32 text-[10px] font-bold text-slate-600 uppercase">Threshold (min/max)</Text>
                        <Text className="w-20 text-[10px] font-bold text-slate-600 uppercase">Status</Text>
                        <Text className="w-24 text-[10px] font-bold text-slate-600 uppercase">Actions</Text>
                      </View>

                      {stockItems.map((item) => {
                        const analyticsMeta = analyticsRows.find((x) => x.masterSkuId === item.skuId);
                        const status = getStockStatus(item);

                        let boxQty = analyticsMeta?.boxQty || 0;
                        if (!boxQty) {
                          const masterPackQty = analyticsMeta?.masterPackQty || 1;
                          const isDoz = analyticsMeta?.masterPackUnit?.toLowerCase() === 'doz';
                          boxQty = masterPackQty * (isDoz ? 12 : 1);
                        }
                        const stockInCase = item.currentStockInCase ?? (boxQty ? Math.floor(item.quantity / boxQty) : 0);

                        let statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        if (status === 'CRITICAL') statusBg = 'bg-red-50 text-red-700 border-red-200';
                        else if (status === 'LOW') statusBg = 'bg-amber-50 text-amber-700 border-amber-200';

                        return (
                          <View key={`${item.entityId}-${item.skuId}`} className="flex-row border-b border-gray-100 px-4 py-3 items-center">
                            <View className="w-36 pr-2">
                              <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                                {analyticsMeta?.name || item.skuName || item.skuId}
                              </Text>
                              <Text className="text-[10px] text-slate-400 font-normal" numberOfLines={1}>
                                {item.skuId}
                              </Text>
                            </View>
                            <Text className="w-24 text-xs text-slate-600 truncate" numberOfLines={1}>{analyticsMeta?.principal || 'General'}</Text>
                            <Text className="w-16 text-xs text-slate-600">{analyticsMeta?.weight || item.skuWeight || 'pcs'}</Text>
                            <Text className="w-28 text-xs font-bold text-slate-800">{item.quantity.toLocaleString('en-IN')}</Text>
                            <Text className="w-36 text-xs font-semibold text-slate-650">{stockInCase.toLocaleString('en-IN')}</Text>
                            <View className="w-32 flex-row items-center gap-1">
                              <Text className="text-xs text-slate-650">{item.lowStockThreshold} / -</Text>
                              {canEditThreshold && (
                                <TouchableOpacity
                                  onPress={() => {
                                    setThresholdModal({
                                      entityId: item.entityId || activeEntityId,
                                      skuId: item.skuId,
                                      current: item.lowStockThreshold,
                                      skuName: analyticsMeta?.name || item.skuName || item.skuId,
                                    });
                                    setNewThreshold(String(item.lowStockThreshold));
                                  }}
                                >
                                  <Text className="text-xs font-semibold text-orange-600">Edit</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <View className="w-20">
                              <View className={`px-1.5 py-0.5 rounded-full border items-center justify-center ${statusBg}`}>
                                <Text className="text-[8px] font-bold uppercase">{status}</Text>
                              </View>
                            </View>

                            <View className="w-24">
                              {canAdjustStock ? (
                                <TouchableOpacity
                                  onPress={() => {
                                    setAdjustModal({
                                      entityId: item.entityId || activeEntityId,
                                      skuId: item.skuId,
                                      skuName: analyticsMeta?.name || item.skuName || item.skuId,
                                    });
                                    setAdjustQty('');
                                  }}
                                >
                                  <Text className="text-xs font-semibold text-orange-600">Adjust Stock</Text>
                                </TouchableOpacity>
                              ) : (
                                <Text className="text-xs text-slate-400">View only</Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <View className="flex-row items-center justify-between px-2 py-4 border-t border-gray-200 bg-transparent">
                    <Text className="text-xs text-gray-500">
                      Page {page} of {totalPages}
                    </Text>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        disabled={page <= 1}
                        onPress={() => setPage((p) => Math.max(1, p - 1))}
                        className={`p-2 border rounded-lg ${page <= 1 ? 'border-gray-100 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                          }`}
                      >
                        <Ionicons name="chevron-back" size={16} color="#374151" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={page >= totalPages}
                        onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={`p-2 border rounded-lg ${page >= totalPages ? 'border-gray-100 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                          }`}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#374151" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* TAB CONTENT: ANALYTICS */}
            {tab === 'analytics' && (
              <View className="gap-4">
                {/* Date presets */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
                  <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Timeframe</Text>
                  <View className="flex-row gap-2">
                    {[
                      { id: '7', label: '7 Days' },
                      { id: '30', label: '30 Days' },
                      { id: '90', label: '90 Days' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => setRangePreset(opt.id as any)}
                        className={`flex-1 py-2 rounded-lg items-center border ${rangePreset === opt.id
                            ? 'bg-orange-50 border-orange-300'
                            : 'bg-gray-50 border-gray-200'
                          }`}
                      >
                        <Text className={`text-xs ${rangePreset === opt.id ? 'font-bold text-orange-700' : 'text-slate-600'}`}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Stock Movement micro bar chart */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-2">
                  <Text className="text-xs font-bold text-gray-700">Stock Movement Trend</Text>
                  <View className="h-32 flex-row items-end justify-between border-b border-gray-200 pb-1 mt-2">
                    {lineSeries.length === 0 ? (
                      <View className="flex-1 items-center justify-center">
                        <Text className="text-[10px] text-gray-400">No ledger transactions</Text>
                      </View>
                    ) : (
                      lineSeries.map((p) => {
                        const maxVal = Math.max(1, ...lineSeries.map((x) => x.value));
                        const pctHeight = Math.max(5, (p.value / maxVal) * 100);
                        return (
                          <View key={p.day} className="flex-1 items-center gap-1 mx-0.5">
                            <View
                              className="w-full bg-[#f97316] rounded-t"
                              style={{ height: `${pctHeight}%` }}
                            />
                          </View>
                        );
                      })
                    )}
                  </View>
                  <View className="flex-row justify-between text-[8px] text-gray-400 mt-1">
                    <Text>{lineSeries[0]?.day ?? ''}</Text>
                    <Text>{lineSeries[lineSeries.length - 1]?.day ?? ''}</Text>
                  </View>
                </View>

                {/* Top Moving SKUs bar representations */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
                  <Text className="text-xs font-bold text-gray-700">Top Moving SKUs (Units)</Text>
                  <View className="gap-2">
                    {topMoving.length === 0 ? (
                      <Text className="text-xs text-gray-400 text-center py-4">No recent movements recorded</Text>
                    ) : (
                      topMoving.map((row, idx) => {
                        const maxMove = Math.max(1, topMoving[0]?.movement ?? 1);
                        const pct = Math.max(6, (row.movement / maxMove) * 100);
                        return (
                          <View key={row.skuId} className="gap-1">
                            <View className="flex-row justify-between text-xs">
                              <Text className="text-gray-700 font-semibold" numberOfLines={1}>
                                {idx + 1}. {row.name}
                              </Text>
                              <Text className="text-gray-500 font-bold">{row.movement.toLocaleString('en-IN')}</Text>
                            </View>
                            <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <View
                                className="h-full bg-[#f97316] rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>

                {/* Category Valuations */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
                  <Text className="text-xs font-bold text-gray-700">Category Valuation Breakdown</Text>
                  <View className="gap-2.5">
                    {principalBreakdown.length === 0 ? (
                      <Text className="text-xs text-gray-400 text-center py-4">No category valuations available</Text>
                    ) : (
                      principalBreakdown.map((row) => (
                        <View key={row.name} className="flex-row justify-between items-center border-b border-gray-50 pb-2">
                          <Text className="text-xs text-gray-700 font-medium">{row.name}</Text>
                          <Text className="text-xs font-bold text-emerald-700">{formatCurrency(row.value)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* TAB CONTENT: ALERTS */}
            {tab === 'alerts' && (
              <View className="gap-4">
                {/* Low Stock Alerts */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
                  <View className="flex-row items-center gap-1.5 border-b border-gray-100 pb-2.5">
                    <Ionicons name="warning-outline" size={16} color="#d97706" />
                    <Text className="text-xs font-bold text-gray-800">Low Stock Deficits</Text>
                  </View>
                  <View className="gap-2.5">
                    {lowStockAlerts.length === 0 ? (
                      <Text className="text-xs text-gray-400 py-3 text-center">No current low-stock alerts</Text>
                    ) : (
                      lowStockAlerts.map((row) => (
                        <View key={row.skuId} className="border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
                          <Text className="text-xs font-bold text-gray-800" numberOfLines={1}>{row.name}</Text>
                          <View className="flex-row justify-between text-[10px] text-gray-500 mt-2">
                            <Text>Current: {row.quantity}</Text>
                            <Text>Min Required: {row.threshold}</Text>
                            <Text className="font-bold text-red-600">Deficit: {row.deficit}</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                {/* Slow Moving SKUs */}
                <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
                  <View className="flex-row items-center gap-1.5 border-b border-gray-100 pb-2.5">
                    <Ionicons name="timer-outline" size={16} color="#dc2626" />
                    <Text className="text-xs font-bold text-gray-800">Slow Moving Alerts (45+ Days)</Text>
                  </View>
                  <View className="gap-2.5">
                    {slowMovingAlerts.length === 0 ? (
                      <Text className="text-xs text-gray-400 py-3 text-center">No slow-moving SKUs detected</Text>
                    ) : (
                      slowMovingAlerts.map((row) => (
                        <View key={row.skuId} className="border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
                          <Text className="text-xs font-bold text-gray-800" numberOfLines={1}>{row.name}</Text>
                          <Text className="text-[10px] font-bold text-red-600 mt-1.5">
                            {row.days} days since last stock transaction
                          </Text>
                          <View className="flex-row justify-between text-[10px] text-gray-400 mt-1">
                            <Text>Current Units: {row.quantity}</Text>
                            <Text>Min Threshold: {row.threshold}</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Subordinate Selector Modal */}
      <Modal
        visible={showSubordinateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSubordinateModal(false);
          setSubordinateSearchQuery('');
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 bg-gray-50 gap-2">
              <View className="flex-row justify-between items-center">
                <Text className="font-bold text-gray-800 text-base">Select Subordinate</Text>
                <TouchableOpacity onPress={() => { setShowSubordinateModal(false); setSubordinateSearchQuery(''); }} className="p-1">
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center border border-gray-200 bg-white rounded-xl px-3 py-1.5 mt-1">
                <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
                <TextInput
                  placeholder="Search..."
                  placeholderTextColor="#9ca3af"
                  value={subordinateSearchQuery}
                  onChangeText={setSubordinateSearchQuery}
                  className="flex-grow text-xs text-gray-800 p-0 py-1"
                />
              </View>
            </View>
            <FlatList
              data={filteredSubordinates}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedEntityId(item.value === entityId ? '' : item.value);
                    setPage(1);
                    setShowSubordinateModal(false);
                    setSubordinateSearchQuery('');
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${activeEntityId === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${activeEntityId === item.value ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {activeEntityId === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Adjust Stock Modal ── */}
      {adjustModal && (
        <Modal visible={!!adjustModal} transparent animationType="fade" onRequestClose={() => setAdjustModal(null)}>
          <View className="flex-1 bg-black/50 justify-center items-center p-6">
            <View className="bg-white w-full max-w-sm rounded-2xl p-6 gap-4 shadow-xl">
              <View className="flex-row justify-between items-center border-b border-gray-100 pb-2">
                <Text className="text-base font-bold text-gray-800">Adjust Stock</Text>
                <TouchableOpacity onPress={() => setAdjustModal(null)} className="p-1">
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {adjustModal.skuName || adjustModal.skuId}
              </Text>

              <View className="border border-gray-300 rounded-xl bg-white px-3 py-1 flex-row items-center justify-between shadow-xs">
                <TextInput
                  value={adjustQty}
                  onChangeText={setAdjustQty}
                  placeholder="0"
                  keyboardType="numeric"
                  className="flex-1 text-sm font-semibold text-gray-800 py-1.5"
                />
                <View className="flex-col gap-0.5 items-center justify-center border-l border-gray-200 pl-2">
                  <TouchableOpacity
                    onPress={() => {
                      const num = parseInt(adjustQty || '0', 10);
                      setAdjustQty(String(isNaN(num) ? 1 : num + 1));
                    }}
                    className="p-0.5 active:bg-gray-100 rounded"
                  >
                    <Ionicons name="chevron-up" size={14} color="#4b5563" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const num = parseInt(adjustQty || '0', 10);
                      setAdjustQty(String(isNaN(num) ? -1 : num - 1));
                    }}
                    className="p-0.5 active:bg-gray-100 rounded"
                  >
                    <Ionicons name="chevron-down" size={14} color="#4b5563" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row justify-end gap-2 mt-2">
                <TouchableOpacity
                  onPress={() => setAdjustModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white active:bg-gray-50"
                >
                  <Text className="text-xs font-semibold text-gray-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={adjustMutation.isPending}
                  onPress={handleAdjustStockSubmit}
                  className="px-4 py-2 bg-[#f97316] rounded-lg active:bg-orange-600 disabled:opacity-50"
                >
                  <Text className="text-xs font-bold text-white">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Threshold Modal ── */}
      {thresholdModal && (
        <Modal visible={!!thresholdModal} transparent animationType="fade" onRequestClose={() => setThresholdModal(null)}>
          <View className="flex-1 bg-black/50 justify-center items-center p-6">
            <View className="bg-white w-full max-w-sm rounded-2xl p-6 gap-4 shadow-xl">
              <View className="flex-row justify-between items-center border-b border-gray-100 pb-2">
                <Text className="text-base font-bold text-gray-800">Edit Threshold</Text>
                <TouchableOpacity onPress={() => setThresholdModal(null)} className="p-1">
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {thresholdModal.skuName || thresholdModal.skuId}
              </Text>

              <View className="border border-gray-300 rounded-xl bg-white px-3 py-1 flex-row items-center justify-between shadow-xs">
                <TextInput
                  value={newThreshold}
                  onChangeText={setNewThreshold}
                  placeholder="0"
                  keyboardType="numeric"
                  className="flex-1 text-sm font-semibold text-gray-800 py-1.5"
                />
                <View className="flex-col gap-0.5 items-center justify-center border-l border-gray-200 pl-2">
                  <TouchableOpacity
                    onPress={() => {
                      const num = parseInt(newThreshold || '0', 10);
                      setNewThreshold(String(isNaN(num) ? 1 : num + 1));
                    }}
                    className="p-0.5 active:bg-gray-100 rounded"
                  >
                    <Ionicons name="chevron-up" size={14} color="#4b5563" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const num = parseInt(newThreshold || '0', 10);
                      setNewThreshold(String(isNaN(num) ? 0 : Math.max(0, num - 1)));
                    }}
                    className="p-0.5 active:bg-gray-100 rounded"
                  >
                    <Ionicons name="chevron-down" size={14} color="#4b5563" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row justify-end gap-2 mt-2">
                <TouchableOpacity
                  onPress={() => setThresholdModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white active:bg-gray-50"
                >
                  <Text className="text-xs font-semibold text-gray-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={thresholdMutation.isPending}
                  onPress={handleThresholdSubmit}
                  className="px-4 py-2 bg-[#f97316] rounded-lg active:bg-orange-600 disabled:opacity-50"
                >
                  <Text className="text-xs font-bold text-white">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Items Per Page Selector Modal */}
      <Modal
        visible={showLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLimitModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Items Per Page</Text>
              <TouchableOpacity onPress={() => setShowLimitModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            {[20, 50, 100].map((pageSize) => (
              <TouchableOpacity
                key={pageSize}
                onPress={() => {
                  setLimit(pageSize);
                  setPage(1);
                  setShowLimitModal(false);
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${
                  limit === pageSize ? 'bg-orange-50' : 'active:bg-gray-50'
                }`}
              >
                <Text className={`text-sm ${limit === pageSize ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                  {pageSize} / page
                </Text>
                {limit === pageSize && <Ionicons name="checkmark-circle" size={20} color="#f97316" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
