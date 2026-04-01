import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import type { Post, User } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { UserAvatar } from '@/components/UserAvatar';

export default function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: trendingPosts, isLoading: loadingTrending, isRefetching } = useQuery({
    queryKey: ['explore', 'trending'],
    queryFn: () => api.get<Post[]>('/api/posts?sort=trending'),
  });

  const { data: recommendedUsers } = useQuery({
    queryKey: ['explore', 'users'],
    queryFn: () => api.get<User[]>('/api/users?recommended=true'),
  });

  const { data: searchResults, isLoading: loadingSearch } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => api.get<Post[]>(`/api/posts?search=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length > 2,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/api/users/${userId}/follow`);
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ['explore', 'users'] });
    },
  });

  const popularTags = ['art', 'photography', 'music', 'writing', 'memes', 'aesthetic', 'nature', 'fashion'];
  const displayPosts = searchQuery.length > 2 ? searchResults : trendingPosts;

  return (
    <SafeAreaView testID="explore-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center rounded-xl px-4" style={{ backgroundColor: '#0a2d50' }}>
          <Search size={18} color="#4a6fa5" />
          <TextInput
            testID="search-input"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Tumblr"
            placeholderTextColor="#4a6fa5"
            className="flex-1 py-3 ml-3 text-white text-sm"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['explore'] })}
            tintColor="#00CF35"
          />
        }
      >
        {/* Popular Tags */}
        {searchQuery.length <= 2 ? (
          <View className="px-4 mb-6">
            <Text className="text-white font-bold text-lg mb-3">Popular Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View className="flex-row gap-2">
                {popularTags.map((tag) => (
                  <Pressable
                    key={tag}
                    testID={`tag-${tag}`}
                    onPress={() => setSearchQuery(tag)}
                    className="rounded-full px-4 py-2"
                    style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                  >
                    <Text style={{ color: '#00CF35' }} className="text-sm font-medium">
                      #{tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Recommended Blogs */}
        {searchQuery.length <= 2 && recommendedUsers && recommendedUsers.length > 0 ? (
          <View className="px-4 mb-6">
            <Text className="text-white font-bold text-lg mb-3">Recommended Blogs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View className="flex-row gap-3">
                {recommendedUsers.map((user) => (
                  <Pressable
                    key={user.id}
                    testID={`recommended-user-${user.id}`}
                    onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: user.id } })}
                    className="items-center rounded-2xl p-4"
                    style={{ backgroundColor: '#0a2d50', width: 140 }}
                  >
                    <UserAvatar uri={user.image} name={user.name} size={56} />
                    <Text className="text-white font-semibold text-sm mt-2" numberOfLines={1}>
                      {user.username ?? user.name}
                    </Text>
                    <Pressable
                      testID={`follow-user-${user.id}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        followMutation.mutate(user.id);
                      }}
                      className="rounded-full px-4 py-1.5 mt-2"
                      style={{ backgroundColor: '#00CF35' }}
                    >
                      <Text className="text-xs font-bold" style={{ color: '#001935' }}>
                        Follow
                      </Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Posts */}
        <View className="px-0">
          {searchQuery.length > 2 ? (
            <Text className="text-white font-bold text-lg px-4 mb-3">
              Results for &quot;{searchQuery}&quot;
            </Text>
          ) : (
            <Text className="text-white font-bold text-lg px-4 mb-3">Trending</Text>
          )}

          {loadingTrending || loadingSearch ? (
            <ActivityIndicator testID="loading-indicator" color="#00CF35" className="mt-8" />
          ) : (
            (displayPosts ?? []).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}

          {!loadingTrending && !loadingSearch && (displayPosts ?? []).length === 0 ? (
            <Text className="text-center mt-8" style={{ color: '#4a6fa5' }}>
              No posts found
            </Text>
          ) : null}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
