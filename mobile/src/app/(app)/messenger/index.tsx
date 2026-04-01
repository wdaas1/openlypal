import React from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Edit2 } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import type { Conversation } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isOnline(lastMessageDate: string | null | undefined): boolean {
  if (!lastMessageDate) return false;
  const diffMs = Date.now() - new Date(lastMessageDate).getTime();
  return diffMs < 30 * 60 * 1000; // within 30 minutes
}

export default function MessengerScreen() {
  const router = useRouter();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/conversations'),
    refetchInterval: 10000,
  });

  const conversationList = conversations ?? [];
  const activeCount = conversationList.length;

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const online = isOnline(item.lastMessage?.createdAt);
    return (
      <Pressable
        testID={`conversation-${item.userId}`}
        onPress={() => router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: item.userId } })}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: item.unreadCount > 0 ? 'rgba(0,207,53,0.05)' : 'transparent',
          borderBottomWidth: 0.5,
          borderBottomColor: '#1a3a5c',
        }}
      >
        {/* Avatar with online indicator */}
        <View style={{ position: 'relative' }}>
          <UserAvatar uri={item.user.image} name={item.user.name} size={56} />
          {online ? (
            <View style={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 13,
              height: 13,
              borderRadius: 6.5,
              backgroundColor: '#00CF35',
              borderWidth: 2,
              borderColor: '#001935',
            }} />
          ) : null}
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{
              color: '#ffffff',
              fontSize: 15,
              fontWeight: item.unreadCount > 0 ? '700' : '600',
              flex: 1,
              marginRight: 8,
            }} numberOfLines={1}>
              {item.user.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.lastMessage ? (
                <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                  {formatTime(item.lastMessage.createdAt)}
                </Text>
              ) : null}
              {item.unreadCount > 0 ? (
                <View style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: '#00CF35',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#001935', fontSize: 10, fontWeight: '800' }}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text
            style={{
              color: item.unreadCount > 0 ? '#a0b4c8' : '#4a6fa5',
              fontSize: 13,
              lineHeight: 18,
              fontWeight: item.unreadCount > 0 ? '500' : '400',
            }}
            numberOfLines={1}
          >
            {item.lastMessage?.content ?? 'No messages yet'}
          </Text>
        </View>
      </Pressable>
    );
  };

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
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '800' }}>Chat</Text>
          <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 2 }}>
            {activeCount > 0 ? `${activeCount} active conversation${activeCount !== 1 ? 's' : ''}` : 'No conversations yet'}
          </Text>
        </View>
        <Pressable
          testID="compose-button"
          onPress={() => {}}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#0a2d50',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#1a3a5c',
          }}
        >
          <Edit2 size={16} color="#4a6fa5" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
        </View>
      ) : conversationList.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#0a2d50',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#1a3a5c',
          }}>
            <MessageSquare size={36} color="#4a6fa5" />
          </View>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>
            No messages yet
          </Text>
          <Text style={{ color: '#4a6fa5', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Visit someone's profile and tap "Message" to start a conversation
          </Text>
        </View>
      ) : (
        <ScrollView testID="conversations-scroll" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* ACTIVE section */}
          <View style={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ color: '#4a6fa5', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }}>ACTIVE</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: '#1a3a5c' }} />
          </View>

          {/* Quick avatar scroll for active/online */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 16 }}
          >
            {conversationList.map((conv) => {
              const online = isOnline(conv.lastMessage?.createdAt);
              return (
                <Pressable
                  key={conv.userId}
                  testID={`quick-avatar-${conv.userId}`}
                  onPress={() => router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: conv.userId } })}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={{ position: 'relative' }}>
                    <View style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      borderWidth: 2,
                      borderColor: online ? '#00CF35' : '#1a3a5c',
                      padding: 2,
                    }}>
                      <UserAvatar uri={conv.user.image} name={conv.user.name} size={50} />
                    </View>
                    {conv.unreadCount > 0 ? (
                      <View style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: '#00CF35',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: '#001935',
                      }}>
                        <Text style={{ color: '#001935', fontSize: 8, fontWeight: '800' }}>
                          {conv.unreadCount > 9 ? '9+' : String(conv.unreadCount)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: '#a0b4c8', fontSize: 11, fontWeight: '600', maxWidth: 56 }} numberOfLines={1}>
                    {conv.user.name.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Conversations list */}
          <View style={{ marginTop: 8 }}>
            {conversationList.map((item) => (
              <React.Fragment key={item.userId}>
                {renderConversationItem({ item })}
              </React.Fragment>
            ))}
          </View>

          {/* SUGGESTED section */}
          {conversationList.length > 0 ? (
            <View>
              <View style={{
                paddingHorizontal: 20,
                paddingTop: 24,
                paddingBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <Text style={{ color: '#4a6fa5', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }}>SUGGESTED</Text>
                <View style={{ flex: 1, height: 0.5, backgroundColor: '#1a3a5c' }} />
              </View>
              <Text style={{ color: '#4a6fa5', fontSize: 12, paddingHorizontal: 20, marginBottom: 12 }}>
                People you might know
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              >
                {conversationList.slice().reverse().map((conv) => (
                  <Pressable
                    key={`suggested-${conv.userId}`}
                    testID={`suggested-${conv.userId}`}
                    onPress={() => router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: conv.userId } })}
                    style={{
                      alignItems: 'center',
                      backgroundColor: '#0a2d50',
                      borderRadius: 16,
                      padding: 16,
                      width: 100,
                      borderWidth: 1,
                      borderColor: '#1a3a5c',
                      gap: 8,
                    }}
                  >
                    <UserAvatar uri={conv.user.image} name={conv.user.name} size={44} />
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
                      {conv.user.name.split(' ')[0]}
                    </Text>
                    <View style={{
                      backgroundColor: 'rgba(0,207,53,0.12)',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: 'rgba(0,207,53,0.25)',
                    }}>
                      <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700' }}>Message</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
