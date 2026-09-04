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
  Switch,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { STATE_OPTIONS } from '@/lib/states';
import { userService, type UserWithoutPassword } from '@/services/user.service';
import { retailerTransferService } from '@/services/retailerTransfer.service';
import { apiClient } from '@/lib/api-client';
import UserTable from '@/components/UserTable';

const ROLE_PARENT_CONFIG: Partial<Record<UserRole, { parentRoles: UserRole[]; label: string }>> = {
  [UserRole.RSM]: { parentRoles: [UserRole.NSM], label: 'Reporting NSM' },
  [UserRole.ASM]: { parentRoles: [UserRole.RSM, UserRole.NSM], label: 'Reporting RSM / NSM' },
  [UserRole.SO]: { parentRoles: [UserRole.ASE, UserRole.ASM, UserRole.RSM], label: 'Reporting To (ASE / ASM / RSM)' },
  [UserRole.ASE]: { parentRoles: [UserRole.ASM, UserRole.RSM], label: 'Reporting Manager (ASM / RSM)' },
  [UserRole.DISTRIBUTOR]: { parentRoles: [UserRole.SUPER_STOCKIST], label: 'Parent Super Stockist' },
  [UserRole.SUPER_STOCKIST]: { parentRoles: [UserRole.ADMIN], label: 'Connected to Admin (root)' },
};

const { width } = Dimensions.get('window');

const ALL_ROLES = [
  UserRole.NSM,
  UserRole.SUPER_STOCKIST,
  UserRole.RSM,
  UserRole.DISTRIBUTOR,
  UserRole.ASM,
  UserRole.SO,
  UserRole.ASE,
  UserRole.RETAILER,
];

function getRoleDisplayName(roleStr: string): string {
  switch (roleStr) {
    case UserRole.ADMIN: return 'Admin';
    case UserRole.NSM: return 'NSM';
    case UserRole.RSM: return 'RSM';
    case UserRole.ASM: return 'ASM';
    case UserRole.SO: return 'SO';
    case UserRole.ASE: return 'ASE';
    case UserRole.DISTRIBUTOR: return 'Distributor';
    case UserRole.SUPER_STOCKIST: return 'Super Stockist';
    case UserRole.RETAILER: return 'Retailer';
    default: return roleStr;
  }
}

function NetworkCard({
  title,
  icon,
  iconColor = '#f97316',
  member,
  extra,
  emptyText,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  member: any;
  extra?: string;
  emptyText: string;
}) {
  return (
    <View className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm gap-2 mb-3">
      <View className="flex-row items-center gap-2 mb-1">
        <Ionicons name={icon} size={16} color={iconColor} />
        <Text className="text-sm font-semibold text-slate-800">{title}</Text>
      </View>

      {member ? (
        <View className="gap-1">
          <Text className="text-sm font-semibold text-slate-800">{member.name}</Text>
          <Text className="text-xs text-slate-500">{member.email || 'Email not available'}</Text>
          <Text className="text-xs text-slate-500">{member.phone || 'Phone not available'}</Text>
          <View className="flex-row mt-1">
            <View className={`rounded-full px-2 py-0.5 ${member.status === 'active' ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-250'}`}>
              <Text className={`text-[10px] font-bold uppercase ${member.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                {member.status}
              </Text>
            </View>
          </View>
          {extra ? <Text className="text-xs text-slate-400 mt-1">{extra}</Text> : null}
        </View>
      ) : (
        <Text className="text-xs text-slate-400 font-medium">{emptyText}</Text>
      )}
    </View>
  );
}

export default function UsersScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [beatFilter, setBeatFilter] = useState('');

  // Modals
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [beatsList, setBeatsList] = useState<string[]>([]);

  // Create User States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole | ''>('');
  const [formState, setFormState] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showFormRoleDropdown, setShowFormRoleDropdown] = useState(false);
  const [showFormStateDropdown, setShowFormStateDropdown] = useState(false);

  // New RETAILER-specific form states
  const [formBeat, setFormBeat] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formSalesAgentId, setFormSalesAgentId] = useState('');
  const [formRetailerType, setFormRetailerType] = useState('');
  const [formCustomRetailerType, setFormCustomRetailerType] = useState('');

  const [showFormBeatDropdown, setShowFormBeatDropdown] = useState(false);
  const [showFormParentDropdown, setShowFormParentDropdown] = useState(false);
  const [showFormSalesAgentDropdown, setShowFormSalesAgentDropdown] = useState(false);
  const [showFormRetailerTypeDropdown, setShowFormRetailerTypeDropdown] = useState(false);

  // Edit User States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithoutPassword | null>(null);
  const [editName, setEditName] = useState('');
  const [editState, setEditState] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editBeat, setEditBeat] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [editSalesAgentId, setEditSalesAgentId] = useState('');
  const [editRetailerType, setEditRetailerType] = useState('');
  const [editCustomRetailerType, setEditCustomRetailerType] = useState('');

  // Dropdown/Suggestion visibility states for Edit User Modal
  const [showEditStateDropdown, setShowEditStateDropdown] = useState(false);
  const [showEditParentDropdown, setShowEditParentDropdown] = useState(false);
  const [showEditSalesAgentDropdown, setShowEditSalesAgentDropdown] = useState(false);
  const [showEditRetailerTypeDropdown, setShowEditRetailerTypeDropdown] = useState(false);
  const [showEditBeatSuggestions, setShowEditBeatSuggestions] = useState(false);
  const [showEditBeatDropdown, setShowEditBeatDropdown] = useState(false);

  const isSO = user?.role === UserRole.SO || user?.role === UserRole.ASE;

  const soBeats = useMemo<string[]>(() => {
    return (user?.beat || '')
      .split(',')
      .map((b: string) => b.trim())
      .filter(Boolean);
  }, [user]);

  // Fetch distributor candidates (for RETAILER parentId)
  const { data: distributorsList, isLoading: loadingDistributors } = useQuery({
    queryKey: ['distributor-candidates', formState],
    queryFn: async () => {
      if (!formState) return [];
      const res = await userService.listAll({
        role: UserRole.DISTRIBUTOR,
        state: formState || undefined,
        limit: 1000,
      });
      return res.data ?? [];
    },
    enabled: showCreateModal && (formRole === UserRole.RETAILER) && !!formState,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch sales agent candidates (for RETAILER salesAgentId, if creator is not SO/ASE)
  const { data: agentsList, isLoading: loadingAgents } = useQuery({
    queryKey: ['sales-agent-candidates', formState],
    queryFn: async () => {
      if (!formState) return [];
      const res = await userService.listAll({ role: 'so,ase', state: formState || undefined, limit: 1000 });
      return res.data ?? [];
    },
    enabled: showCreateModal && !isSO && (formRole === UserRole.RETAILER) && !!formState,
    staleTime: 5 * 60 * 1000,
  });

  const [showFormBeatSuggestions, setShowFormBeatSuggestions] = useState(false);

  // Fetch beats candidates (for RETAILER beat selection dropdown)
  const { data: formBeatsData } = useQuery({
    queryKey: ['retailer-beats', formState],
    queryFn: () => userService.listBeats({ state: formState, role: UserRole.RETAILER }),
    enabled: showCreateModal && (formRole === UserRole.RETAILER) && !!formState,
    staleTime: 5 * 60 * 1000,
  });
  const formBeats = formBeatsData ?? [];

  const isEditingRetailer = editingUser?.role === UserRole.RETAILER;
  const editParentConfig = editingUser ? (ROLE_PARENT_CONFIG[editingUser.role as UserRole] ?? null) : null;
  const editParentRoles = editParentConfig?.parentRoles ?? [];
  const canChangeManager = user?.role === UserRole.ADMIN && editParentRoles.length > 0;
  const canResetPassword = user?.role === UserRole.ADMIN;

  // Fetch distributor candidates for Edit (for RETAILER parentId / distributorId)
  const { data: editDistributorsList, isLoading: loadingEditDistributors } = useQuery({
    queryKey: ['distributor-candidates', editState],
    queryFn: async () => {
      if (!editState) return [];
      const res = await userService.listDistributors({ state: editState || undefined, limit: 1000 });
      return res.data ?? [];
    },
    enabled: showEditModal && isEditingRetailer && (user?.role === UserRole.ADMIN || user?.role === UserRole.SO || user?.role === UserRole.ASE),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch sales agent candidates for Edit (for RETAILER salesAgentId)
  const { data: editAgentsList, isLoading: loadingEditAgents } = useQuery({
    queryKey: ['sales-agent-candidates', editState],
    queryFn: async () => {
      if (!editState) return [];
      const res = await userService.listAll({ role: 'so,ase', state: editState || undefined, limit: 1000 });
      return res.data ?? [];
    },
    enabled: showEditModal && isEditingRetailer && (user?.role === UserRole.ADMIN || user?.role === UserRole.SO || user?.role === UserRole.ASE),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch managers candidates for Edit (for managerId / parentId)
  const { data: editManagersList, isLoading: loadingEditManagers } = useQuery({
    queryKey: ['edit-managers-candidates', editParentRoles.join(','), editState],
    queryFn: async () => {
      if (!editState || editParentRoles.length === 0) return [];
      const res = await userService.listAll({ role: editParentRoles.join(','), state: editState || undefined, limit: 1000 });
      return res.data ?? [];
    },
    enabled: showEditModal && canChangeManager && !!editState,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch current parent for editing user
  const { data: editCurrentParentData } = useQuery({
    queryKey: ['edit-current-parent', editingUser?.parentId],
    queryFn: () => userService.getByEntityId(editingUser?.parentId as string),
    enabled: showEditModal && canChangeManager && !!editingUser?.parentId,
    staleTime: 5 * 60 * 1000,
  });
  const editCurrentParent = editCurrentParentData?.data?.user;

  const editManagerOptions = useMemo(() => {
    const opts = [...(editManagersList ?? [])];
    if (editCurrentParent && !opts.some((m) => m.entityId === editCurrentParent.entityId)) {
      opts.unshift(editCurrentParent);
    }
    return opts;
  }, [editManagersList, editCurrentParent]);

  // Fetch current sales agent for editing retailer
  const { data: editCurrentSalesAgentData } = useQuery({
    queryKey: ['edit-current-sales-agent', editingUser?.salesAgentId],
    queryFn: () => userService.getByEntityId(editingUser?.salesAgentId as string),
    enabled: showEditModal && isEditingRetailer && !!editingUser?.salesAgentId,
    staleTime: 5 * 60 * 1000,
  });
  const editCurrentSalesAgent = editCurrentSalesAgentData?.data?.user;

  const editSalesAgentOptions = useMemo(() => {
    const opts = [...(editAgentsList ?? [])];
    if (editCurrentSalesAgent && !opts.some((s) => s.entityId === editCurrentSalesAgent.entityId)) {
      opts.unshift(editCurrentSalesAgent);
    }
    return opts;
  }, [editAgentsList, editCurrentSalesAgent]);

  // Fetch beats candidates (for RETAILER beat selection dropdown)
  const { data: editBeatsData } = useQuery({
    queryKey: ['retailer-beats', editState],
    queryFn: () => userService.listBeats({ state: editState, role: UserRole.RETAILER }),
    enabled: showEditModal && isEditingRetailer && !!editState,
    staleTime: 5 * 60 * 1000,
  });
  const editBeats = editBeatsData ?? [];

  const filteredEditBeats = useMemo(() => {
    if (!editState) return [];
    return editBeats.filter((b) =>
      !editBeat || b.toLowerCase().includes(editBeat.toLowerCase())
    );
  }, [editBeats, editBeat, editState]);

  const filteredBeats = useMemo(() => {
    if (!formState) return [];
    return formBeats.filter((b) =>
      !formBeat || b.toLowerCase().includes(formBeat.toLowerCase())
    );
  }, [formBeats, formBeat, formState]);

  const resetForm = () => {
    setFormName('');
    setFormRole('');
    setFormState('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormBeat('');
    setFormParentId('');
    setFormSalesAgentId('');
    setFormRetailerType('');
    setFormCustomRetailerType('');
    setShowFormRoleDropdown(false);
    setShowFormStateDropdown(false);
    setShowFormBeatDropdown(false);
    setShowFormParentDropdown(false);
    setShowFormSalesAgentDropdown(false);
    setShowFormRetailerTypeDropdown(false);
    setShowFormBeatSuggestions(false);
  };

  useEffect(() => {
    if (!showCreateModal) {
      resetForm();
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (showCreateModal && isSO && user) {
      setFormRole(UserRole.RETAILER);
      setFormState(user.state || '');
      setFormSalesAgentId(user.entityId || '');
    }
  }, [showCreateModal, isSO, user]);

  useEffect(() => {
    const fetchBeats = async () => {
      try {
        const data = await userService.listBeats({
          state: stateFilter || undefined,
          role: roleFilter ? (roleFilter as UserRole) : undefined,
        });
        setBeatsList(data || []);
      } catch (e) {
        console.error('Failed to fetch recommended beats:', e);
      }
    };
    fetchBeats();
  }, [stateFilter, roleFilter]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { exportPaginatedData } = require('@/lib/xlsx-export');
      const timestamp = new Date().toISOString().split('T')[0];
      const options = { fileName: `users-export-${timestamp}.xlsx`, sheetName: 'Users' };

      const rowMapper = (u: UserWithoutPassword) => ({
        Name: u.name,
        Email: u.email || '-',
        Role: getRoleDisplayName(u.role),
        Type: u.role === UserRole.RETAILER ? (u.retailerType || '-') : '-',
        State: u.state || '-',
        Beat: u.beat || '-',
        Phone: u.phone || '-',
        Status: u.isActive ? 'Active' : 'Inactive',
        Date: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : '-',
      });

      const baseParams = {
        search: search.trim() || undefined,
        state: stateFilter || undefined,
        beat: beatFilter || undefined,
        role: roleFilter ? (roleFilter as UserRole) : undefined,
      };

      await exportPaginatedData(
        userService.listManagement,
        baseParams,
        rowMapper,
        options
      );
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Error', err.message || 'Failed to export users data.');
    } finally {
      setIsExporting(false);
    }
  };

  const isRetailer = user?.role === UserRole.RETAILER;

  // 1. Retailer Network Query
  const { data: networkData, isLoading: networkLoading } = useQuery({
    queryKey: ['retailer-network-app'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: any }>('/users/retailer/my-network');
      return res.data.data;
    },
    enabled: isRetailer,
  });

  // 2. Staff Management Query
  const { data: managementData, isLoading: managementLoading, isError, refetch } = useQuery({
    queryKey: ['users-list-app', page, search, roleFilter, stateFilter, beatFilter],
    queryFn: () =>
      userService.listManagement({
        page,
        limit: 15,
        search: search.trim() || undefined,
        state: stateFilter || undefined,
        beat: beatFilter || undefined,
        role: roleFilter ? (roleFilter as UserRole) : undefined,
      }),
    enabled: !isRetailer && !!user,
  });

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: ({ entityId, isActive }: { entityId: string; isActive: boolean }) =>
      userService.toggleStatus(entityId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list-app'] });
      Alert.alert('Success', 'User status updated successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update user status');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: any) => userService.createUser(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users-list-app'] });
      setShowCreateModal(false);
      const generatedPass = res.data?.generatedPassword;
      if (generatedPass) {
        Alert.alert(
          'User Created Successfully',
          `Name: ${res.data?.user.name}\nPassword: ${generatedPass}\n\nPlease copy this password as it will not be shown again.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Success', 'User created successfully.');
      }
      // Reset form
      resetForm();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (entityId: string) => userService.deleteUser(entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list-app'] });
      Alert.alert('Success', 'User deleted successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete user');
    },
  });

  const editUserMutation = useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: any }) =>
      userService.editUser(entityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list-app'] });
    },
  });

  const handleToggleStatus = (u: UserWithoutPassword, val: boolean) => {
    toggleMutation.mutate({ entityId: u.entityId, isActive: val });
  };

  const handleDeleteUser = (u: UserWithoutPassword) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(u.entityId) },
    ]);
  };

  const handleEditClick = (u: UserWithoutPassword) => {
    setEditingUser(u);
    setEditName(u.name || '');
    setEditState(u.state || '');
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditPassword('');
    setEditBeat(u.beat || '');
    setEditParentId(u.parentId || '');
    setEditSalesAgentId(u.salesAgentId || '');

    const rType = u.retailerType || '';
    if (['Kiryana Store', 'Beauty parlour', 'Chemist shop'].includes(rType === 'Beuty parlour' ? 'Beauty parlour' : rType)) {
      setEditRetailerType(rType === 'Beuty parlour' ? 'Beauty parlour' : rType);
      setEditCustomRetailerType('');
    } else if (rType) {
      setEditRetailerType('Others');
      setEditCustomRetailerType(rType);
    } else {
      setEditRetailerType('');
      setEditCustomRetailerType('');
    }

    // Reset dropdown visibility states
    setShowEditStateDropdown(false);
    setShowEditParentDropdown(false);
    setShowEditSalesAgentDropdown(false);
    setShowEditRetailerTypeDropdown(false);
    setShowEditBeatSuggestions(false);
    setShowEditBeatDropdown(false);

    setShowEditModal(true);
  };

  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const handleEditSubmit = async () => {
    if (!editingUser) return;

    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }

    if (editPhone && !/^\d{10}$/.test(editPhone)) {
      Alert.alert('Validation Error', 'Phone number must be exactly 10 digits');
      return;
    }

    if (isEditingRetailer && !editBeat.trim()) {
      Alert.alert('Validation Error', 'Beat is required for retailer');
      return;
    }

    if (canResetPassword && editPassword && editPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters');
      return;
    }

    setIsEditSubmitting(true);
    try {
      // 1. Process main user details edit
      const editData = {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        state: editState || undefined,
        beat: isEditingRetailer ? editBeat.trim() || undefined : undefined,
        retailerType: isEditingRetailer
          ? (editRetailerType === 'Others' ? editCustomRetailerType.trim() : editRetailerType) || undefined
          : undefined,
      };

      await editUserMutation.mutateAsync({ entityId: editingUser.entityId, data: editData });

      const originalParentId = editingUser.parentId || '';
      const originalSalesAgentId = editingUser.salesAgentId || '';

      // 2. Password reset if password was specified by Admin
      if (canResetPassword && editPassword) {
        await userService.adminResetPassword(editingUser.entityId, editPassword);
      }

      // 3. Hierarchy updates (Distributor, Sales Agent or Manager)
      if (isEditingRetailer) {
        // Distributor transfer
        if (editParentId && editParentId !== originalParentId) {
          await retailerTransferService.changeRetailerDistributor(editingUser.entityId, editParentId);
        }
        // Sales Agent transfer
        if (editSalesAgentId && editSalesAgentId !== originalSalesAgentId) {
          await retailerTransferService.changeRetailerSalesAgent(editingUser.entityId, editSalesAgentId);
        }
      } else {
        // Parent Manager transfer
        if (editParentId && editParentId !== originalParentId) {
          await retailerTransferService.changeParent(editingUser.entityId, editParentId);
        }
      }

      Alert.alert('Success', 'User updated successfully');
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Failed to edit user:', err);
      Alert.alert('Error', err.message || 'Failed to update user');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStateFilter('');
    setBeatFilter('');
    setPage(1);
  };

  // Render view-only network layout for Retailers
  if (isRetailer) {
    const net = networkData ?? {};

    const formatAuthDate = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      } catch (e) {
        return '';
      }
    };

    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="px-6 py-4 bg-white border-b border-gray-200 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.push('/')} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-800">My Network</Text>
            <Text className="text-xs text-gray-500 mt-0.5">Your connected sales and distribution team</Text>
          </View>
        </View>

        {networkLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : (
          <ScrollView className="p-4 gap-4" showsVerticalScrollIndicator={false}>
            <View className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl mb-3">
              <Text className="text-xs text-amber-800 font-medium leading-relaxed">
                This page is view-only. Contact your distributor for any changes.
              </Text>
            </View>

            <NetworkCard
              title="Your Distributor"
              icon="business"
              member={net.distributor}
              extra={net.distributor ? `Territory: ${net.distributor.territory || 'N/A'}` : undefined}
              emptyText="Not assigned"
            />

            <NetworkCard
              title="Your Sales Officer"
              icon="person"
              member={net.so}
              extra={net.so?.authorizedAt ? `Authorized on: ${formatAuthDate(net.so.authorizedAt)}` : undefined}
              emptyText="No SO authorized yet"
            />

            <NetworkCard
              title="Area Sales Manager"
              icon="person"
              member={net.asm}
              emptyText="Not assigned"
            />

            <NetworkCard
              title="Regional Sales Manager"
              icon="shield-checkmark"
              member={net.rsm}
              emptyText="Not assigned"
            />
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // Else: Staff/Admin User Management List
  const users: UserWithoutPassword[] = managementData?.data ?? [];
  const total = managementData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 15));

  const allowedRoles = managementData?.meta?.visibleRoles ?? ALL_ROLES;
  const deactivationRoles = managementData?.meta?.deactivationRoles ?? [];
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

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Dropdown Selectors and Input Filters */}
        <View className="px-6 pt-6 gap-3">
          {/* Role Filter */}
          {allowedRoles.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowRoleModal(true)}
              className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
            >
              <Text className="text-sm text-slate-700">
                {roleFilter ? getRoleDisplayName(roleFilter) : 'All Roles'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
          )}

          {/* State Filter */}
          <TouchableOpacity
            onPress={() => setShowStateModal(true)}
            className="w-full flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white"
          >
            <Text className="text-sm text-slate-700">
              {stateFilter ? STATE_OPTIONS.find((s) => s.value === stateFilter)?.label : 'All States'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          {/* Beat Input */}
          {(!roleFilter || roleFilter === UserRole.RETAILER) && (
            <View className="gap-2">
              <View className="border border-gray-200 rounded-xl px-4 py-3 bg-white flex-row items-center">
                <TextInput
                  value={beatFilter}
                  onChangeText={(text) => {
                    setBeatFilter(text);
                    setPage(1);
                  }}
                  placeholder="Beat"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 text-sm text-slate-700 p-0"
                />
                {beatFilter ? (
                  <TouchableOpacity onPress={() => { setBeatFilter(''); setPage(1); }} className="p-0.5">
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {beatsList.length > 0 && (
                <View className="px-1">
                  <Text className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Recommended Beats</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pb-1">
                    {beatsList
                      .filter((b) => !beatFilter || b.toLowerCase().includes(beatFilter.toLowerCase()))
                      .slice(0, 15)
                      .map((beat) => (
                        <TouchableOpacity
                          key={beat}
                          onPress={() => {
                            setBeatFilter(beat);
                            setPage(1);
                          }}
                          className={`px-3 py-1 rounded-full border mr-2 ${beatFilter === beat
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-white border-gray-250'
                            }`}
                        >
                          <Text
                            className={`text-xs ${beatFilter === beat ? 'font-bold text-orange-700' : 'text-slate-600'
                              }`}
                          >
                            {beat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="px-6 pt-4 gap-3">
          <TouchableOpacity
            disabled={isExporting}
            onPress={handleExport}
            className="w-full flex-row items-center justify-center border border-gray-200 bg-white rounded-xl py-3 gap-2"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#475569" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#475569" />
            )}
            <Text className="text-slate-700 text-sm font-semibold">
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            className="w-full flex-row items-center justify-center bg-[#f97316] rounded-xl py-3 gap-1.5"
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text className="text-white text-sm font-bold">Create User</Text>
          </TouchableOpacity>
        </View>

        {/* Users list content */}
        <View className="px-6 pt-6 pb-24">
          <UserTable
            title="User Management"
            subtitle={`${total} users in the system`}
            users={users}
            total={total}
            page={page}
            totalPages={totalPages}
            isLoading={managementLoading}
            isError={isError}
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            onPageChange={setPage}
            onToggle={handleToggleStatus}
            canToggleUser={(item) => deactivationRoles.includes(item.role)}
            togglingId={toggleMutation.isPending ? toggleMutation.variables?.entityId : null}
            isAdmin={user?.role === UserRole.ADMIN}
            onEdit={handleEditClick}
            canEditUser={(u) => (user?.role === UserRole.ADMIN && u.role !== UserRole.ADMIN) || ((user?.role === UserRole.SO || user?.role === UserRole.ASE) && u.role === UserRole.RETAILER)}
            onDelete={(u) => deleteMutation.mutate(u.entityId)}
            deletingId={deleteMutation.isPending ? deleteMutation.variables : null}
          />
        </View>
      </ScrollView>

      {/* Role filter Modal */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <View className="p-4 border-b border-gray-150 flex-row justify-between items-center bg-gray-50">
              <Text className="font-bold text-gray-800 text-base">Select Role</Text>
              <TouchableOpacity onPress={() => setShowRoleModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ value: '', label: 'All Roles' }, ...allowedRoles.map((r) => ({ value: r, label: getRoleDisplayName(r) }))]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setRoleFilter(item.value);
                    if (item.value && item.value !== UserRole.RETAILER) {
                      setBeatFilter('');
                    }
                    setPage(1);
                    setShowRoleModal(false);
                  }}
                  className={`p-4 border-b border-gray-100 flex-row justify-between items-center ${roleFilter === item.value ? 'bg-orange-50' : ''
                    }`}
                >
                  <Text className={`text-sm ${roleFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {roleFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* State Filter Modal */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStateModal(false)}
      >
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
                  <Text className={`text-sm ${stateFilter === item.value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                  {stateFilter === item.value && <Ionicons name="checkmark" size={18} color="#f97316" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Create User Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6" style={{ zIndex: 1000 }}>
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl p-6 relative">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <Text className="text-lg font-bold text-slate-800">{isSO ? 'Add Retailer' : 'Create User'}</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} className="p-1">
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[450px]">
              {/* Name */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">
                  {isSO ? 'Store Name *' : 'Name *'}
                </Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  placeholder={isSO ? 'Store name' : 'Full name'}
                  placeholderTextColor="#94a3b8"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>

              {/* Role */}
              {!isSO && (
                <View className="mb-4 relative" style={{ zIndex: 90 }}>
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">Role *</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFormRoleDropdown(!showFormRoleDropdown);
                      setShowFormStateDropdown(false);
                      setShowFormParentDropdown(false);
                      setShowFormSalesAgentDropdown(false);
                      setShowFormRetailerTypeDropdown(false);
                      setShowFormBeatDropdown(false);
                    }}
                    className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                  >
                    <Text className="text-sm text-slate-700">
                      {formRole ? getRoleDisplayName(formRole) : 'Select role'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {showFormRoleDropdown && (
                    <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                      <ScrollView nestedScrollEnabled={true}>
                        {allowedRoles.map((r) => (
                          <TouchableOpacity
                            key={r}
                            onPress={() => {
                              setFormRole(r);
                              setShowFormRoleDropdown(false);
                            }}
                            className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                          >
                            <Text className="text-xs text-slate-700 font-medium">{getRoleDisplayName(r)}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* State */}
              <View className="mb-4 relative" style={{ zIndex: 80 }}>
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">State *</Text>
                <TouchableOpacity
                  disabled={isSO}
                  onPress={() => {
                    setShowFormStateDropdown(!showFormStateDropdown);
                    setShowFormRoleDropdown(false);
                    setShowFormParentDropdown(false);
                    setShowFormSalesAgentDropdown(false);
                    setShowFormRetailerTypeDropdown(false);
                    setShowFormBeatDropdown(false);
                  }}
                  className={`flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 ${isSO ? 'bg-slate-50 opacity-70' : 'bg-white'}`}
                >
                  <Text className="text-sm text-slate-700">
                    {formState ? STATE_OPTIONS.find((s) => s.value === formState)?.label : 'Select state'}
                  </Text>
                  {!isSO && <Ionicons name="chevron-down" size={14} color="#64748b" />}
                </TouchableOpacity>

                {showFormStateDropdown && !isSO && (
                  <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                    <ScrollView nestedScrollEnabled={true}>
                      {STATE_OPTIONS.map((state) => (
                        <TouchableOpacity
                          key={state.value}
                          onPress={() => {
                            setFormState(state.value);
                            setShowFormStateDropdown(false);
                          }}
                          className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                        >
                          <Text className="text-xs text-slate-700 font-medium">{state.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Assigned Distributor */}
              {formRole === UserRole.RETAILER && (
                <View className="mb-4 relative" style={{ zIndex: 75 }}>
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">Assigned Distributor *</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFormParentDropdown(!showFormParentDropdown);
                      setShowFormRoleDropdown(false);
                      setShowFormStateDropdown(false);
                      setShowFormSalesAgentDropdown(false);
                      setShowFormRetailerTypeDropdown(false);
                      setShowFormBeatDropdown(false);
                    }}
                    className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                  >
                    <Text className="text-sm text-slate-700">
                      {formParentId
                        ? (distributorsList?.find((d) => d.entityId === formParentId)?.name ?? formParentId)
                        : 'Select distributor'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {showFormParentDropdown && (
                    <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                      {loadingDistributors ? (
                        <View className="p-3">
                          <ActivityIndicator size="small" color="#f97316" />
                        </View>
                      ) : distributorsList && distributorsList.length > 0 ? (
                        <ScrollView nestedScrollEnabled={true}>
                          {distributorsList.map((d) => (
                            <TouchableOpacity
                              key={d.entityId}
                              onPress={() => {
                                setFormParentId(d.entityId);
                                setShowFormParentDropdown(false);
                              }}
                              className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                            >
                              <Text className="text-xs text-slate-700 font-medium">{d.name} ({d.entityId})</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View className="p-3">
                          <Text className="text-xs text-slate-400">No distributors available in this state</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Assigned Sales Officer / ASE Dropdown */}
              {formRole === UserRole.RETAILER && !isSO && (
                <View className="mb-4 relative" style={{ zIndex: 70 }}>
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">Assigned Sales Officer / ASE *</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFormSalesAgentDropdown(!showFormSalesAgentDropdown);
                      setShowFormRoleDropdown(false);
                      setShowFormStateDropdown(false);
                      setShowFormParentDropdown(false);
                      setShowFormRetailerTypeDropdown(false);
                      setShowFormBeatDropdown(false);
                    }}
                    className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                  >
                    <Text className="text-sm text-slate-700">
                      {formSalesAgentId
                        ? (agentsList?.find((a) => a.entityId === formSalesAgentId)?.name ?? formSalesAgentId)
                        : 'Select SO / ASE'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {showFormSalesAgentDropdown && (
                    <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                      {loadingAgents ? (
                        <View className="p-3">
                          <ActivityIndicator size="small" color="#f97316" />
                        </View>
                      ) : agentsList && agentsList.length > 0 ? (
                        <ScrollView nestedScrollEnabled={true}>
                          {agentsList.map((a) => (
                            <TouchableOpacity
                              key={a.entityId}
                              onPress={() => {
                                setFormSalesAgentId(a.entityId);
                                setShowFormSalesAgentDropdown(false);
                              }}
                              className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                            >
                              <Text className="text-xs text-slate-700 font-medium">{a.name} ({getRoleDisplayName(a.role)} · {a.entityId})</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View className="p-3">
                          <Text className="text-xs text-slate-400">No SO/ASE available in this state</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Beat */}
              {formRole === UserRole.RETAILER && (
                <View className="mb-4 relative" style={{ zIndex: 65 }}>
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">Beat *</Text>
                  {isSO && soBeats.length > 0 ? (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          setShowFormBeatDropdown(!showFormBeatDropdown);
                          setShowFormRoleDropdown(false);
                          setShowFormStateDropdown(false);
                          setShowFormParentDropdown(false);
                          setShowFormSalesAgentDropdown(false);
                          setShowFormRetailerTypeDropdown(false);
                          setShowFormBeatSuggestions(false);
                        }}
                        className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                      >
                        <Text className="text-sm text-slate-700">
                          {formBeat ? formBeat : 'Select beat'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color="#64748b" />
                      </TouchableOpacity>

                      {showFormBeatDropdown && (
                        <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                          <ScrollView nestedScrollEnabled={true}>
                            {soBeats.map((beat: string) => (
                              <TouchableOpacity
                                key={beat}
                                onPress={() => {
                                  setFormBeat(beat);
                                  setShowFormBeatDropdown(false);
                                }}
                                className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                              >
                                <Text className="text-xs text-slate-700 font-medium">{beat}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  ) : (
                    <View className="relative">
                      <TextInput
                        value={formBeat}
                        onChangeText={(text) => {
                          setFormBeat(text);
                          setShowFormBeatSuggestions(true);
                        }}
                        onFocus={() => {
                          setShowFormBeatSuggestions(true);
                          setShowFormRoleDropdown(false);
                          setShowFormStateDropdown(false);
                          setShowFormParentDropdown(false);
                          setShowFormSalesAgentDropdown(false);
                          setShowFormRetailerTypeDropdown(false);
                          setShowFormBeatDropdown(false);
                        }}
                        placeholder="Enter beat name"
                        placeholderTextColor="#94a3b8"
                        className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                      />
                      {showFormBeatSuggestions && filteredBeats.length > 0 && (
                        <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                          <ScrollView nestedScrollEnabled={true}>
                            {filteredBeats.map((beat) => (
                              <TouchableOpacity
                                key={beat}
                                onPress={() => {
                                  setFormBeat(beat);
                                  setShowFormBeatSuggestions(false);
                                }}
                                className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                              >
                                <Text className="text-xs text-slate-700 font-medium capitalize">{beat}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Retailer Type */}
              {formRole === UserRole.RETAILER && (
                <View className="mb-4 relative" style={{ zIndex: 60 }}>
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">Retailer Type *</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFormRetailerTypeDropdown(!showFormRetailerTypeDropdown);
                      setShowFormRoleDropdown(false);
                      setShowFormStateDropdown(false);
                      setShowFormParentDropdown(false);
                      setShowFormSalesAgentDropdown(false);
                      setShowFormBeatDropdown(false);
                    }}
                    className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                  >
                    <Text className="text-sm text-slate-700">
                      {formRetailerType ? formRetailerType : 'Select Retailer Type'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {showFormRetailerTypeDropdown && (
                    <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ zIndex: 100 }}>
                      <ScrollView nestedScrollEnabled={true}>
                        {['Kiryana Store', 'Beauty parlour', 'Chemist shop', 'Others'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            onPress={() => {
                              setFormRetailerType(type);
                              setShowFormRetailerTypeDropdown(false);
                            }}
                            className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                          >
                            <Text className="text-xs text-slate-700 font-medium">{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {formRetailerType === 'Others' && (
                    <TextInput
                      value={formCustomRetailerType}
                      onChangeText={setFormCustomRetailerType}
                      placeholder="Specify retailer type"
                      placeholderTextColor="#94a3b8"
                      className="mt-2 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                    />
                  )}
                </View>
              )}

              {/* Email */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">Email (optional)</Text>
                <TextInput
                  value={formEmail}
                  onChangeText={setFormEmail}
                  placeholder="user@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>

              {/* Phone */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">Phone *</Text>
                <TextInput
                  value={formPhone}
                  onChangeText={(val) => setFormPhone(val.replace(/\D/g, ''))}
                  placeholder="10-digit mobile"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={10}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>

              {/* Password */}
              <View className="mb-6">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">
                  {isSO && formRole === UserRole.RETAILER ? 'Password *' : 'Password'}
                </Text>
                <TextInput
                  value={formPassword}
                  onChangeText={setFormPassword}
                  placeholder={isSO && formRole === UserRole.RETAILER ? 'Enter password for retailer' : 'Auto-generate'}
                  placeholderTextColor="#94a3b8"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>
            </ScrollView>

            {/* Bottom buttons */}
            <View className="flex-row justify-end items-center gap-3 pt-4 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                className="border border-slate-200 rounded-xl px-5 py-2.5"
              >
                <Text className="text-slate-500 text-sm font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!formName.trim()) {
                    Alert.alert('Validation Error', 'Please enter a name.');
                    return;
                  }
                  if (!formRole) {
                    Alert.alert('Validation Error', 'Please select a role.');
                    return;
                  }
                  if (!formState) {
                    Alert.alert('Validation Error', 'Please select a state.');
                    return;
                  }
                  if (!formPhone || formPhone.length !== 10) {
                    Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number.');
                    return;
                  }
                  if (formRole === UserRole.RETAILER && !formBeat.trim()) {
                    Alert.alert('Validation Error', 'Beat is required for retailer creation.');
                    return;
                  }
                  if (formRole === UserRole.RETAILER && !formRetailerType) {
                    Alert.alert('Validation Error', 'Retailer Type is required.');
                    return;
                  }
                  if (formRole === UserRole.RETAILER && formRetailerType === 'Others' && !formCustomRetailerType.trim()) {
                    Alert.alert('Validation Error', 'Please specify the Retailer Type.');
                    return;
                  }
                  if (formRole === UserRole.RETAILER && !formParentId) {
                    Alert.alert('Validation Error', 'Assigned Distributor is required.');
                    return;
                  }
                  if (formRole === UserRole.RETAILER && !isSO && !formSalesAgentId) {
                    Alert.alert('Validation Error', 'Assigned Sales Officer / ASE is required.');
                    return;
                  }
                  if (isSO && formRole === UserRole.RETAILER && !formPassword.trim()) {
                    Alert.alert('Validation Error', 'Password is required for retailer creation.');
                    return;
                  }

                  createUserMutation.mutate({
                    name: formName.trim(),
                    role: formRole,
                    state: formState,
                    email: formEmail.trim() || undefined,
                    phone: formPhone,
                    password: formPassword.trim() || undefined,
                    beat: formRole === UserRole.RETAILER ? formBeat.trim() : undefined,
                    parentId: formRole === UserRole.RETAILER ? formParentId : undefined,
                    salesAgentId: formRole === UserRole.RETAILER
                      ? (isSO ? (user?.entityId || undefined) : (formSalesAgentId || undefined))
                      : undefined,
                    retailerType: formRole === UserRole.RETAILER
                      ? (formRetailerType === 'Others' ? formCustomRetailerType.trim() : formRetailerType)
                      : undefined,
                  });
                }}
                disabled={createUserMutation.isPending}
                className="bg-[#f97316] rounded-xl px-5 py-2.5"
              >
                {createUserMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-bold">{isSO ? 'Add Retailer' : 'Create User'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6" style={{ zIndex: 1000 }}>
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl p-6 relative">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <Text className="text-lg font-bold text-slate-800">Edit User</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingUser(null); }} className="p-1">
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Info bar */}
            <View className="mb-4 bg-blue-50 border border-blue-100 p-3 rounded-xl gap-1">
              <Text className="text-sm font-semibold text-blue-800">Entity ID: {editingUser?.entityId}</Text>
              <Text className="text-xs text-blue-600 font-medium">Role: {editingUser ? getRoleDisplayName(editingUser.role) : ''} (cannot be changed)</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[400px]">
              {/* Name */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">Name *</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full name"
                  placeholderTextColor="#94a3b8"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>

              {/* State */}
              <View className="mb-4 relative" style={{ zIndex: 80 }}>
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">State *</Text>
                <TouchableOpacity
                  disabled={isSO}
                  onPress={() => {
                    setShowEditStateDropdown(!showEditStateDropdown);
                    setShowEditParentDropdown(false);
                    setShowEditSalesAgentDropdown(false);
                    setShowEditRetailerTypeDropdown(false);
                    setShowEditBeatDropdown(false);
                  }}
                  className={`flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 ${isSO ? 'bg-slate-50 opacity-70' : 'bg-white'}`}
                >
                  <Text className="text-sm text-slate-700">
                    {editState ? STATE_OPTIONS.find((s) => s.value === editState)?.label : 'Select state'}
                  </Text>
                  {!isSO && <Ionicons name="chevron-down" size={14} color="#64748b" />}
                </TouchableOpacity>

                {showEditStateDropdown && !isSO && (
                  <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                    <ScrollView nestedScrollEnabled={true}>
                      {STATE_OPTIONS.map((state) => (
                        <TouchableOpacity
                          key={state.value}
                          onPress={() => {
                            setEditState(state.value);
                            setShowEditStateDropdown(false);
                          }}
                          className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                        >
                          <Text className="text-xs text-slate-700 font-medium">{state.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Email */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">Email (optional)</Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="user@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>

              {/* Phone */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-slate-500 mb-1.5">Phone *</Text>
                <TextInput
                  value={editPhone}
                  onChangeText={(val) => setEditPhone(val.replace(/\D/g, ''))}
                  placeholder="10-digit mobile"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={10}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                />
              </View>

              {/* New Password (Admin only) */}
              {canResetPassword && (
                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">New Password</Text>
                  <TextInput
                    value={editPassword}
                    onChangeText={setEditPassword}
                    placeholder="Leave blank to keep unchanged"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                  />
                </View>
              )}

              {/* Retailer specific fields */}
              {isEditingRetailer && (
                <>
                  {/* Beat */}
                  <View className="mb-4 relative" style={{ zIndex: 65 }}>
                    <Text className="text-xs font-semibold text-slate-500 mb-1.5">Beat *</Text>
                    {isSO && soBeats.length > 0 ? (
                      <>
                        <TouchableOpacity
                          onPress={() => {
                            setShowEditBeatDropdown(!showEditBeatDropdown);
                            setShowEditParentDropdown(false);
                            setShowEditSalesAgentDropdown(false);
                            setShowEditRetailerTypeDropdown(false);
                            setShowEditBeatSuggestions(false);
                          }}
                          className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                        >
                          <Text className="text-sm text-slate-700">
                            {editBeat ? editBeat : 'Select beat'}
                          </Text>
                          <Ionicons name="chevron-down" size={14} color="#64748b" />
                        </TouchableOpacity>

                        {showEditBeatDropdown && (
                          <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                            <ScrollView nestedScrollEnabled={true}>
                              {soBeats.map((beat) => (
                                <TouchableOpacity
                                  key={beat}
                                  onPress={() => {
                                    setEditBeat(beat);
                                    setShowEditBeatDropdown(false);
                                  }}
                                  className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                                >
                                  <Text className="text-xs text-slate-700 font-medium">{beat}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </>
                    ) : (
                      <View className="relative">
                        <TextInput
                          value={editBeat}
                          onChangeText={(text) => {
                            setEditBeat(text);
                            setShowEditBeatSuggestions(true);
                          }}
                          onFocus={() => {
                            setShowEditBeatSuggestions(true);
                            setShowEditStateDropdown(false);
                            setShowEditParentDropdown(false);
                            setShowEditSalesAgentDropdown(false);
                            setShowEditRetailerTypeDropdown(false);
                            setShowEditBeatDropdown(false);
                          }}
                          placeholder="Enter beat name"
                          placeholderTextColor="#94a3b8"
                          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                        />
                        {showEditBeatSuggestions && filteredEditBeats.length > 0 && (
                          <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                            <ScrollView nestedScrollEnabled={true}>
                              {filteredEditBeats.map((beat) => (
                                <TouchableOpacity
                                  key={beat}
                                  onPress={() => {
                                    setEditBeat(beat);
                                    setShowEditBeatSuggestions(false);
                                  }}
                                  className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                                >
                                  <Text className="text-xs text-slate-700 font-medium capitalize">{beat}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Retailer Type */}
                  <View className="mb-4 relative" style={{ zIndex: 60 }}>
                    <Text className="text-xs font-semibold text-slate-500 mb-1.5">Retailer Type *</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowEditRetailerTypeDropdown(!showEditRetailerTypeDropdown);
                        setShowEditStateDropdown(false);
                        setShowEditParentDropdown(false);
                        setShowEditSalesAgentDropdown(false);
                        setShowEditBeatDropdown(false);
                      }}
                      className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                    >
                      <Text className="text-sm text-slate-700">
                        {editRetailerType ? editRetailerType : 'Select Retailer Type'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {showEditRetailerTypeDropdown && (
                      <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ zIndex: 100 }}>
                        <ScrollView nestedScrollEnabled={true}>
                          {['Kiryana Store', 'Beauty parlour', 'Chemist shop', 'Others'].map((type) => (
                            <TouchableOpacity
                              key={type}
                              onPress={() => {
                                setEditRetailerType(type);
                                setShowEditRetailerTypeDropdown(false);
                              }}
                              className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                            >
                              <Text className="text-xs text-slate-700 font-medium">{type}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {editRetailerType === 'Others' && (
                      <TextInput
                        value={editCustomRetailerType}
                        onChangeText={setEditCustomRetailerType}
                        placeholder="Specify retailer type"
                        placeholderTextColor="#94a3b8"
                        className="mt-2 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white"
                      />
                    )}
                  </View>

                  {/* Assigned Distributor */}
                  {(user?.role === UserRole.ADMIN || user?.role === UserRole.SO || user?.role === UserRole.ASE) && (
                    <View className="mb-4 relative" style={{ zIndex: 55 }}>
                      <Text className="text-xs font-semibold text-slate-500 mb-1.5">Assigned Distributor *</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowEditParentDropdown(!showEditParentDropdown);
                          setShowEditStateDropdown(false);
                          setShowEditSalesAgentDropdown(false);
                          setShowEditRetailerTypeDropdown(false);
                          setShowEditBeatDropdown(false);
                        }}
                        className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                      >
                        <Text className="text-sm text-slate-700">
                          {editParentId
                            ? (editDistributorsList?.find((d) => d.entityId === editParentId)?.name ?? editParentId)
                            : 'Select distributor'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color="#64748b" />
                      </TouchableOpacity>

                      {showEditParentDropdown && (
                        <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                          {loadingEditDistributors ? (
                            <View className="p-3">
                              <ActivityIndicator size="small" color="#f97316" />
                            </View>
                          ) : editDistributorsList && editDistributorsList.length > 0 ? (
                            <ScrollView nestedScrollEnabled={true}>
                              {editDistributorsList.map((d) => (
                                <TouchableOpacity
                                  key={d.entityId}
                                  onPress={() => {
                                    setEditParentId(d.entityId);
                                    setShowEditParentDropdown(false);
                                  }}
                                  className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                                >
                                  <Text className="text-xs text-slate-700 font-medium">{d.name} ({d.entityId})</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          ) : (
                            <View className="p-3">
                              <Text className="text-xs text-slate-400">No distributors available in this state</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Assigned Sales Agent */}
                  {(user?.role === UserRole.ADMIN || user?.role === UserRole.SO || user?.role === UserRole.ASE) && (
                    <View className="mb-4 relative" style={{ zIndex: 50 }}>
                      <Text className="text-xs font-semibold text-slate-500 mb-1.5">Assigned Sales Officer / ASE *</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowEditSalesAgentDropdown(!showEditSalesAgentDropdown);
                          setShowEditStateDropdown(false);
                          setShowEditParentDropdown(false);
                          setShowEditRetailerTypeDropdown(false);
                          setShowEditBeatDropdown(false);
                        }}
                        className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                      >
                        <Text className="text-sm text-slate-700">
                          {editSalesAgentId
                            ? (editSalesAgentOptions.find((a) => a.entityId === editSalesAgentId)?.name ?? editSalesAgentId)
                            : 'Select SO / ASE'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color="#64748b" />
                      </TouchableOpacity>

                      {showEditSalesAgentDropdown && (
                        <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                          {loadingEditAgents ? (
                            <View className="p-3">
                              <ActivityIndicator size="small" color="#f97316" />
                            </View>
                          ) : editSalesAgentOptions.length > 0 ? (
                            <ScrollView nestedScrollEnabled={true}>
                              {editSalesAgentOptions.map((a) => (
                                <TouchableOpacity
                                  key={a.entityId}
                                  onPress={() => {
                                    setEditSalesAgentId(a.entityId);
                                    setShowEditSalesAgentDropdown(false);
                                  }}
                                  className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                                >
                                  <Text className="text-xs text-slate-700 font-medium">
                                    {a.name} ({getRoleDisplayName(a.role)} · {a.entityId})
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          ) : (
                            <View className="p-3">
                              <Text className="text-xs text-slate-400">No SO/ASE available in this state</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Reporting manager for non-retailers */}
              {!isEditingRetailer && canChangeManager && (
                <View className="mb-4 relative" style={{ zIndex: 55 }}>
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">{editParentConfig?.label} *</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowEditParentDropdown(!showEditParentDropdown);
                      setShowEditStateDropdown(false);
                      setShowEditSalesAgentDropdown(false);
                      setShowEditRetailerTypeDropdown(false);
                      setShowEditBeatDropdown(false);
                    }}
                    className="flex-row items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 bg-white"
                  >
                    <Text className="text-sm text-slate-700">
                      {editParentId
                        ? (editManagerOptions.find((m) => m.entityId === editParentId)?.name ?? editParentId)
                        : `Select ${editParentConfig?.label}`}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {showEditParentDropdown && (
                    <View className="absolute top-[48px] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-hidden" style={{ zIndex: 100 }}>
                      {loadingEditManagers ? (
                        <View className="p-3">
                          <ActivityIndicator size="small" color="#f97316" />
                        </View>
                      ) : editManagerOptions.length > 0 ? (
                        <ScrollView nestedScrollEnabled={true}>
                          {editManagerOptions.map((m) => (
                            <TouchableOpacity
                              key={m.entityId}
                              onPress={() => {
                                setEditParentId(m.entityId);
                                setShowEditParentDropdown(false);
                              }}
                              className="p-3 border-b border-slate-50 last:border-b-0 active:bg-slate-50"
                            >
                              <Text className="text-xs text-slate-700 font-medium">
                                {m.name} ({getRoleDisplayName(m.role)} · {m.entityId})
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View className="p-3">
                          <Text className="text-xs text-slate-400">No manager options available in this state</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Readonly beat for non-retailer */}
              {!isEditingRetailer && editingUser?.beat && (
                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-500 mb-1.5">Beat (read-only)</Text>
                  <View className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5">
                    <Text className="text-sm text-slate-500">{editingUser.beat}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bottom buttons */}
            <View className="flex-row justify-end items-center gap-3 pt-4 border-t border-slate-100 mt-4">
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="border border-slate-200 rounded-xl px-5 py-2.5"
              >
                <Text className="text-slate-500 text-sm font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditSubmit}
                disabled={isEditSubmitting}
                className="bg-[#f97316] rounded-xl px-5 py-2.5"
              >
                {isEditSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-bold">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

