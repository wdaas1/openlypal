import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import type { Message, Conversation } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { useSession } from '@/lib/auth/use-session';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { data: sessionData } = useSession();
  const currentUserId = sessionData?.user?.id;
  const insets = useSafeAreaInsets();
  // Tab bar is 68px tall, floating bottom = max(insets.bottom, 12) + 16px margin
  const tabBarHeight = 68;
  const tabBarBottom = Math.max(insets.bottom, 12);
  const inputBottomPadding = tabBarBottom + tabBarHeight + 8;

  // Get conversation meta (for the user name/avatar)
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/api/conversations'),
  });

  const otherUser = conversations?.find((c) => c.userId === userId)?.user;

  // Load messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', userId],
    queryFn: () => api.get<Message[]>(`/api/conversations/${userId}`),
    enabled: !!userId,
  });

  // Mark as read when screen opens
  useEffect(() => {
    if (userId) {
      api.patch(`/api/conversations/${userId}/read`, {});
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [userId, queryClient]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
    }, 2000);
    return () => clearInterval(interval);
  }, [userId, queryClient]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages?.length]);

  // Track previous message count for incoming message detection
  const prevMessageCountRef = useRef<number>(0);

  // Haptic feedback when new messages arrive from other user
  useEffect(() => {
    if (!messages || !currentUserId) return;
    const count = messages.length;
    if (count > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.senderId !== currentUserId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    prevMessageCountRef.current = count;
  }, [messages, currentUserId]);

  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async (content: string) => {
      const result = await api.post(`/api/conversations/${userId}`, { content });
      if (!result) throw new Error('Failed to send message');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText('');
    sendMessage(trimmed, {
      onError: () => {
        setText(trimmed);
      },
    });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === currentUserId;
    const prevItem = index > 0 ? (messages ?? [])[index - 1] : null;
    const showAvatar = !isMe && prevItem?.senderId !== item.senderId;
    const showTime = !prevItem || (
      new Date(item.createdAt).getTime() - new Date(prevItem.createdAt).getTime() > 5 * 60 * 1000
    );

    return (
      <View key={item.id}>
        {showTime ? (
          <Text style={{
            textAlign: 'center',
            color: '#4a6fa5',
            fontSize: 11,
            marginVertical: 10,
            fontWeight: '500',
          }}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </Text>
        ) : null}

        <View style={{
          flexDirection: 'row',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          marginHorizontal: 16,
          marginBottom: 4,
          alignItems: 'flex-end',
        }}>
          {!isMe ? (
            <View style={{ width: 28, marginRight: 8 }}>
              {showAvatar ? (
                <UserAvatar uri={item.sender.image} name={item.sender.name} size={28} />
              ) : null}
            </View>
          ) : null}

          <View style={{
            maxWidth: '72%',
            backgroundColor: isMe ? '#00CF35' : '#0a2d50',
            borderRadius: 18,
            borderBottomRightRadius: isMe ? 4 : 18,
            borderBottomLeftRadius: isMe ? 18 : 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}>
            <Text style={{
              color: isMe ? '#001935' : '#ffffff',
              fontSize: 15,
              lineHeight: 20,
            }}>
              {item.content}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView testID="chat-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#1a3a5c',
      }}>
        <Pressable
          testID="back-button"
          onPress={handleBack}
          style={{ marginRight: 12, padding: 4 }}
        >
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>

        {otherUser ? (
          <>
            <UserAvatar uri={otherUser.image} name={otherUser.name} size={36} />
            <View style={{ marginLeft: 10 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                {otherUser.name}
              </Text>
              {otherUser.username ? (
                <Text style={{ color: '#4a6fa5', fontSize: 12 }}>@{otherUser.username}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Chat</Text>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={inputBottomPadding}
      >
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator testID="loading-indicator" color="#00CF35" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            testID="messages-list"
            data={messages ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Text style={{ color: '#4a6fa5', fontSize: 15, textAlign: 'center' }}>
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: inputBottomPadding,
          borderTopWidth: 0.5,
          borderTopColor: '#1a3a5c',
          gap: 10,
        }}>
          <TextInput
            testID="message-input"
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="#4a6fa5"
            multiline
            style={{
              flex: 1,
              backgroundColor: '#0a2d50',
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: '#ffffff',
              fontSize: 15,
              maxHeight: 120,
              lineHeight: 20,
            }}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            testID="send-button"
            onPress={handleSend}
            disabled={!text.trim() || isSending}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: text.trim() ? '#00CF35' : '#0a2d50',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSending ? (
              <ActivityIndicator color="#001935" size="small" />
            ) : (
              <Send size={18} color={text.trim() ? '#001935' : '#4a6fa5'} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
