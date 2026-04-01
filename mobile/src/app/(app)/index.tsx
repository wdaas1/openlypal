import React, { useState } from 'react';
import { View, Text, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { api } from '@/lib/api/api';
import type { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { AdCard } from '@/components/AdCard';

type Tab = 'foryou' | 'following' | 'tags';

type FeedItem =
  | { type: 'post'; data: Post; key: string }
  | { type: 'ad'; adIndex: number; key: string };

function buildFeedItems(posts: Post[]): FeedItem[] {
  const items: FeedItem[] = [];
  let adIndex = 0;
  posts.forEach((post, i) => {
    items.push({ type: 'post', data: post, key: post.id });
    if ((i + 1) % 5 === 0) {
      items.push({ type: 'ad', adIndex: adIndex++, key: `ad-${adIndex}` });
    }
  });
  return items;
}

function EmptyState({ message, sub, action, onAction }: {
  message: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 }}>
      <Text style={{ color: '#4a6fa5', fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
        {message}
      </Text>
      {sub ? (
        <Text style={{ color: '#4a6fa5', fontSize: 13, marginTop: 8, textAlign: 'center', opacity: 0.75 }}>
          {sub}
        </Text>
      ) : null}
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          style={{ marginTop: 20, backgroundColor: '#00CF35', borderRadius: 22, paddingHorizontal: 24, paddingVertical: 11 }}
        >
          <Text style={{ color: '#001935', fontWeight: '700', fontSize: 14 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ForYouTab({ onScroll }: { onScroll: (event: any) => void }) {
  const queryClient = useQueryClient();
  const { data: posts, isLoading, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get<Post[]>('/api/posts'),
  });

  const feedItems = buildFeedItems(posts ?? []);

  return (
    <FlashList
      testID="feed-list"
      data={feedItems}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.type === 'ad') return <AdCard index={item.adIndex} />;
        return <PostCard post={item.data} />;
      }}
      estimatedItemSize={320}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed'] })}
          tintColor="#00CF35"
        />
      }
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState
            message="No posts yet"
            sub="Follow some blogs or create your first post"
          />
        )
      }
    />
  );
}

function FollowingTab({ onScroll }: { onScroll: (event: any) => void }) {
  const queryClient = useQueryClient();
  const { data: posts, isLoading, isRefetching } = useQuery({
    queryKey: ['feed', 'following'],
    queryFn: () => api.get<Post[]>('/api/posts/feed/following'),
  });

  const feedItems = buildFeedItems(posts ?? []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00CF35" size="large" />
      </View>
    );
  }

  return (
    <FlashList
      testID="following-feed-list"
      data={feedItems}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.type === 'ad') return <AdCard index={item.adIndex} />;
        return <PostCard post={item.data} />;
      }}
      estimatedItemSize={320}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed', 'following'] })}
          tintColor="#00CF35"
        />
      }
      ListEmptyComponent={
        <EmptyState
          message="Nothing here yet"
          sub="Follow people to see their posts in this tab"
        />
      }
    />
  );
}

function TagsTab({ onScroll }: { onScroll: (event: any) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: followedTags, isLoading: loadingTags } = useQuery({
    queryKey: ['tags', 'following'],
    queryFn: () => api.get<string[]>('/api/tags/following'),
  });

  const { data: posts, isLoading: loadingPosts, isRefetching } = useQuery({
    queryKey: ['feed', 'tags'],
    queryFn: () => api.get<Post[]>('/api/feed/tags'),
    enabled: (followedTags ?? []).length > 0,
  });

  const isLoading = loadingTags || loadingPosts;

  if (isLoading && !posts) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00CF35" size="large" />
      </View>
    );
  }

  if (!loadingTags && (followedTags ?? []).length === 0) {
    return (
      <EmptyState
        message="You're not following any tags"
        sub="Follow tags to see posts about topics you love"
        action="Explore Tags"
        onAction={() => router.push('/(app)/explore' as any)}
      />
    );
  }

  const feedItems = buildFeedItems(posts ?? []);

  return (
    <FlashList
      testID="tags-feed-list"
      data={feedItems}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.type === 'ad') return <AdCard index={item.adIndex} />;
        return <PostCard post={item.data} />;
      }}
      estimatedItemSize={320}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed', 'tags'] })}
          tintColor="#00CF35"
        />
      }
      ListEmptyComponent={
        <EmptyState
          message="No posts in your tags yet"
          sub="Posts tagged with topics you follow will appear here"
        />
      }
    />
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'foryou', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'tags', label: 'Tags' },
];

const HEADER_HEIGHT = 46;
const TABBAR_HEIGHT = 52;
const COLLAPSE_TOTAL = HEADER_HEIGHT + TABBAR_HEIGHT;

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('foryou');
  const scrollY = useSharedValue(0);

  const scrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  };

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, HEADER_HEIGHT], [HEADER_HEIGHT, 0], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [0, HEADER_HEIGHT * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  const tabBarStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [HEADER_HEIGHT, COLLAPSE_TOTAL], [TABBAR_HEIGHT, 0], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [HEADER_HEIGHT, COLLAPSE_TOTAL * 0.8], [1, 0], Extrapolation.CLAMP),
  }));

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    scrollY.value = 0;
  };

  return (
    <SafeAreaView testID="feed-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Collapsing header */}
      <Animated.View style={[{ overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: '#1a3a5c' }, headerStyle]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1 }}>
            Openly
          </Text>
        </View>
      </Animated.View>

      {/* Tab Bar */}
      <Animated.View style={[{ overflow: 'hidden' }, tabBarStyle]}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 4 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`tab-${tab.id}`}
              onPress={() => handleTabChange(tab.id)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive ? '#00CF35' : '#0a2d50',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isActive ? '#001935' : '#4a6fa5',
                  letterSpacing: 0.1,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        </View>
      </Animated.View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'foryou' && <ForYouTab onScroll={scrollHandler} />}
        {activeTab === 'following' && <FollowingTab onScroll={scrollHandler} />}
        {activeTab === 'tags' && <TagsTab onScroll={scrollHandler} />}
      </View>
    </SafeAreaView>
  );
}
