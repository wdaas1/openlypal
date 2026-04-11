import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowLeft, RotateCcw, MessageCircle, Clock, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { useSession } from '@/lib/auth/use-session';
import type { LiveMoment, LiveMomentMessage } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MessageItem({ message }: { message: LiveMomentMessage }) {
  if (message.type === 'reaction') {
    return (
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 10,
          marginHorizontal: 16,
          marginVertical: 2,
        }}
      >
        <Text style={{ fontSize: 28, marginBottom: 2 }}>{message.content}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
          {message.user?.name ?? 'Someone'} reacted
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 10,
      }}
      testID={`message-item-${message.id}`}
    >
      <UserAvatar
        uri={message.user?.image}
        name={message.user?.name ?? 'U'}
        size={34}
      />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: 0.2,
            }}
          >
            {message.user?.name ?? 'Unknown'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
            {formatRelativeTime(message.createdAt)}
          </Text>
        </View>
        {message.type === 'image' ? (
          <View
            style={{
              width: 160,
              height: 110,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.07)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Image</Text>
          </View>
        ) : (
          <Text
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

function RestartConfirmModal({
  visible,
  onCancel,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
      testID="restart-confirm-modal"
    >
      <BlurView
        intensity={20}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={{
            width: '100%',
            backgroundColor: '#001228',
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <BlurView intensity={10} tint="dark">
            <View style={{ padding: 28, alignItems: 'center' }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: 'rgba(0,207,53,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(0,207,53,0.25)',
                }}
              >
                <RotateCcw size={22} color="#00CF35" />
              </View>
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 18,
                  fontWeight: '800',
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Restart this session?
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 14,
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: 24,
                }}
              >
                A new session will be created with the same title and invited people.
              </Text>

              <View style={{ width: '100%', gap: 10 }}>
                <Pressable
                  testID="confirm-restart-button"
                  onPress={onConfirm}
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#00CF35',
                    height: 50,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#00CF35',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#001935" size="small" />
                  ) : (
                    <Text
                      style={{
                        color: '#001935',
                        fontSize: 15,
                        fontWeight: '800',
                        letterSpacing: 0.5,
                      }}
                    >
                      Restart
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  testID="cancel-restart-button"
                  onPress={onCancel}
                  disabled={isLoading}
                  style={{
                    height: 50,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.55)',
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: moment, isLoading: momentLoading } = useQuery<LiveMoment>({
    queryKey: ['live-moments', id],
    queryFn: () => liveMomentsApi.getOne(id),
    enabled: !!id,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<LiveMomentMessage[]>({
    queryKey: ['live-moments-messages', id],
    queryFn: () => liveMomentsApi.getMessages(id),
    enabled: !!id,
  });

  const { mutate: restartMutate, isPending: restartPending } = useMutation({
    mutationFn: () => liveMomentsApi.restart(id),
    onSuccess: (newMoment) => {
      queryClient.invalidateQueries({ queryKey: ['live-moments'] });
      queryClient.invalidateQueries({ queryKey: ['live-moments-archive'] });
      setShowConfirm(false);
      router.replace(`/(app)/live-moments/${newMoment.id}` as any);
    },
  });

  const isCreator = session?.user?.id === moment?.creatorId;
  const isLoading = momentLoading || messagesLoading;

  const handleRestartPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowConfirm(true);
  }, []);

  const handleConfirmRestart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    restartMutate();
  }, [restartMutate]);

  const msgList = messages ?? [];

  const renderMessage = useCallback(
    ({ item }: { item: LiveMomentMessage }) => <MessageItem message={item} />,
    []
  );

  const keyExtractor = useCallback((item: LiveMomentMessage) => item.id, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={['#000d1a', '#001025', '#000d1a']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
      </View>
    );
  }

  if (!moment) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={['#000d1a', '#001025', '#000d1a']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>Moment not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000d1a' }} testID="recap-screen">
      <LinearGradient
        colors={['#000d1a', '#001025', '#000d1a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            gap: 12,
          }}
        >
          <Pressable
            testID="back-button"
            onPress={() => router.back()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 18,
                fontWeight: '800',
                letterSpacing: 0.2,
              }}
              numberOfLines={1}
            >
              {moment.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 }}>
              {formatDate(moment.createdAt)}
            </Text>
          </View>

          {/* Ended badge */}
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Clock size={11} color="rgba(255,255,255,0.4)" />
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
              }}
            >
              ENDED
            </Text>
          </View>
        </View>

        {/* Stats bar */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 14,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <BlurView intensity={12} tint="dark">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 0,
              }}
            >
              {/* Creator */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <User size={13} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' }}>
                  {moment.creator?.name ?? 'Unknown'}
                </Text>
              </View>

              {/* Divider */}
              <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12 }} />

              {/* Message count */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <MessageCircle size={13} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' }}>
                  {msgList.length} {msgList.length === 1 ? 'message' : 'messages'}
                </Text>
              </View>

              {/* Divider */}
              <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12 }} />

              {/* Duration */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Clock size={13} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' }}>
                  {moment.expiresAfter}h
                </Text>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Section label */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 2,
            marginHorizontal: 20,
            marginBottom: 8,
          }}
        >
          MESSAGES
        </Text>

        {/* Message list */}
        <FlatList
          testID="messages-list"
          data={msgList}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: isCreator ? 110 : 32,
            paddingTop: 4,
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 40 }}>
              <MessageCircle size={40} color="rgba(255,255,255,0.12)" />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 15,
                  textAlign: 'center',
                  marginTop: 14,
                  lineHeight: 22,
                }}
              >
                No messages were sent during this session.
              </Text>
            </View>
          }
        />

        {/* Restart button for creator */}
        {isCreator ? (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              paddingBottom: 24,
              paddingTop: 12,
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <Pressable
              testID="restart-session-button"
              onPress={handleRestartPress}
              style={{
                backgroundColor: '#00CF35',
                height: 54,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                shadowColor: '#00CF35',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 10,
              }}
            >
              <RotateCcw size={18} color="#001935" />
              <Text
                style={{
                  color: '#001935',
                  fontSize: 16,
                  fontWeight: '800',
                  letterSpacing: 0.4,
                }}
              >
                Restart Session
              </Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      <RestartConfirmModal
        visible={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmRestart}
        isLoading={restartPending}
      />
    </View>
  );
}
