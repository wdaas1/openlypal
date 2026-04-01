import React from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api/api';
import type { Conversation } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';

export default function MessengerScreen() {
  const router = useRouter();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/conversations'),
  });

  return (
    <SafeAreaView testID="messenger-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: '#1a3a5c',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800', flex: 1 }}>Messages</Text>
        <MessageCircle size={22} color="#4a6fa5" />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
        </View>
      ) : (conversations ?? []).length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#0a2d50',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <MessageCircle size={34} color="#4a6fa5" />
          </View>
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            No messages yet
          </Text>
          <Text style={{ color: '#4a6fa5', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Visit someone's profile and tap "Message" to start a conversation
          </Text>
        </View>
      ) : (
        <FlatList
          testID="conversations-list"
          data={conversations ?? []}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <Pressable
              testID={`conversation-${item.userId}`}
              onPress={() => router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: item.userId } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: '#1a3a5c',
                backgroundColor: item.unreadCount > 0 ? '#071d35' : 'transparent',
              }}
            >
              <View style={{ position: 'relative' }}>
                <UserAvatar uri={item.user.image} name={item.user.name} size={52} />
                {item.unreadCount > 0 ? (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#00CF35',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                    borderWidth: 2,
                    borderColor: '#001935',
                  }}>
                    <Text style={{ color: '#001935', fontSize: 10, fontWeight: '800' }}>
                      {item.unreadCount > 9 ? '9+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: item.unreadCount > 0 ? '700' : '600',
                    flex: 1,
                    marginRight: 8,
                  }} numberOfLines={1}>
                    {item.user.name}
                  </Text>
                  {item.lastMessage ? (
                    <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                      {formatDistanceToNow(new Date(item.lastMessage.createdAt), { addSuffix: false })}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    color: item.unreadCount > 0 ? '#a0b4c8' : '#4a6fa5',
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                  numberOfLines={1}
                >
                  {item.lastMessage?.content ?? 'No messages yet'}
                </Text>
              </View>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
