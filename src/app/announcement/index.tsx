import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/store/auth.store';
import { UserRole, IAnnouncement } from '@/types';
import { announcementService } from '@/services/announcement.service';

const { width } = Dimensions.get('window');

const ADMIN_ONLY = new Set<UserRole>([UserRole.ADMIN]);
const VIEWER_ROLES = new Set<UserRole>([
  UserRole.ADMIN,
  UserRole.NSM,
  UserRole.RSM,
  UserRole.ASM,
  UserRole.SO,
  UserRole.ASE,
  UserRole.RETAILER,
]);

export default function AnnouncementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isAdmin = Boolean(user && ADMIN_ONLY.has(user.role));
  const canView = Boolean(user && VIEWER_ROLES.has(user.role));

  // States
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingAnnouncement, setViewingAnnouncement] = useState<IAnnouncement | null>(null);
  const [viewingImageIndex, setViewingImageIndex] = useState(0);

  // Form States
  const [editingAnnouncement, setEditingAnnouncement] = useState<IAnnouncement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [browserLinks, setBrowserLinks] = useState<string[]>(['']);
  const [videoLinks, setVideoLinks] = useState<string[]>(['']);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [existingImages, setExistingImages] = useState<IAnnouncement['images']>([]);
  const [formError, setFormError] = useState('');

  // Fetch announcements
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['announcements', page, sortOrder],
    queryFn: () => announcementService.list({ page, limit: 10, sortOrder }),
    enabled: canView,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      announcementService.create({
        title,
        description,
        images: selectedFiles,
        browserLinks: browserLinks.filter((l) => l.trim()),
        videoLinks: videoLinks.filter((l) => l.trim()),
      }),
    onSuccess: () => {
      closeFormModal();
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      Alert.alert('Success', 'Announcement created successfully');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create announcement';
      setFormError(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      announcementService.update(id, {
        title,
        description,
        images: selectedFiles.length > 0 ? selectedFiles : undefined,
        browserLinks: browserLinks.filter((l) => l.trim()),
        videoLinks: videoLinks.filter((l) => l.trim()),
      }),
    onSuccess: () => {
      closeFormModal();
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      Alert.alert('Success', 'Announcement updated successfully');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update announcement';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      Alert.alert('Success', 'Announcement deleted successfully');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to delete announcement';
      Alert.alert('Error', msg);
    },
  });

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setBrowserLinks(['']);
    setVideoLinks(['']);
    setSelectedFiles([]);
    setExistingImages([]);
    setFormError('');
    setEditingAnnouncement(null);
  }, []);

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (ann: IAnnouncement) => {
    setEditingAnnouncement(ann);
    setTitle(ann.title);
    setDescription(ann.description);
    setBrowserLinks(ann.browserLinks.length > 0 ? [...ann.browserLinks, ''] : ['']);
    setVideoLinks(ann.videoLinks.length > 0 ? [...ann.videoLinks, ''] : ['']);
    setSelectedFiles([]);
    setExistingImages(ann.images);
    setFormError('');
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  const handlePickImages = async () => {
    const totalImages = selectedFiles.length + existingImages.length;
    if (totalImages >= 5) {
      setFormError('Maximum 5 images allowed.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is required to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - totalImages,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const formatted = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));

      setSelectedFiles((prev) => [...prev, ...formatted]);
      setFormError('');
    }
  };

  const removeNewImage = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExistingImage = (idx: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!title.trim()) return setFormError('Title is required');
    if (title.trim().length > 200) return setFormError('Title must be 200 characters or fewer');
    if (!description.trim()) return setFormError('Description is required');
    if (description.trim().length > 5000) return setFormError('Description must be 5000 characters or fewer');

    const totalImages = selectedFiles.length + existingImages.length;
    if (totalImages < 1) return setFormError('At least 1 image is required');

    setFormError('');

    if (editingAnnouncement) {
      updateMutation.mutate(editingAnnouncement.announcementId);
    } else {
      createMutation.mutate();
    }
  };

  const handleDelete = (ann: IAnnouncement) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(ann.announcementId),
        },
      ]
    );
  };

  const openLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Error', 'Unable to open link');
    }
  };

  const announcements = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const totalCount = data?.pagination?.totalItems ?? announcements.length;

  if (!canView) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-6 bg-white">
        <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-gray-800 mt-4">Access Denied</Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          You do not have permission to view system announcements.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Title and Subtitle with Megaphone Icon */}
        <View className="mb-4 flex-row items-start gap-3">
          <View className="mt-1 bg-orange-50 p-2.5 rounded-lg border border-orange-100">
            <Ionicons name="megaphone-outline" size={22} color="#f97316" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-800">Announcements</Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              Create and manage company-wide announcements
            </Text>
          </View>
        </View>

        {/* Action Buttons: Refresh and Create Announcement */}
        <View className="flex-row gap-2.5 mb-5">
          <TouchableOpacity
            onPress={() => refetch()}
            disabled={isFetching}
            className="flex-row items-center gap-1.5 bg-white border border-gray-200 px-4 py-2.5 rounded-lg"
          >
            <Ionicons
              name="refresh-outline"
              size={15}
              color="#4b5563"
              style={isFetching ? { transform: [{ rotate: '45deg' }] } : {}}
            />
            <Text className="text-xs font-semibold text-gray-600">Refresh</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              onPress={openCreateModal}
              className="flex-row items-center gap-1.5 bg-orange-500 px-4 py-2.5 rounded-lg"
            >
              <Ionicons name="add-outline" size={16} color="white" />
              <Text className="text-white font-semibold text-xs">Create Announcement</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Announcements Card Container */}
        <View className="bg-white border border-gray-150 rounded-xl overflow-hidden shadow-sm mb-6">
          {/* Card Header */}
          <View className="px-4 py-3.5 border-b border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-bold text-gray-800">All Announcements</Text>
              <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Text className="text-[10px] font-bold text-emerald-700 uppercase">
                  {totalCount} Total
                </Text>
              </View>
            </View>

            {/* Sort Toggle Dropdown UI */}
            <TouchableOpacity
              onPress={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex-row items-center border border-gray-200 px-2.5 py-1.5 rounded-lg"
            >
              <Text className="text-xs text-gray-500 mr-1">
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Card Body */}
          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#8b5cf6" />
              <Text className="text-xs text-gray-500 mt-2">Loading announcements...</Text>
            </View>
          ) : announcements.length === 0 ? (
            <View className="py-12 items-center justify-center px-6">
              <Ionicons name="megaphone-outline" size={40} color="#d1d5db" style={{ opacity: 0.5 }} />
              <Text className="text-base font-bold text-gray-600 mt-3">No announcements yet.</Text>
              <Text className="text-xs text-gray-400 mt-1 text-center">
                Create one to get started.
              </Text>
            </View>
          ) : (
            <View className="p-4 gap-4">
              {announcements.map((ann) => (
                <TouchableOpacity
                  key={ann.announcementId}
                  onPress={() => {
                    setViewingAnnouncement(ann);
                    setViewingImageIndex(0);
                    setShowDetailModal(true);
                  }}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs"
                >
                  {ann.images.length > 0 && (
                    <Image
                      source={{ uri: ann.images[0].url }}
                      className="w-full h-44 bg-gray-50"
                      resizeMode="cover"
                    />
                  )}
                  <View className="p-4">
                    <View className="flex-row justify-between items-start">
                      <Text className="text-base font-bold text-gray-800 flex-1 mr-2" numberOfLines={2}>
                        {ann.title}
                      </Text>
                      {isAdmin && (
                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            onPress={() => openEditModal(ann)}
                            className="p-1.5 border border-gray-100 rounded-lg bg-gray-50"
                          >
                            <Ionicons name="pencil" size={14} color="#8b5cf6" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDelete(ann)}
                            className="p-1.5 border border-red-100 rounded-lg bg-red-50"
                          >
                            <Ionicons name="trash" size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-500 mt-1.5" numberOfLines={3}>
                      {ann.description}
                    </Text>
                    <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-gray-50">
                      <Text className="text-[10px] text-gray-400">
                        {new Date(ann.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                      <View className="flex-row items-center gap-3">
                        {ann.images.length > 1 && (
                          <View className="flex-row items-center gap-0.5">
                            <Ionicons name="images-outline" size={12} color="#8b5cf6" />
                            <Text className="text-[10px] text-gray-500">{ann.images.length}</Text>
                          </View>
                        )}
                        {ann.browserLinks.length > 0 && (
                          <View className="flex-row items-center gap-0.5">
                            <Ionicons name="link-outline" size={12} color="#3b82f6" />
                            <Text className="text-[10px] text-gray-500">{ann.browserLinks.length}</Text>
                          </View>
                        )}
                        {ann.videoLinks.length > 0 && (
                          <View className="flex-row items-center gap-0.5">
                            <Ionicons name="videocam-outline" size={12} color="#10b981" />
                            <Text className="text-[10px] text-gray-500">{ann.videoLinks.length}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pagination inside card container */}
          {totalPages > 1 && (
            <View className="flex-row items-center justify-center py-4 border-t border-gray-100 gap-4 bg-white">
              <TouchableOpacity
                disabled={page === 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                className={`p-2 border rounded-lg ${
                  page === 1 ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
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
                className={`p-2 border rounded-lg ${
                  page === totalPages ? 'border-gray-50 bg-gray-50 opacity-40' : 'border-gray-200 bg-white'
                }`}
              >
                <Ionicons name="chevron-forward" size={16} color="#374151" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Detail Modal ── */}
      {viewingAnnouncement && (
        <Modal
          visible={showDetailModal}
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-800 flex-1 mr-4" numberOfLines={1}>
                {viewingAnnouncement.title}
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {/* Image Carousel */}
              {viewingAnnouncement.images.length > 0 && (
                <View className="relative bg-black w-full h-72">
                  <Image
                    source={{ uri: viewingAnnouncement.images[viewingImageIndex].url }}
                    className="w-full h-full"
                    resizeMode="contain"
                  />
                  {viewingAnnouncement.images.length > 1 && (
                    <>
                      <TouchableOpacity
                        disabled={viewingImageIndex === 0}
                        onPress={() => setViewingImageIndex((i) => Math.max(0, i - 1))}
                        className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 ${
                          viewingImageIndex === 0 ? 'opacity-30' : ''
                        }`}
                      >
                        <Ionicons name="chevron-back" size={20} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={viewingImageIndex === viewingAnnouncement.images.length - 1}
                        onPress={() =>
                          setViewingImageIndex((i) =>
                            Math.min(viewingAnnouncement.images.length - 1, i + 1)
                          )
                        }
                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 ${
                          viewingImageIndex === viewingAnnouncement.images.length - 1 ? 'opacity-30' : ''
                        }`}
                      >
                        <Ionicons name="chevron-forward" size={20} color="white" />
                      </TouchableOpacity>
                      <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-1.5">
                        {viewingAnnouncement.images.map((_, idx) => (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => setViewingImageIndex(idx)}
                            className={`h-2 w-2 rounded-full ${
                              idx === viewingImageIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Details Content */}
              <View className="p-6">
                <Text className="text-xl font-bold text-gray-800">{viewingAnnouncement.title}</Text>
                <Text className="text-xs text-gray-400 mt-1">
                  Posted on{' '}
                  {new Date(viewingAnnouncement.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text className="text-sm text-gray-600 mt-4 leading-6">
                  {viewingAnnouncement.description}
                </Text>

                {/* Browser Links */}
                {viewingAnnouncement.browserLinks.length > 0 && (
                  <View className="mt-6">
                    <Text className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">
                      Web Links
                    </Text>
                    <View className="gap-2">
                      {viewingAnnouncement.browserLinks.map((link, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => openLink(link)}
                          className="flex-row items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-lg p-3"
                        >
                          <Ionicons name="earth-outline" size={16} color="#3b82f6" />
                          <Text className="text-xs text-blue-600 font-semibold flex-1" numberOfLines={1}>
                            {link}
                          </Text>
                          <Ionicons name="open-outline" size={14} color="#3b82f6" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Video Links */}
                {viewingAnnouncement.videoLinks.length > 0 && (
                  <View className="mt-6">
                    <Text className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">
                      Video Links
                    </Text>
                    <View className="gap-2">
                      {viewingAnnouncement.videoLinks.map((link, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => openLink(link)}
                          className="flex-row items-center gap-2 bg-emerald-50/50 border border-emerald-100 rounded-lg p-3"
                        >
                          <Ionicons name="videocam-outline" size={16} color="#10b981" />
                          <Text className="text-xs text-emerald-600 font-semibold flex-1" numberOfLines={1}>
                            {link}
                          </Text>
                          <Ionicons name="open-outline" size={14} color="#10b981" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* ── Form Create/Edit Modal ── */}
      {showFormModal && (
        <Modal
          visible={showFormModal}
          animationType="slide"
          onRequestClose={closeFormModal}
        >
          <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-800">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </Text>
              <TouchableOpacity onPress={closeFormModal} className="p-1">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-6">
              {formError ? (
                <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex-row items-start gap-2">
                  <Ionicons name="alert-circle-outline" size={16} color="#ef4444" className="mt-0.5" />
                  <Text className="text-xs text-red-600 flex-1">{formError}</Text>
                </View>
              ) : null}

              {/* Title */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter announcement title"
                  maxLength={200}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:bg-white"
                />
                <Text className="text-[10px] text-gray-400 text-right mt-1">{title.length}/200</Text>
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Description *</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter detailed description"
                  maxLength={5000}
                  multiline
                  numberOfLines={6}
                  style={{ textAlignVertical: 'top' }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:bg-white min-h-[120px]"
                />
                <Text className="text-[10px] text-gray-400 text-right mt-1">{description.length}/5000</Text>
              </View>

              {/* Image Picker */}
              <View className="mb-6">
                <Text className="text-xs font-semibold text-gray-600 mb-2">Images * (1-5)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-3">
                  {/* Existing Images */}
                  {existingImages.map((img, idx) => (
                    <View key={`existing-${idx}`} className="relative mr-2">
                      <Image source={{ uri: img.url }} className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50" />
                      <TouchableOpacity
                        onPress={() => removeExistingImage(idx)}
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 shadow"
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {/* New Selected Files */}
                  {selectedFiles.map((file, idx) => (
                    <View key={`new-${idx}`} className="relative mr-2">
                      <Image source={{ uri: file.uri }} className="w-20 h-20 rounded-lg border border-purple-200 bg-gray-50" />
                      <TouchableOpacity
                        onPress={() => removeNewImage(idx)}
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 shadow"
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                {(selectedFiles.length + existingImages.length) < 5 && (
                  <TouchableOpacity
                    onPress={handlePickImages}
                    className="border border-dashed border-gray-300 rounded-lg py-3 items-center justify-center flex-row gap-1.5 bg-gray-50"
                  >
                    <Ionicons name="image-outline" size={16} color="#6b7280" />
                    <Text className="text-xs text-gray-600 font-semibold">Add Images</Text>
                  </TouchableOpacity>
                )}
                <Text className="text-[10px] text-gray-400 mt-1">
                  {selectedFiles.length + existingImages.length}/5 images selected
                </Text>
              </View>

              {/* Browser Links */}
              <View className="mb-6">
                <Text className="text-xs font-semibold text-gray-600 mb-2">Web Links (optional)</Text>
                {browserLinks.map((link, idx) => (
                  <View key={idx} className="flex-row items-center gap-2 mb-2">
                    <TextInput
                      value={link}
                      onChangeText={(val) => {
                        const updated = [...browserLinks];
                        updated[idx] = val;
                        if (idx === browserLinks.length - 1 && val.trim()) {
                          updated.push('');
                        }
                        setBrowserLinks(updated);
                      }}
                      placeholder="https://example.com"
                      keyboardType="url"
                      autoCapitalize="none"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                    />
                    {browserLinks.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setBrowserLinks(browserLinks.filter((_, i) => i !== idx))}
                        className="p-2 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Video Links */}
              <View className="mb-8">
                <Text className="text-xs font-semibold text-gray-600 mb-2">Video Links (optional)</Text>
                {videoLinks.map((link, idx) => (
                  <View key={idx} className="flex-row items-center gap-2 mb-2">
                    <TextInput
                      value={link}
                      onChangeText={(val) => {
                        const updated = [...videoLinks];
                        updated[idx] = val;
                        if (idx === videoLinks.length - 1 && val.trim()) {
                          updated.push('');
                        }
                        setVideoLinks(updated);
                      }}
                      placeholder="https://youtube.com/..."
                      keyboardType="url"
                      autoCapitalize="none"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50"
                    />
                    {videoLinks.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setVideoLinks(videoLinks.filter((_, i) => i !== idx))}
                        className="p-2 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Save / Cancel Buttons */}
              <View className="flex-row justify-end gap-3 mb-12">
                <TouchableOpacity
                  onPress={closeFormModal}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg"
                >
                  <Text className="text-sm text-gray-600 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onPress={handleSubmit}
                  className="px-5 py-2.5 bg-purple-600 rounded-lg flex-row items-center gap-1.5"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : null}
                  <Text className="text-sm text-white font-semibold">
                    {editingAnnouncement ? 'Update' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
