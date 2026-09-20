import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore } from '@/store/auth.store';
import { catalogService } from '@/services/catalog.service';
import { userService } from '@/services/user.service';
import { UserRole } from '@/types';
import { formatCurrencyDecimal as formatCurrency } from '@/lib/format-utils';
import { STATE_OPTIONS, getScopedStateOptions } from '@/lib/states';

const RETAILER_TYPES = ['Cosmetic store', 'Cosmetics Shop', 'Salon', 'Supermarket', 'Wholesaler', 'Others'];
const { width } = Dimensions.get('window');

export default function BeatVisitsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isBeatCreator = user?.role === UserRole.ASM || user?.role === UserRole.RSM || user?.role === UserRole.NSM;
  const isAuthorizedRole = user?.role === UserRole.SO || user?.role === UserRole.ASE || user?.role === UserRole.ASM || user?.role === UserRole.RSM;

  // UI Modals
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStateDropdownModal, setShowStateDropdownModal] = useState(false);
  const [showFormStateModal, setShowFormStateModal] = useState(false);
  const [showFormTypeModal, setShowFormTypeModal] = useState(false);
  const [showFormDistributorModal, setShowFormDistributorModal] = useState(false);

  const scopedFormStateOptions = useMemo(() => {
    return getScopedStateOptions(user?.state, user?.role);
  }, [user?.state, user?.role]);

  const defaultFormState = useMemo(() => {
    if (scopedFormStateOptions.length > 0) return scopedFormStateOptions[0].value;
    return user?.state?.split(',')[0]?.trim()?.toLowerCase() || '';
  }, [scopedFormStateOptions, user?.state]);

  // Form Fields
  const [retailerName, setRetailerName] = useState('');
  const [retailerPhone, setRetailerPhone] = useState('');
  const [retailerPassword, setRetailerPassword] = useState('');
  const [retailerState, setRetailerState] = useState(defaultFormState);
  const [retailerBeat, setRetailerBeat] = useState('');
  const [retailerType, setRetailerType] = useState('');
  const [customRetailerType, setCustomRetailerType] = useState('');
  const [retailerDistributor, setRetailerDistributor] = useState('');
  const [retailerSalesAgent, setRetailerSalesAgent] = useState('');
  const [salesAgentSearch, setSalesAgentSearch] = useState('');
  const [showFormSalesAgentModal, setShowFormSalesAgentModal] = useState(false);
  const [photo, setPhoto] = useState<any>(null);
  const [formError, setFormError] = useState('');

  // Location State
  const [locationLoading, setLocationLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // State Management / Filter States
  const [selectedViewState, setSelectedViewState] = useState('');
  const [beatSearchQuery, setBeatSearchQuery] = useState('');
  const [confirmDeleteBeatName, setConfirmDeleteBeatName] = useState<string | null>(null);

  const [selectedRetailerState, setSelectedRetailerState] = useState('');
  const [retailersPage, setRetailersPage] = useState(1);
  const retailersLimit = 10;

  // Dropdown options fetching
  const { data: viewStateBeatsData, isLoading: viewStateBeatsLoading } = useQuery({
    queryKey: ['state-beats-asm', selectedViewState],
    queryFn: () => userService.listBeats({ state: selectedViewState, role: UserRole.RETAILER }),
    enabled: isBeatCreator && !!selectedViewState,
  });
  const viewStateBeats = viewStateBeatsData ?? [];

  const filteredViewStateBeats = viewStateBeats.filter((b) =>
    b.toLowerCase().includes(beatSearchQuery.toLowerCase())
  );

  const { data: distributorsData } = useQuery({
    queryKey: ['distributors', retailerState],
    queryFn: () => userService.listDistributors({ state: retailerState, limit: 1000 }),
    enabled: !!retailerState,
  });
  const distributors = distributorsData?.data ?? [];

  const { data: recommendedBeatsData } = useQuery({
    queryKey: ['form-recommended-beats', retailerState],
    queryFn: () => userService.listBeats({ state: retailerState, role: UserRole.RETAILER }),
    enabled: !!retailerState,
  });
  const recommendedBeats = recommendedBeatsData ?? [];

  const [showFormBeatSuggestions, setShowFormBeatSuggestions] = useState(false);

  const filteredBeats = useMemo(() => {
    if (!retailerState) return [];
    return recommendedBeats.filter((b) =>
      !retailerBeat || b.toLowerCase().includes(retailerBeat.toLowerCase())
    );
  }, [recommendedBeats, retailerBeat, retailerState]);

  const { data: subordinatesData } = useQuery({
    queryKey: ['subordinates', retailerState],
    queryFn: () => userService.listSubordinates({ state: retailerState, limit: 1000 }),
    enabled: isBeatCreator && !!retailerState,
  });
  const agents = subordinatesData?.data ?? [];

  const { data: allDistributorsData } = useQuery({
    queryKey: ['all-distributors'],
    queryFn: () => userService.listDistributors({ limit: 1000 }),
    enabled: isBeatCreator,
  });
  const allDistributors = allDistributorsData?.data ?? [];

  const { data: allAgentsData } = useQuery({
    queryKey: ['all-subordinates-asm'],
    queryFn: () => userService.listSubordinates({ limit: 1000 }),
    enabled: isBeatCreator,
  });
  const allAgents = allAgentsData?.data ?? [];

  const { data: systemSosData } = useQuery({
    queryKey: ['system-sos'],
    queryFn: () => userService.listByRole(UserRole.SO),
    enabled: showModal,
  });
  const systemSos = systemSosData?.data ?? [];

  const { data: systemAsesData } = useQuery({
    queryKey: ['system-ases'],
    queryFn: () => userService.listByRole(UserRole.ASE),
    enabled: showModal,
  });
  const systemAses = systemAsesData?.data ?? [];

  const allPossibleAgents = useMemo(() => {
    const list = [...systemSos, ...systemAses];
    if (user && (user.role === UserRole.SO || user.role === UserRole.ASE)) {
      if (!list.some(a => a.entityId === user.entityId)) {
        list.push({
          entityId: user.entityId,
          name: user.name,
          role: user.role,
          state: user.state || '',
        } as any);
      }
    }
    return list;
  }, [systemSos, systemAses, user]);

  const stateAgents = useMemo(() => {
    return allPossibleAgents.filter(
      (a) => !retailerState || a.state?.toLowerCase() === retailerState.toLowerCase()
    );
  }, [allPossibleAgents, retailerState]);

  const filteredSalesAgents = useMemo(() => {
    return stateAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(salesAgentSearch.toLowerCase()) ||
        a.entityId.toLowerCase().includes(salesAgentSearch.toLowerCase())
    );
  }, [stateAgents, salesAgentSearch]);

  const { data: stateRetailersData, isLoading: stateRetailersLoading } = useQuery({
    queryKey: ['state-retailers', selectedRetailerState, retailersPage],
    queryFn: () => userService.listRetailers({ state: selectedRetailerState, page: retailersPage, limit: retailersLimit }),
    enabled: !!selectedRetailerState,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Get GPS Location Coordinates
  const requestLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
    } catch (err: any) {
      setLocationError(err?.message || 'Failed to acquire current location');
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      requestLocation();
      if (user) {
        if ((user.role === UserRole.SO || user.role === UserRole.ASE) && !retailerSalesAgent) {
          setRetailerSalesAgent(user.entityId);
          setSalesAgentSearch(user.name);
        }
        if (!retailerState || user.state) {
          setRetailerState(defaultFormState);
        }
      }
    }
  }, [showModal, user, defaultFormState]);

  // Mutations
  const createRetailerMutation = useMutation({
    mutationFn: (input: any) => userService.createUser(input),
    onSuccess: (data) => {
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['state-beats'] });
      queryClient.invalidateQueries({ queryKey: ['state-retailers'] });
      queryClient.invalidateQueries({ queryKey: ['state-beats-asm'] });
      Alert.alert(
        'Success',
        `Retailer "${data.data.user.name}" created & authorized!\nEntity ID: ${data.data.user.entityId}`
      );
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create retailer';
      setFormError(msg);
    },
  });

  const deleteBeatMutation = useMutation({
    mutationFn: (input: { state: string; beat: string }) =>
      userService.deleteBeat(input.state, input.beat),
    onSuccess: () => {
      Alert.alert('Success', 'Beat deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['state-beats'] });
      queryClient.invalidateQueries({ queryKey: ['state-beats-asm'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to delete beat');
    },
  });

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to capture store front photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'store.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      setFormError('');
    }
  };

  const resetForm = () => {
    setRetailerName('');
    setRetailerPhone('');
    setRetailerPassword('');
    setRetailerState('');
    setRetailerBeat('');
    setRetailerType('');
    setCustomRetailerType('');
    setRetailerDistributor('');
    setRetailerSalesAgent('');
    setSalesAgentSearch('');
    setPhoto(null);
    setLatitude(null);
    setLongitude(null);
    setLocationError(null);
    setFormError('');
    setShowFormBeatSuggestions(false);
  };

  // Reset distributor, sales agent and beat when state changes
  useEffect(() => {
    setRetailerDistributor('');
    if (user && (user.role === UserRole.SO || user.role === UserRole.ASE)) {
      setRetailerSalesAgent(user.entityId);
      setSalesAgentSearch(user.name);
    } else {
      setRetailerSalesAgent('');
      setSalesAgentSearch('');
    }
    setRetailerBeat('');
  }, [retailerState, user]);

  const handleSubmit = () => {
    if (isBeatCreator) {
      if (!retailerState.trim()) return setFormError('State is required');
      if (!retailerBeat.trim()) return setFormError('City / Beat name is required');

      // ASM/RSM Quick Beat registration
      const phone = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
      const name = `${retailerBeat.trim().charAt(0).toUpperCase() + retailerBeat.trim().slice(1)} Beat`;

      const resolvedDistributor = distributors[0]?.entityId || allDistributors[0]?.entityId;
      const resolvedAgent = agents[0]?.entityId || allAgents[0]?.entityId || user?.entityId;

      createRetailerMutation.mutate({
        name,
        phone,
        password: 'nimsonpassword123',
        role: UserRole.RETAILER,
        state: retailerState.trim().toLowerCase(),
        beat: retailerBeat.trim().toLowerCase(),
        parentId: resolvedDistributor || null,
        salesAgentId: resolvedAgent || undefined,
      });
      return;
    }

    // SO/ASE retailer registration
    if (!retailerName.trim()) return setFormError('Retailer name is required');
    if (!/^\d{10}$/.test(retailerPhone.replace(/\D/g, ''))) {
      return setFormError('Phone number must be exactly 10 digits');
    }
    if (!retailerPassword || retailerPassword.length < 4) {
      return setFormError('Password must be at least 4 characters');
    }
    if (!retailerState.trim()) return setFormError('State is required');
    if (!retailerBeat.trim()) return setFormError('Beat name is required');
    if (!retailerType.trim()) return setFormError('Retailer Type is required');
    if (retailerType === 'Others' && !customRetailerType.trim()) {
      return setFormError('Please specify the custom Retailer Type');
    }
    if (!retailerSalesAgent) return setFormError('Please assign a sales agent (SO/ASE)');
    if (!retailerDistributor) return setFormError('Please assign a distributor');
    if (!photo) return setFormError('Front store photo is required');

    setFormError('');

    const payload: any = {
      name: retailerName.trim(),
      phone: retailerPhone.replace(/\D/g, ''),
      password: retailerPassword,
      role: UserRole.RETAILER,
      state: retailerState.trim().toLowerCase(),
      beat: retailerBeat.trim().toLowerCase(),
      parentId: retailerDistributor,
      salesAgentId: retailerSalesAgent,
      retailerType: retailerType === 'Others' ? customRetailerType.trim() : retailerType,
    };

    if (latitude && longitude) {
      payload.storeLatitude = latitude;
      payload.storeLongitude = longitude;
    }

    createRetailerMutation.mutate(payload);
  };

  const sidebarItems = [
    { name: 'BP Transfer', icon: 'swap-horizontal-outline' as const, route: '/admin/transfer-business-partner' },
    { name: 'Territories', icon: 'location-outline' as const, route: '/admin/geofence' },
    { name: 'SKU Catalog', icon: 'book-outline' as const, route: '/skus' },
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

  if (!isAuthorizedRole) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          Retailer registration is only available for SO, ASE, ASM, and RSM roles.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Header */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="person-add-outline" size={28} color="#f97316" />
            <Text className="text-2xl font-bold text-gray-900">Add New Retailer</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-1 leading-5">
            Register new retailers with GPS location, photo verification, and auto-authorization.
          </Text>
        </View>

        {/* Add New Retailer Banner Button */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setShowModal(true);
            }}
            className="w-full bg-[#ecfdf5] border border-[#a7f3d0] rounded-lg py-2.5 items-center justify-center flex-row gap-2"
          >
            <Ionicons name="add" size={18} color="#047857" />
            <Text className="text-[#047857] font-semibold text-sm">
              Add New Retailer
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 gap-6 mb-24">
          {/* Instructions Card: How to Create a New Beat */}
          <View className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
            <Text className="text-base font-bold text-slate-900 mb-3">How to Create a New Beat</Text>
            <View className="gap-2.5">
              {[
                'Click "Add New Retailer" to register a new store in your territory',
                'Your GPS location will be captured as the store\'s permanent location',
                'Capture a photo of the store front for verification',
                'Enter retailer name, phone number, password, and state',
                'The retailer will be auto-authorized to your account for order placement',
                'During future orders, your proximity to this location will be tracked (50m radius)',
              ].map((text, idx) => (
                <View key={idx} className="flex-row items-start gap-2">
                  <View className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5" />
                  <Text className="text-xs text-slate-500 leading-5 flex-1">{text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ASM/RSM Beat Management Panel */}
          {isBeatCreator && (
            <View className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm gap-3">
              <Text className="text-base font-bold text-slate-900">Manage Registered Beats</Text>

              {/* Dropdown state trigger */}
              <TouchableOpacity
                onPress={() => setShowStateDropdownModal(true)}
                className="flex-row items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-white"
              >
                <Text className="text-xs text-gray-700 font-medium">
                  {selectedViewState ? STATE_OPTIONS.find((s) => s.value === selectedViewState)?.label : 'Select State'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#6b7280" />
              </TouchableOpacity>

              {selectedViewState && (
                <TextInput
                  value={beatSearchQuery}
                  onChangeText={setBeatSearchQuery}
                  placeholder="Search beats..."
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50/50"
                />
              )}

              {viewStateBeatsLoading ? (
                <ActivityIndicator size="small" color="#8b5cf6" />
              ) : !selectedViewState ? (
                <Text className="text-xs text-gray-400 text-center py-2">Select a state from the dropdown to list registered beats</Text>
              ) : filteredViewStateBeats.length === 0 ? (
                <Text className="text-xs text-red-400 text-center py-2">No beats registered</Text>
              ) : (
                <View className="gap-2 mt-2">
                  {filteredViewStateBeats.map((beat) => (
                    <View key={beat} className="flex-row justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg">
                      {confirmDeleteBeatName === beat ? (
                        <View className="flex-row items-center justify-between w-full">
                          <Text className="text-xs font-bold text-red-600">Delete beat "{beat}"?</Text>
                          <View className="flex-row gap-2">
                            <TouchableOpacity
                              onPress={() => {
                                deleteBeatMutation.mutate({ state: selectedViewState, beat });
                                setConfirmDeleteBeatName(null);
                              }}
                              className="bg-red-500 px-3 py-1 rounded-lg"
                            >
                              <Text className="text-white text-xs font-bold">Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setConfirmDeleteBeatName(null)}
                              className="border border-gray-200 px-3 py-1 rounded-lg bg-white"
                            >
                              <Text className="text-gray-600 text-xs font-bold">Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <>
                          <Text className="text-xs font-semibold text-gray-700 capitalize">{beat}</Text>
                          <TouchableOpacity onPress={() => setConfirmDeleteBeatName(beat)}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Registered Retailers Listing */}
          <View className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm gap-3">
            <Text className="text-base font-bold text-slate-900">Registered Retailers by State</Text>
            <Text className="text-xs text-slate-500">View all retailers registered in a specific state</Text>

            {/* Custom Dropdown Trigger for state selection */}
            <TouchableOpacity
              onPress={() => setShowStateDropdownModal(true)}
              className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white mt-2"
            >
              <Text className="text-sm text-gray-700">
                {selectedRetailerState ? STATE_OPTIONS.find((s) => s.value === selectedRetailerState)?.label : 'Select State'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#1e293b" />
            </TouchableOpacity>

            {stateRetailersLoading ? (
              <ActivityIndicator size="small" color="#8b5cf6" className="mt-4" />
            ) : !selectedRetailerState ? (
              <Text className="text-xs text-gray-400 text-center py-6 mt-2">
                Please select a state from the dropdown to view its registered retailers.
              </Text>
            ) : !stateRetailersData?.data || stateRetailersData.data.length === 0 ? (
              <Text className="text-xs text-gray-400 text-center py-6 mt-2">No retailers registered in this state</Text>
            ) : (
              <View className="gap-2 mt-2">
                {stateRetailersData.data.map((r: any) => (
                  <View key={r.entityId} className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex-row justify-between items-center">
                    <View>
                      <Text className="text-xs font-bold text-gray-800">{r.name}</Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">Phone: {r.phone} · Beat: {r.beat || '-'}</Text>
                    </View>
                    <View className="bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      <Text className="text-[9px] font-bold text-emerald-700 uppercase">Active</Text>
                    </View>
                  </View>
                ))}

                {/* Pagination */}
                {stateRetailersData.total > retailersLimit && (
                  <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <Text className="text-[10px] text-gray-400">Total: {stateRetailersData.total}</Text>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        disabled={retailersPage === 1}
                        onPress={() => setRetailersPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 border border-gray-200 rounded bg-white"
                      >
                        <Text className="text-[10px] font-bold text-gray-600">Prev</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={retailersPage * retailersLimit >= stateRetailersData.total}
                        onPress={() => setRetailersPage((p) => p + 1)}
                        className="px-2.5 py-1 border border-gray-200 rounded bg-white"
                      >
                        <Text className="text-[10px] font-bold text-gray-600">Next</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sidebar Drawer Navigation Modal Overlay */}
      <Modal
        visible={isSidebarOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSidebarOpen(false)}
      >
        <View className="flex-1 flex-row">
          <View style={{ width: width * 0.78 }} className="h-full bg-[#181d2a] p-4 justify-between">
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
              <View className="flex-row justify-between items-center pb-4 mb-4 border-b border-gray-800">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-orange-500 rounded-full items-center justify-center mr-3 shadow-md">
                    <Text className="text-white font-bold text-lg">N</Text>
                  </View>
                  <View>
                    <Text className="text-white font-bold text-base">Nimson DMS</Text>
                    <Text className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mt-0.5">OPERATIONS PANEL</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setIsSidebarOpen(false)} className="p-2">
                  <Ionicons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                <View className="gap-1">
                  {sidebarItems.map((item, idx) => {
                    const isSelected = item.name === 'BP Transfer';
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setIsSidebarOpen(false);
                          router.push(item.route as any);
                        }}
                        className={`flex-row items-center justify-between px-3 py-3 rounded-xl ${isSelected ? 'bg-[#2c3144] border border-gray-700' : 'active:bg-[#202637]'
                          }`}
                      >
                        <View className="flex-row items-center gap-3">
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={isSelected ? '#ffffff' : '#9ca3af'}
                          />
                          <Text
                            className={`text-sm ${isSelected ? 'text-white font-semibold' : 'text-gray-300'
                              }`}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={isSelected ? '#ffffff' : '#4b5563'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View className="border border-gray-800 rounded-xl p-3 bg-[#1e2332] items-center justify-center">
                <Text className="text-[9px] font-bold text-gray-500 tracking-widest uppercase">ROLE</Text>
                <Text className="text-white font-bold text-sm mt-1">{user?.role || 'User'}</Text>
              </View>
            </SafeAreaView>
          </View>

          <TouchableOpacity
            style={{ width: width * 0.22 }}
            className="h-full bg-black/50"
            activeOpacity={1}
            onPress={() => setIsSidebarOpen(false)}
          />
        </View>
      </Modal>

      {/* State Selection Dropdown Modal */}
      <Modal
        visible={showStateDropdownModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStateDropdownModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select State</Text>
              <TouchableOpacity onPress={() => setShowStateDropdownModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ value: '', label: 'Select State' }, ...STATE_OPTIONS]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedViewState(item.value);
                    setSelectedRetailerState(item.value);
                    setRetailersPage(1);
                    setShowStateDropdownModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${selectedRetailerState === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${selectedRetailerState === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {selectedRetailerState === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Add/Create Modal ── */}
      {showModal && (
        <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
          <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="person-add-outline" size={22} color="#f97316" />
                <Text className="text-lg font-bold text-gray-800 ml-2">
                  {isBeatCreator ? 'Register New Beat' : 'Register New Retailer'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                className="w-8 h-8 rounded-full border border-gray-200 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
              {formError ? (
                <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex-row items-start gap-2">
                  <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                  <Text className="text-xs text-red-600 flex-1">{formError}</Text>
                </View>
              ) : null}

              {/* Standard Retailer Geolocation & Photo Banner */}
              {!isBeatCreator && (
                <View className="mb-4">
                  {/* GPS Proximity / Store Location bar */}
                  <View className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl px-4 py-2.5 flex-row items-center gap-2 mb-4">
                    <Ionicons name="navigate-outline" size={16} color="#047857" />
                    {locationLoading ? (
                      <ActivityIndicator size="small" color="#047857" />
                    ) : latitude ? (
                      <Text className="text-[#047857] text-xs font-semibold">
                        Store Location: {latitude.toFixed(5)}, {longitude?.toFixed(5)} (±50m)
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={requestLocation}>
                        <Text className="text-[#047857] text-xs font-semibold underline">
                          Acquire Coordinates
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Photo Preview black box */}
                  <View className="w-full h-48 bg-black rounded-xl overflow-hidden mb-4 justify-center items-center">
                    {photo ? (
                      <Image source={{ uri: photo.uri }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <Ionicons name="camera-outline" size={40} color="#475569" />
                    )}
                  </View>

                  {/* Capture Button */}
                  <TouchableOpacity
                    onPress={handlePickPhoto}
                    className="w-full bg-[#f97316] rounded-xl py-3 items-center justify-center flex-row gap-2 mb-6"
                  >
                    <Ionicons name="camera-outline" size={18} color="white" />
                    <Text className="text-white font-bold text-sm">Capture Store Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Form Input fields */}
              <View style={{ zIndex: 10 }} className="gap-4">
                {/* Retailer Name */}
                {!isBeatCreator && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="person-add-outline" size={14} color="#64748b" />
                      <Text className="text-xs font-semibold text-slate-500 ml-1">Retailer Name *</Text>
                    </View>
                    <TextInput
                      value={retailerName}
                      onChangeText={setRetailerName}
                      placeholder="Enter retailer / store name"
                      placeholderTextColor="#9ca3af"
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                    />
                  </View>
                )}

                {/* Phone Number */}
                {!isBeatCreator && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="call-outline" size={14} color="#64748b" />
                      <Text className="text-xs font-semibold text-slate-500 ml-1">Phone Number *</Text>
                    </View>
                    <TextInput
                      value={retailerPhone}
                      onChangeText={setRetailerPhone}
                      placeholder="10-digit phone number"
                      placeholderTextColor="#9ca3af"
                      keyboardType="phone-pad"
                      maxLength={10}
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                    />
                  </View>
                )}

                {/* Password */}
                {!isBeatCreator && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="lock-closed-outline" size={14} color="#64748b" />
                      <Text className="text-xs font-semibold text-slate-500 ml-1">Password *</Text>
                    </View>
                    <TextInput
                      value={retailerPassword}
                      onChangeText={setRetailerPassword}
                      placeholder="Set login password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                    />
                  </View>
                )}

                {/* State */}
                <View>
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="earth-outline" size={14} color="#64748b" />
                    <Text className="text-xs font-semibold text-slate-500 ml-1">State *</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFormStateModal(true);
                      setShowFormBeatSuggestions(false);
                    }}
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
                  >
                    <Text className={`text-sm ${retailerState ? 'text-gray-800' : 'text-gray-400'}`}>
                      {retailerState ? STATE_OPTIONS.find((s) => s.value === retailerState)?.label : 'Select State'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* Retailer Type */}
                {!isBeatCreator && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="person-outline" size={14} color="#64748b" />
                      <Text className="text-xs font-semibold text-slate-500 ml-1">Retailer Type *</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setShowFormTypeModal(true);
                        setShowFormBeatSuggestions(false);
                      }}
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
                    >
                      <Text className={`text-sm ${retailerType ? 'text-gray-800' : 'text-gray-400'}`}>
                        {retailerType || 'Select Retailer Type'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Custom Retailer Type Input */}
                {!isBeatCreator && retailerType === 'Others' && (
                  <View>
                    <TextInput
                      value={customRetailerType}
                      onChangeText={setCustomRetailerType}
                      placeholder="Specify retailer type"
                      placeholderTextColor="#9ca3af"
                      className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                    />
                  </View>
                )}

                {/* Beat / City */}
                <View style={{ zIndex: 70 }} className="relative">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text className="text-xs font-semibold text-slate-500 ml-1">Beat *</Text>
                  </View>
                  <TextInput
                    value={retailerBeat}
                    onChangeText={(text) => {
                      setRetailerBeat(text);
                      if (!isBeatCreator) {
                        setShowFormBeatSuggestions(true);
                      }
                    }}
                    onFocus={() => {
                      if (!isBeatCreator) {
                        setShowFormBeatSuggestions(true);
                      }
                    }}
                    placeholder={isBeatCreator ? "Enter city / beat name" : "Select or enter beat name"}
                    placeholderTextColor="#9ca3af"
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
                  />
                  {!isBeatCreator && showFormBeatSuggestions && filteredBeats.length > 0 && (
                    <View className="absolute top-[76px] left-0 right-0 z-[100] bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                      <ScrollView nestedScrollEnabled={true}>
                        {filteredBeats.map((beat) => (
                          <TouchableOpacity
                            key={beat}
                            onPress={() => {
                              setRetailerBeat(beat);
                              setShowFormBeatSuggestions(false);
                            }}
                            className="p-3 border-b border-gray-100 last:border-b-0 active:bg-gray-50"
                          >
                            <Text className="text-xs text-gray-700 font-medium capitalize">{beat}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Assign Sales Agent (SO/ASE) */}
                {!isBeatCreator && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="person-add-outline" size={14} color="#64748b" />
                      <Text className="text-xs font-semibold text-slate-500 ml-1">Assign Sales Agent (SO/ASE) *</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (!retailerState) {
                          Alert.alert('Required', 'Please select State first to load sales agents');
                          return;
                        }
                        setShowFormSalesAgentModal(true);
                        setShowFormBeatSuggestions(false);
                      }}
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
                    >
                      <Text className={`text-sm ${retailerSalesAgent ? 'text-gray-800' : 'text-gray-400'}`}>
                        {retailerSalesAgent ? stateAgents.find((a: any) => a.entityId === retailerSalesAgent)?.name || retailerSalesAgent : 'Select a sales agent'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Assign Distributor */}
                {!isBeatCreator && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="people-outline" size={14} color="#64748b" />
                      <Text className="text-xs font-semibold text-slate-500 ml-1">Assign Distributor *</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (!retailerState) {
                          Alert.alert('Required', 'Please select State first to load distributors');
                          return;
                        }
                        setShowFormDistributorModal(true);
                        setShowFormBeatSuggestions(false);
                      }}
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row justify-between items-center"
                    >
                      <Text className={`text-sm ${retailerDistributor ? 'text-gray-800' : 'text-gray-400'}`}>
                        {retailerDistributor ? distributors.find((d: any) => d.entityId === retailerDistributor)?.name || retailerDistributor : 'Select a distributor'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Submit Buttons */}
              <View className="mt-8 mb-16 gap-3">
                <TouchableOpacity
                  disabled={createRetailerMutation.isPending}
                  onPress={handleSubmit}
                  className="w-full bg-[#047857] rounded-xl py-3.5 items-center justify-center flex-row gap-2 shadow-sm"
                >
                  {createRetailerMutation.isPending && <ActivityIndicator size="small" color="white" />}
                  <Text className="text-sm font-bold text-white">
                    {isBeatCreator ? 'Register & Authorize Beat' : 'Register & Authorize Retailer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="w-full py-3 items-center justify-center"
                >
                  <Text className="text-sm font-semibold text-gray-500">Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* State Selector for Form Modal */}
            <Modal
              visible={showFormStateModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowFormStateModal(false)}
            >
              <View className="flex-1 bg-black/50 justify-center items-center p-6">
                <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
                  <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
                    <Text className="font-bold text-gray-800 text-base">Select State</Text>
                    <TouchableOpacity onPress={() => setShowFormStateModal(false)} className="p-1">
                      <Ionicons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={scopedFormStateOptions}
                    keyExtractor={(item) => item.value}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setRetailerState(item.value);
                          setShowFormStateModal(false);
                        }}
                        className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${retailerState === item.value ? 'bg-orange-50' : ''
                          }`}
                      >
                        <Text className={`text-sm ${retailerState === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                          {item.label}
                        </Text>
                        {retailerState === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>

            {/* Retailer Type Selector for Form Modal */}
            <Modal
              visible={showFormTypeModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowFormTypeModal(false)}
            >
              <View className="flex-1 bg-black/50 justify-center items-center p-6">
                <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
                  <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
                    <Text className="font-bold text-gray-800 text-base">Select Retailer Type</Text>
                    <TouchableOpacity onPress={() => setShowFormTypeModal(false)} className="p-1">
                      <Ionicons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={RETAILER_TYPES.map(t => ({ value: t, label: t }))}
                    keyExtractor={(item) => item.value}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setRetailerType(item.value);
                          setShowFormTypeModal(false);
                        }}
                        className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${retailerType === item.value ? 'bg-orange-50' : ''
                          }`}
                      >
                        <Text className={`text-sm ${retailerType === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                          {item.label}
                        </Text>
                        {retailerType === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>

            {/* Distributor Selector for Form Modal */}
            <Modal
              visible={showFormDistributorModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowFormDistributorModal(false)}
            >
              <View className="flex-1 bg-black/50 justify-center items-center p-6">
                <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
                  <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
                    <Text className="font-bold text-gray-800 text-base">Select Distributor</Text>
                    <TouchableOpacity onPress={() => setShowFormDistributorModal(false)} className="p-1">
                      <Ionicons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  {distributors.length === 0 ? (
                    <View className="p-8 items-center justify-center">
                      <Text className="text-sm text-gray-500">No distributors found for this state.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={distributors}
                      keyExtractor={(item: any) => item.entityId}
                      renderItem={({ item }: any) => (
                        <TouchableOpacity
                          onPress={() => {
                            setRetailerDistributor(item.entityId);
                            setShowFormDistributorModal(false);
                          }}
                          className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${retailerDistributor === item.entityId ? 'bg-orange-50' : ''
                            }`}
                        >
                          <Text className={`text-sm ${retailerDistributor === item.entityId ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                            {item.name} ({item.entityId})
                          </Text>
                          {retailerDistributor === item.entityId && <Ionicons name="checkmark" size={18} color="#f97316" />}
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              </View>
            </Modal>

            {/* Sales Agent Selector for Form Modal */}
            <Modal
              visible={showFormSalesAgentModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowFormSalesAgentModal(false)}
            >
              <View className="flex-1 bg-black/50 justify-center items-center p-6">
                <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl max-h-[80%]">
                  <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
                    <Text className="font-bold text-gray-800 text-base">Select Sales Agent</Text>
                    <TouchableOpacity onPress={() => setShowFormSalesAgentModal(false)} className="p-1">
                      <Ionicons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <View className="p-3 border-b border-gray-100">
                    <TextInput
                      value={salesAgentSearch}
                      onChangeText={setSalesAgentSearch}
                      placeholder="Search sales agent..."
                      placeholderTextColor="#9ca3af"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-gray-50/50"
                    />
                  </View>
                  {filteredSalesAgents.length === 0 ? (
                    <View className="p-8 items-center justify-center">
                      <Text className="text-sm text-gray-500">No sales agents found for this state.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={filteredSalesAgents}
                      keyExtractor={(item: any) => item.entityId}
                      renderItem={({ item }: any) => (
                        <TouchableOpacity
                          onPress={() => {
                            setRetailerSalesAgent(item.entityId);
                            setSalesAgentSearch(item.name);
                            setShowFormSalesAgentModal(false);
                          }}
                          className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${retailerSalesAgent === item.entityId ? 'bg-orange-50' : ''
                            }`}
                        >
                          <View>
                            <Text className={`text-sm ${retailerSalesAgent === item.entityId ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                              {item.name}
                            </Text>
                            <Text className="text-[10px] text-gray-400 font-mono mt-0.5">{item.entityId} ({item.role})</Text>
                          </View>
                          {retailerSalesAgent === item.entityId && <Ionicons name="checkmark" size={18} color="#f97316" />}
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              </View>
            </Modal>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
