import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

import { useAuthStore } from '@/store/auth.store';
import { catalogService } from '@/services/catalog.service';
import { userService } from '@/services/user.service';
import { UserRole } from '@/types';
import { formatCurrencyDecimal as formatCurrency } from '@/lib/format-utils';

const { width } = Dimensions.get('window');

const CATALOG_TEMPLATE_HEADERS = [
  'S.NO',
  'Unique',
  'NAME OF PRODUCT',
  'WEIGHT',
  'MASTER PKG.',
  'Master Pack',
  'for per/pc price',
  'MRP/UNIT',
  'Offer Rate NEW',
  'Case qty',
  'Box rate',
  'scheme %',
  'scheme Amount',
  'Billing',
  'Per/pc',
  '18%',
  '5%',
  'Super total',
  'S.S.MARGIN 7%',
  'Distributor total',
  'Dist. Margin 10%',
  'Retail',
];

function PickerTrigger({ label, value, placeholder, onPress, loading }: any) {
  return (
    <View className="gap-1 mb-2.5 flex-1">
      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#f37021" />
        ) : (
          <Text className={`text-xs ${value ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
            {value || placeholder}
          </Text>
        )}
        <Ionicons name="chevron-down" size={14} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}

function SelectorModal({ visible, onClose, data, selectedValue, onSelect, title }: any) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = (data || []).filter((item: any) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setSearchQuery(''); onClose(); }}>
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[70%]">
          <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-55">
            <Text className="font-bold text-gray-800 text-base">{title}</Text>
            <TouchableOpacity onPress={() => { setSearchQuery(''); onClose(); }} className="p-1">
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-2 border-b border-gray-100 bg-white">
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Ionicons name="search-outline" size={16} color="#6b7280" className="mr-2" />
              <TextInput
                placeholder="Search..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-xs text-gray-800 p-0"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item.value);
                  setSearchQuery('');
                  onClose();
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${selectedValue === item.value ? 'bg-orange-50' : ''
                  }`}
              >
                <Text className={`text-xs ${selectedValue === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {selectedValue === item.value && <Ionicons name="checkmark" size={16} color="#f37021" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function MultiSelectorModal({ visible, onClose, data, selectedValues = [], onSelect, title }: any) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = (data || []).filter((item: any) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelect(selectedValues.filter((v: string) => v !== value));
    } else {
      onSelect([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    const allFiltered = filteredData.map((d: any) => d.value).filter(Boolean);
    onSelect(Array.from(new Set([...selectedValues, ...allFiltered])));
  };

  const handleClearAll = () => {
    const allFiltered = filteredData.map((d: any) => d.value);
    onSelect(selectedValues.filter((v: string) => !allFiltered.includes(v)));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setSearchQuery(''); onClose(); }}>
      <View className="flex-1 bg-black/50 justify-center items-center p-6">
        <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[70%]">
          <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
            <Text className="font-bold text-gray-800 text-base">{title}</Text>
            <TouchableOpacity onPress={() => { setSearchQuery(''); onClose(); }} className="p-1">
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="px-4 py-2 border-b border-gray-100 bg-white">
            <View className="flex-row items-center bg-gray-50 border-2 border-orange-500 rounded-xl px-3 py-2">
              <Ionicons name="search-outline" size={16} color="#f97316" className="mr-2" />
              <TextInput
                placeholder="Search..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-xs text-gray-800 p-0"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Select All & Clear All Actions */}
          <View className="px-4 py-2.5 border-b border-gray-100 flex-row justify-between items-center bg-white">
            <TouchableOpacity onPress={handleSelectAll}>
              <Text className="text-xs font-bold text-orange-600">Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAll}>
              <Text className="text-xs font-semibold text-gray-400">Clear All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isSelected = selectedValues.includes(item.value);
              return (
                <TouchableOpacity
                  onPress={() => handleToggle(item.value)}
                  className={`p-4 border-b border-gray-100 flex-row items-center gap-3 ${isSelected ? 'bg-orange-50/5' : ''
                    }`}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={isSelected ? '#f37021' : '#9ca3af'}
                  />
                  <Text className={`text-xs ${isSelected ? 'font-bold text-gray-850' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function SKUCatalogScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE;
  const isSS = user?.role === UserRole.SUPER_STOCKIST;
  const isDist = user?.role === UserRole.DISTRIBUTOR;
  const canSetPrices = isAdmin || isSS || isDist;
  const isAuthorized = !!(user && [
    UserRole.ADMIN,
    UserRole.SUPER_STOCKIST,
    UserRole.DISTRIBUTOR,
    UserRole.ASM,
    UserRole.RSM,
    UserRole.SO,
    UserRole.ASE,
    UserRole.FINANCE,
  ].includes(user.role as UserRole));

  // States
  const [activeTab, setActiveTab] = useState<'catalog' | 'pricing'>('catalog');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedPrincipal, setSelectedPrincipal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddSku, setShowAddSku] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  // Form states for SKU Creation / Editing
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [skuPrincipal, setSkuPrincipal] = useState('');
  const [skuUnitPrice, setSkuUnitPrice] = useState('');
  const [skuPackQty, setSkuPackQty] = useState('');
  const [skuPriceDozenSS, setSkuPriceDozenSS] = useState('');
  const [skuSchemeEligible, setSkuSchemeEligible] = useState(false);

  // Add Manufactured Stock State
  const [stockSkuId, setStockSkuId] = useState('');
  const [stockQty, setStockQty] = useState('');

  // Pricing Tab States
  const [pricingScope, setPricingScope] = useState<'GLOBAL' | 'STATE' | 'ENTITY'>('GLOBAL');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.SUPER_STOCKIST);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  // Dropdown modals
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  // React Queries
  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['catalog', page, search, selectedPrincipal, user?.role],
    queryFn: () => {
      return catalogService.list({
        page,
        limit: 20,
        search: search || undefined,
        principal: selectedPrincipal || undefined,
      });
    },
    enabled: isAuthorized,
  });

  const { data: principalsData } = useQuery({
    queryKey: ['catalog-principals'],
    queryFn: () => catalogService.listPrincipals(),
    enabled: isAuthorized,
  });

  const skusList = catalogData?.data ?? [];
  const principals = principalsData?.data ?? [];
  const total = catalogData?.total ?? 0;
  const totalPages = catalogData?.pagination?.totalPages ?? Math.ceil(total / 20) ?? 1;

  // Mutations
  const createSkuMutation = useMutation({
    mutationFn: (payload: any) => catalogService.adminCreateSku(payload),
    onSuccess: () => {
      setShowAddSku(false);
      resetSkuForm();
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-principals'] });
      Alert.alert('Success', 'SKU created successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create SKU');
    },
  });


  const addStockMutation = useMutation({
    mutationFn: () => catalogService.adminAddStock(stockSkuId, Number(stockQty)),
    onSuccess: () => {
      setShowAddStock(false);
      setStockSkuId('');
      setStockQty('');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      Alert.alert('Success', 'Stock registered successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add stock');
    },
  });

  const toggleSkuMutation = useMutation({
    mutationFn: ({ masterSkuId, enabled }: { masterSkuId: string; enabled: boolean }) => {
      if (enabled) {
        return catalogService.disableSku(masterSkuId);
      } else {
        return catalogService.enableSku(masterSkuId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to toggle SKU visibility');
    },
  });

  const deleteSkuMutation = useMutation({
    mutationFn: (masterSkuId: string) => catalogService.adminDeleteSku(masterSkuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-principals'] });
      Alert.alert('Success', 'SKU deleted successfully from catalog');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to delete SKU');
    },
  });

  const handleDeleteSku = (sku: any) => {
    Alert.alert(
      'Delete SKU',
      `Are you sure you want to delete SKU '${sku.masterSkuId}' (${sku.name}) from the catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSkuMutation.mutate(sku.masterSkuId),
        },
      ]
    );
  };

  const handleToggleAssortment = (sku: any) => {
    const isCurrentlyEnabled = !!sku.enabled;
    const title = isCurrentlyEnabled
      ? 'Disable SKU for Your Network'
      : 'Enable SKU for Your Network';
    const description = isCurrentlyEnabled
      ? `Disabling this SKU will immediately remove it from all downstream distributors, agents, and retailers in your network. They will no longer be able to view or order this product.\n\nProduct: ${sku.name}\nBox Price: ${formatCurrency(sku.boxPrice || 0)}\nUnit Price: ${formatCurrency(sku.unitPrice || 0)}`
      : `Enabling this SKU will make it visible to all downstream entities in your network. Distributors, agents, and retailers will be able to view and order this product.\n\nProduct: ${sku.name}\nBox Price: ${formatCurrency(sku.boxPrice || 0)}\nUnit Price: ${formatCurrency(sku.unitPrice || 0)}`;

    Alert.alert(
      title,
      description,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlyEnabled ? 'Disable SKU' : 'Enable SKU',
          style: isCurrentlyEnabled ? 'destructive' : 'default',
          onPress: () => {
            toggleSkuMutation.mutate({ masterSkuId: sku.masterSkuId, enabled: isCurrentlyEnabled });
          },
        },
      ]
    );
  };

  // Fetch States for State-wise scope
  const { data: statesList = [] } = useQuery({
    queryKey: ['pricing-states'],
    queryFn: () => userService.listUniqueStates(),
    enabled: isAuthorized && activeTab === 'pricing' && pricingScope === 'STATE',
  });

  // Fetch Target Entities for Entity-Specific scope based on Role (always enabled in pricing tab)
  const { data: pricingTargets } = useQuery({
    queryKey: ['pricing-entities-v4', user?.role, selectedRole],
    queryFn: async () => {
      if (isAdmin) {
        return userService.listAll({ role: selectedRole, limit: 1000 });
      }
      if (isSS) {
        return userService.listManagement({ role: UserRole.DISTRIBUTOR, limit: 500 });
      }
      if (isDist) {
        return userService.listManagement({ role: UserRole.RETAILER, limit: 500 });
      }
      return { data: [] } as any;
    },
    enabled: isAuthorized && activeTab === 'pricing',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const entitiesList = Array.isArray(pricingTargets)
    ? pricingTargets
    : (Array.isArray(pricingTargets?.data)
      ? pricingTargets.data
      : []);

  // Determine effective scope and primary target for the API
  const effectiveScope = isAdmin
    ? (selectedTargetIds.length > 0
      ? (pricingScope === 'STATE' ? 'STATE' : 'ENTITY')
      : 'GLOBAL')
    : 'ENTITY';
  const primaryTargetId = selectedTargetIds[0] || undefined;
  const selectedTargetId = primaryTargetId;

  const isPricingSelectionValid = isAdmin
    ? (pricingScope === 'GLOBAL' ? true : selectedTargetIds.length > 0)
    : selectedTargetIds.length > 0;

  // Scoped Pricing list query
  const { data: pricingRes, isLoading: pricingLoading, refetch: refetchPricing } = useQuery({
    queryKey: ['pricing-rows-scoped', isAdmin ? effectiveScope : 'ENTITY', primaryTargetId],
    queryFn: () => {
      if (isAdmin) {
        return catalogService.adminGetScopedPricing(effectiveScope, {
          targetId: effectiveScope === 'GLOBAL' ? undefined : primaryTargetId,
          limit: 100,
        });
      }
      return catalogService.getEntityPricing(primaryTargetId || '', {
        limit: 100,
      });
    },
    enabled: isAuthorized && activeTab === 'pricing' && isPricingSelectionValid,
  });
  const pricingRows = pricingRes?.data ?? [];

  // Set Scoped Price Mutation (runs update for all selected targets)
  const setPriceMutation = useMutation({
    mutationFn: async ({ masterSkuId, price }: { masterSkuId: string; price: number }) => {
      if (isAdmin) {
        if (effectiveScope === 'GLOBAL') {
          await catalogService.adminSetScopedPrice('GLOBAL', masterSkuId, price, undefined);
        } else {
          await Promise.all(
            selectedTargetIds.map((targetId) =>
              catalogService.adminSetScopedPrice(effectiveScope, masterSkuId, price, targetId)
            )
          );
        }
      } else {
        // Non-admin (Super Stockist / Distributor) sets price for target entity
        await Promise.all(
          selectedTargetIds.map((targetId) =>
            catalogService.setEntityPrice(targetId, masterSkuId, price)
          )
        );
      }
    },
    onSuccess: (_, variables) => {
      refetchPricing();
      setEditingPrices((p) => {
        const next = { ...p };
        delete next[variables.masterSkuId];
        return next;
      });
      Alert.alert('Success', 'Price updated successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update price');
    },
  });

  const resetSkuForm = () => {
    setSkuCode('');
    setSkuName('');
    setSkuPrincipal('');
    setSkuUnitPrice('');
    setSkuPackQty('');
    setSkuPriceDozenSS('');
    setSkuSchemeEligible(false);
  };

  const handleCreateSku = () => {
    if (!skuCode.trim() || !skuName.trim() || !skuPrincipal.trim() || !skuUnitPrice) {
      Alert.alert('Error', 'Product Code, Name, Principal, and Unit Price are required');
      return;
    }

    const payload = {
      masterSkuId: skuCode.trim(),
      name: skuName.trim(),
      principal: skuPrincipal.trim(),
      unitPrice: Number(skuUnitPrice),
      boxPrice: Number(skuPriceDozenSS) * Number(skuPackQty),
      displayRequiredQty: Number(skuPackQty),
      masterPackQty: Number(skuPackQty),
      pricePerDozenSS: Number(skuPriceDozenSS),
      schemeEligible: skuSchemeEligible,
    };

    createSkuMutation.mutate(payload);
  };


  const handleAddStock = () => {
    if (!stockSkuId || !stockQty || Number(stockQty) <= 0) {
      Alert.alert('Error', 'Please select a product and input quantity');
      return;
    }
    addStockMutation.mutate();
  };

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async (templateName: string) => {
    setIsDownloadingTemplate(true);
    try {
      // Fetch all products from the catalog to populate the template.
      // We set limit: 1000 to get a comprehensive list.
      const res = await catalogService.list({ limit: 1000 });
      const products = res.data ?? [];
      
      const rows = products.map((sku: any, index: number) => ({
        'S.NO': String(index + 1),
        Unique: sku.masterSkuId,
        'NAME OF PRODUCT': sku.name,
        WEIGHT: sku.weight ?? '',
        'MASTER PKG.': sku.masterPackUnit ?? '',
        'Master Pack': sku.masterPackQty !== undefined ? String(sku.masterPackQty) : '',
        'Case qty': sku.boxQty !== undefined ? String(sku.boxQty) : '',
        'for per/pc price': sku.perPcPrice !== undefined ? String(sku.perPcPrice) : '',
        'MRP/UNIT': sku.mrpPerUnit !== undefined ? String(sku.mrpPerUnit) : (sku.unitPrice !== undefined ? String(sku.unitPrice) : ''),
        'Offer Rate NEW': sku.offerRateNew !== undefined ? String(sku.offerRateNew) : '',
        'Box rate': sku.boxRate !== undefined ? String(sku.boxRate) : '',
        'scheme %': sku.schemePercent !== undefined ? String(sku.schemePercent) : '',
        'scheme Amount': sku.schemeAmount !== undefined ? String(sku.schemeAmount) : '',
        Billing: sku.billing !== undefined ? String(sku.billing) : '',
        'Per/pc': sku.billing && sku.perPcPrice ? String(sku.billing / sku.perPcPrice) : '',
        '18%': sku.tax18 !== undefined ? String(sku.tax18) : '',
        '5%': sku.tax5 !== undefined ? String(sku.tax5) : '',
        'Super total': sku.superTotal !== undefined ? String(sku.superTotal) : '',
        'S.S.MARGIN 7%': sku.ssMargin !== undefined ? String(sku.ssMargin) : '',
        'Distributor total': sku.distributorTotal !== undefined ? String(sku.distributorTotal) : '',
        'Dist. Margin 10%': sku.distMargin !== undefined ? String(sku.distMargin) : '',
        Retail: sku.retailTotal !== undefined ? String(sku.retailTotal) : '',
      }));

      const { downloadXlsxReport } = require('@/lib/xlsx-export');
      await downloadXlsxReport(rows, {
        fileName: templateName,
        sheetName: 'Catalog Template',
      });
    } catch (e: any) {
      console.error('Failed to download template', e);
      Alert.alert('Error', 'Failed to generate catalog template.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);

  const chooseHeaderRow = (matrix: string[][]): number => {
    let bestIndex = -1;
    let bestScore = 0;

    matrix.forEach((row, index) => {
      let score = 0;
      row.forEach((cell) => {
        const normalized = String(cell ?? '').trim().toLowerCase();
        if (
          CATALOG_TEMPLATE_HEADERS.some(
            (h) => h.toLowerCase().trim() === normalized
          )
        ) {
          score++;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  const parseStrictTemplateRowsFromMatrix = (matrix: string[][]): any[] => {
    if (!matrix.length) {
      throw new Error('Uploaded file is empty');
    }

    const normalizedMatrix = matrix.map((row) =>
      row.map((cell) => String(cell ?? '').trim())
    );
    const headerRowIndex = chooseHeaderRow(normalizedMatrix);
    if (headerRowIndex < 0) {
      throw new Error('Could not detect header row in uploaded file');
    }

    const rawHeaders = normalizedMatrix[headerRowIndex] ?? [];
    const headers = rawHeaders.slice(0, CATALOG_TEMPLATE_HEADERS.length).map((header) => String(header ?? '').trim());

    const parsedRows = normalizedMatrix
      .slice(headerRowIndex + 1)
      .map((cells, index) => {
        const normalizedCells = cells.slice(0, CATALOG_TEMPLATE_HEADERS.length).map((cell) => String(cell ?? '').trim());
        const hasAnyValue = normalizedCells.some((cell) => cell !== '');
        if (!hasAnyValue) {
          return null;
        }

        const raw: Record<string, string> = {};
        CATALOG_TEMPLATE_HEADERS.forEach((header, colIndex) => {
          raw[header] = normalizedCells[colIndex] ?? '';
        });

        return {
          rowNumber: headerRowIndex + index + 2,
          raw,
          selected: true,
        };
      })
      .filter((row) => row !== null);

    if (!parsedRows.length) {
      throw new Error('No data rows found below header row');
    }

    return parsedRows;
  };

  const handleUploadTemplate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      setIsUploadingTemplate(true);

      const base64Str = await FileSystem.readAsStringAsync(fileAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const workbook = XLSX.read(base64Str, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Uploaded file has no sheet');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][];

      const parsedRows = parseStrictTemplateRowsFromMatrix(matrix);

      const mappedRows = parsedRows.map((row) => {
        const val = (header: string) => {
          const rawVal = row.raw[header];
          return rawVal !== undefined && rawVal !== '' ? rawVal : undefined;
        };

        const numVal = (header: string) => {
          const rawVal = row.raw[header];
          return rawVal !== undefined && rawVal !== '' ? Number(rawVal) : undefined;
        };

        return {
          rowNumber: row.rowNumber,
          masterSkuId: val('Unique'),
          name: val('NAME OF PRODUCT'),
          weight: val('WEIGHT'),
          masterPackUnit: val('MASTER PKG.'),
          masterPackQty: numVal('Master Pack'),
          perPcPrice: numVal('for per/pc price'),
          mrpPerUnit: numVal('MRP/UNIT'),
          offerRateNew: numVal('Offer Rate NEW'),
          boxQty: numVal('Case qty'),
          boxRate: numVal('Box rate'),
          schemePercent: numVal('scheme %'),
          schemeAmount: numVal('scheme Amount'),
          billing: numVal('Billing'),
          tax18: numVal('18%'),
          tax5: numVal('5%'),
          superTotal: numVal('Super total'),
          ssMargin: numVal('S.S.MARGIN 7%'),
          distributorTotal: numVal('Distributor total'),
          distMargin: numVal('Dist. Margin 10%'),
          retailTotal: numVal('Retail'),
        };
      });

      for (const row of mappedRows) {
        if (!row.masterSkuId || !row.name || row.perPcPrice === undefined) {
          throw new Error(
            `Row ${row.rowNumber} is missing required values for Unique (Product Code), NAME OF PRODUCT, or for per/pc price.`
          );
        }
      }

      const res = await catalogService.adminBulkImport(mappedRows);
      
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-principals'] });

      Alert.alert(
        'Import Success',
        `Catalog bulk import completed.\nInserted: ${res.data?.inserted ?? 0}\nExisting/Updated: ${res.data?.existing ?? 0}\nInvalid: ${res.data?.invalid ?? 0}`
      );
    } catch (err: any) {
      console.error('Catalog bulk upload error:', err);
      Alert.alert('Upload Error', err.message || 'Failed to import catalog template.');
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  const handleUploadPricingTemplate = async () => {
    const requiresTarget = !isAdmin || pricingScope !== 'GLOBAL';
    if (requiresTarget && selectedTargetIds.length === 0) {
      Alert.alert(
        'Selection Required',
        `Please select a target ${isAdmin ? (pricingScope === 'STATE' ? 'state' : 'super stockist') : (isSS ? 'distributor' : 'retailer')} first.`
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      setIsUploadingTemplate(true);

      if (isAdmin) {
        if (pricingScope === 'ENTITY') {
          const promises = selectedTargetIds.map((targetId) =>
            catalogService.adminUploadScopedPricingFile(
              fileAsset.uri,
              fileAsset.name,
              fileAsset.mimeType || '',
              pricingScope,
              targetId
            )
          );
          const results = await Promise.all(promises);
          const res = results[0];
          Alert.alert(
            'Upload Success',
            `Pricing upload completed. Scopes updated: ${selectedTargetIds.length}.\nSuccess Count: ${res.successCount ?? 0}\nErrors: ${res.errors?.length ?? 0}`
          );
        } else {
          const targetId = pricingScope === 'STATE' ? selectedTargetIds[0] : undefined;
          const res = await catalogService.adminUploadScopedPricingFile(
            fileAsset.uri,
            fileAsset.name,
            fileAsset.mimeType || '',
            pricingScope,
            targetId
          );
          Alert.alert(
            'Upload Success',
            `Pricing upload completed.\nSuccess Count: ${res.successCount ?? 0}\nErrors: ${res.errors?.length ?? 0}`
          );
        }
        refetchPricing();
      } else {
        const base64Str = await FileSystem.readAsStringAsync(fileAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const workbook = XLSX.read(base64Str, { type: 'base64' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Uploaded file has no sheet');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as string[][];

        const parsedRows = parseStrictTemplateRowsFromMatrix(matrix);

        const prices = parsedRows.map((row) => {
          const masterSkuId = String(row.raw['Unique'] ?? row.raw['Product Code'] ?? '').trim().toUpperCase();
          const rawPrice = String(row.raw['Distributor total'] ?? row.raw['Unit Price'] ?? row.raw['for per/pc price'] ?? '').trim();
          const sellingPrice = Number(rawPrice);

          if (!masterSkuId || isNaN(sellingPrice)) {
            throw new Error(`Invalid price value for product ${masterSkuId}`);
          }
          return { masterSkuId, sellingPrice };
        });

        await Promise.all(
          selectedTargetIds.map((targetEntityId) =>
            catalogService.bulkSetPrices(targetEntityId, prices)
          )
        );

        refetchPricing();
        Alert.alert(
          'Upload Success',
          `Pricing template uploaded and applied to ${selectedTargetIds.length} target(s).`
        );
      }
    } catch (err: any) {
      console.error('Pricing upload error:', err);
      Alert.alert('Upload Error', err.message || 'Failed to upload pricing template.');
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  if (!isAuthorized) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          You do not have access to browse the catalog manager.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Page Title & Count */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-slate-900">SKU Catalog</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {isAdmin
              ? `${total} product${total !== 1 ? 's' : ''} in master catalog`
              : isDist
                ? `${total} product${total !== 1 ? 's' : ''} available in your catalog`
                : `${total} product${total !== 1 ? 's' : ''} in master catalog — toggle to enable for your network`}
          </Text>
        </View>

        {/* Tab Controls */}
        <View className="bg-gray-100 border border-gray-200 rounded-xl p-1 flex-row mb-4">
          <TouchableOpacity
            onPress={() => setActiveTab('catalog')}
            className={`flex-1 flex-row items-center justify-center py-2 px-3 rounded-lg gap-1.5 ${activeTab === 'catalog' ? 'bg-white border border-gray-200 shadow-xs' : ''
              }`}
          >
            <Ionicons name="search" size={14} color={activeTab === 'catalog' ? '#1e293b' : '#64748b'} />
            <Text className={`text-xs font-bold ${activeTab === 'catalog' ? 'text-slate-800' : 'text-slate-500'}`}>Catalog</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('pricing')}
            className={`flex-1 flex-row items-center justify-center py-2 px-3 rounded-lg gap-1.5 ${activeTab === 'pricing' ? 'bg-white border border-gray-200 shadow-xs' : ''
              }`}
          >
            <Text className={`text-xs font-bold ${activeTab === 'pricing' ? 'text-slate-800' : 'text-slate-500'}`}>₹</Text>
            <Text className={`text-xs font-bold ${activeTab === 'pricing' ? 'text-slate-800' : 'text-slate-500'}`}>Pricing</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar & Admin Actions inside catalog tab */}
        {activeTab === 'catalog' && (
          <View>
            {isAdmin && (
              /* Action Button Controls Grid */
              <View className="flex-row gap-2 mb-4 justify-between">
                <TouchableOpacity
                  onPress={() => handleDownloadTemplate('catalog-bulk-upload-template.xlsx')}
                  disabled={isDownloadingTemplate}
                  className="flex-1 border border-gray-250 bg-white rounded-xl py-3 px-1 flex-row items-center justify-center gap-1"
                >
                  <Ionicons name="download-outline" size={14} color="#475569" />
                  <Text className="text-[10px] font-bold text-slate-700 text-center leading-3">
                    {isDownloadingTemplate ? 'Downloading...' : `Download\nTemplate`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUploadTemplate}
                  disabled={isUploadingTemplate}
                  className="flex-1 border border-gray-200 bg-white rounded-xl py-3 px-1 flex-row items-center justify-center gap-1"
                >
                  <Ionicons name="upload-outline" size={14} color="#475569" />
                  <Text className="text-[10px] font-bold text-slate-700 text-center leading-3">
                    {isUploadingTemplate ? 'Uploading...' : `Upload\nTemplate`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowAddStock(true)}
                  className="flex-1 border border-emerald-500 bg-white rounded-xl py-3 px-1 flex-row items-center justify-center gap-1"
                >
                  <Ionicons name="add-outline" size={15} color="#10b981" />
                  <Text className="text-[10px] font-bold text-emerald-600 text-center leading-3">Add{"\n"}Stock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    resetSkuForm();
                    setShowAddSku(true);
                  }}
                  className="flex-1 bg-[#f37021] rounded-xl py-3 px-1 flex-row items-center justify-center gap-1"
                >
                  <Ionicons name="add-outline" size={15} color="white" />
                  <Text className="text-[10px] font-bold text-white text-center leading-3">Add New{"\n"}SKU</Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="bg-white border border-gray-250 rounded-xl px-3 py-2.5 flex-row items-center mb-4 shadow-xs">
              <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
              <TextInput
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  setPage(1);
                }}
                placeholder="Search by product name..."
                placeholderTextColor="#9ca3af"
                className="flex-grow text-xs text-gray-800 p-0"
              />
            </View>
          </View>
        )}

        {/* Content View / Product Table */}
        {activeTab === 'catalog' && (
          catalogLoading ? (
            <ActivityIndicator size="large" color="#f37021" className="my-12" />
          ) : skusList.length === 0 ? (
            <View className="bg-white border border-gray-200 rounded-2xl p-8 items-center justify-center mb-8">
              <Ionicons name="cube-outline" size={32} color="#9ca3af" className="opacity-40" />
              <Text className="text-xs text-gray-400 mt-2">No products found</Text>
            </View>
          ) : (
            <View className="pb-12">
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                <View>
                  {/* Table Header */}
                  <View className="flex-row bg-gray-55 border-b border-gray-200 py-3 px-4">
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-12 text-center">S.No</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32">Unique</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-44">Name of Product</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Weight</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Master Pkg.</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Master Pack</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Case qty</Text>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">for per/pc</Text>
                    
                    {(isAdmin || (!isSS && !isDist)) && (
                      <>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">MRP/UNIT</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Offer Rate NEW</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Box rate</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">scheme %</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">scheme Amount</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Billing</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Per/pc</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">18%</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">5%</Text>
                      </>
                    )}
                    
                    {(isAdmin || isSS) && (
                      <>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">super total/pc</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Super total/case</Text>
                      </>
                    )}
                    {isAdmin && (
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">S.S.MARGIN 7%</Text>
                    )}
                    
                    {(isAdmin || isDist) && (
                      <>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">Distributor total /pc</Text>
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Distributor total / case</Text>
                      </>
                    )}
                    {isAdmin && (
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Dist. Margin 10%</Text>
                    )}
                    {isAdmin && (
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Retail</Text>
                    )}
                    {isSS && (
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Enabled</Text>
                    )}
                    {isAdmin && (
                      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Action</Text>
                    )}
                  </View>

                  {/* Table Body */}
                  {skusList.map((sku: any, index) => {
                    const isEven = index % 2 === 0;
                    return (
                      <View key={sku.masterSkuId || sku._id} className={`flex-row border-b border-gray-100 py-3 px-4 items-center ${isEven ? 'bg-white' : 'bg-orange-50/5'}`}>
                        <Text className="text-xs font-semibold text-gray-550 w-12 text-center">{((page - 1) * 20) + index + 1}</Text>
                        <Text className="text-xs font-semibold text-gray-555 w-32">{sku.masterSkuId}</Text>
                        <Text className="text-xs font-semibold text-gray-800 w-44 leading-normal" numberOfLines={2}>{sku.name}</Text>
                        <Text className="text-xs font-semibold text-gray-555 w-20 text-center">{sku.weight || '-'}</Text>
                        <Text className="text-xs font-semibold text-gray-555 w-24 text-center">{sku.masterPackUnit ?? '-'}</Text>
                        <Text className="text-xs font-semibold text-gray-555 w-24 text-center">{sku.masterPackQty ?? '-'}</Text>
                        <Text className="text-xs font-semibold text-gray-555 w-24 text-center">{sku.boxQty ?? '-'}</Text>
                        <Text className="text-xs font-semibold text-gray-555 w-24 text-center">{sku.perPcPrice ?? '-'}</Text>
                        
                        {(isAdmin || (!isSS && !isDist)) && (
                          <>
                            <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                              {formatCurrency(sku.mrpPerUnit ?? sku.unitPrice)}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                              {sku.offerRateNew ? formatCurrency(sku.offerRateNew) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                              {sku.boxRate ? formatCurrency(sku.boxRate) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-20 text-center">
                              {sku.schemePercent ? `${sku.schemePercent}%` : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                              {sku.schemeAmount ? formatCurrency(sku.schemeAmount) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                              {sku.billing ? formatCurrency(sku.billing) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                              {sku.billing ? formatCurrency(sku.billing / (sku.perPcPrice || 1)) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                              {sku.tax18 ? formatCurrency(sku.tax18) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                              {sku.tax5 ? formatCurrency(sku.tax5) : '-'}
                            </Text>
                          </>
                        )}
                        
                        {(isAdmin || isSS) && (
                          <>
                            <Text className="text-xs font-semibold text-orange-600 w-28 text-center">
                              {sku.superTotal ? formatCurrency(sku.superTotal) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-orange-600 w-36 text-center">
                              {sku.superTotal && (sku.masterPackQty) ? formatCurrency(sku.superTotal * sku.masterPackQty) : '-'}
                            </Text>
                          </>
                        )}
                        
                        {isAdmin && (
                          <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                            {sku.ssMargin ? formatCurrency(sku.ssMargin) : '-'}
                          </Text>
                        )}
                        
                        {(isAdmin || isDist) && (
                          <>
                            <Text className="text-xs font-semibold text-emerald-600 w-32 text-center">
                              {sku.distributorTotal ? formatCurrency(sku.distributorTotal) : '-'}
                            </Text>
                            <Text className="text-xs font-semibold text-emerald-600 w-36 text-center">
                              {sku.distributorTotal && (sku.masterPackQty) ? formatCurrency(sku.distributorTotal * sku.masterPackQty) : '-'}
                            </Text>
                          </>
                        )}
                        
                        {isAdmin && (
                          <Text className="text-xs font-semibold text-gray-555 w-28 text-center">
                            {sku.distMargin ? formatCurrency(sku.distMargin) : '-'}
                          </Text>
                        )}
                        
                        {isAdmin && (
                          <Text className="text-xs font-semibold text-amber-600 w-28 text-center">
                            {sku.retailTotal ? formatCurrency(sku.retailTotal) : '-'}
                          </Text>
                        )}

                        {isSS && (
                          <View className="w-20 items-center justify-center">
                            <TouchableOpacity
                              onPress={() => handleToggleAssortment(sku)}
                              disabled={toggleSkuMutation.isPending}
                              className={`items-center justify-center border ${
                                sku.enabled
                                  ? 'bg-emerald-100 border-emerald-200 w-7 h-7 rounded-lg'
                                  : 'bg-gray-100 border-gray-200 w-7 h-7 rounded-lg'
                              }`}
                            >
                              {sku.enabled ? (
                                <Ionicons name="checkmark" size={14} color="#047857" />
                              ) : (
                                <Ionicons name="close" size={14} color="#9ca3af" />
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                        
                        {isAdmin && (
                          <View className="w-36 flex-row items-center justify-center gap-1.5">
                            <TouchableOpacity
                              onPress={() => {
                                router.push(`/catalog/${sku.masterSkuId}/edit` as any);
                              }}
                              className="border border-gray-200 bg-white rounded-lg px-2 py-1 items-center justify-center flex-row gap-1"
                            >
                              <Ionicons name="pencil" size={12} color="#475569" />
                              <Text className="text-[10px] font-bold text-gray-600">Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteSku(sku)}
                              disabled={deleteSkuMutation.isPending}
                              className="border border-red-200 bg-red-50 rounded-lg px-2 py-1 items-center justify-center flex-row gap-1"
                            >
                              <Ionicons name="trash-outline" size={12} color="#dc2626" />
                              <Text className="text-[10px] font-bold text-red-600">Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )
        )}

        {/* Pricing Tab View */}
        {activeTab === 'pricing' && (
          <View className="pb-24">
            {/* Scopes Dropdowns */}
            <View className="gap-2.5 mb-4">
              {isAdmin ? (
                <>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-gray-700 font-semibold w-24">Pricing scope:</Text>
                    <TouchableOpacity
                      onPress={() => setShowScopeModal(true)}
                      className="flex-row items-center justify-between border-2 border-orange-500 bg-white rounded-xl px-4 py-2 flex-1"
                    >
                      <Text className="text-xs text-gray-800 font-semibold">
                        {pricingScope === 'GLOBAL' ? 'Global (All India)' : 'State-wise'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>

                  {pricingScope === 'STATE' && (
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-gray-700 font-semibold w-24">Select State:</Text>
                      <TouchableOpacity
                        onPress={() => setShowTargetModal(true)}
                        className="flex-row items-center justify-between border border-gray-200 bg-white rounded-xl px-4 py-2 flex-1"
                      >
                        <Text className={`text-xs ${selectedTargetIds.length > 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                          {selectedTargetIds.length === 0
                            ? 'Select State...'
                            : selectedTargetIds.length === 1
                              ? selectedTargetIds[0]
                              : `${selectedTargetIds.length} States Selected`}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {pricingScope === 'GLOBAL' && (
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-gray-700 font-semibold w-10">Role:</Text>
                      <TouchableOpacity
                        onPress={() => setShowRoleModal(true)}
                        className="flex-row items-center justify-between border border-gray-200 bg-white rounded-xl px-3 py-2 w-32"
                      >
                        <Text className="text-xs text-gray-800 font-semibold">
                          {selectedRole === UserRole.SUPER_STOCKIST
                            ? 'Super Stockist'
                            : selectedRole === UserRole.DISTRIBUTOR
                              ? 'Distributor'
                              : 'Retailer'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#6b7280" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowTargetModal(true)}
                        className="flex-row items-center justify-between border border-gray-200 bg-white rounded-xl px-3 py-2 flex-1"
                      >
                        <Text className={`text-xs ${selectedTargetIds.length > 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
                          {selectedTargetIds.length === 0
                            ? `Select ${selectedRole === UserRole.SUPER_STOCKIST ? 'Super Stockist' : selectedRole === UserRole.DISTRIBUTOR ? 'Distributor' : 'Retailer'}...`
                            : selectedTargetIds.length === 1
                              ? (entitiesList.find((e: any) => e.entityId === selectedTargetIds[0])?.name || selectedTargetIds[0])
                              : `${selectedTargetIds.length} Selected`}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-gray-700 font-semibold w-24">
                    Set prices for:
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowTargetModal(true)}
                    className="flex-row items-center justify-between border border-gray-200 bg-white rounded-xl px-4 py-2 flex-1"
                  >
                    <Text className={`text-xs ${selectedTargetIds.length > 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
                      {selectedTargetIds.length === 0
                        ? `Select ${isSS ? 'Distributor' : 'Retailer'}...`
                        : selectedTargetIds.length === 1
                          ? (entitiesList.find((e: any) => e.entityId === selectedTargetIds[0])?.name || selectedTargetIds[0])
                          : `${selectedTargetIds.length} Selected`}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Template Buttons */}
            <View className="flex-row gap-2.5 mb-4 justify-between">
              <TouchableOpacity
                onPress={() => handleDownloadTemplate('pricing-template.xlsx')}
                disabled={isDownloadingTemplate}
                className="flex-1 border border-gray-200 bg-white rounded-xl py-3 px-3 flex-row items-center justify-center gap-1.5"
              >
                <Ionicons name="download-outline" size={15} color="#475569" />
                <Text className="text-[11px] font-bold text-slate-700 text-center">
                  {isDownloadingTemplate ? 'Downloading...' : 'Download Template'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUploadPricingTemplate}
                disabled={isUploadingTemplate}
                className="flex-1 border border-gray-200 bg-white rounded-xl py-3 px-3 flex-row items-center justify-center gap-1.5"
              >
                <Ionicons name="upload-outline" size={15} color="#475569" />
                <Text className="text-[11px] font-bold text-slate-700 text-center">
                  {isUploadingTemplate ? 'Uploading...' : 'Upload Template'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Main pricing view */}
            {((isAdmin && pricingScope !== 'GLOBAL') || !isAdmin) && !selectedTargetId ? (
              <View className="bg-white border border-gray-200 rounded-xl p-8 items-center justify-center shadow-sm">
                <Ionicons name="logo-usd" size={32} color="#9ca3af" className="opacity-45 mb-2" />
                <Text className="text-xs text-gray-500 text-center">
                  {isAdmin
                    ? 'Select a target state or entity to manage SKU prices'
                    : `Select a ${isSS ? 'distributor' : 'retailer'} to manage their SKU prices`}
                </Text>
              </View>
            ) : pricingLoading ? (
              <ActivityIndicator size="large" color="#f97316" className="my-12" />
            ) : pricingRows.length === 0 ? (
              <View className="bg-white border border-gray-200 rounded-xl p-8 items-center justify-center">
                <Text className="text-xs text-gray-400">No SKUs available for pricing</Text>
              </View>
            ) : (
              <View className="pb-12">
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                  <View>
                    {/* Table Header */}
                    {(() => {
                      const activeRoleEdit = isAdmin
                        ? (selectedRole === UserRole.SUPER_STOCKIST ? 'SS' : (selectedRole === UserRole.DISTRIBUTOR ? 'DIST' : 'RETAIL'))
                        : (isSS ? 'DIST' : (isDist ? 'RETAIL' : null));
                      return (
                        <>
                          <View className="flex-row bg-gray-55 border-b border-gray-200 py-3 px-4">
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-12 text-center">S.No</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32">Unique</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-44">Name of Product</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Weight</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Master Pkg.</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Master Pack</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Box qty</Text>
                            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">for per/pc</Text>
                            
                            {(!isSS && !isDist || activeRoleEdit === 'RETAIL') && (
                              <>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">MRP/UNIT</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Offer Rate NEW</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Box qty</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Box rate</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">scheme %</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">scheme Amount</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Billing</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Per/pc</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">18%</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">5%</Text>
                              </>
                            )}
                            
                            {(isAdmin || isSS) && (
                              <>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">super total/pc</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Super total/box</Text>
                              </>
                            )}
                            {isAdmin && (
                              <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">S.S.MARGIN 7%</Text>
                            )}
                            
                            {(isAdmin || isDist || activeRoleEdit === 'DIST') && (
                              <>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">Distributor total /pc</Text>
                                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-36 text-center">Distributor total / box</Text>
                              </>
                            )}
                            {isAdmin && (
                              <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Dist. Margin 10%</Text>
                            )}
                            {(isAdmin || activeRoleEdit === 'RETAIL') && (
                              <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">Retail</Text>
                            )}
                                                     <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Custom</Text>
                            {(!isSS && !isDist) && (
                              <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Action</Text>
                            )}
                          </View>

                          {/* Table Body */}
                          {pricingRows.map((row: any, index) => {
                             const masterSkuId = row.masterSkuId;
                             const isEven = index % 2 === 0;
                             const isEditing = masterSkuId in editingPrices;

                             // SS & DIST edit custom case price, RETAIL edits custom piece price
                             let initialVal = '';
                             if (activeRoleEdit === 'SS') {
                               initialVal = row.isCustomPrice
                                 ? String(Math.round(((row.sellingPrice / 12) * (row.boxQty || 1)) * 100) / 100)
                                 : String(Math.round(((row.superTotal || 0) * (row.boxQty || 1)) * 100) / 100);
                             } else if (activeRoleEdit === 'DIST') {
                               initialVal = row.isCustomPrice
                                 ? String(Math.round(((row.sellingPrice / 12) * (row.boxQty || 1)) * 100) / 100)
                                 : String(Math.round(((row.distributorTotal || 0) * (row.boxQty || 1)) * 100) / 100);
                             } else if (activeRoleEdit === 'RETAIL') {
                               initialVal = row.isCustomPrice
                                 ? String(Math.round((row.sellingPrice / 12) * 100) / 100)
                                 : String(Math.round(((row.retailTotal || 0)) * 100) / 100);
                             }
                             const currentEditVal = editingPrices[masterSkuId] !== undefined ? editingPrices[masterSkuId] : initialVal;

                             return (
                               <View key={masterSkuId} className={`flex-row border-b border-gray-100 py-3 px-4 items-center ${isEven ? 'bg-white' : 'bg-orange-50/5'}`}>
                                 <Text className="text-xs font-semibold text-gray-550 w-12 text-center">{index + 1}</Text>
                                 <Text className="text-xs font-semibold text-gray-550 w-32">{masterSkuId}</Text>
                                 <Text className="text-xs font-semibold text-gray-800 w-44 leading-normal" numberOfLines={2}>{row.name}</Text>
                                 <Text className="text-xs font-semibold text-gray-550 w-20 text-center">{row.weight || '-'}</Text>
                                 <Text className="text-xs font-semibold text-gray-550 w-24 text-center">{row.masterPackUnit ?? '-'}</Text>
                                 <Text className="text-xs font-semibold text-gray-550 w-24 text-center">{row.masterPackQty ?? '-'}</Text>
                                 <Text className="text-xs font-semibold text-gray-550 w-24 text-center">{row.boxQty ?? '-'}</Text>
                                 <Text className="text-xs font-semibold text-gray-550 w-24 text-center">{row.perPcPrice ?? '-'}</Text>
                                 
                                 {(!isSS && !isDist || activeRoleEdit === 'RETAIL') && (
                                   <>
                                     <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                                       {formatCurrency(row.mrpPerUnit ?? row.unitPrice)}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                                       {row.offerRateNew ? formatCurrency(row.offerRateNew) : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                                       {row.boxQty ? row.boxQty : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                                       {row.boxRate ? formatCurrency(row.boxRate) : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-20 text-center">
                                       {row.schemePercent ? `${row.schemePercent}%` : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                                       {row.schemeAmount ? formatCurrency(row.schemeAmount) : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                                       {row.billing ? formatCurrency(row.billing) : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-28 text-center">
                                       {row.billing ? formatCurrency(row.billing / (row.perPcPrice || 1)) : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                                       {row.tax18 ? formatCurrency(row.tax18) : '-'}
                                     </Text>
                                     <Text className="text-xs font-semibold text-gray-550 w-24 text-center">
                                       {row.tax5 ? formatCurrency(row.tax5) : '-'}
                                     </Text>
                                   </>
                                 )}
                                 
                                 {(isAdmin || isSS) && (
                                   <>
                                     <Text className="text-xs font-semibold text-orange-600 w-28 text-center">
                                       {(row.isCustomPrice && activeRoleEdit === 'SS') ? formatCurrency(row.sellingPrice / 12) : (row.superTotal ? formatCurrency(row.superTotal) : '-')}
                                     </Text>
                                     <View className="w-36 items-center justify-center">
                                       {(isEditing && activeRoleEdit === 'SS') ? (
                                         <TextInput
                                           keyboardType="numeric"
                                           value={currentEditVal}
                                           onChangeText={(text) => setEditingPrices((prev) => ({ ...prev, [masterSkuId]: text }))}
                                           className="border border-orange-500 rounded-lg px-2 py-1 text-xs text-gray-800 bg-white w-28 text-center font-semibold"
                                           autoFocus
                                         />
                                       ) : (
                                         <Text className="text-xs font-semibold text-orange-600 text-center">
                                           {(row.isCustomPrice && activeRoleEdit === 'SS') ? formatCurrency((row.sellingPrice / 12) * (row.boxQty || 1)) : (row.superTotal && row.boxQty ? formatCurrency(row.superTotal * row.boxQty) : '-')}
                                         </Text>
                                       )}
                                     </View>
                                   </>
                                 )}
                                 
                                 {isAdmin && (
                                   <Text className="text-xs font-semibold text-gray-500 w-28 text-center">
                                     {row.ssMargin ? formatCurrency(row.ssMargin) : '-'}
                                   </Text>
                                 )}
                                 {(isAdmin || isDist || activeRoleEdit === 'DIST') && (
                                   <>
                                     <Text className="text-xs font-semibold text-emerald-600 w-32 text-center">
                                       {(row.isCustomPrice && activeRoleEdit === 'DIST') ? formatCurrency(row.sellingPrice / 12) : (row.distributorTotal ? formatCurrency(row.distributorTotal) : '-')}
                                     </Text>
                                     <View className="w-36 items-center justify-center">
                                       {(isEditing && activeRoleEdit === 'DIST') ? (
                                         <TextInput
                                           keyboardType="numeric"
                                           value={currentEditVal}
                                           onChangeText={(text) => setEditingPrices((prev) => ({ ...prev, [masterSkuId]: text }))}
                                           className="border border-orange-500 rounded-lg px-2 py-1 text-xs text-gray-800 bg-white w-28 text-center font-semibold"
                                           autoFocus
                                         />
                                       ) : (
                                         <Text className="text-xs font-semibold text-emerald-600 text-center">
                                           {(row.isCustomPrice && activeRoleEdit === 'DIST') ? formatCurrency((row.sellingPrice / 12) * (row.boxQty || 1)) : (row.distributorTotal && row.boxQty ? formatCurrency(row.distributorTotal * row.boxQty) : '-')}
                                         </Text>
                                       )}
                                     </View>
                                   </>
                                 )}
                                 
                                 {isAdmin && (
                                   <Text className="text-xs font-semibold text-gray-555 w-28 text-center">
                                     {row.distMargin ? formatCurrency(row.distMargin) : '-'}
                                   </Text>
                                 )}
                                 
                                 {(isAdmin || activeRoleEdit === 'RETAIL') && (
                                   <View className="w-28 items-center justify-center">
                                     {(isEditing && activeRoleEdit === 'RETAIL') ? (
                                       <TextInput
                                         keyboardType="numeric"
                                         value={currentEditVal}
                                         onChangeText={(text) => setEditingPrices((prev) => ({ ...prev, [masterSkuId]: text }))}
                                         className="border border-orange-500 rounded-lg px-2 py-1 text-xs text-gray-800 bg-white w-20 text-center font-semibold"
                                         autoFocus
                                       />
                                     ) : (
                                       <Text className="text-xs font-semibold text-amber-600 text-center">
                                         {(row.isCustomPrice && activeRoleEdit === 'RETAIL') ? formatCurrency(row.sellingPrice / 12) : (row.retailTotal ? formatCurrency(row.retailTotal) : '-')}
                                       </Text>
                                     )}
                                   </View>
                                 )}
                                 
                                 <View className="w-20 items-center justify-center">
                                   <View className={`rounded-full px-2 py-0.5 border ${row.isCustomPrice ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                     <Text className={`text-[10px] font-semibold ${row.isCustomPrice ? 'text-emerald-700' : 'text-gray-500'}`}>
                                       {row.isCustomPrice ? 'Custom' : 'Default'}
                                     </Text>
                                   </View>
                                 </View>
                                 
                                 {(!isSS && !isDist) && (
                                   <View className="w-24 flex-row gap-2 items-center justify-center">
                                     {isAdmin && (
                                       <TouchableOpacity
                                         onPress={() => {
                                           router.push(`/catalog/${masterSkuId}/edit` as any);
                                         }}
                                         className="border border-gray-200 bg-white rounded-lg px-2 py-1 items-center justify-center flex-row gap-1"
                                       >
                                         <Ionicons name="pencil" size={12} color="#475569" />
                                         <Text className="text-[10px] font-bold text-gray-600">Edit</Text>
                                       </TouchableOpacity>
                                     )}
                                   </View>
                                 )}
                               </View>
                           );
                          })}
                        </>
                      );
                    })()}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Scope Selection Modal */}
            <SelectorModal
              visible={showScopeModal}
              onClose={() => setShowScopeModal(false)}
              data={[
                { value: 'GLOBAL', label: 'Global (All India)' },
                { value: 'STATE', label: 'State-wise' },
              ]}
              selectedValue={pricingScope}
              onSelect={(val: any) => {
                setPricingScope(val);
                setSelectedTargetIds([]);
                setEditingPrices({});
              }}
              title="Select Pricing Scope"
            />

            {/* Role Selection Modal */}
            <SelectorModal
              visible={showRoleModal}
              onClose={() => setShowRoleModal(false)}
              data={[
                { value: UserRole.SUPER_STOCKIST, label: 'Super Stockist' },
                { value: UserRole.DISTRIBUTOR, label: 'Distributor' },
                { value: UserRole.RETAILER, label: 'Retailer' },
              ]}
              selectedValue={selectedRole}
              onSelect={(val: any) => {
                setSelectedRole(val);
                setSelectedTargetIds([]);
                setEditingPrices({});
              }}
              title="Select Target Role"
            />

            {/* Target State or Entity Modal (Multi-Select Enabled) */}
            <MultiSelectorModal
              visible={showTargetModal}
              onClose={() => setShowTargetModal(false)}
              data={
                pricingScope === 'STATE'
                  ? statesList.filter((state: string) => typeof state === 'string' && !state.includes(',')).map((state: string) => ({ value: state, label: state }))
                  : entitiesList.map((e: any) => ({
                    value: e.entityId,
                    label: `${e.name} (${e.entityId})`,
                  }))
              }
              selectedValues={selectedTargetIds}
              onSelect={(vals: string[]) => {
                setSelectedTargetIds(vals);
                setEditingPrices({});
              }}
              title={pricingScope === 'STATE' ? 'Select Target States' : 'Select Target Entities'}
            />
          </View>
        )}
      </ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-center py-4 border-t border-gray-100 gap-4 bg-white">
          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            className={`p-2 border rounded-lg ${page === 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
              }`}
          >
            <Ionicons name="chevron-back" size={16} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xs text-gray-600 font-semibold">
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity
            disabled={page === totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`p-2 border rounded-lg ${page === totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
              }`}
          >
            <Ionicons name="chevron-forward" size={16} color="#374151" />
          </TouchableOpacity>
        </View>
      )}

      {/* Add SKU Modal */}
      {showAddSku && (
        <Modal visible={showAddSku} animationType="slide" onRequestClose={() => setShowAddSku(false)}>
          <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-800">Add New SKU</Text>
              <TouchableOpacity onPress={() => setShowAddSku(false)} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1 p-6 gap-4" showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1">Product Code *</Text>
                <TextInput
                  value={skuCode}
                  onChangeText={setSkuCode}
                  placeholder="e.g. SKU-001"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1">Product Name *</Text>
                <TextInput
                  value={skuName}
                  onChangeText={setSkuName}
                  placeholder="e.g. Hair Oil 200ml"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1">Principal Category *</Text>
                <TextInput
                  value={skuPrincipal}
                  onChangeText={setSkuPrincipal}
                  placeholder="e.g. Hair Care"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-500 mb-1">MRP Unit Price *</Text>
                  <TextInput
                    value={skuUnitPrice}
                    onChangeText={setSkuUnitPrice}
                    placeholder="INR"
                    keyboardType="numeric"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-500 mb-1">Pack Qty</Text>
                  <TextInput
                    value={skuPackQty}
                    onChangeText={setSkuPackQty}
                    placeholder="Pieces per box"
                    keyboardType="numeric"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                  />
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1">SS Price Dozen</Text>
                <TextInput
                  value={skuPriceDozenSS}
                  onChangeText={setSkuPriceDozenSS}
                  placeholder="INR"
                  keyboardType="numeric"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xs font-semibold text-gray-500">Scheme Eligible</Text>
                <Switch
                  value={skuSchemeEligible}
                  onValueChange={setSkuSchemeEligible}
                  trackColor={{ false: '#d1d5db', true: '#f97316' }}
                  thumbColor={skuSchemeEligible ? '#f37021' : '#f3f4f6'}
                />
              </View>

              <View className="flex-row justify-end gap-3 mb-16">
                <TouchableOpacity
                  onPress={() => setShowAddSku(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg"
                >
                  <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateSku}
                  className="px-5 py-2.5 bg-[#f37021] rounded-lg"
                >
                  <Text className="text-sm font-bold text-white">Create SKU</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Add Stock Modal */}
      {showAddStock && (
        <Modal visible={showAddStock} animationType="slide" onRequestClose={() => setShowAddStock(false)}>
          <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-800">Add Manufactured Stock</Text>
              <TouchableOpacity onPress={() => setShowAddStock(false)} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1 p-6 gap-4" showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-1">Select Product *</Text>
                <View className="border border-gray-200 rounded-lg bg-gray-50 p-2">
                  <ScrollView style={{ maxHeight: 150 }}>
                    {skusList.map((s) => (
                      <TouchableOpacity
                        key={s.masterSkuId}
                        onPress={() => setStockSkuId(s.masterSkuId)}
                        className={`p-3 border-b border-gray-100 ${stockSkuId === s.masterSkuId ? 'bg-orange-50' : ''
                          }`}
                      >
                        <Text className={`text-xs ${stockSkuId === s.masterSkuId ? 'text-orange-700 font-bold' : 'text-gray-700'}`}>
                          {s.name} ({s.masterSkuId})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-xs font-semibold text-gray-500 mb-1">Quantity to Add *</Text>
                <TextInput
                  value={stockQty}
                  onChangeText={setStockQty}
                  placeholder="e.g. 500"
                  keyboardType="numeric"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                />
              </View>

              <View className="flex-row justify-end gap-3 mb-16">
                <TouchableOpacity
                  onPress={() => setShowAddStock(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg"
                >
                  <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddStock}
                  className="px-5 py-2.5 bg-[#f37021] rounded-lg"
                >
                  <Text className="text-sm font-bold text-white">Add Stock</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}


    </View>
  );
}
