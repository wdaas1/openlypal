import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, TrendingUp, TrendingDown, Minus, Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { api } from '@/lib/api/api';
import type { Post, User, TrendingHashtag } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { UserAvatar } from '@/components/UserAvatar';

const SCREEN_WIDTH = Dimensions.get('window').width;

type TrendingType = 'trending' | 'rising' | 'controversial';

const TRENDING_TABS: { id: TrendingType; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'rising', label: 'Rising' },
  { id: 'controversial', label: 'Controversial' },
];

const POPULAR_HASHTAGS: TrendingHashtag[] = [
  { tag: 'art', count: 14200, trend: 'up' },
  { tag: 'photography', count: 9800, trend: 'stable' },
  { tag: 'music', count: 8300, trend: 'up' },
  { tag: 'writing', count: 6100, trend: 'down' },
  { tag: 'memes', count: 22400, trend: 'up' },
  { tag: 'aesthetic', count: 11700, trend: 'stable' },
  { tag: 'nature', count: 7600, trend: 'down' },
  { tag: 'fashion', count: 5400, trend: 'up' },
];

const SORTED_HASHTAGS = [...POPULAR_HASHTAGS].sort((a, b) => b.count - a.count);

const CATEGORIES = ['All', 'Art', 'Music', 'Tech', 'Gaming', 'Fashion', 'Food', 'Travel'];

const CATEGORY_EMOJIS: Record<string, string> = {
  All: '🌐',
  Art: '🎨',
  Music: '🎵',
  Tech: '💻',
  Gaming: '🎮',
  Fashion: '👗',
  Food: '🍜',
  Travel: '✈️',
};

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp size={10} color="#00CF35" />;
  if (trend === 'down') return <TrendingDown size={10} color="#FF4E6A" />;
  if (trend === 'stable') return <Minus size={10} color="#4a6fa5" />;
  return null;
}

function accentColorForTrend(trend?: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '#00CF35';
  if (trend === 'down') return '#FF4E6A';
  return '#4a6fa5';
}

const SKELETON_HEIGHTS = [120, 80, 140];

function SkeletonCard({ height }: { height: number }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600 }),
        withTiming(0.6, { duration: 600 })
      ),
      -1
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#0a2d50',
          borderRadius: 16,
          height,
          marginHorizontal: 12,
          marginBottom: 10,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingType, setTrendingType] = useState<TrendingType>('trending');
  const [focused, setFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const { data: trendingPosts, isLoading: loadingTrending, isRefetching } = useQuery({
    queryKey: ['explore', 'trending', trendingType, selectedCategory],
    queryFn: async () => {
      const categoryParam = selectedCategory !== 'All' ? `&category=${encodeURIComponent(selectedCategory)}` : '';
      const result = await api.get<Post[]>(`/api/explore/trending?type=${trendingType}${categoryParam}`);
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

  const { data: userSearchResults } = useQuery({
    queryKey: ['search', 'users', searchQuery],
    queryFn: async () => {
      const result = await api.get<User[]>(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
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
  const hasNoSearchResults =
    isSearching &&
    !loadingSearch &&
    (searchResults ?? []).length === 0 &&
    (userSearchResults ?? []).length === 0;

  return (
    <SafeAreaView testID="explore-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 10,
      }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 26, flex: 1 }}>Explore</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(app)/activity');
          }}
          style={{ padding: 4 }}
          testID="explore-bell-button"
        >
          <View style={{ position: 'relative' }}>
            <Bell size={22} color="#FFFFFF" />
            <View style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#00CF35',
              borderWidth: 1.5,
              borderColor: '#001935',
            }} />
          </View>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 50,
          borderRadius: 25,
          paddingHorizontal: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: focused ? 'rgba(0,207,53,0.4)' : '#1a3a5c',
        }}>
          <BlurView
            intensity={40}
            tint="dark"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Search size={18} color={focused ? '#00CF35' : '#4a6fa5'} />
          <TextInput
            testID="search-input"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search Openly"
            placeholderTextColor="#4a6fa5"
            style={{ flex: 1, paddingVertical: 0, marginLeft: 10, color: '#FFFFFF', fontSize: 14 }}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              testID="search-clear-button"
              onPress={() => setSearchQuery('')}
              hitSlop={8}
            >
              <X size={16} color="#4a6fa5" />
            </Pressable>
          ) : null}
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
        {/* Trending type tabs — glass segmented control — only show when not searching */}
        {!isSearching ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(10,45,80,0.7)',
              borderRadius: 22,
              padding: 4,
            }}>
              {TRENDING_TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  testID={`trending-tab-${tab.id}`}
                  onPress={() => setTrendingType(tab.id)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderRadius: 18,
                    backgroundColor: trendingType === tab.id ? '#00CF35' : 'transparent',
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
          </View>
        ) : null}

        {/* Category filter chips */}
        {!isSearching ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  testID={`category-filter-${cat.toLowerCase()}`}
                  onPress={() => setSelectedCategory(cat)}
                  style={{
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    backgroundColor: isSelected ? '#00CF35' : '#0a2d50',
                    borderWidth: 1,
                    borderColor: isSelected ? '#00CF35' : '#1a3a5c',
                    shadowColor: isSelected ? '#00CF35' : 'transparent',
                    shadowOpacity: isSelected ? 0.5 : 0,
                    shadowRadius: isSelected ? 8 : 0,
                    elevation: isSelected ? 4 : 0,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isSelected ? '#001935' : '#7a9fc0',
                  }}>
                    {CATEGORY_EMOJIS[cat] ?? ''} {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Trending Hashtags */}
        {!isSearching ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: '#00CF35', marginRight: 8 }} />
              <TrendingUp size={16} color="#00CF35" style={{ marginRight: 6 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, flex: 1 }}>Trending Hashtags</Text>
              <Pressable testID="hashtags-see-all">
                <Text style={{ color: '#00CF35', fontSize: 12 }}>See all</Text>
              </Pressable>
            </View>
            {/* 2-column grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SORTED_HASHTAGS.map((item, index) => (
                <Pressable
                  key={item.tag}
                  testID={`hashtag-${item.tag}`}
                  onPress={() => setSearchQuery(item.tag)}
                  style={{
                    width: (SCREEN_WIDTH - 48) / 2,
                    height: 80,
                    borderRadius: 18,
                    backgroundColor: '#0a2d50',
                    borderColor: '#1a3a5c',
                    borderWidth: 1,
                    overflow: 'hidden',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                  }}
                >
                  {/* Left accent bar */}
                  <View style={{
                    width: 3,
                    height: '60%',
                    borderRadius: 2,
                    backgroundColor: accentColorForTrend(item.trend),
                    marginRight: 10,
                  }} />

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    {/* Rank + tag */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#00CF35', fontWeight: '900', fontSize: 14 }}>
                        {index + 1}
                      </Text>
                      <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '600' }}>
                        #{item.tag}
                      </Text>
                    </View>

                    {/* Count + trend icon */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Text style={{ color: '#4a6fa5', fontSize: 10 }}>
                        {item.count >= 1000 ? `${(item.count / 1000).toFixed(1)}k` : item.count} posts
                      </Text>
                      <TrendIcon trend={item.trend} />
                    </View>
                  </View>

                  {/* Watermark rank number */}
                  <Text style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 4,
                    fontSize: 32,
                    fontWeight: '900',
                    color: '#00CF35',
                    opacity: 0.15,
                  }}>
                    {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Recommended Blogs */}
        {!isSearching && recommendedUsers && recommendedUsers.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: '#00CF35', marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, flex: 1 }}>Recommended Blogs</Text>
              <Pressable testID="recommended-see-all">
                <Text style={{ color: '#00CF35', fontSize: 12 }}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {recommendedUsers.map((user) => (
                  <Pressable
                    key={user.id}
                    testID={`recommended-user-${user.id}`}
                    onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: user.id } })}
                    style={{
                      borderRadius: 18,
                      width: 140,
                      height: 180,
                      backgroundColor: 'rgba(10,45,80,0.8)',
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.06)',
                      borderTopWidth: 2,
                      borderTopColor: 'rgba(0,207,53,0.4)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Gradient overlay at bottom */}
                    <LinearGradient
                      colors={['rgba(0,18,40,0)', 'rgba(0,18,40,0.8)']}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 90,
                      }}
                    />

                    {/* Content */}
                    <View style={{ alignItems: 'center', paddingTop: 12, flex: 1 }}>
                      <UserAvatar uri={user.image} name={user.name} size={60} />
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
                        style={user.isFollowing ? {
                          borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 10,
                          backgroundColor: 'transparent',
                          borderWidth: 1,
                          borderColor: '#00CF35',
                        } : {
                          borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginTop: 10,
                          backgroundColor: '#00CF35',
                        }}
                      >
                        <Text style={user.isFollowing ? {
                          fontSize: 12, fontWeight: '700', color: '#00CF35',
                        } : {
                          fontSize: 12, fontWeight: '700', color: '#001935',
                        }}>
                          {user.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* People search results */}
        {isSearching && userSearchResults && userSearchResults.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: '#00CF35', marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                People
              </Text>
            </View>
            {userSearchResults.map((user) => (
              <Pressable
                key={user.id}
                testID={`search-user-${user.id}`}
                onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: user.id } })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: '#0a2d50',
                  borderRadius: 14,
                  marginBottom: 8,
                  borderWidth: 0.5,
                  borderColor: '#1a3a5c',
                }}
              >
                <UserAvatar uri={user.image} name={user.name} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                    {user.name}
                  </Text>
                  {user.username ? (
                    <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                      @{user.username}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  testID={`follow-search-user-${user.id}`}
                  onPress={(e) => {
                    e.stopPropagation();
                    followMutation.mutate(user.id);
                  }}
                  style={user.isFollowing ? {
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: '#00CF35',
                  } : {
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
                    backgroundColor: '#00CF35',
                  }}
                >
                  <Text style={user.isFollowing ? {
                    fontSize: 12, fontWeight: '700', color: '#00CF35',
                  } : {
                    fontSize: 12, fontWeight: '700', color: '#001935',
                  }}>
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Empty search state */}
        {hasNoSearchResults ? (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }}>
            <Search size={40} color="rgba(255,255,255,0.15)" />
            <Text style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 15,
              fontWeight: '600',
              marginTop: 16,
              textAlign: 'center',
            }}>
              No results for "{searchQuery}"
            </Text>
          </View>
        ) : null}

        {/* Posts section */}
        <View>
          {!hasNoSearchResults ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: '#00CF35', marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                {isSearching
                  ? 'Posts'
                  : trendingType === 'trending'
                    ? 'Trending'
                    : trendingType === 'rising'
                      ? 'Rising'
                      : 'Controversial'}
              </Text>
            </View>
          ) : null}

          {loadingTrending || loadingSearch ? (
            <View testID="loading-indicator">
              {SKELETON_HEIGHTS.map((h, i) => (
                <SkeletonCard key={i} height={h} />
              ))}
            </View>
          ) : (
            (displayPosts ?? []).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}

          {!loadingTrending && !loadingSearch && !isSearching && (displayPosts ?? []).length === 0 ? (
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
