import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ConfirmModal from '@/components/ui/ConfirmModal';
import { type IUser, UserRole } from '@/types';
import { ListSkeleton } from '@/components/ui/Skeleton';

export type UserRow = Omit<IUser, 'password'>;

export interface UserTableProps {
  title: string;
  subtitle?: string;
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isError: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggle?: (user: UserRow, newStatus: boolean) => void;
  canToggleUser?: (user: UserRow) => boolean;
  togglingId?: string | null;
  showRetailerType?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  isAdmin?: boolean;
  onEdit?: (user: UserRow) => void;
  onDelete?: (user: UserRow) => void;
  canEditUser?: (user: UserRow) => boolean;
  canDeleteUser?: (user: UserRow) => boolean;
  editingId?: string | null;
  deletingId?: string | null;
}

function getRoleDisplayName(role: string): string {
  switch (role?.toLowerCase()) {
    case 'admin': return 'Admin';
    case 'finance': return 'Finance';
    case 'dispatch': return 'Dispatch';
    case 'nsm': return 'National Sales Manager';
    case 'rsm': return 'Regional Sales Manager';
    case 'asm': return 'Area Sales Manager';
    case 'super_stockist': return 'Super Stockist';
    case 'distributor': return 'Distributor';
    case 'so': return 'Sales Officer';
    case 'ase': return 'Area Sales Executive';
    case 'retailer': return 'Retailer';
    default: return String(role || '');
  }
}

function UserCard({
  user,
  onToggle,
  canToggleUser,
  togglingId,
  onToggleClick,
  isAdmin,
  onEdit,
  onDelete,
  canEditUser,
  canDeleteUser,
  editingId,
  deletingId,
}: {
  user: UserRow;
  onToggle?: UserTableProps['onToggle'];
  canToggleUser?: UserTableProps['canToggleUser'];
  togglingId?: string | null;
  onToggleClick: (user: UserRow) => void;
  isAdmin?: boolean;
  onEdit?: UserTableProps['onEdit'];
  onDelete?: UserTableProps['onDelete'];
  canEditUser?: UserTableProps['canEditUser'];
  canDeleteUser?: UserTableProps['canDeleteUser'];
  editingId?: string | null;
  deletingId?: string | null;
}) {
  const isThisToggling = togglingId === user.entityId;
  const isThisEditing = editingId === user.entityId;
  const isThisDeleting = deletingId === user.entityId;
  const canToggle = onToggle && (canToggleUser ? canToggleUser(user) : true);

  const showEdit = onEdit && (canEditUser ? canEditUser(user) : (isAdmin && user.role !== UserRole.ADMIN));
  const showDelete = onDelete && (canDeleteUser ? canDeleteUser(user) : (isAdmin && user.role !== UserRole.ADMIN));

  return (
    <View
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-3 ${
        !user.isActive ? 'opacity-60' : ''
      }`}
    >
      {/* Top Header info */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-bold text-gray-800 flex-1 mr-2" numberOfLines={1}>
          {user.name}
          {!user.isActive && (
            <Text className="text-xs font-normal text-red-500"> (inactive)</Text>
          )}
        </Text>
        <View className={`px-2.5 py-0.5 rounded-full ${user.isActive ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <Text className={`text-[10px] font-bold uppercase ${user.isActive ? 'text-emerald-700' : 'text-red-600'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Detail Fields */}
      <View className="gap-1.5 text-xs border-t border-gray-50 pt-3">
        <View className="flex-row justify-between">
          <Text className="text-gray-400 text-xs">Email</Text>
          <Text className="text-gray-700 text-xs font-semibold flex-1 text-right ml-4" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-400 text-xs">Phone</Text>
          <Text className="text-gray-700 text-xs font-semibold">{user.phone || '—'}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-400 text-xs">Role</Text>
          <View className="bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
            <Text className="text-[10px] font-bold text-orange-700 uppercase">
              {getRoleDisplayName(user.role)}
            </Text>
          </View>
        </View>
        {user.state && (
          <View className="flex-row justify-between items-center">
            <Text className="text-gray-400 text-xs">State</Text>
            <View className="bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
              <Text className="text-[10px] font-bold text-orange-700 uppercase">
                {user.state}
              </Text>
            </View>
          </View>
        )}
        {user.beat && (
          <View className="flex-row justify-between">
            <Text className="text-gray-400 text-xs">Beat</Text>
            <Text className="text-gray-700 text-xs font-semibold">{user.beat}</Text>
          </View>
        )}
        <View className="flex-row justify-between">
          <Text className="text-gray-400 text-xs">Joined</Text>
          <Text className="text-gray-700 text-xs font-semibold">
            {new Date(user.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>

      {/* Buttons Block */}
      <View className="mt-4 pt-3 border-t border-gray-100 flex-row gap-2.5">
        {showEdit && (
          <TouchableOpacity
            disabled={isThisEditing || !!editingId || !!deletingId}
            onPress={() => onEdit?.(user)}
            className="flex-1 bg-blue-50 border border-blue-100 rounded-lg py-2 flex-row items-center justify-center gap-1.5"
          >
            {isThisEditing ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Ionicons name="pencil-outline" size={14} color="#2563eb" />
            )}
            <Text className="text-xs font-bold text-blue-600">Edit</Text>
          </TouchableOpacity>
        )}

        {showDelete && (
          <TouchableOpacity
            disabled={isThisDeleting || !!deletingId || !!editingId}
            onPress={() => onDelete?.(user)}
            className="flex-1 bg-red-50 border border-red-100 rounded-lg py-2 flex-row items-center justify-center gap-1.5"
          >
            {isThisDeleting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Ionicons name="trash-outline" size={14} color="#dc2626" />
            )}
            <Text className="text-xs font-bold text-red-600">Delete</Text>
          </TouchableOpacity>
        )}

        {canToggle && (
          <TouchableOpacity
            disabled={isThisToggling || !!togglingId}
            onPress={() => onToggleClick(user)}
            className={`flex-1 rounded-lg py-2 flex-row items-center justify-center gap-1.5 ${
              user.isActive ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'
            }`}
          >
            {isThisToggling ? (
              <ActivityIndicator size="small" color={user.isActive ? '#dc2626' : '#059669'} />
            ) : (
              <Ionicons
                name={user.isActive ? 'toggle-outline' : 'toggle'}
                size={16}
                color={user.isActive ? '#dc2626' : '#059669'}
              />
            )}
            <Text className={`text-xs font-bold ${user.isActive ? 'text-red-600' : 'text-emerald-700'}`}>
              {user.isActive ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function UserTable({
  title,
  subtitle,
  users,
  total,
  page,
  totalPages,
  isLoading,
  isError,
  search,
  onSearchChange,
  onPageChange,
  onToggle,
  canToggleUser,
  togglingId,
  isAdmin,
  onEdit,
  onDelete,
  canEditUser,
  canDeleteUser,
  editingId,
  deletingId,
}: UserTableProps) {
  const [pending, setPending] = useState<{ user: UserRow; newStatus: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);

  const handleToggleClick = (user: UserRow) => {
    setPending({ user, newStatus: !user.isActive });
  };

  const handleConfirm = () => {
    if (!pending) return;
    onToggle?.(pending.user, pending.newStatus);
    setPending(null);
  };

  const handleCancel = () => {
    if (togglingId) return;
    setPending(null);
  };

  const isActivating = pending ? pending.newStatus : false;

  return (
    <View className="flex-1 bg-gray-50">
      
      {/* Title Header */}
      <View className="mb-4">
        <Text className="text-xl font-bold text-gray-900">{title}</Text>
        <Text className="text-xs text-gray-500 mt-1">
          {subtitle ?? `${total} ${title.toLowerCase()} found`}
        </Text>
      </View>

      {/* Search Input Bar */}
      <View className="mb-4">
        <View className="flex-row items-center bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
          <Ionicons name="search-outline" size={16} color="#9ca3af" className="mr-2" />
          <TextInput
            placeholder="Search by name, email, or phone…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={onSearchChange}
            className="flex-1 text-sm text-gray-800 p-0 h-8"
          />
          {search ? (
            <TouchableOpacity onPress={() => onSearchChange('')} className="p-1">
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content Area */}
      {isLoading ? (
        <ListSkeleton items={5} />
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={28} color="#ef4444" />
          <Text className="text-sm text-gray-600 mt-2 font-semibold">Failed to load data. Please try again.</Text>
        </View>
      ) : users.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <Ionicons name="people-outline" size={32} color="#9ca3af" className="opacity-45 mb-2" />
          <Text className="text-sm text-gray-400 font-bold">No records found</Text>
          {search ? (
            <TouchableOpacity onPress={() => onSearchChange('')} className="mt-2.5">
              <Text className="text-xs font-bold text-orange-500">Clear Search</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View className="pb-10">
          {users.map((item) => (
            <UserCard
              key={item._id ?? item.entityId}
              user={item}
              onToggle={onToggle}
              canToggleUser={canToggleUser}
              togglingId={togglingId}
              onToggleClick={handleToggleClick}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              canEditUser={canEditUser}
              canDeleteUser={canDeleteUser}
              editingId={editingId}
              deletingId={deletingId}
            />
          ))}
        </View>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-between border-t border-gray-150 py-3.5 bg-white px-4 rounded-xl shadow-sm mt-3">
          <Text className="text-xs text-gray-500 font-semibold">
            Page {page} of {totalPages} · {total} total
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => onPageChange(page - 1)}
              className={`flex-row items-center gap-1 px-3 py-1.5 border rounded-lg ${
                page <= 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white active:bg-gray-50'
              }`}
            >
              <Ionicons name="chevron-back" size={12} color="#4b5563" />
              <Text className="text-xs font-bold text-gray-700">Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => onPageChange(page + 1)}
              className={`flex-row items-center gap-1 px-3 py-1.5 border rounded-lg ${
                page >= totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white active:bg-gray-50'
              }`}
            >
              <Text className="text-xs font-bold text-gray-700">Next</Text>
              <Ionicons name="chevron-forward" size={12} color="#4b5563" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmation Modals */}
      {pending && (
        <ConfirmModal
          open={!!pending}
          title={isActivating ? `Activate ${pending.user.name}?` : `Deactivate ${pending.user.name}?`}
          description={
            isActivating
              ? `This will re-enable ${pending.user.name}. They will be able to log in and place orders again.`
              : `This will block ${pending.user.name} immediately. They will not be able to log in, access the system, or place orders until reactivated.`
          }
          confirmLabel={isActivating ? 'Yes, Activate' : 'Yes, Deactivate'}
          cancelLabel="Cancel"
          variant={isActivating ? 'info' : 'danger'}
          loading={!!togglingId}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          open={!!pendingDelete}
          title={`Delete ${pendingDelete.name}?`}
          description={`This will permanently delete ${pendingDelete.name} (${getRoleDisplayName(pendingDelete.role)}). This action cannot be undone.`}
          confirmLabel="Yes, Delete"
          cancelLabel="Cancel"
          variant="danger"
          loading={!!deletingId}
          onConfirm={() => {
            onDelete?.(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

    </View>
  );
}
