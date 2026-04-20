import React from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import type { User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { useTheme } from '@/lib/theme';

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function AllRecommendedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['explore', 'users', 'all'],
    queryFn: async () => {
      const result = await api.get<User[]>('/api/explore/recommended');
      return result ?? [];
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/api/users/${userId}/follow`);
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ['explore', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      console.error('Follow/unfollow failed:', error);
    },
  });

  return (
    <SafeAreaView testID="all-recommended-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.card,
      }}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{ padding: 6, marginRight: 10, borderRadius: 20, backgroundColor: theme.card }}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20 }}>Recommended Blogs</Text>
          {users && users.length > 0 ? (
            <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>
              {users.length} people to follow
            </Text>
          ) : null}
        </View>
        <Users size={20} color="#00CF35" />
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View testID="loading-indicator" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" size="large" />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#FF4E6A', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
            Failed to load recommendations
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#00CF35', borderRadius: 20 }}
          >
            <Text style={{ color: '#001935', fontWeight: '700', fontSize: 14 }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="all-recommended-list"
          data={users ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 64 }}>
              <Users size={48} color={theme.border} />
              <Text style={{ color: theme.subtext, fontSize: 15, fontWeight: '600', marginTop: 16 }}>
                No recommendations yet
              </Text>
            </View>
          )}
          renderItem={({ item: user }) => (
            <Pressable
              testID={`recommended-user-row-${user.id}`}
              onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: user.id } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.border,
                borderTopWidth: 2,
                borderTopColor: 'rgba(0,207,53,0.3)',
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
            >
              {/* Avatar */}
              <UserAvatar uri={user.image} name={user.name} size={52} />

              {/* User info */}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                  {user.name}
                </Text>
                {user.username ? (
                  <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
                    @{user.username}
                  </Text>
                ) : null}
                {user.followerCount !== undefined ? (
                  <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 3 }}>
                    {formatCount(user.followerCount)} followers
                  </Text>
                ) : null}
                {user.bio ? (
                  <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                    {user.bio}
                  </Text>
                ) : null}
              </View>

              {/* Follow button */}
              <Pressable
                testID={`follow-user-${user.id}`}
                disabled={followMutation.isPending}
                onPress={(e) => {
                  e.stopPropagation();
                  followMutation.mutate(user.id);
                }}
                style={user.isFollowing ? {
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginLeft: 12,
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: '#00CF35',
                  minWidth: 84,
                  alignItems: 'center',
                } : {
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginLeft: 12,
                  backgroundColor: '#00CF35',
                  minWidth: 84,
                  alignItems: 'center',
                }}
              >
                <Text style={user.isFollowing ? {
                  fontSize: 13, fontWeight: '700', color: '#00CF35',
                } : {
                  fontSize: 13, fontWeight: '700', color: '#001935',
                }}>
                  {user.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
