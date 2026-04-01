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

type TrendingType = 'trending' | 'rising' | 'controversial';

const TRENDING_TABS: { id: TrendingType; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'rising', label: 'Rising' },
  { id: 'controversial', label: 'Controversial' },
];

type HashtagItem = { tag: string; count: number };

const POPULAR_HASHTAGS: HashtagItem[] = [
  { tag: 'art', count: 14200 },
  { tag: 'photography', count: 9800 },
  { tag: 'music', count: 8300 },
  { tag: 'writing', count: 6100 },
  { tag: 'memes', count: 22400 },
  { tag: 'aesthetic', count: 11700 },
  { tag: 'nature', count: 7600 },
  { tag: 'fashion', count: 5400 },
];

export default function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingType, setTrendingType] = useState<TrendingType>('trending');

  const { data: trendingPosts, isLoading: loadingTrending, isRefetching } = useQuery({
    queryKey: ['explore', 'trending', trendingType],
    queryFn: async () => {
      const result = await api.get<Post[]>(`/api/explore/trending?type=${trendingType}`);
      return result ?? [];
    },
  });

  const { data: recommendedUsers } = useQuery({
    queryKey: ['explore', 'users'],
    queryFn: async () => {
      const result = await api.get<User[]>('/api/explore/recommended');
      return result ?? [];
    },
  });

  const { data: searchResults, isLoading: loadingSearch } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: async () => {
      const result = await api.get<Post[]>(`/api/posts?tag=${encodeURIComponent(searchQuery)}`);
      return result ?? [];
    },
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

  const displayPosts = searchQuery.length > 2 ? searchResults : trendingPosts;
  const isSearching = searchQuery.length > 2;

  return (
    <SafeAreaView testID="explore-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          borderRadius: 14, paddingHorizontal: 14,
          backgroundColor: '#0a2d50',
          borderWidth: 1, borderColor: '#1a3a5c',
        }}>
          <Search size={18} color="#4a6fa5" />
          <TextInput
            testID="search-input"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Openly"
            placeholderTextColor="#4a6fa5"
            style={{ flex: 1, paddingVertical: 12, marginLeft: 10, color: '#FFFFFF', fontSize: 14 }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['explore'] })}
            tintColor="#00CF35"
          />
        }
      >
        {/* Trending type tabs — only show when not searching */}
        {!isSearching ? (
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
            {TRENDING_TABS.map((tab) => (
              <Pressable
                key={tab.id}
                testID={`trending-tab-${tab.id}`}
                onPress={() => setTrendingType(tab.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: trendingType === tab.id ? '#00CF35' : '#0a2d50',
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: trendingType === tab.id ? '#001935' : '#4a6fa5',
                }}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Trending Hashtags */}
        {!isSearching ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Trending Hashtags</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_HASHTAGS.map((item) => (
                <Pressable
                  key={item.tag}
                  testID={`hashtag-${item.tag}`}
                  onPress={() => setSearchQuery(item.tag)}
                  style={{
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                    backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1,
                  }}
                >
                  <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '600' }}>
                    #{item.tag}
                  </Text>
                  <Text style={{ color: '#4a6fa5', fontSize: 10, marginTop: 2 }}>
                    {item.count >= 1000 ? `${(item.count / 1000).toFixed(1)}k` : item.count} posts
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Recommended Blogs */}
        {!isSearching && recommendedUsers && recommendedUsers.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Recommended Blogs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {recommendedUsers.map((user) => (
                  <Pressable
                    key={user.id}
                    testID={`recommended-user-${user.id}`}
                    onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: user.id } })}
                    style={{
                      alignItems: 'center', borderRadius: 18, padding: 16,
                      backgroundColor: '#0a2d50', width: 148,
                    }}
                  >
                    <UserAvatar uri={user.image} name={user.name} size={56} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13, marginTop: 8 }} numberOfLines={1}>
                      {user.username ?? user.name}
                    </Text>
                    {user.followerCount !== undefined ? (
                      <Text style={{ color: '#4a6fa5', fontSize: 11, marginTop: 2 }}>
                        {user.followerCount >= 1000 ? `${(user.followerCount / 1000).toFixed(1)}k` : user.followerCount} followers
                      </Text>
                    ) : null}
                    <Pressable
                      testID={`follow-user-${user.id}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        followMutation.mutate(user.id);
                      }}
                      style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 10, backgroundColor: '#00CF35' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#001935' }}>
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
        <View>
          {isSearching ? (
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, paddingHorizontal: 16, marginBottom: 12 }}>
              Results for &quot;{searchQuery}&quot;
            </Text>
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, paddingHorizontal: 16, marginBottom: 12 }}>
              {trendingType === 'trending' ? 'Trending' : trendingType === 'rising' ? 'Rising' : 'Controversial'}
            </Text>
          )}

          {loadingTrending || loadingSearch ? (
            <ActivityIndicator testID="loading-indicator" color="#00CF35" style={{ marginTop: 32 }} />
          ) : (
            (displayPosts ?? []).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}

          {!loadingTrending && !loadingSearch && (displayPosts ?? []).length === 0 ? (
            <Text style={{ color: '#4a6fa5', textAlign: 'center', marginTop: 32 }}>
              No posts found
            </Text>
          ) : null}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
