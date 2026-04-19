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
import { useTheme } from '@/lib/theme';

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
    // outgoing types — muted, no fill
    case 'like_given':
      return <Heart size={16} color="#7a3344" />;
    case 'reblog_given':
      return <Repeat2 size={16} color="#1a6630" />;
    case 'comment_given':
      return <MessageCircle size={16} color="#2a4a6f" />;
    case 'follow_given':
      return <UserPlus size={16} color="#6b3fa0" />;
    default:
      return <Heart size={16} color="#4a6fa5" />;
  }
}

function getActivityText(type: string, item: ActivityItem): string {
  const target = item.user.username ?? item.user.name;
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'reblog':
      return 'reblogged your post';
    case 'comment':
      return 'commented on your post';
    case 'follow':
      return 'started following you';
    // outgoing types
    case 'like_given':
      return `You liked ${target}'s post`;
    case 'reblog_given':
      return `You reblogged ${target}'s post`;
    case 'comment_given':
      return `You commented on ${target}'s post`;
    case 'follow_given':
      return `You followed ${target}`;
    default:
      return 'interacted with your post';
  }
}

const OUTGOING_TYPES = new Set(['like_given', 'reblog_given', 'comment_given', 'follow_given']);

function ActivityRow({ item, isOutgoing }: { item: ActivityItem; isOutgoing: boolean }) {
  const theme = useTheme();
  const router = useRouter();

  const handlePress = () => {
    if (isOutgoing) {
      if (item.type === 'follow_given') {
        router.push(`/(app)/user/${item.user.id}` as any);
      } else if (item.postId) {
        router.push(`/(app)/post/${item.postId}` as any);
      }
    } else {
      if (item.type === 'follow') {
        router.push(`/(app)/user/${item.userId}` as any);
      } else if (item.postId) {
        router.push(`/(app)/post/${item.postId}` as any);
      }
    }
  };

  const handleAvatarPress = () => {
    if (isOutgoing) {
      router.push(`/(app)/user/${item.user.id}` as any);
    } else {
      router.push(`/(app)/user/${item.userId}` as any);
    }
  };

  const showChevron = isOutgoing
    ? item.type === 'follow_given' || !!item.postId
    : item.postId != null || item.type === 'follow';

  const text = getActivityText(item.type, item);

  return (
    <Pressable
      testID={`activity-item-${item.id}`}
      onPress={handlePress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomColor: theme.border,
        borderBottomWidth: 0.5,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Pressable onPress={handleAvatarPress}>
        <UserAvatar uri={item.user.image} name={item.user.name} size={40} />
      </Pressable>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {getActivityIcon(item.type)}
          {isOutgoing ? (
            <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
              {text}
            </Text>
          ) : (
            <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>{item.user.username ?? item.user.name}</Text>
              {' '}{text}
            </Text>
          )}
        </View>
        {!isOutgoing && (item.post?.title || item.post?.content) ? (
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
            {item.post?.title ?? item.post?.content}
          </Text>
        ) : null}
        <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 4 }}>
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </Text>
      </View>
      {showChevron ? (
        <Text style={{ color: theme.subtext, fontSize: 18, marginLeft: 8 }}>{'›'}</Text>
      ) : null}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
        {title}
      </Text>
    </View>
  );
}

export default function ActivityScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => {
      localStore.set('activity-last-seen', new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    }, [queryClient])
  );

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const result = await api.get<{ notifications: ActivityItem[]; outgoing: ActivityItem[] }>('/api/activity');
      return result ?? { notifications: [], outgoing: [] };
    },
  });

  const notifications = data?.notifications ?? [];
  const outgoing = data?.outgoing ?? [];

  return (
    <SafeAreaView testID="activity-screen" className="flex-1" style={{ backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3" style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}>
        <Text style={{ color: theme.text }} className="text-xl font-bold">Activity</Text>
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
              backgroundColor: theme.card,
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
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                Relationship Map
              </Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
                See your friendship strength and who you're drifting from
              </Text>
            </View>
            <Text style={{ color: '#00CF35', fontSize: 18 }}>{'›'}</Text>
          </Pressable>

          {/* Notifications section */}
          <SectionHeader title="Notifications" />
          {notifications.length === 0 ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
              <Text style={{ color: theme.subtext, fontSize: 14 }}>No notifications yet</Text>
            </View>
          ) : (
            notifications.map((item) => (
              <ActivityRow key={item.id} item={item} isOutgoing={false} />
            ))
          )}

          {/* Your Activity section */}
          <SectionHeader title="Your Activity" />
          {outgoing.length === 0 ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
              <Text style={{ color: theme.subtext, fontSize: 14 }}>Nothing here yet</Text>
            </View>
          ) : (
            outgoing.map((item) => (
              <ActivityRow key={item.id} item={item} isOutgoing={true} />
            ))
          )}

          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
