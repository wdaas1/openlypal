import React from 'react';
import { View, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import type { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';

export default function FeedScreen() {
  const queryClient = useQueryClient();

  const { data: posts, isLoading, isRefetching } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get<Post[]>('/api/posts'),
  });

  return (
    <SafeAreaView testID="feed-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 items-center" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Text className="text-white text-2xl font-black" style={{ fontStyle: 'italic', letterSpacing: -1 }}>
          tumblr
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
        </View>
      ) : (
        <FlashList
          testID="feed-list"
          data={posts ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          estimatedItemSize={300}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed'] })}
              tintColor="#00CF35"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-32">
              <Text className="text-lg font-semibold" style={{ color: '#4a6fa5' }}>
                No posts yet
              </Text>
              <Text className="text-sm mt-2" style={{ color: '#4a6fa5' }}>
                Follow some blogs or create your first post
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
