import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Search, Lock } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { api } from '@/lib/api/api';
import type { Conversation, User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { useTheme } from '@/lib/theme';

function isEncryptedContent(content: string): boolean {
  return content.includes('.') && content.length > 60;
}

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
  return diffMs < 30 * 60 * 1000;
}

function OnlineDot() {
  const theme = useTheme();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 1,
          right: 1,
          width: 13,
          height: 13,
          borderRadius: 6.5,
          backgroundColor: '#00CF35',
          borderWidth: 2,
          borderColor: theme.bg,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function MessengerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [searchFilter, setSearchFilter] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/conversations'),
    refetchInterval: 10000,
  });

  const { data: suggestedUsers } = useQuery({
    queryKey: ['explore', 'users'],
    queryFn: async () => {
      const result = await api.get<User[]>('/api/explore/recommended');
      return result ?? [];
    },
  });

  const conversationList = conversations ?? [];

  const filteredConversations = searchFilter.trim()
    ? conversationList.filter((conv) =>
        conv.user.name.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : conversationList;

  const onlineConversations = conversationList.filter((conv) =>
    isOnline(conv.lastMessage?.createdAt)
  );

  const onlineCount = onlineConversations.length;

  const headerSubtitle =
    onlineCount > 0
      ? `${onlineCount} online`
      : conversationList.length > 0
      ? `${conversationList.length} conversation${conversationList.length !== 1 ? 's' : ''}`
      : 'No conversations yet';

  const renderConversationItem = (item: Conversation) => {
    const online = isOnline(item.lastMessage?.createdAt);
    return (
      <Pressable
        key={item.userId}
        testID={`conversation-${item.userId}`}
        onPress={() =>
          router.push({
            pathname: '/(app)/messenger/[userId]' as any,
            params: { userId: item.userId },
          })
        }
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: item.unreadCount > 0
            ? 'rgba(0,207,53,0.04)'
            : theme.card,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 8,
          borderWidth: 0.5,
          borderColor: item.unreadCount > 0
            ? 'rgba(0,207,53,0.25)'
            : theme.border,
        }}
      >
        {/* Avatar with online indicator */}
        <View style={{ position: 'relative' }}>
          <UserAvatar uri={item.user.image} name={item.user.name} size={56} />
          {online ? <OnlineDot /> : null}
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 15,
                fontWeight: item.unreadCount > 0 ? '700' : '600',
                flex: 1,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              {item.user.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.lastMessage && isEncryptedContent(item.lastMessage.content) ? (
                <Lock size={11} color="#00CF35" />
              ) : null}
              {item.lastMessage ? (
                <Text style={{ color: theme.subtext, fontSize: 11 }}>
                  {formatTime(item.lastMessage.createdAt)}
                </Text>
              ) : null}
              {item.unreadCount > 0 ? (
                <View
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#00CF35',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: '#001935', fontSize: 10, fontWeight: '800' }}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text
            style={{
              color: theme.subtext,
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
    <SafeAreaView
      testID="messenger-screen"
      style={{ flex: 1, backgroundColor: theme.bg }}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.border,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              shadowColor: '#00CF35',
              shadowOpacity: 0.2,
              shadowRadius: 5,
            }}
          >
            <MessageSquare size={20} color="#00CF35" />
          </View>
          <View>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>Chat</Text>
            <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
              {headerSubtitle}
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
        </View>
      ) : conversationList.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: theme.card,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <MessageSquare size={36} color={theme.subtext} />
          </View>
          <Text
            style={{
              color: theme.text,
              fontSize: 20,
              fontWeight: '800',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            No messages yet
          </Text>
          <Text
            style={{
              color: theme.subtext,
              fontSize: 14,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 28,
            }}
          >
            Discover people to connect with and start a conversation
          </Text>
          <Pressable
            testID="empty-state-explore-button"
            onPress={() => router.push('/(app)/explore' as any)}
            style={{
              backgroundColor: '#00CF35',
              borderRadius: 16,
              paddingVertical: 14,
              width: 200,
              alignSelf: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#001935', fontSize: 15, fontWeight: '800' }}>
              Start a conversation
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView testID="conversations-scroll" contentContainerStyle={{ paddingBottom: 100 }}>

          {/* Search bar */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: searchFocused ? 'rgba(0,207,53,0.4)' : theme.border,
                gap: 8,
              }}
            >
              <Search size={16} color={theme.subtext} />
              <TextInput
                testID="messenger-search-input"
                value={searchFilter}
                onChangeText={setSearchFilter}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search conversations..."
                placeholderTextColor={theme.subtext}
                style={{
                  flex: 1,
                  color: theme.text,
                  fontSize: 14,
                  padding: 0,
                }}
              />
            </View>
          </View>

          {/* ACTIVE section — only show if there are online users */}
          {onlineConversations.length > 0 ? (
            <View>
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 20,
                  paddingBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: theme.subtext,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                  }}
                >
                  ACTIVE
                </Text>
                <View style={{ flex: 1, height: 0.5, backgroundColor: theme.border }} />
              </View>

              {/* Quick avatar scroll — online only */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  gap: 16,
                }}
              >
                {onlineConversations.map((conv) => (
                  <Pressable
                    key={conv.userId}
                    testID={`quick-avatar-${conv.userId}`}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/messenger/[userId]' as any,
                        params: { userId: conv.userId },
                      })
                    }
                    style={{ alignItems: 'center', gap: 6 }}
                  >
                    <View style={{ position: 'relative' }}>
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: '#00CF35',
                          padding: 2,
                        }}
                      >
                        <UserAvatar
                          uri={conv.user.image}
                          name={conv.user.name}
                          size={50}
                        />
                      </View>
                      {conv.unreadCount > 0 ? (
                        <View
                          style={{
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
                            borderColor: theme.bg,
                          }}
                        >
                          <Text
                            style={{ color: '#001935', fontSize: 8, fontWeight: '800' }}
                          >
                            {conv.unreadCount > 9 ? '9+' : String(conv.unreadCount)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: theme.subtext,
                        fontSize: 11,
                        fontWeight: '600',
                        maxWidth: 56,
                      }}
                      numberOfLines={1}
                    >
                      {conv.user.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Conversations list */}
          <View style={{ marginTop: 12 }}>
            {filteredConversations.map((item) => renderConversationItem(item))}
          </View>

          {/* SUGGESTED section — from explore API */}
          {suggestedUsers && suggestedUsers.length > 0 ? (
            <View>
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 24,
                  paddingBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: theme.subtext,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                  }}
                >
                  SUGGESTED
                </Text>
                <View style={{ flex: 1, height: 0.5, backgroundColor: theme.border }} />
              </View>
              <Text
                style={{ color: theme.subtext, fontSize: 12, paddingHorizontal: 20, marginBottom: 12 }}
              >
                People you might know
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              >
                {suggestedUsers.map((user) => (
                  <Pressable
                    key={`suggested-${user.id}`}
                    testID={`suggested-${user.id}`}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/messenger/[userId]' as any,
                        params: { userId: user.id },
                      })
                    }
                    style={{
                      alignItems: 'center',
                      backgroundColor: theme.card,
                      borderRadius: 16,
                      padding: 16,
                      width: 100,
                      borderWidth: 1,
                      borderColor: theme.border,
                      gap: 8,
                    }}
                  >
                    <UserAvatar uri={user.image} name={user.name} size={44} />
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: 12,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                      numberOfLines={1}
                    >
                      {user.name.split(' ')[0]}
                    </Text>
                    <View
                      style={{
                        backgroundColor: 'rgba(0,207,53,0.12)',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderWidth: 1,
                        borderColor: 'rgba(0,207,53,0.25)',
                      }}
                    >
                      <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700' }}>
                        Message
                      </Text>
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
