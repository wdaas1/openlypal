import React from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Repeat2, MessageCircle } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api/api';
import { UserAvatar } from '@/components/UserAvatar';

interface ActivityItem {
  id: string;
  type: string;
  userId: string;
  postId: string | null;
  user: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
  };
  post?: {
    id: string;
    title: string | null;
    content: string | null;
  } | null;
  createdAt: string;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'like':
      return <Heart size={16} color="#FF4E6A" fill="#FF4E6A" />;
    case 'reblog':
      return <Repeat2 size={16} color="#00CF35" />;
    case 'comment':
      return <MessageCircle size={16} color="#3F72AF" />;
    default:
      return <Heart size={16} color="#4a6fa5" />;
  }
}

function getActivityText(type: string) {
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'reblog':
      return 'reblogged your post';
    case 'comment':
      return 'commented on your post';
    default:
      return 'interacted with your post';
  }
}

export default function ActivityScreen() {
  const queryClient = useQueryClient();

  const { data: activities, isLoading, isRefetching } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const result = await api.get<ActivityItem[]>('/api/activity');
      return result ?? [];
    },
  });

  return (
    <SafeAreaView testID="activity-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Text className="text-white text-xl font-bold">Activity</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['activity'] })}
              tintColor="#00CF35"
            />
          }
        >
          {(activities ?? []).length === 0 ? (
            <View className="items-center justify-center pt-32">
              <Text className="text-lg font-semibold" style={{ color: '#4a6fa5' }}>
                No activity yet
              </Text>
              <Text className="text-sm mt-2" style={{ color: '#4a6fa5' }}>
                Interactions on your posts will show up here
              </Text>
            </View>
          ) : (
            (activities ?? []).map((item) => (
              <View
                key={item.id}
                testID={`activity-item-${item.id}`}
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
              >
                <UserAvatar uri={item.user.image} name={item.user.name} size={40} />
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center gap-2">
                    {getActivityIcon(item.type)}
                    <Text className="text-white text-sm flex-1">
                      <Text className="font-bold">{item.user.username ?? item.user.name}</Text>
                      {' '}{getActivityText(item.type)}
                    </Text>
                  </View>
                  {item.post?.title || item.post?.content ? (
                    <Text className="text-xs mt-1" style={{ color: '#4a6fa5' }} numberOfLines={1}>
                      {item.post.title ?? item.post.content}
                    </Text>
                  ) : null}
                  <Text className="text-xs mt-1" style={{ color: '#4a6fa5' }}>
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </Text>
                </View>
              </View>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
