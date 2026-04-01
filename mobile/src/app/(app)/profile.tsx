import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Edit3, Grid3X3, Heart, Play, FileText } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import type { Post, User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

function GalleryCell({ post, onPress }: { post: Post; onPress: () => void }) {
  const hasMedia = !!(post.imageUrl || post.videoUrl);

  return (
    <Pressable
      testID={`gallery-cell-${post.id}`}
      onPress={onPress}
      style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#0a2d50' }}
    >
      {hasMedia ? (
        <>
          <Image
            source={{ uri: post.imageUrl ?? post.videoUrl ?? undefined }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          {post.videoUrl ? (
            <View style={{
              position: 'absolute', top: 6, right: 6,
              backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
              padding: 4,
            }}>
              <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </>
      ) : (
        <View className="flex-1 items-center justify-center p-2">
          <FileText size={18} color="#2a4a6a" />
          {post.title ? (
            <Text
              className="text-center text-xs mt-1 leading-4"
              style={{ color: '#4a6fa5' }}
              numberOfLines={3}
            >
              {post.title}
            </Text>
          ) : post.content ? (
            <Text
              className="text-center text-xs mt-1 leading-4"
              style={{ color: '#4a6fa5' }}
              numberOfLines={3}
            >
              {post.content}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts');

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>('/api/users/me'),
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
        {/* Header Banner */}
        <View style={{ height: 150, backgroundColor: '#0a2d50' }}>
          {profile?.headerImage ? (
            <Image
              source={{ uri: profile.headerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1" style={{ backgroundColor: '#0a2d50' }} />
          )}
          {/* Top-right action buttons */}
          <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 }}>
            <Pressable
              testID="edit-profile-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(app)/edit-profile' as any);
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Edit3 size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Edit Profile</Text>
            </Pressable>
            <Pressable
              testID="settings-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(app)/settings' as any);
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Avatar + Stats row */}
        <View className="px-4" style={{ marginTop: -28 }}>
          <View className="flex-row items-end justify-between">
            {/* Avatar */}
            <View style={{ borderColor: '#001935', borderWidth: 3, borderRadius: 44 }}>
              <UserAvatar uri={profile?.image} name={profile?.name ?? 'U'} size={76} />
            </View>

            {/* Stats */}
            <View className="flex-row gap-5 mb-2">
              <View className="items-center">
                <Text className="text-white font-bold text-base">{profile?.postCount ?? 0}</Text>
                <Text className="text-xs" style={{ color: '#4a6fa5' }}>Posts</Text>
              </View>
              <View className="items-center">
                <Text className="text-white font-bold text-base">{profile?.followerCount ?? 0}</Text>
                <Text className="text-xs" style={{ color: '#4a6fa5' }}>Followers</Text>
              </View>
              <View className="items-center">
                <Text className="text-white font-bold text-base">{profile?.followingCount ?? 0}</Text>
                <Text className="text-xs" style={{ color: '#4a6fa5' }}>Following</Text>
              </View>
            </View>
          </View>

          {/* Name & Bio */}
          <View className="mt-2">
            {loadingProfile ? (
              <ActivityIndicator testID="loading-indicator" color="#00CF35" />
            ) : (
              <>
                <Text className="text-white text-lg font-bold leading-tight">
                  {profile?.name ?? ''}
                </Text>
                {profile?.username ? (
                  <Text className="text-sm mt-0.5" style={{ color: '#4a6fa5' }}>
                    @{profile.username}
                  </Text>
                ) : null}
                {profile?.bio ? (
                  <Text className="text-sm mt-2 leading-5" style={{ color: '#a0b4c8' }}>
                    {profile.bio}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View
          className="flex-row mt-5"
          style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
        >
          <Pressable
            testID="posts-tab"
            onPress={() => setActiveTab('posts')}
            className="flex-1 items-center py-3 flex-row justify-center gap-2"
            style={activeTab === 'posts' ? { borderBottomColor: '#00CF35', borderBottomWidth: 2 } : undefined}
          >
            <Grid3X3 size={15} color={activeTab === 'posts' ? '#FFFFFF' : '#4a6fa5'} />
            <Text
              className="font-semibold text-sm"
              style={{ color: activeTab === 'posts' ? '#FFFFFF' : '#4a6fa5' }}
            >
              Posts
            </Text>
          </Pressable>
          <Pressable
            testID="likes-tab"
            onPress={() => setActiveTab('likes')}
            className="flex-1 items-center py-3 flex-row justify-center gap-2"
            style={activeTab === 'likes' ? { borderBottomColor: '#00CF35', borderBottomWidth: 2 } : undefined}
          >
            <Heart size={15} color={activeTab === 'likes' ? '#FFFFFF' : '#4a6fa5'} />
            <Text
              className="font-semibold text-sm"
              style={{ color: activeTab === 'likes' ? '#FFFFFF' : '#4a6fa5' }}
            >
              Liked
            </Text>
          </Pressable>
        </View>

        {/* Gallery Grid */}
        {loadingPosts ? (
          <ActivityIndicator color="#00CF35" className="mt-12" />
        ) : (displayPosts ?? []).length === 0 ? (
          <View className="items-center mt-16 px-8">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
              style={{ backgroundColor: '#0a2d50' }}
            >
              {activeTab === 'posts' ? (
                <Grid3X3 size={28} color="#2a4a6a" />
              ) : (
                <Heart size={28} color="#2a4a6a" />
              )}
            </View>
            <Text className="text-white font-semibold text-base">
              {activeTab === 'posts' ? 'No posts yet' : 'No liked posts yet'}
            </Text>
            <Text className="text-sm text-center mt-1" style={{ color: '#4a6fa5' }}>
              {activeTab === 'posts'
                ? 'Share your first post to get started'
                : 'Posts you like will appear here'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
            {(displayPosts ?? []).map((post) => (
              <GalleryCell
                key={post.id}
                post={post}
                onPress={() => router.push(`/(app)/post/${post.id}` as any)}
              />
            ))}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
