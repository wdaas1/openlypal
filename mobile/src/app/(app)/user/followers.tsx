import React from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import { UserAvatar } from '@/components/UserAvatar';

type UserSummary = {
  id: string;
  name: string;
  username?: string | null;
  image?: string | null;
};

export default function FollowersScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'followers' | 'following' }>();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const isFollowers = type === 'followers';

  const { data: users, isLoading } = useQuery({
    queryKey: [type, id],
    queryFn: () => api.get<UserSummary[]>(`/api/users/${id}/${type}`),
    enabled: !!id && !!type,
  });

  return (
    <SafeAreaView testID="followers-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Pressable testID="back-button" onPress={handleBack} className="p-1">
          <ArrowLeft size={22} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white font-bold text-lg">{isFollowers ? 'Followers' : 'Following'}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator testID="loading-indicator" color="#00CF35" style={{ marginTop: 40 }} />
      ) : (users ?? []).length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: '#4a6fa5', fontSize: 15 }}>
            {isFollowers ? 'No followers yet' : 'Not following anyone yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="users-list"
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              testID={`user-item-${item.id}`}
              onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: item.id } })}
              className="flex-row items-center px-4 py-3 gap-3"
              style={{ borderBottomColor: '#0a2d50', borderBottomWidth: 0.5 }}
            >
              <UserAvatar uri={item.image} name={item.name} size={44} />
              <View className="flex-1">
                <Text className="text-white font-semibold text-sm">{item.name}</Text>
                {item.username ? (
                  <Text style={{ color: '#4a6fa5', fontSize: 13 }}>@{item.username}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
