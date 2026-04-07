import React from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Repeat2, MessageCircle, Users, UserPlus } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api/api';
import { UserAvatar } from '@/components/UserAvatar';
import { localStore } from '@/lib/local-store';

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
    case 'follow':
      return <UserPlus size={16} color="#A855F7" />;
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
    case 'follow':
      return 'started following you';
    default:
      return 'interacted with your post';
  }
}

export default function ActivityScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => {
      localStore.set('activity-last-seen', new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    }, [queryClient])
  );

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
          {/* Relationship Map Banner — always visible */}
          <Pressable
            testID="relationship-map-banner"
            onPress={() => router.push('/(app)/relationships' as any)}
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              marginBottom: 8,
              borderRadius: 16,
              backgroundColor: '#011e3d',
              borderWidth: 1,
              borderColor: 'rgba(0,207,53,0.25)',
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              gap: 14,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(0,207,53,0.12)',
                borderWidth: 1.5,
                borderColor: 'rgba(0,207,53,0.4)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} color="#00CF35" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
                Relationship Map
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
                See your friendship strength and who you're drifting from
              </Text>
            </View>
            <Text style={{ color: '#00CF35', fontSize: 18 }}>{'›'}</Text>
          </Pressable>

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
