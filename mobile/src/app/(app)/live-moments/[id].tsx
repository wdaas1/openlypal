import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { ArrowLeft, Eye, Send, StopCircle, FlipHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { useSession } from '@/lib/auth/use-session';
import type { LiveMomentMessage } from '@/lib/types';

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

const QUICK_REACTIONS = ['🔥', '❤️', '👀', '⚡'];

function LiveBadge() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      false
    );
  }, [scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,59,48,0.18)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,59,48,0.4)',
      }}
    >
      <Animated.View
        style={[
          dotStyle,
          {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: '#FF3B30',
            shadowColor: '#FF3B30',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 5,
            elevation: 5,
          },
        ]}
      />
      <Text
        style={{
          color: '#FF3B30',
          fontSize: 12,
          fontWeight: '900',
          letterSpacing: 2.5,
        }}
      >
        LIVE
      </Text>
    </View>
  );
}

function FloatingReaction({ emoji, id }: { emoji: string; id: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(-120, { duration: 2000 });
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0, { duration: 1800 })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    position: 'absolute',
    bottom: 0,
    right: 16 + (id % 4) * 18,
  }));

  return (
    <Animated.Text style={[style, { fontSize: 26 }]}>{emoji}</Animated.Text>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: LiveMomentMessage;
  isOwn: boolean;
}) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(14).stiffness(120)}
      style={{
        flexDirection: 'row',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        marginBottom: 8,
        paddingHorizontal: 16,
      }}
    >
      {!isOwn && (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            alignSelf: 'flex-end',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)' }}>
            {(message.user?.name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ maxWidth: '72%' }}>
        {!isOwn && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11,
              fontWeight: '700',
              marginBottom: 3,
              marginLeft: 4,
            }}
          >
            {message.user?.name ?? 'Unknown'}
          </Text>
        )}
        {message.type === 'reaction' ? (
          <Text style={{ fontSize: 24 }}>{message.content}</Text>
        ) : (
          <View
            style={{
              backgroundColor: isOwn ? '#00CF35' : 'rgba(255,255,255,0.1)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 18,
              borderBottomRightRadius: isOwn ? 4 : 18,
              borderBottomLeftRadius: isOwn ? 18 : 4,
            }}
          >
            <Text
              style={{
                color: isOwn ? '#001935' : '#ffffff',
                fontSize: 14,
                fontWeight: '500',
                lineHeight: 20,
              }}
            >
              {message.content}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function LiveMomentRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [messageText, setMessageText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<
    { emoji: string; id: number }[]
  >([]);
  const reactionCounter = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  // 'front' | 'back' — tracked for when camera is wired up
  const [facingFront, setFacingFront] = useState(true);

  // Fetch moment
  const { data: moment, isLoading } = useQuery({
    queryKey: ['live-moment', id],
    queryFn: () => liveMomentsApi.getOne(id),
    refetchInterval: 3000,
    enabled: Boolean(id),
  });

  // Fetch messages
  const { data: messages } = useQuery({
    queryKey: ['live-moment-messages', id],
    queryFn: () => liveMomentsApi.getMessages(id),
    refetchInterval: 3000,
    enabled: Boolean(id),
  });

  // Join on mount
  const joinMutation = useMutation({
    mutationFn: () => liveMomentsApi.join(id),
  });

  useEffect(() => {
    if (id) {
      joinMutation.mutate();
    }
    return () => {
      if (id) {
        liveMomentsApi.leave(id);
      }
    };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!moment?.expiresAt) return;
    const update = () => setTimeRemaining(getTimeRemaining(moment.expiresAt));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [moment?.expiresAt]);

  // Auto-scroll
  useEffect(() => {
    if ((messages ?? []).length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      liveMomentsApi.sendMessage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-moment-messages', id] });
    },
  });
  const sendMessage = sendMessageMutation.mutate;

  const endMomentMutation = useMutation({
    mutationFn: () => liveMomentsApi.end(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-moments'] });
      queryClient.invalidateQueries({ queryKey: ['live-moment', id] });
    },
  });
  const endMoment = endMomentMutation.mutate;

  const handleSend = useCallback(() => {
    const text = messageText.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage({ content: text, type: 'text' });
    setMessageText('');
  }, [messageText, sendMessage]);

  const handleReaction = useCallback(
    (emoji: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newId = ++reactionCounter.current;
      setFloatingReactions((prev: { emoji: string; id: number }[]) => [
        ...prev,
        { emoji, id: newId },
      ]);
      setTimeout(() => {
        setFloatingReactions((prev: { emoji: string; id: number }[]) =>
          prev.filter((r) => r.id !== newId)
        );
      }, 2200);
      sendMessage({ content: emoji, type: 'reaction' });
    },
    [sendMessage]
  );

  const handleEnd = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    endMoment();
  }, [endMoment]);

  const handleFlipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacingFront((prev) => !prev);
  }, []);

  const isCreator = moment?.creatorId === session?.user?.id;
  const isEnded = moment?.status === 'ended' || timeRemaining === 'Ended';

  if (isLoading || !moment) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000d1a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
      </View>
    );
  }

  // Shared overlay UI rendered on top of both creator and viewer backgrounds
  const overlayContent = (
    <SafeAreaView
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 10,
        }}
      >
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '800',
              letterSpacing: 0.2,
            }}
            numberOfLines={1}
          >
            {moment.title}
          </Text>
          {!isCreator ? (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {moment.creator?.name ?? 'Unknown'}'s moment
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Viewer count */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Eye size={14} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' }}>
              {moment.viewerCount ?? 0}
            </Text>
          </View>

          {isEnded ? (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800' }}>
                ENDED
              </Text>
            </View>
          ) : (
            <LiveBadge />
          )}

          {/* Flip camera button — creator only */}
          {isCreator ? (
            <Pressable
              testID="flip-camera-button"
              onPress={handleFlipCamera}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FlipHorizontal size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Viewer "watching live" indicator */}
      {!isCreator && !isEnded ? (
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>
            📡 Watching live...
          </Text>
        </View>
      ) : null}

      {/* Time remaining */}
      {!isEnded && timeRemaining ? (
        <Text
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          {timeRemaining}
        </Text>
      ) : null}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        testID="messages-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {(messages ?? []).length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
              No messages yet. Say something!
            </Text>
          </View>
        ) : null}
        {(messages ?? []).map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === session?.user?.id}
          />
        ))}
      </ScrollView>

      {/* Floating reactions layer */}
      <View
        style={{ position: 'absolute', bottom: 100, right: 0, width: 120, height: 160 }}
        pointerEvents="none"
      >
        {floatingReactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} id={r.id} />
        ))}
      </View>

      {/* Ended overlay */}
      {isEnded ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,13,26,0.85)',
          }}
        >
          <Text style={{ fontSize: 48 }}>📡</Text>
          <Text
            style={{
              color: '#ffffff',
              fontSize: 22,
              fontWeight: '900',
              marginTop: 16,
              letterSpacing: 0.3,
            }}
          >
            This moment has ended
          </Text>
          <Pressable
            testID="leave-ended-button"
            onPress={() => router.back()}
            style={{
              marginTop: 24,
              backgroundColor: 'rgba(255,255,255,0.1)',
              paddingHorizontal: 28,
              paddingVertical: 12,
              borderRadius: 30,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
              Go Back
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Bottom input area */}
      {!isEnded ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <BlurView intensity={40} tint="dark">
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.07)',
                paddingTop: 10,
                paddingHorizontal: 16,
                paddingBottom: 10,
              }}
            >
              {/* Quick reactions */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable
                    testID={`reaction-${emoji}`}
                    key={emoji}
                    onPress={() => handleReaction(emoji)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </Pressable>
                ))}

                {isCreator ? (
                  <Pressable
                    testID="end-moment-button"
                    onPress={handleEnd}
                    disabled={endMomentMutation.isPending}
                    style={{
                      marginLeft: 'auto',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(255,59,48,0.15)',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255,59,48,0.3)',
                    }}
                  >
                    <StopCircle size={14} color="#FF3B30" />
                    <Text
                      style={{
                        color: '#FF3B30',
                        fontSize: 12,
                        fontWeight: '800',
                        letterSpacing: 0.5,
                      }}
                    >
                      END
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Text input row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <TextInput
                    testID="message-input"
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder="Say something..."
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    style={{ color: '#ffffff', fontSize: 15 }}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    multiline={false}
                  />
                </View>

                <Pressable
                  testID="send-message-button"
                  onPress={handleSend}
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor:
                      messageText.trim() ? '#00CF35' : 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: messageText.trim() ? '#00CF35' : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 10,
                    elevation: messageText.trim() ? 6 : 0,
                  }}
                >
                  <Send
                    size={16}
                    color={messageText.trim() ? '#001935' : 'rgba(255,255,255,0.3)'}
                  />
                </Pressable>
              </View>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );

  // Creator view: dark camera-style full-screen background with gradient overlay and UI on top
  if (isCreator) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Simulated camera background — subtle noise/vignette feel */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: facingFront ? '#0a0a12' : '#0a120a',
          }}
        />
        {/* Gradient overlay for text readability (top and bottom) */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {overlayContent}
      </View>
    );
  }

  // Viewer view: dark background with gradient
  return (
    <View style={{ flex: 1, backgroundColor: '#000d1a' }}>
      <LinearGradient
        colors={['#000d1a', '#001025', '#000d1a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {overlayContent}
    </View>
  );
}
