import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, LogOut, Edit3, Check, X, Camera, ChevronRight } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { authClient } from '@/lib/auth/auth-client';
import { useSession, useInvalidateSession } from '@/lib/auth/use-session';
import type { Post, User } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { UserAvatar } from '@/components/UserAvatar';
import { pickImage } from '@/lib/file-picker';
import { uploadFile } from '@/lib/upload';

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>(`/api/users/${session?.user?.id}`),
    enabled: !!session?.user?.id,
  });

  const { data: myPosts, isLoading: loadingPosts, isRefetching } = useQuery({
    queryKey: ['posts', 'user', session?.user?.id],
    queryFn: () => api.get<Post[]>(`/api/posts?userId=${session?.user?.id}`),
    enabled: !!session?.user?.id,
  });

  const { data: likedPosts } = useQuery({
    queryKey: ['posts', 'liked'],
    queryFn: () => api.get<Post[]>('/api/posts?liked=true'),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      return api.patch(`/api/users/${session?.user?.id}`, {
        name: editName,
        bio: editBio,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async () => {
      const file = await pickImage();
      if (!file) return null;
      const result = await uploadFile(file.uri, file.filename, file.mimeType);
      return api.patch(`/api/users/${session?.user?.id}`, { image: result.url });
    },
    onSuccess: (result) => {
      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    },
  });

  const updateHeaderMutation = useMutation({
    mutationFn: async () => {
      const file = await pickImage();
      if (!file) return null;
      const result = await uploadFile(file.uri, file.filename, file.mimeType);
      return api.patch(`/api/users/${session?.user?.id}`, { headerImage: result.url });
    },
    onSuccess: (result) => {
      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      invalidateSession();
    },
  });

  const updateShowExplicit = useMutation({
    mutationFn: async (value: boolean) => {
      return api.patch('/api/users/me', { showExplicit: value });
    },
    onSuccess: () => {
      Haptics.selectionAsync();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const startEditing = () => {
    setEditName(profile?.name ?? '');
    setEditBio(profile?.bio ?? '');
    setIsEditing(true);
  };

  const displayPosts = activeTab === 'posts' ? myPosts : likedPosts;

  return (
    <SafeAreaView testID="profile-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['profile'] });
              queryClient.invalidateQueries({ queryKey: ['posts'] });
            }}
            tintColor="#00CF35"
          />
        }
      >
        {/* Header Image */}
        <Pressable
          testID="header-image-button"
          onPress={() => updateHeaderMutation.mutate()}
          disabled={updateHeaderMutation.isPending}
          style={{ height: 160, backgroundColor: '#0a2d50' }}
        >
          {profile?.headerImage ? (
            <Image
              source={{ uri: profile.headerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1" style={{ backgroundColor: '#0a2d50' }}>
              <View className="flex-1 items-center justify-center">
                <View className="w-full h-full opacity-30" style={{ backgroundColor: '#1a3a5c' }} />
              </View>
            </View>
          )}
          {updateHeaderMutation.isPending ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <ActivityIndicator testID="header-upload-indicator" color="#00CF35" />
            </View>
          ) : (
            <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, padding: 6 }}>
              <Camera size={16} color="#FFFFFF" />
            </View>
          )}
        </Pressable>

        {/* Profile Info */}
        <View className="px-4 -mt-10">
          <View className="flex-row items-end justify-between">
            <Pressable
              testID="avatar-button"
              onPress={() => updateAvatarMutation.mutate()}
              disabled={updateAvatarMutation.isPending}
              style={{ borderColor: '#001935', borderWidth: 4, borderRadius: 44, position: 'relative' }}
            >
              <UserAvatar uri={profile?.image} name={profile?.name ?? 'U'} size={80} />
              {updateAvatarMutation.isPending ? (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <ActivityIndicator testID="avatar-upload-indicator" color="#00CF35" size="small" />
                </View>
              ) : (
                <View style={{ position: 'absolute', bottom: 2, right: 2, backgroundColor: '#00CF35', borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={12} color="#001935" />
                </View>
              )}
            </Pressable>
            <View className="flex-row gap-2 mb-1">
              {isEditing ? (
                <>
                  <Pressable
                    testID="cancel-edit-button"
                    onPress={() => setIsEditing(false)}
                    className="rounded-full p-2"
                    style={{ backgroundColor: '#0a2d50' }}
                  >
                    <X size={18} color="#FF4E6A" />
                  </Pressable>
                  <Pressable
                    testID="save-edit-button"
                    onPress={() => updateProfile.mutate()}
                    className="rounded-full p-2"
                    style={{ backgroundColor: '#00CF35' }}
                  >
                    <Check size={18} color="#001935" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    testID="edit-profile-button"
                    onPress={startEditing}
                    className="rounded-full px-4 py-2"
                    style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                  >
                    <Edit3 size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    testID="sign-out-button"
                    onPress={() => signOut.mutate()}
                    className="rounded-full px-4 py-2"
                    style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                  >
                    <LogOut size={16} color="#FF4E6A" />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Name & Bio */}
          <View className="mt-3">
            {isEditing ? (
              <>
                <TextInput
                  testID="edit-name-input"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Name"
                  placeholderTextColor="#4a6fa5"
                  className="text-white text-xl font-bold mb-2 pb-2"
                  style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 1 }}
                />
                <TextInput
                  testID="edit-bio-input"
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Bio"
                  placeholderTextColor="#4a6fa5"
                  multiline
                  className="text-sm mb-3"
                  style={{ color: '#a0b4c8', borderBottomColor: '#1a3a5c', borderBottomWidth: 1, paddingBottom: 8 }}
                />
              </>
            ) : (
              <>
                <Text className="text-white text-xl font-bold">
                  {profile?.name ?? 'Loading...'}
                </Text>
                {profile?.username ? (
                  <Text className="text-sm" style={{ color: '#4a6fa5' }}>
                    @{profile.username}
                  </Text>
                ) : null}
                {profile?.bio ? (
                  <Text className="text-sm mt-2" style={{ color: '#a0b4c8' }}>
                    {profile.bio}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {/* Stats */}
          <View className="flex-row mt-4 gap-6">
            <View>
              <Text className="text-white font-bold text-base">{profile?._count?.posts ?? 0}</Text>
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Posts</Text>
            </View>
            <View>
              <Text className="text-white font-bold text-base">{profile?._count?.followers ?? 0}</Text>
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Followers</Text>
            </View>
            <View>
              <Text className="text-white font-bold text-base">{profile?._count?.following ?? 0}</Text>
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Following</Text>
            </View>
          </View>

          {/* Settings rows */}
          <View className="mt-5 rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}>
            {/* Interests */}
            <Pressable
              testID="interests-button"
              onPress={() => router.push('/(app)/interests' as any)}
              className="flex-row items-center justify-between px-4 py-3.5"
              style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
            >
              <Text className="text-white font-medium text-sm">Interests</Text>
              <View className="flex-row items-center gap-2">
                {profile?.categories ? (
                  <Text className="text-xs" style={{ color: '#4a6fa5' }}>
                    {profile.categories.split(',').filter(Boolean).length} selected
                  </Text>
                ) : (
                  <Text className="text-xs" style={{ color: '#4a6fa5' }}>None selected</Text>
                )}
                <ChevronRight size={16} color="#4a6fa5" />
              </View>
            </Pressable>

            {/* Show explicit content */}
            <View className="flex-row items-center justify-between px-4 py-3.5">
              <Text className="text-white font-medium text-sm">Show explicit content</Text>
              <Pressable
                testID="show-explicit-toggle"
                onPress={() => updateShowExplicit.mutate(!(profile?.showExplicit ?? false))}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: profile?.showExplicit ? '#00CF35' : '#1a3a5c',
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#FFFFFF',
                    transform: [{ translateX: profile?.showExplicit ? 20 : 0 }],
                  }}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tab View */}
        <View className="flex-row mt-6" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
          <Pressable
            testID="posts-tab"
            onPress={() => setActiveTab('posts')}
            className="flex-1 items-center py-3"
            style={activeTab === 'posts' ? { borderBottomColor: '#00CF35', borderBottomWidth: 2 } : undefined}
          >
            <Text className="font-semibold text-sm" style={{ color: activeTab === 'posts' ? '#FFFFFF' : '#4a6fa5' }}>
              Posts
            </Text>
          </Pressable>
          <Pressable
            testID="likes-tab"
            onPress={() => setActiveTab('likes')}
            className="flex-1 items-center py-3"
            style={activeTab === 'likes' ? { borderBottomColor: '#00CF35', borderBottomWidth: 2 } : undefined}
          >
            <Text className="font-semibold text-sm" style={{ color: activeTab === 'likes' ? '#FFFFFF' : '#4a6fa5' }}>
              Likes
            </Text>
          </Pressable>
        </View>

        {/* Posts */}
        <View className="pt-3">
          {loadingPosts || loadingProfile ? (
            <ActivityIndicator testID="loading-indicator" color="#00CF35" className="mt-8" />
          ) : (displayPosts ?? []).length === 0 ? (
            <Text className="text-center mt-8" style={{ color: '#4a6fa5' }}>
              {activeTab === 'posts' ? 'No posts yet' : 'No liked posts yet'}
            </Text>
          ) : (
            (displayPosts ?? []).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
