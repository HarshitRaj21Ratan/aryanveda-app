import React, { useState, useMemo, useEffect } from 'react';
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
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth.store';
import { orderService } from '@/services/order.service';
import { userService } from '@/services/user.service';
import { visitService } from '@/services/visit.service';
import { retailerAuthorizationService } from '@/services/retailerAuthorization.service';
import { UserRole, OrderType, OrderStatus, type IOrder } from '@/types';
import { STATE_OPTIONS } from '@/lib/states';
import {
  STATUS_CONFIG,
  formatCurrency,
  getDistanceMeters,
  participantLabel,
  canApproveOrder,
  canDispatchOrder,
  canDeliverOrder,
  canCancelOrder,
} from '@/lib/order-helpers';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ApproveOrderModal from '@/components/orders/ApproveOrderModal';

const { width } = Dimensions.get('window');

function LocationBadge({ activity }: { activity?: IOrder['orderActivity'] }) {
  if (!activity) return null;
  const isStore = activity === 'in_store';
  return (
    <View
      className={`px-2 py-0.5 rounded-full border ${isStore ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
        }`}
    >
      <Text
        className={`text-[10px] font-bold ${isStore ? 'text-emerald-700' : 'text-red-700'
          }`}
      >
        {isStore ? 'In Store' : 'Out Store'}
      </Text>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ type?: string; status?: string; state?: string; beat?: string; orderFlow?: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const roleStr = (user?.role || '').toLowerCase();
  const isSS = user?.role === UserRole.SUPER_STOCKIST || roleStr === 'super_stockist';
  const isDist = user?.role === UserRole.DISTRIBUTOR || roleStr === 'distributor';
  const isSO = user?.role === UserRole.SO || user?.role === UserRole.ASE || roleStr === 'so' || roleStr === 'ase';
  const isRetailer = user?.role === UserRole.RETAILER || roleStr === 'retailer';
  const isAdmin = user?.role === UserRole.ADMIN || roleStr === 'admin';
  const isFinance = user?.role === UserRole.FINANCE || roleStr === 'finance';
  const isDispatch = user?.role === UserRole.DISPATCH || roleStr === 'dispatch';
  const isRSM = user?.role === UserRole.RSM || roleStr === 'rsm';
  const isASM = user?.role === UserRole.ASM || roleStr === 'asm';
  const isNSM = user?.role === UserRole.NSM || roleStr === 'nsm';
  const isManager = isRSM || isASM || isNSM;
  const isSalesUser = isRSM || isASM;

  const defaultTypeFilter = routeParams.type !== undefined ? routeParams.type : '';

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState(defaultTypeFilter);
  const [statusFilter, setStatusFilter] = useState(routeParams.status || '');
  const [stateFilter, setStateFilter] = useState(routeParams.state || '');
  const [beatFilter, setBeatFilter] = useState(routeParams.beat || '');
  const [levelFilter, setLevelFilter] = useState(routeParams.orderFlow || '');

  React.useEffect(() => {
    if (routeParams.type !== undefined) setTypeFilter(routeParams.type || '');
    if (routeParams.status !== undefined) setStatusFilter(routeParams.status || '');
    if (routeParams.state !== undefined) setStateFilter(routeParams.state || '');
    if (routeParams.beat !== undefined) setBeatFilter(routeParams.beat || '');
    if (routeParams.orderFlow !== undefined) setLevelFilter(routeParams.orderFlow || '');
  }, [routeParams.type, routeParams.status, routeParams.state, routeParams.beat, routeParams.orderFlow]);

  // SO target role selection
  const [soTargetRole, setSoTargetRole] = useState<'RETAILER' | 'DISTRIBUTOR'>('RETAILER');
  const [salesUserTargetRole, setSalesUserTargetRole] = useState<'SUPER_STOCKIST' | 'DISTRIBUTOR'>('SUPER_STOCKIST');
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [selectedDistributorId, setSelectedDistributorId] = useState('');

  // SO Beat & Retailer search filters
  const [retailerBeatFilter, setRetailerBeatFilter] = useState('');
  const [retailerSearchQuery, setRetailerSearchQuery] = useState('');

  // Load persisted beat filter on mount for ASE / SO
  React.useEffect(() => {
    if (!isSO || !user?.entityId) return;
    const loadSavedBeatFilter = async () => {
      try {
        const savedBeat = await AsyncStorage.getItem(`orders_retailer_beat_filter_${user.entityId}`);
        if (savedBeat) {
          setRetailerBeatFilter(savedBeat);
          setBeatSearchQuery(savedBeat);
        }
      } catch (e) {
        console.error('Failed to load saved beat filter', e);
      }
    };
    void loadSavedBeatFilter();
  }, [isSO, user?.entityId]);

  // Persist beat filter whenever it changes
  React.useEffect(() => {
    if (!isSO || !user?.entityId) return;
    const saveBeatFilter = async () => {
      try {
        if (retailerBeatFilter) {
          await AsyncStorage.setItem(`orders_retailer_beat_filter_${user.entityId}`, retailerBeatFilter);
        } else {
          await AsyncStorage.removeItem(`orders_retailer_beat_filter_${user.entityId}`);
        }
      } catch (e) {
        console.error('Failed to persist beat filter', e);
      }
    };
    void saveBeatFilter();
  }, [isSO, retailerBeatFilter, user?.entityId]);

  // Dropdown modals
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showRetailerModal, setShowRetailerModal] = useState(false);
  const [showDistributorModal, setShowDistributorModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [distributorSearchQuery, setDistributorSearchQuery] = useState('');
  const [isSearchingDistributor, setIsSearchingDistributor] = useState(false);

  // Beat Autocomplete states
  const [beatSearchQuery, setBeatSearchQuery] = useState('');
  const [beatSuggestions, setBeatSuggestions] = useState<string[]>([]);
  const [showBeatModal, setShowBeatModal] = useState(false);
  const [beatLoading, setBeatLoading] = useState(false);

  // Visit Store Modal States
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitPhoto, setVisitPhoto] = useState<any>(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [visitLoading, setVisitLoading] = useState(false);
  const [userLatitude, setUserLatitude] = useState<number | null>(null);
  const [userLongitude, setUserLongitude] = useState<number | null>(null);
  const [geofenceDistance, setGeofenceDistance] = useState<number>(0);
  const [isManualVerify, setIsManualVerify] = useState(false);
  // Approve Order Modal State
  const [approveModalOrderId, setApproveModalOrderId] = useState<string | null>(null);

  const fetchBeatSuggestions = async (q: string) => {
    try {
      setBeatLoading(true);
      const results = await userService.searchBeats(q, { state: stateFilter || undefined, limit: 30 });
      setBeatSuggestions(results);
    } catch (e) {
      console.error(e);
    } finally {
      setBeatLoading(false);
    }
  };



  // 1. Fetch Authorized Retailers (SO only)
  const { data: soRetailersData } = useQuery({
    queryKey: ['so-retailers-dashboard-orders'],
    queryFn: () => retailerAuthorizationService.getMyRetailers(),
    enabled: isSO,
    staleTime: 5 * 60 * 1000,
  });

  // 1b. Fetch All Assigned Retailers (SO fallback)
  const { data: allRetailersData } = useQuery({
    queryKey: ['so-all-retailers-orders', user?.entityId],
    queryFn: () => userService.listRetailers({ limit: 1000 }),
    enabled: isSO,
    staleTime: 5 * 60 * 1000,
  });

  // 1c. Fetch Today's Visit Performance for TC/PC badges (SO/ASE only)
  const { data: todayPerformanceData } = useQuery({
    queryKey: ['visit-performance-today', user?.entityId],
    queryFn: () => visitService.getPerformance('day'),
    enabled: !!user && isSO,
    staleTime: 5 * 60 * 1000,
  });

  // 1d. Fetch Today's Secondary Orders for TC/PC badges (SO/ASE only)
  const { data: todayOrdersData } = useQuery({
    queryKey: ['so-today-secondary-orders', user?.entityId],
    queryFn: () => orderService.list({ type: OrderType.SECONDARY, limit: 500 }),
    enabled: !!user && isSO,
    staleTime: 5 * 60 * 1000,
  });

  // 1e. Fetch Authorized SO for Retailer (Retailer only)
  const { data: mySoData } = useQuery({
    queryKey: ['retailer-my-so', user?.entityId],
    queryFn: () => retailerAuthorizationService.getMySo(),
    enabled: !!user && isRetailer,
    staleTime: 5 * 60 * 1000,
  });
  const retailerHasAuthorizedSo = Boolean(mySoData?.data);

  const todayCallStatusMap = useMemo(() => {
    const map: Record<string, 'PC' | 'TC'> = {};
    if (!isSO) return map;

    // 1. Process today's visit logs
    const visits = (todayPerformanceData as any)?.recentVisits ?? [];
    for (const v of visits) {
      const rId = v.retailerEntityId || v.retailerId;
      if (rId) {
        if (v.productive) {
          map[rId] = 'PC';
        } else if (!map[rId]) {
          map[rId] = 'TC';
        }
      }
    }

    // 2. Process today's secondary orders
    const orders = (todayOrdersData as any)?.data ?? [];
    const todayStr = new Date().toISOString().split('T')[0];
    for (const order of orders) {
      const orderDateStr = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '';
      if (orderDateStr === todayStr) {
        const retailerId = order.fromEntityId || order.onBehalfOfEntityId || order.onBehalfOf;
        if (retailerId) {
          map[retailerId] = 'PC';
        }
      }
    }

    return map;
  }, [isSO, todayPerformanceData, todayOrdersData]);

  // 2. Fetch Connected Distributors & Super Stockists (SO/ASM/RSM only)
  const { data: connectedDistributorsData } = useQuery({
    queryKey: ['connected-distributors-orders', user?.entityId],
    queryFn: () => orderService.getConnectedDistributors(),
    enabled: !!user && (isSO || isManager),
    staleTime: 5 * 60 * 1000,
  });

  const { data: connectedSuperStockistsData } = useQuery({
    queryKey: ['connected-super-stockists-orders', user?.entityId],
    queryFn: () => orderService.getConnectedSuperStockists(),
    enabled: !!user && (isSO || isManager),
    staleTime: 5 * 60 * 1000,
  });

  const retailers = useMemo(() => {
    const authRetailers = (soRetailersData as any)?.retailers ?? (soRetailersData as any)?.data?.retailers ?? (soRetailersData as any)?.data ?? [];
    if (Array.isArray(authRetailers) && authRetailers.length > 0) return authRetailers;
    const allRet = (allRetailersData as any)?.data ?? (allRetailersData as any)?.retailers ?? [];
    if (Array.isArray(allRet)) {
      return allRet.map((r: any) => ({
        retailerId: r.entityId || String(r._id),
        entityId: r.entityId,
        name: r.name,
        phone: r.phone ?? '',
        email: r.email ?? '',
        beat: r.beat ?? null,
        storeLatitude: r.storeLatitude ?? null,
        storeLongitude: r.storeLongitude ?? null,
        authorizedAt: new Date().toISOString(),
      }));
    }
    return [];
  }, [soRetailersData, allRetailersData]);

  const distributors = connectedDistributorsData?.data?.distributors ?? [];
  const superStockists = connectedSuperStockistsData?.data?.superStockists ?? [];

  const activeSalesUserEntities = isSO
    ? distributors
    : (salesUserTargetRole === 'SUPER_STOCKIST' ? superStockists : distributors);

  const selectedRetailer = useMemo(() => {
    return retailers.find((r: any) => r.entityId === selectedRetailerId || r.retailerId === selectedRetailerId || r._id === selectedRetailerId);
  }, [retailers, selectedRetailerId]);

  const selectedDistributor = useMemo(() => {
    return activeSalesUserEntities.find((d) => d.entityId === selectedDistributorId);
  }, [activeSalesUserEntities, selectedDistributorId]);

  const soBeatOptions = useMemo(() => {
    const beats = new Set<string>();
    for (const r of retailers) {
      const beat = (r.beat ?? '').trim();
      if (beat) beats.add(beat);
    }
    return Array.from(beats).sort((a, b) => a.localeCompare(b));
  }, [retailers]);

  const filteredSoRetailers = useMemo(() => {
    const selectedBeat = retailerBeatFilter.trim().toLowerCase();
    const q = retailerSearchQuery.trim().toLowerCase();

    let filtered = retailers;
    if (selectedBeat) {
      filtered = filtered.filter((r) => (r.beat ?? '').trim().toLowerCase() === selectedBeat);
    }
    if (q) {
      filtered = filtered.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.entityId || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [retailers, retailerBeatFilter, retailerSearchQuery]);

  // Auto-clear retailer selection if current retailer does not belong to newly selected beat filter
  React.useEffect(() => {
    if (!isSO) return;
    const selectedBeat = retailerBeatFilter.trim().toLowerCase();
    if (!selectedBeat || !selectedRetailerId) return;
    const current = retailers.find((r: any) => r.retailerId === selectedRetailerId || r.entityId === selectedRetailerId || r._id === selectedRetailerId);
    const currentBeat = (current?.beat ?? '').trim().toLowerCase();
    if (current && currentBeat !== selectedBeat) {
      setSelectedRetailerId('');
    }
  }, [isSO, retailerBeatFilter, selectedRetailerId, retailers]);

  // Helper to compute API params shared by summary and list queries
  const getOrderApiParams = React.useCallback(() => {
    const apiType = ['primary_handover', 'primary_approve', 'primary_dispatch'].includes(typeFilter)
      ? OrderType.PRIMARY
      : (typeFilter ? (typeFilter as OrderType) : (isSO && soTargetRole === 'RETAILER' ? OrderType.SECONDARY : undefined));

    const listStatus = typeFilter === 'primary_handover'
      ? OrderStatus.CREATED
      : typeFilter === 'primary_approve'
        ? OrderStatus.IN_FINANCE
        : typeFilter === 'primary_dispatch'
          ? OrderStatus.APPROVED
          : (statusFilter ? (statusFilter as OrderStatus) : undefined);

    const summaryStatus = typeFilter === 'primary_handover'
      ? OrderStatus.CREATED
      : typeFilter === 'primary_approve'
        ? OrderStatus.IN_FINANCE
        : typeFilter === 'primary_dispatch'
          ? OrderStatus.APPROVED
          : undefined;

    const apiOrderFlow = ['primary_handover', 'primary_approve', 'primary_dispatch'].includes(typeFilter)
      ? 'admin_to_super'
      : (levelFilter ? levelFilter : (isManager ? (salesUserTargetRole === 'SUPER_STOCKIST' ? 'admin_to_super' : (typeFilter === OrderType.PRIMARY ? 'super_to_dist' : (typeFilter === OrderType.SECONDARY ? 'dist_to_ret' : 'distributor_all'))) : (isSO ? (soTargetRole === 'DISTRIBUTOR' ? (typeFilter === OrderType.PRIMARY ? 'super_to_dist' : (typeFilter === OrderType.SECONDARY ? 'dist_to_ret' : 'distributor_all')) : 'dist_to_ret') : undefined)));

    const searchParam = isSO
      ? (soTargetRole === 'RETAILER' ? selectedRetailerId : selectedDistributorId) || undefined
      : selectedDistributorId || undefined;

    return {
      apiType,
      listStatus,
      summaryStatus,
      apiOrderFlow,
      beatParam: (isSO && soTargetRole === 'RETAILER' && retailerBeatFilter) ? retailerBeatFilter : (beatFilter || undefined),
      searchParam,
    };
  }, [typeFilter, statusFilter, levelFilter, isManager, salesUserTargetRole, isSO, soTargetRole, selectedRetailerId, selectedDistributorId, retailerBeatFilter, beatFilter]);

  const handleExport = React.useCallback(async () => {
    setIsExporting(true);
    try {
      const { apiType, listStatus, apiOrderFlow, beatParam, searchParam } = getOrderApiParams();

      const baseParams = {
        type: apiType,
        status: listStatus,
        state: stateFilter || undefined,
        beat: beatParam,
        orderFlow: apiOrderFlow,
        search: searchParam,
      };

      await orderService.exportOrdersXlsx(baseParams);
    } catch (e: any) {
      console.error('[OrdersScreen] Export error:', e);
      Alert.alert('Error', e.message || 'Failed to export orders');
    } finally {
      setIsExporting(false);
    }
  }, [getOrderApiParams, stateFilter]);

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: [
      'orders-summary-dashboard-app',
      typeFilter,
      statusFilter,
      stateFilter,
      beatFilter,
      retailerBeatFilter,
      levelFilter,
      soTargetRole,
      salesUserTargetRole,
      selectedRetailerId,
      selectedDistributorId,
    ],
    queryFn: async () => {
      try {
        const { apiType, summaryStatus, apiOrderFlow, beatParam, searchParam } = getOrderApiParams();
        const params: any = {
          type: apiType,
          status: summaryStatus,
          state: stateFilter || undefined,
          beat: beatParam,
          orderFlow: apiOrderFlow,
          search: searchParam,
        };
        const res = await orderService.summary(params);
        const raw = (res as any)?.data?.summary ?? (res as any)?.summary ?? (res as any)?.data ?? res;
        if (raw && typeof raw === 'object') {
          return {
            CREATED: raw.CREATED ?? 0,
            IN_FINANCE: raw.IN_FINANCE ?? 0,
            APPROVED: raw.APPROVED ?? 0,
            DISPATCHED: raw.DISPATCHED ?? 0,
            DELIVERED: raw.DELIVERED ?? 0,
            CANCELLED: raw.CANCELLED ?? 0,
            total: raw.total ?? (Number(raw.CREATED || 0) + Number(raw.IN_FINANCE || 0) + Number(raw.APPROVED || 0) + Number(raw.DISPATCHED || 0) + Number(raw.DELIVERED || 0) + Number(raw.CANCELLED || 0)),
          };
        }
        return { CREATED: 0, IN_FINANCE: 0, APPROVED: 0, DISPATCHED: 0, DELIVERED: 0, CANCELLED: 0, total: 0 };
      } catch (err) {
        console.error('[OrdersScreen] Summary fetch error:', err);
        return { CREATED: 0, IN_FINANCE: 0, APPROVED: 0, DISPATCHED: 0, DELIVERED: 0, CANCELLED: 0, total: 0 };
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // 3. Fetch Orders List
  const { data: ordersData, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'orders-list-dashboard-app',
      page,
      typeFilter,
      statusFilter,
      stateFilter,
      beatFilter,
      retailerBeatFilter,
      levelFilter,
      soTargetRole,
      salesUserTargetRole,
      selectedRetailerId,
      selectedDistributorId,
    ],
    queryFn: async () => {
      try {
        const { apiType, listStatus, apiOrderFlow, beatParam, searchParam } = getOrderApiParams();

        if (isSO && soTargetRole === 'RETAILER' && selectedRetailerId) {
          const res = await orderService.getOrdersForRetailer(selectedRetailerId, page, 15, apiType, listStatus);
          const ordersArr = Array.isArray(res?.orders) ? res.orders : [];
          return { data: ordersArr, total: res?.total ?? ordersArr.length };
        }

        const params: any = {
          page,
          limit: 15,
          type: apiType,
          status: listStatus,
          state: stateFilter || undefined,
          beat: beatParam,
          orderFlow: apiOrderFlow,
          search: searchParam,
        };

        const res = await orderService.list(params);
        const rawObj = res as any;
        const listData = Array.isArray(rawObj?.data)
          ? rawObj.data
          : Array.isArray(rawObj?.orders)
            ? rawObj.orders
            : Array.isArray(rawObj)
              ? rawObj
              : [];
        const totalCount = rawObj?.total ?? rawObj?.pagination?.total ?? listData.length;
        return { data: listData, total: totalCount };
      } catch (err) {
        console.error('[OrdersScreen] List fetch error:', err);
        return { data: [], total: 0 };
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Background prefetch next page for 0ms page transitions
  useEffect(() => {
    if (ordersData && page * 15 < ordersData.total) {
      const nextPage = page + 1;
      const { apiType, listStatus, apiOrderFlow, beatParam, searchParam } = getOrderApiParams();
      queryClient.prefetchQuery({
        queryKey: [
          'orders-list-dashboard-app',
          nextPage,
          typeFilter,
          statusFilter,
          stateFilter,
          beatFilter,
          retailerBeatFilter,
          levelFilter,
          soTargetRole,
          salesUserTargetRole,
          selectedRetailerId,
          selectedDistributorId,
        ],
        queryFn: async () => {
          if (isSO && soTargetRole === 'RETAILER' && selectedRetailerId) {
            const res = await orderService.getOrdersForRetailer(selectedRetailerId, nextPage, 15, apiType, listStatus);
            const ordersArr = Array.isArray(res?.orders) ? res.orders : [];
            return { data: ordersArr, total: res?.total ?? ordersArr.length };
          }
          const params: any = {
            page: nextPage,
            limit: 15,
            type: apiType,
            status: listStatus,
            state: stateFilter || undefined,
            beat: beatParam,
            orderFlow: apiOrderFlow,
            search: searchParam,
          };
          const res = await orderService.list(params);
          const rawObj = res as any;
          const listData = Array.isArray(rawObj?.data)
            ? rawObj.data
            : Array.isArray(rawObj?.orders)
              ? rawObj.orders
              : Array.isArray(rawObj)
                ? rawObj
                : [];
          const totalCount = rawObj?.total ?? rawObj?.pagination?.total ?? listData.length;
          return { data: listData, total: totalCount };
        },
        staleTime: 30 * 1000,
      });
    }
  }, [ordersData, page, typeFilter, statusFilter, stateFilter, beatFilter, retailerBeatFilter, levelFilter, soTargetRole, salesUserTargetRole, selectedRetailerId, selectedDistributorId, isSO, queryClient, getOrderApiParams]);

  // Confirmation modal state for order actions
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    orderId: string;
    actionType?: 'status' | 'adminHandover' | 'financeApprove' | 'financeReject';
    targetStatus?: OrderStatus;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: 'warning' | 'danger' | 'info';
  } | null>(null);

  // Actions Mutations
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const adminHandoverMutation = useMutation({
    mutationFn: (orderId: string) => orderService.adminHandoverFinance(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app'] });
      refetch();
      refetchSummary();
      setConfirmAction(null);
      Alert.alert('Success', 'Order handed over to finance successfully');
    },
    onError: (err: any) => {
      setConfirmAction(null);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to hand over order to finance');
    },
  });

  const financeApproveMutation = useMutation({
    mutationFn: (orderId: string) => orderService.financeApprove(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app'] });
      refetch();
      refetchSummary();
      setConfirmAction(null);
      Alert.alert('Success', 'Order approved in finance successfully');
    },
    onError: (err: any) => {
      setConfirmAction(null);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to approve order in finance');
    },
  });

  const financeRejectMutation = useMutation({
    mutationFn: (orderId: string) => orderService.financeReject(orderId, 'Rejected by finance'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app'] });
      refetch();
      refetchSummary();
      setConfirmAction(null);
      Alert.alert('Success', 'Order rejected in finance');
    },
    onError: (err: any) => {
      setConfirmAction(null);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to reject order in finance');
    },
  });

  const handleAdminHandover = (id: string) => {
    setConfirmAction({
      open: true,
      orderId: id,
      actionType: 'adminHandover',
      title: 'Hand Over to Finance',
      description: `Hand over stock-in order ${id} to Finance for review and final approval?`,
      confirmLabel: 'Hand Over',
      cancelLabel: 'Cancel',
      variant: 'info',
    });
  };

  const handleFinanceApprove = (id: string) => {
    setConfirmAction({
      open: true,
      orderId: id,
      actionType: 'financeApprove',
      title: 'Approve in Finance',
      description: `Approve stock-in order ${id} and move it to the dispatch queue?`,
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
      variant: 'info',
    });
  };

  const handleFinanceReject = (id: string) => {
    setConfirmAction({
      open: true,
      orderId: id,
      actionType: 'financeReject',
      title: 'Reject in Finance',
      description: `Reject stock-in order ${id} in finance review?`,
      confirmLabel: 'Reject',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      orderService.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-list-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary-dashboard-app'] });
      queryClient.invalidateQueries({ queryKey: ['retailer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['so-all-retailer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-user-distributor-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-details-dashboard-app'] });
      refetch();
      refetchSummary();
      setConfirmAction(null);
      Alert.alert('Success', 'Order status updated successfully');
    },
    onError: (err: any) => {
      setConfirmAction(null);
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' ? err.response.data : undefined) ||
        err.message ||
        'Failed to update order status';
      const isStockError = typeof message === 'string' && message.toLowerCase().includes('insufficient stock');
      Alert.alert(isStockError ? 'Insufficient Stock' : 'Error', message);
    },
  });

  const handleUpdateStatus = (id: string, status: OrderStatus) => {
    if (status === OrderStatus.DISPATCHED) {
      setConfirmAction({
        open: true,
        orderId: id,
        targetStatus: status,
        title: 'Mark as Dispatched',
        description: `Confirm that order ${id} has been dispatched and is on its way to the receiver?`,
        confirmLabel: 'Yes, Dispatch',
        cancelLabel: 'No, Cancel',
        variant: 'warning',
      });
      return;
    }
    if (status === OrderStatus.DELIVERED) {
      setConfirmAction({
        open: true,
        orderId: id,
        targetStatus: status,
        title: 'Confirm Delivery',
        description: `Confirm that you have received order ${id}? This will mark it as Delivered.`,
        confirmLabel: 'Yes, Deliver',
        cancelLabel: 'No, Cancel',
        variant: 'info',
      });
      return;
    }
    if (status === OrderStatus.CANCELLED) {
      setConfirmAction({
        open: true,
        orderId: id,
        targetStatus: status,
        title: 'Cancel Order',
        description: `Are you sure you want to cancel order ${id}? This action cannot be undone.`,
        confirmLabel: 'Yes, Cancel Order',
        cancelLabel: 'No, Keep Order',
        variant: 'danger',
      });
      return;
    }
    updateStatusMutation.mutate({ id, status });
  };

  const handleOpenVisitModal = async () => {
    if (!selectedRetailer) return;
    setGeofenceDistance(0);
    setIsManualVerify(false);
    setVisitNotes('');
    setVisitPhoto(null);
    setShowVisitModal(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLatitude(loc.coords.latitude);
        setUserLongitude(loc.coords.longitude);

        if (selectedRetailer.storeLatitude != null && selectedRetailer.storeLongitude != null) {
          const dist = getDistanceMeters(
            loc.coords.latitude,
            loc.coords.longitude,
            Number(selectedRetailer.storeLatitude),
            Number(selectedRetailer.storeLongitude)
          );
          setGeofenceDistance(dist);
        }
      }
    } catch (e) {
      console.error('Failed to get location for visit', e);
    }
  };

  const handlePickVisitPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to capture store photo');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setVisitPhoto({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || `visit-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleLogVisit = async () => {
    if (!visitPhoto) {
      Alert.alert('Validation Error', 'Store photo is required.');
      return;
    }
    if (!selectedRetailer) return;

    setVisitLoading(true);
    try {
      await visitService.createVisit(
        selectedRetailer.retailerId,
        visitPhoto,
        visitNotes,
        userLatitude && userLongitude ? { latitude: userLatitude, longitude: userLongitude } : undefined,
        isManualVerify,
        isManualVerify ? geofenceDistance : undefined
      );
      Alert.alert('Success', isManualVerify ? 'Store visit logged with manual verification!' : 'Store visit logged successfully!');
      setShowVisitModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to log visit');
    } finally {
      setVisitLoading(false);
    }
  };

  const orders: IOrder[] = ordersData?.data ?? [];
  const total = ordersData?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / 15));

  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setStateFilter('');
    setBeatFilter('');
    setSelectedRetailerId('');
    setSelectedDistributorId('');
    setRetailerBeatFilter('');
    setBeatSearchQuery('');
    setRetailerSearchQuery('');
    setPage(1);
    if (user?.entityId) {
      void AsyncStorage.removeItem(`orders_retailer_beat_filter_${user.entityId}`);
    }
  };

  const filteredDistributors = useMemo(() => {
    const q = distributorSearchQuery.trim().toLowerCase();
    if (!q) return activeSalesUserEntities;
    return activeSalesUserEntities.filter(
      (d) =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.entityId || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q)
    );
  }, [activeSalesUserEntities, distributorSearchQuery]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-150 bg-white flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center border border-orange-100">
            <Ionicons name="cart-outline" size={22} color="#f97316" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-800">Orders</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {isAdmin && 'All orders across the network'}
              {isFinance && 'Finance review and approval queue'}
              {isDispatch && 'Dispatch execution queue'}
              {isRSM && 'Orders in your region'}
              {isASM && 'Orders in your area'}
              {isSS && 'Primary orders from distributors'}
              {isDist && 'Primary and secondary order management'}
              {isSO && 'Orders you have booked for retailers'}
              {isRetailer && 'Your order history'}
            </Text>
          </View>
        </View>

        {/* Quick Header Action Buttons */}
        <View className="flex-row items-center gap-2">
          {(isManager || isSO || isAdmin) && (
            <TouchableOpacity
              onPress={handleExport}
              disabled={isExporting}
              className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl flex-row items-center gap-1 shadow-sm"
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <Ionicons name="download-outline" size={14} color="#f97316" />
              )}
              <Text className="text-gray-700 text-xs font-bold">
                {isExporting ? 'Exporting...' : 'Export'}
              </Text>
            </TouchableOpacity>
          )}
          {isSS && (
            <TouchableOpacity
              onPress={() => router.push('/orders/new/primary' as any)}
              className="bg-[#f97316] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <Text className="text-white text-xs font-bold">+ New Stock-In</Text>
            </TouchableOpacity>
          )}
          {isDist && (
            <TouchableOpacity
              onPress={() => router.push('/orders/new/primary' as any)}
              className="bg-[#f97316] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <Text className="text-white text-xs font-bold">+ New Primary Order</Text>
            </TouchableOpacity>
          )}
          {isRetailer && !retailerHasAuthorizedSo && (
            <TouchableOpacity
              onPress={() => router.push('/orders/new/secondary' as any)}
              className="bg-[#f97316] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <Text className="text-white text-xs font-bold">+ New Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView className="flex-grow" showsVerticalScrollIndicator={false}>

        {/* Target SO Selector & Search Box for SO Role */}
        {isSO && (
          <View className="px-6 pt-5">
            <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
              {/* Toggle Tabs */}
              <View className="flex-row bg-gray-50 border border-gray-100 p-0.5 rounded-lg">
                <TouchableOpacity
                  onPress={() => {
                    setSoTargetRole('RETAILER');
                    setPage(1);
                  }}
                  className={`flex-1 py-2 items-center rounded-md ${soTargetRole === 'RETAILER' ? 'bg-[#f97316]' : 'bg-transparent'
                    }`}
                >
                  <Text className={`text-xs font-bold ${soTargetRole === 'RETAILER' ? 'text-white' : 'text-gray-600'}`}>
                    Retailer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSoTargetRole('DISTRIBUTOR');
                    setPage(1);
                  }}
                  className={`flex-1 py-2 items-center rounded-md ${soTargetRole === 'DISTRIBUTOR' ? 'bg-[#f97316]' : 'bg-transparent'
                    }`}
                >
                  <Text className={`text-xs font-bold ${soTargetRole === 'DISTRIBUTOR' ? 'text-white' : 'text-gray-600'}`}>
                    Distributor
                  </Text>
                </TouchableOpacity>
              </View>

              {soTargetRole === 'RETAILER' ? (
                <View className="gap-2.5">
                  {/* Beat Search Input / Trigger (Visible only when Retailer is selected) */}
                  <TouchableOpacity
                    onPress={() => {
                      setBeatSearchQuery(retailerBeatFilter);
                      fetchBeatSuggestions(retailerBeatFilter);
                      setShowBeatModal(true);
                    }}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="search-outline" size={14} color="#9ca3af" />
                      <Text className={`text-xs ${retailerBeatFilter ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                        {retailerBeatFilter ? retailerBeatFilter : 'Search beat...'}
                      </Text>
                    </View>
                    {!!retailerBeatFilter && (
                      <TouchableOpacity onPress={() => setRetailerBeatFilter('')} className="p-0.5">
                        <Ionicons name="close-circle" size={14} color="#9ca3af" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  {/* Retailer Selector Trigger */}
                  <TouchableOpacity
                    onPress={() => setShowRetailerModal(true)}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                  >
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <Ionicons name="search-outline" size={14} color="#9ca3af" />
                      <Text className={`text-xs ${selectedRetailer ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
                        {selectedRetailer
                          ? `${selectedRetailer.name} ${selectedRetailer.beat ? `(${selectedRetailer.beat})` : ''}`
                          : 'Search retailer by name or ID...'}
                      </Text>
                    </View>
                    {selectedRetailer && todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId] ? (
                      <View className={`px-1.5 py-0.5 rounded border mr-1.5 ${todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId] === 'PC'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-blue-50 border-blue-200'
                        }`}>
                        <Text className={`text-[10px] font-bold ${todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId] === 'PC'
                          ? 'text-emerald-700'
                          : 'text-blue-700'
                          }`}>
                          {todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId]}
                        </Text>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="gap-2.5">
                  {/* Distributor Selector Trigger */}
                  <TouchableOpacity
                    onPress={() => setShowDistributorModal(true)}
                    className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                  >
                    <View className="flex-row items-center gap-2 flex-1 mr-2">
                      <Ionicons name="search-outline" size={14} color="#9ca3af" />
                      <Text className={`text-xs ${selectedDistributor ? 'text-gray-800 font-semibold' : 'text-gray-400'}`} numberOfLines={1}>
                        {selectedDistributor
                          ? `${selectedDistributor.name} (${selectedDistributor.entityId})`
                          : 'Search distributor by name, ID, or phone...'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* View Performance Button & Action Controls */}
              <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 mt-1">
                <TouchableOpacity
                  onPress={() => router.push('/performance' as any)}
                  className="flex-row items-center gap-1.5 border border-gray-200 bg-gray-50 px-3 py-1.5 rounded-full"
                >
                  <Ionicons name="bar-chart-outline" size={14} color="#475569" />
                  <Text className="text-xs font-semibold text-slate-700">View Performance</Text>
                </TouchableOpacity>

                {soTargetRole === 'RETAILER' && selectedRetailer ? (
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={handleOpenVisitModal}
                      className="bg-white border border-[#f97316] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
                    >
                      <Ionicons name="location-outline" size={14} color="#f97316" />
                      <Text className="text-[#f97316] text-xs font-bold">Visit Store</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/orders/new/secondary',
                          params: { onBehalfOf: selectedRetailerId },
                        } as any)
                      }
                      className="bg-[#f97316] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
                    >
                      <Text className="text-white text-xs font-bold">+ New Order</Text>
                    </TouchableOpacity>
                  </View>
                ) : soTargetRole === 'DISTRIBUTOR' && selectedDistributor ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/orders/new/sales-user',
                        params: {
                          distributorId: selectedDistributor.entityId,
                          distributorName: selectedDistributor.name,
                        },
                      } as any)
                    }
                    className="bg-[#f97316] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
                  >
                    <Text className="text-white text-xs font-bold">+ New Order</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Active selection badge */}
              {soTargetRole === 'RETAILER' && selectedRetailer ? (
                <View className="bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-xl mt-1 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-[#f97316]" numberOfLines={1}>
                    Viewing orders for: {selectedRetailer.name}
                  </Text>
                  {todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId] && (
                    <View className={`px-1.5 py-0.5 rounded border ${todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId] === 'PC'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-blue-50 border-blue-200'
                      }`}>
                      <Text className={`text-[10px] font-bold ${todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId] === 'PC'
                        ? 'text-emerald-700'
                        : 'text-blue-700'
                        }`}>
                        {todayCallStatusMap[selectedRetailer.entityId || selectedRetailer.retailerId]}
                      </Text>
                    </View>
                  )}
                </View>
              ) : soTargetRole === 'DISTRIBUTOR' && selectedDistributor ? (
                <View className="bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-xl mt-1">
                  <Text className="text-xs font-semibold text-[#f97316]" numberOfLines={1}>
                    Viewing orders for: {selectedDistributor.name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Target Selector & Search Box for RSM/ASM Managers */}
        {isManager && (
          <View className="px-6 pt-5" style={{ zIndex: 50 }}>
            <View className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm gap-3 relative">
              {/* Toggle Buttons + View Performance */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row bg-gray-50 border border-gray-100 p-0.5 rounded-lg flex-1 mr-3">
                  <TouchableOpacity
                    onPress={() => {
                      setSalesUserTargetRole('SUPER_STOCKIST');
                      setSelectedDistributorId('');
                      setDistributorSearchQuery('');
                      setPage(1);
                    }}
                    className={`flex-1 py-2 items-center rounded-md ${salesUserTargetRole === 'SUPER_STOCKIST' ? 'bg-[#f97316]' : 'bg-transparent'
                      }`}
                  >
                    <Text className={`text-xs font-bold ${salesUserTargetRole === 'SUPER_STOCKIST' ? 'text-white' : 'text-gray-600'}`}>
                      Super Stockist
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSalesUserTargetRole('DISTRIBUTOR');
                      setSelectedDistributorId('');
                      setDistributorSearchQuery('');
                      setPage(1);
                    }}
                    className={`flex-1 py-2 items-center rounded-md ${salesUserTargetRole === 'DISTRIBUTOR' ? 'bg-[#f97316]' : 'bg-transparent'
                      }`}
                  >
                    <Text className={`text-xs font-bold ${salesUserTargetRole === 'DISTRIBUTOR' ? 'text-white' : 'text-gray-600'}`}>
                      Distributor
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => router.push('/performance' as any)}
                  className="flex-row items-center gap-1.5 border border-gray-200 bg-gray-50 px-3 py-2 rounded-full"
                >
                  <Ionicons name="bar-chart-outline" size={14} color="#475569" />
                  <Text className="text-xs font-semibold text-slate-700">View Performance</Text>
                </TouchableOpacity>
              </View>

              {/* Search Box Header & Input */}
              <View className="gap-1.5 mt-1">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  SELECT {salesUserTargetRole === 'SUPER_STOCKIST' ? 'SUPER STOCKIST' : 'DISTRIBUTOR'}
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-2.5 bg-white">
                  <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-1.5" />
                  <TextInput
                    placeholder={
                      salesUserTargetRole === 'SUPER_STOCKIST'
                        ? 'Search super stockist by name, ID, or phone...'
                        : 'Search distributor by name, ID, or phone...'
                    }
                    placeholderTextColor="#9ca3af"
                    value={distributorSearchQuery}
                    onChangeText={(text) => {
                      if (selectedDistributorId) {
                        setSelectedDistributorId('');
                      }
                      setDistributorSearchQuery(text);
                      setIsSearchingDistributor(true);
                      setPage(1);
                    }}
                    onFocus={() => setIsSearchingDistributor(true)}
                    className="flex-1 text-xs text-gray-850 p-0 h-9"
                  />
                  {!!distributorSearchQuery && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDistributorId('');
                        setDistributorSearchQuery('');
                        setIsSearchingDistributor(false);
                        setPage(1);
                      }}
                    >
                      <Ionicons name="close-circle" size={16} color="#64748b" />
                    </TouchableOpacity>
                  )}
                </View>

                {selectedDistributorId ? (
                  <View className="flex-row items-center justify-between mt-2">
                    <View className="bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                      <Text className="text-xs font-semibold text-[#f97316]">
                        Viewing orders for: {selectedDistributor?.name || distributorSearchQuery}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedDistributorId('');
                          setDistributorSearchQuery('');
                          setIsSearchingDistributor(false);
                          setPage(1);
                        }}
                        className="p-0.5"
                      >
                        <Ionicons name="close-circle" size={14} color="#f97316" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/orders/new/sales-user',
                          params: {
                            distributorId: selectedDistributorId,
                            distributorName: selectedDistributor?.name || distributorSearchQuery,
                            targetRole: salesUserTargetRole,
                          },
                        } as any)
                      }
                      className="bg-orange-500 px-4 py-2 rounded-xl flex-row items-center justify-center"
                    >
                      <Text className="text-white text-xs font-bold">+ New Order</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Autocomplete Suggestions */}
                {isSearchingDistributor && filteredDistributors.length > 0 && !selectedDistributorId && (
                  <View className="absolute top-[70px] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-hidden">
                    <ScrollView nestedScrollEnabled={true}>
                      {filteredDistributors.map((d) => (
                        <TouchableOpacity
                          key={d.entityId}
                          onPress={() => {
                            setSelectedDistributorId(d.entityId);
                            setDistributorSearchQuery(d.name);
                            setIsSearchingDistributor(false);
                            setPage(1);
                          }}
                          className="py-2.5 px-3 border-b border-gray-50 flex-row justify-between items-center bg-white"
                        >
                          <View className="flex-1 mr-2">
                            <Text className="text-xs font-bold text-slate-800">{d.name}</Text>
                            <Text className="text-[10px] text-slate-400 mt-0.5">{d.phone}</Text>
                          </View>
                          <Text className="text-[10px] font-medium text-slate-400">{d.entityId}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}


        {/* Stat Cards Stack (5 Cards: TOTAL, CREATED, IN FINANCE, DISPATCHED, DELIVERED) */}
        <View className="px-6 pt-4 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Total</Text>
              <Text className="text-xl font-black text-slate-800 mt-2">
                {summaryLoading ? '...' : (summaryData?.total ?? 0)}
              </Text>
            </View>
            <View className="flex-1 bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Created</Text>
              <Text className="text-xl font-black text-slate-800 mt-2">
                {summaryLoading ? '...' : (summaryData?.CREATED ?? 0)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">In Finance</Text>
              <Text className="text-xl font-black text-slate-800 mt-2">
                {summaryLoading ? '...' : (summaryData?.IN_FINANCE ?? 0)}
              </Text>
            </View>
            <View className="flex-1 bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Dispatched</Text>
              <Text className="text-xl font-black text-slate-800 mt-2">
                {summaryLoading ? '...' : (summaryData?.DISPATCHED ?? 0)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="w-1/2 pr-1.5">
              <View className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                <Text className="text-[10px] font-bold text-slate-400 uppercase">Delivered</Text>
                <Text className="text-xl font-black text-slate-800 mt-2">
                  {summaryLoading ? '...' : (summaryData?.DELIVERED ?? 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Dropdown Filters Form (Visible ONLY for Non-SO Roles) */}
        {!isSO && (
          <View className="px-6 pt-4 gap-3">
            {/* Types Dropdown */}
            <TouchableOpacity
              onPress={() => setShowTypeModal(true)}
              className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-sm text-slate-700">
                {typeFilter ? (
                  typeFilter === OrderType.PRIMARY ? 'Primary' :
                    typeFilter === 'primary_handover' ? 'Primary Handover' :
                      typeFilter === 'primary_approve' ? 'Primary Approve' :
                        typeFilter === 'primary_dispatch' ? 'Primary Dispatch' :
                          'Secondary'
                ) : 'All Types'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Statuses Dropdown */}
            <TouchableOpacity
              onPress={() => setShowStatusModal(true)}
              className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-sm text-slate-700">
                {statusFilter ? STATUS_CONFIG[statusFilter]?.label : 'All Statuses'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* States Dropdown */}
            <TouchableOpacity
              onPress={() => setShowStateModal(true)}
              className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-sm text-slate-700">
                {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All States'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Beat Autocomplete Trigger */}
            <TouchableOpacity
              onPress={() => {
                setBeatSearchQuery(beatFilter);
                fetchBeatSuggestions(beatFilter);
                setShowBeatModal(true);
              }}
              className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className={`text-sm ${beatFilter ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                {beatFilter ? beatFilter : 'All Beats'}
              </Text>
              <Ionicons name="search-outline" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Levels Dropdown (Admin only) */}
            {isAdmin && (
              <TouchableOpacity
                onPress={() => setShowLevelModal(true)}
                className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
              >
                <Text className="text-sm text-slate-700">
                  {levelFilter ? (
                    levelFilter === 'admin_to_super' ? 'Admin to Super' :
                      levelFilter === 'super_to_dist' ? 'Super to Dist' : 'Dist to Ret'
                  ) : 'All Levels'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            )}

            {/* Export & Reset Row */}
            <View className="flex-row gap-3 pt-1">
              <TouchableOpacity
                onPress={handleExport}
                disabled={isExporting}
                className="flex-1 flex-row items-center justify-center border border-gray-200 bg-white rounded-xl py-3 gap-2 shadow-sm"
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <Ionicons name="download-outline" size={16} color="#f97316" />
                )}
                <Text className="text-xs font-bold text-gray-700">
                  {isExporting ? 'Exporting...' : 'Export'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Clear Filters option */}
            {(!!typeFilter || !!statusFilter || !!stateFilter || !!beatFilter || !!levelFilter || !!selectedRetailerId || !!selectedDistributorId) && (
              <TouchableOpacity
                onPress={clearFilters}
                className="w-full items-center justify-center border border-[#fed7aa] bg-[#fff7ed] rounded-xl py-3 mt-1"
              >
                <Text className="text-[#ea580c] text-sm font-bold">Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Orders Header list */}
        <View className="px-6 pt-5 pb-2">
          <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider">Order List</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#f97316" className="my-12" />
        ) : isError ? (
          <View className="mx-6 bg-white border border-red-150 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="close-circle-outline" size={36} color="#ef4444" />
            <Text className="text-sm text-red-500 mt-2 font-semibold">Failed to load orders list</Text>
          </View>
        ) : orders.length === 0 ? (
          <View className="mx-6 bg-white border border-gray-250 p-8 rounded-2xl items-center justify-center shadow-sm">
            <Ionicons name="cart-outline" size={36} color="#9ca3af" className="opacity-40" />
            <Text className="text-sm text-gray-500 mt-2">No orders matched filters</Text>
          </View>
        ) : (
          <View className="px-6 gap-4 mb-24">
            {orders.map((order: IOrder) => {
              const statusCfg = STATUS_CONFIG[order.status] ?? {
                label: order.status,
                bg: 'bg-gray-50',
                text: 'text-gray-650',
              };

              const isStockInOrder = (order.type === OrderType.PRIMARY || order.type === OrderType.PRIMARY_HANDOVER) && order.fromEntityId === order.toEntityId;
              const canAdminHandover = isAdmin && order.status === OrderStatus.CREATED && (isStockInOrder || order.type === OrderType.PRIMARY_HANDOVER);
              const canFinanceApprove = isFinance && order.status === OrderStatus.IN_FINANCE && (isStockInOrder || order.type === OrderType.PRIMARY_HANDOVER);
              const canFinanceReject = isFinance && order.status === OrderStatus.IN_FINANCE && (isStockInOrder || order.type === OrderType.PRIMARY_HANDOVER);
              const canApprove = canApproveOrder(order, user?.role, user?.entityId);
              const canDispatch = canDispatchOrder(order, user?.role, user?.entityId, soTargetRole);
              const canDeliver = canDeliverOrder(order, user?.role, user?.entityId, soTargetRole);
              const canCancel = canCancelOrder(order, user?.role, user?.entityId);

              return (
                <View
                  key={order._id ?? order.orderId}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                >
                  {/* Card Title Line */}
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-base font-bold text-slate-800 flex-1 mr-2" numberOfLines={1}>
                      {order.orderId}
                    </Text>
                    <View className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-100">
                      <Text className="text-[10px] font-bold text-orange-700 uppercase">
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Flow details */}
                  <Text className="text-xs text-slate-500 mb-2">
                    {participantLabel(order, 'from', user?.entityId, user?.name)} → {participantLabel(order, 'to', user?.entityId, user?.name)}
                  </Text>

                  {/* Badges and Price row */}
                  <View className="flex-row justify-between items-center border-t border-gray-100 pt-3">
                    <View className="flex-row items-center gap-1.5">
                      <View className={`px-2 py-0.5 rounded-full border ${order.type === OrderType.PRIMARY ? 'bg-violet-50 border-violet-100' : 'bg-orange-50 border-orange-100'}`}>
                        <Text className={`text-[10px] font-bold uppercase ${order.type === OrderType.PRIMARY ? 'text-violet-700' : 'text-orange-700'}`}>
                          {order.type === OrderType.PRIMARY ? 'Primary' : order.type === OrderType.PRIMARY_HANDOVER ? 'Primary Handover' : 'Secondary'}
                        </Text>
                      </View>
                      <LocationBadge activity={order.orderActivity} />
                      {(() => {
                        const rId = order.fromEntityId || order.onBehalfOfEntityId || order.onBehalfOf;
                        const callStatus = rId ? todayCallStatusMap[rId] : undefined;
                        if (!callStatus) return null;
                        return (
                          <View className={`px-1.5 py-0.5 rounded border ${callStatus === 'PC' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'
                            }`}>
                            <Text className={`text-[10px] font-bold ${callStatus === 'PC' ? 'text-emerald-700' : 'text-blue-700'
                              }`}>
                              {callStatus}
                            </Text>
                          </View>
                        );
                      })()}
                      <Text className="text-xs text-slate-400">{order.items?.length || 0} items</Text>
                    </View>
                    <Text className="text-sm font-bold text-slate-800">{formatCurrency(order.totalAmount)}</Text>
                  </View>

                  {/* Date and view icon */}
                  <View className="flex-row justify-between items-center mt-3 pt-2.5 border-t border-gray-100">
                    <Text className="text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push(`/orders/${order.orderId}` as any)}
                      className="flex-row items-center gap-1"
                    >
                      <Ionicons name="eye-outline" size={14} color="#f97316" />
                      <Text className="text-xs font-semibold text-[#f97316]">View</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Action buttons */}
                  {(canAdminHandover || canFinanceApprove || canFinanceReject || canApprove || canDispatch || canDeliver || canCancel) && (
                    <View className="flex-row gap-2 mt-3 pt-2 border-t border-gray-100">
                      {canAdminHandover && (
                        <TouchableOpacity
                          disabled={adminHandoverMutation.isPending}
                          onPress={() => handleAdminHandover(order.orderId)}
                          className="flex-1 flex-row items-center justify-center border border-emerald-200 bg-emerald-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                          <Text className="text-xs font-semibold text-emerald-700">Hand Over</Text>
                        </TouchableOpacity>
                      )}

                      {canFinanceApprove && (
                        <TouchableOpacity
                          disabled={financeApproveMutation.isPending}
                          onPress={() => handleFinanceApprove(order.orderId)}
                          className="flex-1 flex-row items-center justify-center border border-emerald-200 bg-emerald-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                          <Text className="text-xs font-semibold text-emerald-700">Approve</Text>
                        </TouchableOpacity>
                      )}

                      {canFinanceReject && (
                        <TouchableOpacity
                          disabled={financeRejectMutation.isPending}
                          onPress={() => handleFinanceReject(order.orderId)}
                          className="flex-1 flex-row items-center justify-center border border-red-200 bg-red-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                          <Text className="text-xs font-semibold text-red-700">Reject</Text>
                        </TouchableOpacity>
                      )}

                      {canApprove && (
                        <TouchableOpacity
                          onPress={() => setApproveModalOrderId(order.orderId)}
                          className="flex-1 flex-row items-center justify-center border border-orange-200 bg-orange-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color="#f97316" />
                          <Text className="text-xs font-semibold text-orange-700">Approve</Text>
                        </TouchableOpacity>
                      )}

                      {canDispatch && (
                        <TouchableOpacity
                          onPress={() => handleUpdateStatus(order.orderId, OrderStatus.DISPATCHED)}
                          className="flex-1 flex-row items-center justify-center border border-amber-200 bg-amber-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="bus-outline" size={14} color="#d97706" />
                          <Text className="text-xs font-semibold text-amber-700">Dispatch</Text>
                        </TouchableOpacity>
                      )}

                      {canDeliver && (
                        <TouchableOpacity
                          onPress={() => handleUpdateStatus(order.orderId, OrderStatus.DELIVERED)}
                          className="flex-1 flex-row items-center justify-center border border-green-200 bg-green-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
                          <Text className="text-xs font-semibold text-green-700">Deliver</Text>
                        </TouchableOpacity>
                      )}

                      {canCancel && (
                        <TouchableOpacity
                          onPress={() => handleUpdateStatus(order.orderId, OrderStatus.CANCELLED)}
                          className="flex-1 flex-row items-center justify-center border border-red-200 bg-red-50 rounded-lg py-2 gap-1"
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                          <Text className="text-xs font-semibold text-red-700">Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
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

      {/* Type Filter Modal */}
      <Modal visible={showTypeModal} transparent animationType="fade" onRequestClose={() => setShowTypeModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            {[
              { value: '', label: 'All Types' },
              { value: OrderType.PRIMARY, label: 'Primary' },
              { value: OrderType.SECONDARY, label: 'Secondary' },
              ...((isAdmin || isManager) ? [{ value: 'primary_handover', label: 'Primary Handover' }] : []),
              ...(isFinance ? [{ value: 'primary_approve', label: 'Primary Approve' }] : []),
              ...(isDispatch ? [{ value: 'primary_dispatch', label: 'Primary Dispatch' }] : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  setTypeFilter(item.value);
                  setPage(1);
                  setShowTypeModal(false);
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${typeFilter === item.value ? 'bg-orange-50' : ''
                  }`}
              >
                <Text className={`text-sm ${typeFilter === item.value ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {typeFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Status Filter Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { value: '', label: 'All Statuses' },
                ...Object.keys(STATUS_CONFIG).map((k) => ({ value: k, label: STATUS_CONFIG[k].label })),
              ]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setStatusFilter(item.value);
                    setPage(1);
                    setShowStatusModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${statusFilter === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${statusFilter === item.value ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {statusFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* State Filter Modal */}
      <Modal visible={showStateModal} transparent animationType="fade" onRequestClose={() => setShowStateModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ value: '', label: 'All States' }, ...STATE_OPTIONS]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setStateFilter(item.value);
                    setPage(1);
                    setShowStateModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${stateFilter === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${stateFilter === item.value ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {stateFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Levels Filter Modal */}
      <Modal visible={showLevelModal} transparent animationType="fade" onRequestClose={() => setShowLevelModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Level</Text>
              <TouchableOpacity onPress={() => setShowLevelModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            {[
              { value: '', label: 'All Levels' },
              { value: 'admin_to_super', label: 'Admin to Super' },
              { value: 'super_to_dist', label: 'Super to Dist' },
              { value: 'dist_to_ret', label: 'Dist to Ret' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  setLevelFilter(item.value);
                  setPage(1);
                  setShowLevelModal(false);
                }}
                className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${levelFilter === item.value ? 'bg-orange-50' : ''
                  }`}
              >
                <Text className={`text-sm ${levelFilter === item.value ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                  {item.label}
                </Text>
                {levelFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Retailer Selector Modal */}
      {isSO && (
        <Modal visible={showRetailerModal} transparent animationType="fade" onRequestClose={() => setShowRetailerModal(false)}>
          <View className="flex-1 bg-black/50 justify-center items-center p-6">
            <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[85%]">
              <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
                <Text className="font-bold text-gray-800 text-base">Select Retailer</Text>
                <TouchableOpacity onPress={() => setShowRetailerModal(false)} className="p-1">
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <View className="p-3 border-b border-gray-100 bg-gray-50/50 flex-row items-center gap-2">
                <Ionicons name="search" size={14} color="#9ca3af" />
                <TextInput
                  value={retailerSearchQuery}
                  onChangeText={setRetailerSearchQuery}
                  placeholder="Search retailer by name or ID..."
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-xs text-gray-800 p-0 py-1"
                />
                {!!retailerSearchQuery && (
                  <TouchableOpacity onPress={() => setRetailerSearchQuery('')} className="p-1">
                    <Ionicons name="close-circle" size={14} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredSoRetailers}
                keyExtractor={(item) => item.entityId || item.retailerId}
                renderItem={({ item }) => {
                  const rId = item.entityId || item.retailerId;
                  const isSelected = selectedRetailerId === rId;
                  const callStatus = todayCallStatusMap[rId];
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedRetailerId(rId);
                        setPage(1);
                        setShowRetailerModal(false);
                      }}
                      className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${isSelected ? 'bg-orange-50' : ''
                        }`}
                    >
                      <View className="flex-1 mr-2">
                        <Text className={`text-xs ${isSelected ? 'font-bold text-orange-700' : 'text-gray-800'}`}>
                          {item.name} ({rId})
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        {callStatus === 'PC' && (
                          <View className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                            <Text className="text-[10px] font-bold text-emerald-700">PC</Text>
                          </View>
                        )}
                        {callStatus === 'TC' && (
                          <View className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
                            <Text className="text-[10px] font-bold text-blue-700">TC</Text>
                          </View>
                        )}
                        {isSelected && <Ionicons name="checkmark" size={18} color="#f97316" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Distributor / Super Stockist Selector Modal */}
      {(isSO || isManager) && (
        <Modal visible={showDistributorModal} transparent animationType="fade" onRequestClose={() => setShowDistributorModal(false)}>
          <View className="flex-1 bg-black/50 justify-center items-center p-6">
            <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
              <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
                <Text className="font-bold text-gray-800 text-base">
                  {isSO ? 'Select Distributor' : (salesUserTargetRole === 'SUPER_STOCKIST' ? 'Select Super Stockist' : 'Select Distributor')}
                </Text>
                <TouchableOpacity onPress={() => setShowDistributorModal(false)} className="p-1">
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <View className="p-3 border-b border-gray-100 bg-gray-50/50 flex-row items-center gap-2">
                <Ionicons name="search" size={14} color="#9ca3af" />
                <TextInput
                  value={distributorSearchQuery}
                  onChangeText={setDistributorSearchQuery}
                  placeholder={`Search ${salesUserTargetRole === 'SUPER_STOCKIST' && !isSO ? 'super stockist' : 'distributor'}...`}
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-xs text-gray-800 p-0 py-1"
                />
                {!!distributorSearchQuery && (
                  <TouchableOpacity onPress={() => setDistributorSearchQuery('')} className="p-1">
                    <Ionicons name="close-circle" size={14} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredDistributors}
                keyExtractor={(item) => item.entityId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedDistributorId(item.entityId);
                      setPage(1);
                      setShowDistributorModal(false);
                    }}
                    className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${selectedDistributorId === item.entityId ? 'bg-orange-50' : ''
                      }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className={`text-xs ${selectedDistributorId === item.entityId ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                        {item.name} ({item.entityId})
                      </Text>
                      {item.phone ? <Text className="text-[10px] text-gray-400 mt-0.5">{item.phone}</Text> : null}
                    </View>
                    {selectedDistributorId === item.entityId && <Ionicons name="checkmark" size={18} color="#f97316" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Beat Filter Modal */}
      <Modal visible={showBeatModal} transparent animationType="fade" onRequestClose={() => setShowBeatModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Beat</Text>
              <TouchableOpacity onPress={() => setShowBeatModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <View className="p-3 border-b border-gray-100 bg-gray-50/50 flex-row items-center gap-2">
              <Ionicons name="search" size={14} color="#9ca3af" />
              <TextInput
                value={beatSearchQuery}
                onChangeText={(text) => {
                  setBeatSearchQuery(text);
                  if (isSO) {
                    setRetailerBeatFilter(text);
                  } else {
                    fetchBeatSuggestions(text);
                  }
                }}
                placeholder="Search beat..."
                placeholderTextColor="#9ca3af"
                className="flex-1 text-xs text-gray-800 p-0 py-1"
              />
              {!!beatSearchQuery && (
                <TouchableOpacity onPress={() => { setBeatSearchQuery(''); if (isSO) setRetailerBeatFilter(''); else fetchBeatSuggestions(''); }} className="p-1">
                  <Ionicons name="close-circle" size={14} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {beatLoading ? (
              <ActivityIndicator size="large" color="#f97316" className="my-8" />
            ) : (
              <FlatList
                data={isSO ? ['All Beats', ...soBeatOptions] : ['All Beats', ...beatSuggestions.filter(b => b !== 'All Beats')]}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const isSelected = item === 'All Beats'
                    ? (isSO ? retailerBeatFilter === '' : beatFilter === '')
                    : (isSO ? retailerBeatFilter === item : beatFilter === item);
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        const targetBeat = item === 'All Beats' ? '' : item;
                        if (isSO) {
                          setRetailerBeatFilter(targetBeat);
                          setBeatSearchQuery(targetBeat);
                        } else {
                          setBeatFilter(targetBeat);
                        }
                        setPage(1);
                        setShowBeatModal(false);
                      }}
                      className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${isSelected ? 'bg-orange-50' : ''
                        }`}
                    >
                      <Text className={`text-sm ${isSelected ? 'font-bold text-orange-700' : 'text-gray-700'}`}>
                        {item}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#f97316" />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Visit Store Modal */}
      <Modal visible={showVisitModal} transparent animationType="fade" onRequestClose={() => setShowVisitModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[90%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base flex-1 mr-2" numberOfLines={1}>
                Visit: {selectedRetailer?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowVisitModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
              {(() => {
                const isFirstTime = selectedRetailer?.storeLatitude == null || selectedRetailer?.storeLongitude == null;
                const outOfRange = !isFirstTime && !isManualVerify && geofenceDistance > 50;

                if (outOfRange) {
                  return (
                    <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 gap-2">
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="location-outline" size={18} color="#dc2626" />
                        <Text className="text-xs font-bold text-red-700">Not Present (Out of Range)</Text>
                      </View>
                      <Text className="text-xs text-red-600">
                        You are <Text className="font-bold">{geofenceDistance}m</Text> away from {selectedRetailer?.name}. Must be within 50m.
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsManualVerify(true)}
                        className="mt-1 bg-white border border-red-300 rounded-lg p-2 items-center"
                      >
                        <Text className="text-xs font-bold text-red-700">GPS Bug (I am at location)</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View className={`mb-4 rounded-xl p-3 border ${isManualVerify ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <View className="flex-row items-center gap-2">
                      <Ionicons
                        name={isManualVerify ? "location-outline" : "checkmark-circle-outline"}
                        size={18}
                        color={isManualVerify ? "#c2410c" : "#047857"}
                      />
                      <Text className={`text-xs font-bold ${isManualVerify ? 'text-orange-700' : 'text-emerald-700'}`}>
                        {isFirstTime ? 'First Visit - Location Set' : isManualVerify ? 'Location manually overridden' : 'Location Confirmed'}
                      </Text>
                    </View>
                    {userLatitude != null && (
                      <Text className={`text-[10px] mt-1 ${isManualVerify ? 'text-orange-600' : 'text-emerald-600'}`}>
                        Lat: {userLatitude.toFixed(5)}, Lng: {userLongitude?.toFixed(5)}
                      </Text>
                    )}
                  </View>
                );
              })()}

              <View className="mb-4 gap-2">
                <Text className="text-xs font-bold text-slate-700">
                  Store Photo <Text className="text-red-500">*</Text>
                </Text>
                {visitPhoto ? (
                  <View className="relative w-full h-44 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <Image source={{ uri: visitPhoto.uri }} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => setVisitPhoto(null)}
                      className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full"
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickVisitPhoto}
                    className="w-full h-32 bg-gray-50 border border-dashed border-gray-300 rounded-xl items-center justify-center gap-2 p-3"
                  >
                    <Ionicons name="camera-outline" size={28} color="#f97316" />
                    <Text className="text-xs text-gray-500 font-semibold">Take Store Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="mb-4 gap-2">
                <Text className="text-xs font-bold text-slate-700">Reason / Notes (Optional)</Text>
                <TextInput
                  value={visitNotes}
                  onChangeText={setVisitNotes}
                  placeholder="Why didn't the retailer give an order? Remarks..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  style={{ textAlignVertical: 'top' }}
                  className="border border-gray-200 bg-gray-50 rounded-xl p-3 text-xs text-slate-700 min-h-[70px]"
                />
              </View>

              <View className="flex-row items-center justify-end gap-2 pt-2 mb-2">
                <TouchableOpacity
                  onPress={() => setShowVisitModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white"
                >
                  <Text className="text-xs font-bold text-gray-600">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={visitLoading || !visitPhoto || (!isManualVerify && selectedRetailer?.storeLatitude != null && geofenceDistance > 50)}
                  onPress={handleLogVisit}
                  className={`px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 ${visitLoading || !visitPhoto || (!isManualVerify && selectedRetailer?.storeLatitude != null && geofenceDistance > 50)
                    ? 'bg-gray-300'
                    : 'bg-[#f97316]'
                    }`}
                >
                  {visitLoading && <ActivityIndicator size="small" color="white" />}
                  <Ionicons name="location-outline" size={14} color="white" />
                  <Text className="text-xs font-bold text-white">Log Visit</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Action Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          open={confirmAction.open}
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          cancelLabel={confirmAction.cancelLabel}
          variant={confirmAction.variant}
          loading={
            updateStatusMutation.isPending ||
            adminHandoverMutation.isPending ||
            financeApproveMutation.isPending ||
            financeRejectMutation.isPending
          }
          onConfirm={() => {
            if (confirmAction) {
              if (confirmAction.actionType === 'adminHandover') {
                adminHandoverMutation.mutate(confirmAction.orderId);
              } else if (confirmAction.actionType === 'financeApprove') {
                financeApproveMutation.mutate(confirmAction.orderId);
              } else if (confirmAction.actionType === 'financeReject') {
                financeRejectMutation.mutate(confirmAction.orderId);
              } else if (confirmAction.targetStatus) {
                updateStatusMutation.mutate({
                  id: confirmAction.orderId,
                  status: confirmAction.targetStatus,
                });
              }
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Approve Order Modal */}
      <ApproveOrderModal
        visible={!!approveModalOrderId}
        orderId={approveModalOrderId}
        onClose={() => setApproveModalOrderId(null)}
      />
    </View>
  );
}
