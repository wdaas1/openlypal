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
import { useTheme } from '@/lib/theme';

export default function UserProfileScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
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
      await api.post(`/api/users/${id}/follow`);
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error) => {
      console.error('Follow/unfollow failed:', error);
    },
  });

  if (loadingUser) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: theme.bg }}>
        <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: theme.bg }}>
        <Text style={{ color: theme.subtext }}>User not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="user-profile-screen" className="flex-1" style={{ backgroundColor: theme.bg }} edges={['top']}>
      {/* Back button overlay — absolute positioned over header image */}
      <View className="absolute top-12 left-4 z-10">
        <Pressable
          testID="back-button"
          onPress={handleBack}
          className="rounded-full p-2"
          style={{ backgroundColor: theme.isDark ? 'rgba(0,25,53,0.7)' : 'rgba(255,255,255,0.85)' }}
        >
          <ArrowLeft size={24} color={theme.text} />
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
        <View style={{ height: 160, backgroundColor: theme.card }}>
          {user.headerImage ? (
            <Image
              source={{ uri: user.headerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1" style={{ backgroundColor: theme.card }} />
          )}
        </View>

        {/* Profile Info */}
        <View className="px-4 -mt-10">
          <View className="flex-row items-end justify-between">
            <View style={{ borderColor: theme.bg, borderWidth: 4, borderRadius: 44 }}>
              <UserAvatar uri={user.image} name={user.name} size={80} />
            </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable
              testID="message-button"
              onPress={() => router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: id } })}
              className="rounded-full px-5 py-2 mb-1"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MessageCircle size={15} color={theme.subtext} />
              <Text className="font-bold text-sm" style={{ color: theme.text }}>
                Message
              </Text>
            </Pressable>
            <Pressable
              testID="follow-button"
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              className="rounded-full px-6 py-2 mb-1"
              style={{
                backgroundColor: user.isFollowing ? theme.card : '#00CF35',
                borderColor: user.isFollowing ? theme.border : '#00CF35',
                borderWidth: 1,
              }}
            >
              <Text
                className="font-bold text-sm"
                style={{ color: user.isFollowing ? theme.text : '#001935' }}
              >
                {followMutation.isPending ? '...' : user.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          </View>
          </View>

          <View className="mt-3">
            <Text style={{ color: theme.text }} className="text-xl font-bold">{user.name}</Text>
            {user.username ? (
              <Text className="text-sm" style={{ color: theme.subtext }}>@{user.username}</Text>
            ) : null}
            {user.bio ? (
              <Text className="text-sm mt-2" style={{ color: theme.subtext }}>{user.bio}</Text>
            ) : null}
          </View>

          {/* Stats */}
          <View className="flex-row mt-4 gap-6">
            <View>
              <Text style={{ color: theme.text }} className="font-bold text-base">{user.postCount ?? user._count?.posts ?? 0}</Text>
              <Text className="text-xs" style={{ color: theme.subtext }}>Posts</Text>
            </View>
            <Pressable
              testID="followers-button"
              onPress={() => router.push({ pathname: '/(app)/user/followers' as any, params: { id, type: 'followers' } })}
            >
              <Text style={{ color: theme.text }} className="font-bold text-base">{user.followerCount ?? user._count?.followers ?? 0}</Text>
              <Text className="text-xs" style={{ color: theme.subtext }}>Followers</Text>
            </Pressable>
            <Pressable
              testID="following-button"
              onPress={() => router.push({ pathname: '/(app)/user/followers' as any, params: { id, type: 'following' } })}
            >
              <Text style={{ color: theme.text }} className="font-bold text-base">{user.followingCount ?? user._count?.following ?? 0}</Text>
              <Text className="text-xs" style={{ color: theme.subtext }}>Following</Text>
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View className="mt-6" style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }} />

        {/* Posts */}
        <View className="pt-3">
          {loadingPosts ? (
            <ActivityIndicator testID="posts-loading" color="#00CF35" className="mt-8" />
          ) : (userPosts ?? []).length === 0 ? (
            <Text className="text-center mt-8" style={{ color: theme.subtext }}>No posts yet</Text>
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
