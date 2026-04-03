import React, { useState, useRef, useCallback } from 'react';
import { View, Text, RefreshControl, Pressable, useWindowDimensions, ViewToken } from 'react-native';
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
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Bell, ShieldAlert } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import type { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { AdCard } from '@/components/AdCard';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';

type Tab = 'following' | 'foryou' | 'unfiltered';

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

function SkeletonCard() {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(-width);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withTiming(width, { duration: 1200 }),
      -1,
      false
    );
  }, [width]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={{
      backgroundColor: '#0a2d50',
      borderRadius: 16,
      marginHorizontal: 12,
      marginBottom: 10,
      padding: 16,
      overflow: 'hidden',
    }}>
      {/* Shimmer overlay */}
      <Animated.View
        style={[
          shimmerStyle,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a3a5c' }} />
        <View style={{ marginLeft: 12, flex: 1, gap: 6 }}>
          <View style={{ height: 12, width: '45%', borderRadius: 6, backgroundColor: '#1a3a5c' }} />
          <View style={{ height: 10, width: '30%', borderRadius: 5, backgroundColor: '#1a3a5c' }} />
        </View>
      </View>
      {/* Content area */}
      <View style={{ height: 160, borderRadius: 10, backgroundColor: '#1a3a5c', marginBottom: 12 }} />
      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ height: 10, width: 44, borderRadius: 5, backgroundColor: '#1a3a5c' }} />
        <View style={{ height: 10, width: 44, borderRadius: 5, backgroundColor: '#1a3a5c' }} />
        <View style={{ height: 10, width: 44, borderRadius: 5, backgroundColor: '#1a3a5c' }} />
      </View>
    </View>
  );
}

function SkeletonLoader() {
  return (
    <View style={{ paddingTop: 8 }}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

function ForYouTab({ onScroll }: { onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const queryClient = useQueryClient();
  const { data: posts, isLoading, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get<Post[]>('/api/posts'),
  });

  const feedItems = buildFeedItems(posts ?? []);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleKeys(new Set(viewableItems.map((v) => v.key as string)));
  }, []);

  if (isLoading) return <SkeletonLoader />;

  return (
    <FlashList
      testID="feed-list"
      data={feedItems}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.type === 'ad') return <AdCard index={item.adIndex} />;
        return <PostCard post={item.data} isVisible={visibleKeys.has(item.key)} />;
      }}
      estimatedItemSize={320}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed'] })}
          tintColor="#00CF35"
        />
      }
      ListEmptyComponent={
        <EmptyState
          message="No posts yet"
          sub="Follow some blogs or create your first post"
        />
      }
    />
  );
}

function FollowingTab({ onScroll }: { onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const queryClient = useQueryClient();
  const { data: posts, isLoading, isRefetching } = useQuery({
    queryKey: ['feed', 'following'],
    queryFn: () => api.get<Post[]>('/api/posts/feed/following'),
  });

  const feedItems = buildFeedItems(posts ?? []);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleKeys(new Set(viewableItems.map((v) => v.key as string)));
  }, []);

  if (isLoading) return <SkeletonLoader />;

  return (
    <FlashList
      testID="following-feed-list"
      data={feedItems}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.type === 'ad') return <AdCard index={item.adIndex} />;
        return <PostCard post={item.data} isVisible={visibleKeys.has(item.key)} />;
      }}
      estimatedItemSize={320}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
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

function UnfilteredTab({ onScroll }: { onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const queryClient = useQueryClient();
  const { data: posts, isLoading, isRefetching } = useQuery({
    queryKey: ['feed', 'unfiltered'],
    queryFn: () => api.get<Post[]>('/api/posts/feed/unfiltered'),
  });

  const feedItems = buildFeedItems(posts ?? []);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleKeys(new Set(viewableItems.map((v) => v.key as string)));
  }, []);

  if (isLoading) return <SkeletonLoader />;

  return (
    <FlashList
      testID="unfiltered-feed-list"
      data={feedItems}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => {
        if (item.type === 'ad') return <AdCard index={item.adIndex} />;
        return <PostCard post={item.data} isVisible={visibleKeys.has(item.key)} />;
      }}
      estimatedItemSize={320}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed', 'unfiltered'] })}
          tintColor="#00CF35"
        />
      }
      ListEmptyComponent={
        <EmptyState
          message="No unfiltered posts yet"
          sub="All posts from the community will appear here"
        />
      }
    />
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'following', label: 'Following' },
  { id: 'foryou', label: 'For You' },
  { id: 'unfiltered', label: 'Unfiltered 🔥' },
];

const HEADER_HEIGHT = 52;
const TABBAR_HEIGHT = 52;
const COLLAPSE_TOTAL = HEADER_HEIGHT + TABBAR_HEIGHT;

const TAB_INDICATOR_WIDTH = 40;

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('foryou');
  const router = useRouter();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);
  const scrollY = useSharedValue(0);
  const { width: screenWidth } = useWindowDimensions();

  // For underline indicator
  const tabWidth = screenWidth / TABS.length;
  const indicatorX = useSharedValue(tabWidth * TABS.findIndex(t => t.id === 'foryou'));

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

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value + (tabWidth / 2) - (TAB_INDICATOR_WIDTH / 2) }],
  }));

  const handleTabChange = (tab: Tab) => {
    const idx = TABS.findIndex(t => t.id === tab);
    indicatorX.value = withSpring(tabWidth * idx, { damping: 20, stiffness: 200 });
    setActiveTab(tab);
    scrollY.value = 0;
  };

  return (
    <SafeAreaView testID="feed-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Collapsing header */}
      <Animated.View style={[{ overflow: 'hidden' }, headerStyle]}>
        <LinearGradient
          colors={['rgba(0,25,53,0.98)', 'rgba(0,25,53,0.85)']}
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <Text style={{
            color: '#00CF35',
            fontSize: 26,
            fontWeight: '900',
            fontStyle: 'italic',
            flex: 1,
            textShadowColor: '#00CF35',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          }}>
            Openly
          </Text>
          {/* Separator */}
          <View style={{ width: 1, height: 20, backgroundColor: 'rgba(26,58,92,0.6)', marginRight: 12 }} />
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {admin ? (
              <Pressable testID="admin-button" onPress={() => router.push('/(app)/admin' as any)}>
                <ShieldAlert size={22} color="#FF4E6A" />
              </Pressable>
            ) : null}
            <Pressable testID="search-button" onPress={() => router.push('/(app)/explore' as any)}>
              <Search size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable testID="notifications-button" onPress={() => router.push('/(app)/activity' as any)}>
              <Bell size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Tab Bar */}
      <Animated.View style={[{
        overflow: 'hidden',
        backgroundColor: 'rgba(0,25,53,0.98)',
        borderBottomWidth: 1,
        borderBottomColor: '#1a3a5c',
      }, tabBarStyle]}>
        <View style={{ flexDirection: 'row', paddingTop: 8 }}>
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
                  paddingBottom: 10,
                  paddingTop: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? '#FFFFFF' : '#4a6fa5',
                    letterSpacing: 0.1,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {/* Sliding underline */}
        <Animated.View
          style={[
            indicatorStyle,
            {
              position: 'absolute',
              bottom: 0,
              width: TAB_INDICATOR_WIDTH,
              height: 3,
              borderRadius: 2,
              backgroundColor: '#00CF35',
            },
          ]}
        />
      </Animated.View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'foryou' && <ForYouTab onScroll={scrollHandler} />}
        {activeTab === 'following' && <FollowingTab onScroll={scrollHandler} />}
        {activeTab === 'unfiltered' && <UnfilteredTab onScroll={scrollHandler} />}
      </View>
    </SafeAreaView>
  );
}
