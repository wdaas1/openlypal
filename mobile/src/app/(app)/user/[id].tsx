import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import type { Post, User } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { UserAvatar } from '@/components/UserAvatar';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading: loadingUser, isRefetching } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get<User>(`/api/users/${id}`),
    enabled: !!id,
  });

  const { data: userPosts, isLoading: loadingPosts } = useQuery({
    queryKey: ['posts', 'user', id],
    queryFn: () => api.get<Post[]>(`/api/posts?userId=${id}`),
    enabled: !!id,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (user?.isFollowing) {
        await api.delete(`/api/users/${id}/follow`);
      } else {
        await api.post(`/api/users/${id}/follow`);
      }
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });

  if (loadingUser) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#001935' }}>
        <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#001935' }}>
        <Text style={{ color: '#4a6fa5' }}>User not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="user-profile-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="absolute top-12 left-4 z-10">
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          className="rounded-full p-2"
          style={{ backgroundColor: 'rgba(0,25,53,0.7)' }}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['user', id] });
              queryClient.invalidateQueries({ queryKey: ['posts', 'user', id] });
            }}
            tintColor="#00CF35"
          />
        }
      >
        {/* Header Image */}
        <View style={{ height: 160, backgroundColor: '#0a2d50' }}>
          {user.headerImage ? (
            <Image
              source={{ uri: user.headerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1" style={{ backgroundColor: '#0a2d50' }} />
          )}
        </View>

        {/* Profile Info */}
        <View className="px-4 -mt-10">
          <View className="flex-row items-end justify-between">
            <View style={{ borderColor: '#001935', borderWidth: 4, borderRadius: 44 }}>
              <UserAvatar uri={user.image} name={user.name} size={80} />
            </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable
              testID="message-button"
              onPress={() => router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: id } })}
              className="rounded-full px-5 py-2 mb-1"
              style={{
                backgroundColor: '#0a2d50',
                borderColor: '#1a3a5c',
                borderWidth: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MessageCircle size={15} color="#4a6fa5" />
              <Text className="font-bold text-sm" style={{ color: '#ffffff' }}>
                Message
              </Text>
            </Pressable>
            <Pressable
              testID="follow-button"
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              className="rounded-full px-6 py-2 mb-1"
              style={{
                backgroundColor: user.isFollowing ? '#0a2d50' : '#00CF35',
                borderColor: user.isFollowing ? '#1a3a5c' : '#00CF35',
                borderWidth: 1,
              }}
            >
              <Text
                className="font-bold text-sm"
                style={{ color: user.isFollowing ? '#FFFFFF' : '#001935' }}
              >
                {followMutation.isPending ? '...' : user.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          </View>
          </View>

          <View className="mt-3">
            <Text className="text-white text-xl font-bold">{user.name}</Text>
            {user.username ? (
              <Text className="text-sm" style={{ color: '#4a6fa5' }}>@{user.username}</Text>
            ) : null}
            {user.bio ? (
              <Text className="text-sm mt-2" style={{ color: '#a0b4c8' }}>{user.bio}</Text>
            ) : null}
          </View>

          {/* Stats */}
          <View className="flex-row mt-4 gap-6">
            <View>
              <Text className="text-white font-bold text-base">{user._count?.posts ?? 0}</Text>
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Posts</Text>
            </View>
            <Pressable
              testID="followers-button"
              onPress={() => router.push({ pathname: '/(app)/user/followers' as any, params: { id, type: 'followers' } })}
            >
              <Text className="text-white font-bold text-base">{user._count?.followers ?? 0}</Text>
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Followers</Text>
            </Pressable>
            <Pressable
              testID="following-button"
              onPress={() => router.push({ pathname: '/(app)/user/followers' as any, params: { id, type: 'following' } })}
            >
              <Text className="text-white font-bold text-base">{user._count?.following ?? 0}</Text>
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Following</Text>
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View className="mt-6" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }} />

        {/* Posts */}
        <View className="pt-3">
          {loadingPosts ? (
            <ActivityIndicator testID="posts-loading" color="#00CF35" className="mt-8" />
          ) : (userPosts ?? []).length === 0 ? (
            <Text className="text-center mt-8" style={{ color: '#4a6fa5' }}>No posts yet</Text>
          ) : (
            (userPosts ?? []).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
