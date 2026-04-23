import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
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
  FadeIn,
} from 'react-native-reanimated';
import { ArrowLeft, Eye, Send, StopCircle, FlipHorizontal, Camera, Pin, Megaphone } from 'lucide-react-native';
import Purchases from 'react-native-purchases';
import * as Burnt from 'burnt';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, Camera as ExpoCamera } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { useSession } from '@/lib/auth/use-session';
import { getAccessToken } from '@/lib/auth/auth-client';
import type { LiveMomentMessage } from '@/lib/types';
import { showMediaPicker } from '@/lib/file-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_AREA_HEIGHT = 230;

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

function OfflineBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: 'rgba(255,255,255,0.3)',
        }}
      />
      <Text
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 12,
          fontWeight: '900',
          letterSpacing: 2.5,
        }}
      >
        OFFLINE
      </Text>
    </View>
  );
}

function GoLivePulseButton({ onPress, isPending }: { onPress: () => void; isPending: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 700 }),
        withTiming(1, { duration: 700 })
      ),
      -1,
      false
    );
  }, [scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Pressable
        testID="go-live-button"
        onPress={onPress}
        disabled={isPending}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#00CF35',
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 24,
          shadowColor: '#00CF35',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          elevation: 10,
        }}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#001935" />
        ) : (
          <Text
            style={{
              color: '#001935',
              fontSize: 14,
              fontWeight: '900',
              letterSpacing: 1.5,
            }}
          >
            GO LIVE
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function FloatingReaction({ emoji, id }: { emoji: string; id: number }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    // Random horizontal drift
    const drift = ((id * 37 + 13) % 60) - 30;
    translateY.value = withTiming(-180, { duration: 2200 });
    translateX.value = withTiming(drift, { duration: 2200 });
    scale.value = withSequence(
      withTiming(1.3, { duration: 300 }),
      withTiming(1, { duration: 200 })
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: 1400 }),
      withTiming(0, { duration: 500 })
    );
  }, []);

  // Spread across bottom third of screen
  const baseRight = 20 + (id % 5) * ((SCREEN_WIDTH - 100) / 5);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    position: 'absolute',
    bottom: 0,
    right: baseRight,
  }));

  return (
    <Animated.Text style={[style, { fontSize: 28 }]}>{emoji}</Animated.Text>
  );
}

function VideoMessage({ uri, isOwn }: { uri: string; isOwn: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <View
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isOwn ? 'rgba(0,207,53,0.3)' : 'rgba(255,255,255,0.1)',
        width: 220,
        height: 160,
      }}
    >
      <VideoView
        player={player}
        style={{ width: 220, height: 160 }}
        allowsFullscreen
        allowsPictureInPicture={false}
        contentFit="cover"
      />
    </View>
  );
}

function MessageBubble({
  message,
  isOwn,
  onLongPress,
  isPinned,
}: {
  message: LiveMomentMessage;
  isOwn: boolean;
  onLongPress?: () => void;
  isPinned?: boolean;
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
      <Pressable onLongPress={onLongPress} style={{ maxWidth: '72%' }}>
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
        ) : message.type === 'image' && message.contentUrl ? (
          <View
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              borderWidth: isPinned ? 2 : 1,
              borderColor: isPinned ? 'rgba(0,207,53,0.6)' : (isOwn ? 'rgba(0,207,53,0.3)' : 'rgba(255,255,255,0.1)'),
            }}
          >
            <Image
              source={{ uri: message.contentUrl }}
              style={{ width: 200, height: 150, borderRadius: 12 }}
              resizeMode="cover"
            />
          </View>
        ) : message.type === 'video' && message.contentUrl ? (
          <VideoMessage uri={message.contentUrl} isOwn={isOwn} />
        ) : (
          <View
            style={{
              backgroundColor: isOwn ? '#00CF35' : 'rgba(255,255,255,0.13)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 18,
              borderBottomRightRadius: isOwn ? 4 : 18,
              borderBottomLeftRadius: isOwn ? 18 : 4,
              borderWidth: isPinned ? 1 : 0,
              borderColor: 'rgba(0,207,53,0.5)',
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
      </Pressable>
    </Animated.View>
  );
}

function SystemMessageBubble({ content }: { content: string }) {
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={{ alignItems: 'center', marginVertical: 5, paddingHorizontal: 16 }}
    >
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.07)',
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' }}>
          {content}
        </Text>
      </View>
    </Animated.View>
  );
}

function PinnedMessageView({
  message,
  onUnpin,
  isCreator,
}: {
  message: LiveMomentMessage;
  onUnpin: () => void;
  isCreator: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,207,53,0.15)',
        backgroundColor: 'rgba(0,207,53,0.06)',
      }}
    >
      <Pin size={12} color="rgba(0,207,53,0.8)" />
      <Text
        style={{
          flex: 1,
          color: 'rgba(255,255,255,0.6)',
          fontSize: 12,
          fontWeight: '600',
        }}
        numberOfLines={1}
      >
        {message.type === 'image' ? '📷 Photo' : message.type === 'video' ? '🎥 Video' : message.content}
      </Text>
      {isCreator ? (
        <Pressable onPress={onUnpin}>
          <Text style={{ color: 'rgba(0,207,53,0.7)', fontSize: 11, fontWeight: '700' }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LiveContentArea({
  media,
  isLive,
}: {
  media: LiveMomentMessage | null;
  isLive: boolean;
}) {
  const pulse = useSharedValue(0.6);
  const videoUri = media?.type === 'video' && media.contentUrl ? media.contentUrl : '';
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0.6, { duration: 1800 })
      ),
      -1,
      false
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (media?.type === 'image' && media.contentUrl) {
    return (
      <View style={{ flex: 1 }}>
        <Image
          source={{ uri: media.contentUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.85)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
    );
  }

  if (media?.type === 'video' && media.contentUrl) {
    return (
      <View style={{ flex: 1 }}>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="cover"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.85)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
    );
  }

  // Placeholder
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient
        colors={['#001530', '#000d1a', '#0a0510']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Subtle animated circles */}
      <Animated.View
        style={[
          pulseStyle,
          {
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 1,
            borderColor: 'rgba(0,207,53,0.15)',
            position: 'absolute',
          },
        ]}
      />
      <Animated.View
        style={[
          pulseStyle,
          {
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 1,
            borderColor: 'rgba(0,207,53,0.25)',
            position: 'absolute',
          },
        ]}
      />
      <Text style={{ fontSize: 36, marginBottom: 10 }}>📡</Text>
      <Text
        style={{
          color: isLive ? 'rgba(0,207,53,0.7)' : 'rgba(255,255,255,0.3)',
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 1,
        }}
      >
        {isLive ? 'BROADCASTING' : 'WAITING FOR HOST'}
      </Text>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
      />
    </View>
  );
}

function useBoostCountdown(boostExpiresAt: string | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!boostExpiresAt) { setLabel(null); return; }

    const compute = () => {
      const diff = new Date(boostExpiresAt).getTime() - Date.now();
      if (diff <= 0) { setLabel(null); return; }
      const mins = Math.ceil(diff / 60000);
      setLabel(`Boost ends in ${mins}m`);
    };

    compute();
    const id = setInterval(compute, 30000);
    return () => clearInterval(id);
  }, [boostExpiresAt]);

  return label;
}

function useSimulatedViewerCount(realCount: number, isBoosted: boolean): number {
  const [offset, setOffset] = useState<number>(0);
  const prevBoosted = useRef(false);

  useEffect(() => {
    if (!isBoosted) {
      setOffset(0);
      prevBoosted.current = false;
      return;
    }
    if (!prevBoosted.current) {
      prevBoosted.current = true;
      setOffset(Math.floor(Math.random() * 21) + 10);
    }
    const id = setInterval(() => {
      setOffset((prev) => {
        if (prev >= 50) return prev;
        return prev + Math.floor(Math.random() * 3) + 1;
      });
    }, 10000);
    return () => clearInterval(id);
  }, [isBoosted]);

  return realCount + offset;
}

function ViewerCountDisplay({ count }: { count: number }) {
  const scale = useSharedValue(1);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      scale.value = withSequence(
        withTiming(1.5, { duration: 200 }),
        withTiming(1, { duration: 300 })
      );
    }
  }, [count, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
      <Eye size={14} color="rgba(255,255,255,0.5)" />
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>
        {count}
      </Text>
    </Animated.View>
  );
}

type SystemMsg = { id: string; content: string; createdAt: number; isSystem: true };

export default function LiveMomentScreen() {
  const { id: momentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleBack = () => {
    router.replace('/(app)/live-moments' as any);
  };
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [messageText, setMessageText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<
    { emoji: string; id: number }[]
  >([]);
  const reactionCounter = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [facingFront, setFacingFront] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string }[]>([]);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingSent = useRef<number>(0);
  const [streamToken, setStreamToken] = useState<string | null>(null);
  const [streamWsUrl, setStreamWsUrl] = useState<string | null>(null);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [systemMessages, setSystemMessages] = useState<SystemMsg[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<LiveMomentMessage | null>(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostPrice, setBoostPrice] = useState<string>('£9.99');
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const cameraPermissionRequested = useRef(false);
  const isFocused = useIsFocused();

  // Request camera + microphone permissions once on mount (creator only)
  useEffect(() => {
    if (cameraPermissionRequested.current) return;
    cameraPermissionRequested.current = true;

    const requestPerms = async () => {
      console.log('Requesting camera permission');
      // Use hook updater so cameraPermission state syncs after grant/deny
      const camResult = await requestCameraPermission();
      await ExpoCamera.requestMicrophonePermissionsAsync();
      const granted = camResult?.granted === true;
      console.log(granted ? 'Permission granted' : 'Permission denied');
    };

    requestPerms();
  }, [requestCameraPermission]);

  const { data: moment, isLoading } = useQuery({
    queryKey: ['live-moment', momentId],
    queryFn: () => liveMomentsApi.getOne(momentId),
    refetchInterval: 3000,
    enabled: Boolean(momentId),
  });

  const { data: messages } = useQuery({
    queryKey: ['live-moment-messages', momentId],
    queryFn: () => liveMomentsApi.getMessages(momentId),
    refetchInterval: 3000,
    enabled: Boolean(momentId),
  });

  // Latest media from any message for the content area
  const latestMedia = useMemo(() => {
    const media = (messages ?? []).filter((m) => m.type === 'image' || m.type === 'video');
    return media.length > 0 ? media[media.length - 1] : null;
  }, [messages]);

  const joinMutation = useMutation({
    mutationFn: () => liveMomentsApi.join(momentId),
  });

  useEffect(() => {
    if (momentId) {
      joinMutation.mutate();
    }
    return () => {
      if (momentId) {
        liveMomentsApi.leave(momentId);
      }
    };
  }, [momentId]);

  useEffect(() => {
    if (!momentId) return;
    let ws: WebSocket | null = null;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const wsUrl = backendUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');

      ws = new WebSocket(`${wsUrl}/ws/live-moments/${momentId}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as
            | { type: 'message'; data: LiveMomentMessage }
            | { type: 'typing'; userId: string; userName: string }
            | { type: 'user_joined'; userId: string; userName: string };

          if (data.type === 'message') {
            queryClient.setQueryData(
              ['live-moment-messages', momentId],
              (old: LiveMomentMessage[] | undefined) => {
                const existing = old ?? [];
                if (existing.some((m) => m.id === data.data.id)) return existing;
                return [...existing, data.data];
              }
            );
          } else if (data.type === 'typing') {
            setTypingUsers((prev) => {
              const filtered = prev.filter((u) => u.userId !== data.userId);
              return [...filtered, { userId: data.userId, userName: data.userName }];
            });
            const existing = typingTimers.current.get(data.userId);
            if (existing) clearTimeout(existing);
            const timer = setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
              typingTimers.current.delete(data.userId);
            }, 3000);
            typingTimers.current.set(data.userId, timer);
          } else if (data.type === 'user_joined') {
            setSystemMessages((prev) => [
              ...prev,
              {
                id: `join-${data.userId}-${Date.now()}`,
                content: `👋 ${data.userName} joined`,
                createdAt: Date.now(),
                isSystem: true,
              },
            ]);
            // Refresh viewer count
            queryClient.invalidateQueries({ queryKey: ['live-moment', momentId] });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
      };
      ws.onerror = () => {
        setWsConnected(false);
      };
    };

    connect();

    return () => {
      ws?.close();
      wsRef.current = null;
      for (const timer of typingTimers.current.values()) clearTimeout(timer);
      typingTimers.current.clear();
    };
  }, [momentId]);

  useEffect(() => {
    if (!moment?.expiresAt) return;
    const update = () => setTimeRemaining(getTimeRemaining(moment.expiresAt));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [moment?.expiresAt]);

  useEffect(() => {
    if ((messages ?? []).length > 0 || systemMessages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, systemMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; type: string; contentUrl?: string }) =>
      liveMomentsApi.sendMessage(momentId, data),
    onSuccess: (newMessage) => {
      queryClient.setQueryData(
        ['live-moment-messages', momentId],
        (old: LiveMomentMessage[] | undefined) => {
          const existing = old ?? [];
          if (existing.some((m) => m.id === newMessage.id)) return existing;
          return [...existing, newMessage];
        }
      );
    },
  });
  const sendMessage = sendMessageMutation.mutate;

  const endMomentMutation = useMutation({
    mutationFn: () => liveMomentsApi.end(momentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-moments'] });
      queryClient.invalidateQueries({ queryKey: ['live-moment', momentId] });
      router.replace('/(app)/live-moments' as any);
    },
  });
  const endMoment = endMomentMutation.mutate;

  // Calls the backend to record the boost and optimistically updates the UI
  const activateBoost = useCallback(async (liveId: string, transactionId?: string) => {
    const token = await getAccessToken();
    const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
    await fetch(`${backendUrl}/api/boosts/live/${liveId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ transactionId }),
    });

    // Immediately update the cached moment so the UI reflects boosted state
    const boostExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    queryClient.setQueryData(['live-moment', liveId], (old: any) =>
      old ? { ...old, isBoosted: true, boostExpiresAt } : old
    );
    queryClient.invalidateQueries({ queryKey: ['live-moment', liveId] });
    queryClient.invalidateQueries({ queryKey: ['live-moments'] });
  }, [queryClient]);

  const boostMutation = useMutation({
    mutationFn: async () => {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
      if (!apiKey) throw new Error('Boost not available yet. Please try again later.');
      Purchases.configure({ apiKey, appUserID: session?.user?.id });
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p) => p.product.identifier === 'boost_live_999'
      );
      if (!pkg) throw new Error('Boost not available yet. Please try again later.');
      const result = await Purchases.purchasePackage(pkg);
      const transactionId = (result as any).transaction?.transactionIdentifier ?? pkg.product.identifier;
      await activateBoost(momentId, transactionId);
    },
    onSuccess: () => {
      setShowBoostModal(false);
      Burnt.toast({ title: '🔥 Boost activated for 30 minutes', preset: 'done' });
    },
    onError: (err: Error) => {
      setShowBoostModal(false);
      Burnt.toast({ title: err.message ?? 'Boost failed. Please try again.', preset: 'error' });
    },
  });

  const { mutate: goLive, isPending: isGoingLive } = useMutation({
    mutationFn: () => liveMomentsApi.goLive(momentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-moments'] });
      queryClient.invalidateQueries({ queryKey: ['live-moment', momentId] });
    },
  });

  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      const now = Date.now();
      if (
        wsRef.current?.readyState === WebSocket.OPEN &&
        now - lastTypingSent.current > 1500
      ) {
        wsRef.current.send(JSON.stringify({ type: 'typing' }));
        lastTypingSent.current = now;
      }
    },
    []
  );

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
      }, 2400);
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

  const handleGoLive = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsStartingStream(true);
    try {
      console.log('[LiveKit] handleGoLive: permissions already requested on mount.');

      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const token = await getAccessToken();
      console.log('[LiveKit] Fetching publisher token for moment:', momentId);
      const res = await fetch(`${backendUrl}/api/livekit/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ momentId: momentId, role: 'publisher' }),
      });
      if (res.ok) {
        const json = await res.json() as { data: { token: string; wsUrl: string } };
        console.log('[LiveKit] Token received, wsUrl:', json.data.wsUrl);
        setStreamToken(json.data.token);
        setStreamWsUrl(json.data.wsUrl);
      } else {
        console.warn('[LiveKit] Token fetch failed:', res.status);
      }
      goLive();
    } catch (e) {
      console.warn('[LiveKit] handleGoLive error:', e);
      goLive();
    } finally {
      setIsStartingStream(false);
    }
  }, [momentId, goLive]);

  const handleJoinStream = useCallback(async () => {
    try {
      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const token = await getAccessToken();
      const res = await fetch(`${backendUrl}/api/livekit/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ momentId: momentId, role: 'viewer' }),
      });
      if (res.ok) {
        const json = await res.json() as { data: { token: string; wsUrl: string } };
        setStreamToken(json.data.token);
        setStreamWsUrl(json.data.wsUrl);
      }
    } catch {
      // ignore
    }
  }, [momentId]);

  const handlePickMedia = useCallback(() => {
    showMediaPicker({
      mediaType: 'both',
      onResult: async (picked) => {
        if (!picked) return;

        const isVideo = picked.mimeType.startsWith('video/');

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
          const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
          const token = await getAccessToken();

          const formData = new FormData();
          formData.append('file', {
            uri: picked.uri,
            type: picked.mimeType,
            name: isVideo ? 'video.mp4' : 'photo.jpg',
          } as any);

          const uploadRes = await fetch(`${backendUrl}/api/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });

          if (!uploadRes.ok) {
            if (!isVideo) {
              sendMessage({ content: 'Photo', type: 'image', contentUrl: picked.uri });
            }
            return;
          }

          const uploadJson = await uploadRes.json() as { data: { url: string } };
          const remoteUrl = uploadJson.data.url;

          sendMessage({
            content: isVideo ? 'Video' : 'Photo',
            type: isVideo ? 'video' : 'image',
            contentUrl: remoteUrl,
          });
        } catch {
          if (!isVideo) {
            sendMessage({ content: 'Photo', type: 'image', contentUrl: picked.uri });
          }
        }
      },
    });
  }, [sendMessage]);

  const isCreator = moment?.creatorId === session?.user?.id;
  const isEnded = moment?.status === 'ended' || timeRemaining === 'Ended';
  const displayViewerCount = useSimulatedViewerCount(
    moment?.viewerCount ?? 0,
    moment?.isBoosted === true && !isEnded
  );
  const boostCountdown = useBoostCountdown(moment?.boostExpiresAt);
  const isNotLive = !moment?.isLive;

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

  const backendBaseUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
  const streamUrl = streamToken && streamWsUrl
    ? `${backendBaseUrl}/stream/${momentId}?token=${encodeURIComponent(streamToken)}&url=${encodeURIComponent(streamWsUrl)}&role=${isCreator ? 'publisher' : 'viewer'}`
    : null;

  // Bottom bar shared between creator and viewer
  const bottomBar = !isEnded ? (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <BlurView intensity={25} tint="dark">
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.07)',
            paddingTop: 10,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          {typingUsers.length > 0 ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                fontWeight: '500',
                marginBottom: 6,
                fontStyle: 'italic',
              }}
            >
              {typingUsers.map((u) => u.userName).join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                testID={`reaction-${emoji}`}
                key={emoji}
                onPress={() => handleReaction(emoji)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 19 }}>{emoji}</Text>
              </Pressable>
            ))}

            {isCreator && !isEnded && moment?.isLive ? (
              moment?.isBoosted === true ? (
                // Boost is active — show countdown, disable button
                <View
                  testID="boost-active-indicator"
                  style={{
                    marginLeft: 'auto',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(245,158,11,0.25)',
                  }}
                >
                  <Text style={{ fontSize: 11 }}>🔥</Text>
                  <Text style={{ color: 'rgba(245,158,11,0.7)', fontSize: 11, fontWeight: '700' }}>
                    {boostCountdown ?? 'Boosted'}
                  </Text>
                </View>
              ) : (
                // Not boosted — show PROMOTE button
                <Pressable
                  testID="promote-live-button"
                  onPress={async () => {
                    setShowBoostModal(true);
                    try {
                      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
                      if (!apiKey) return;
                      Purchases.configure({ apiKey, appUserID: session?.user?.id });
                      const offerings = await Purchases.getOfferings();
                      const pkg = offerings.current?.availablePackages.find(
                        (p) => p.product.identifier === 'boost_live_999'
                      );
                      if (pkg?.product.priceString) {
                        setBoostPrice(pkg.product.priceString);
                      }
                    } catch {
                      // Non-fatal — modal already open, price stays at fallback
                    }
                  }}
                  style={{
                    marginLeft: 'auto',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: 'rgba(245,158,11,0.15)',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(245,158,11,0.35)',
                  }}
                >
                  <Megaphone size={13} color="#f59e0b" />
                  <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>
                    PROMOTE
                  </Text>
                </Pressable>
              )
            ) : null}
            {isCreator ? (
              <Pressable
                testID="end-moment-button"
                onPress={handleEnd}
                disabled={endMomentMutation.isPending}
                style={{
                  marginLeft: isCreator && !isEnded && moment?.isLive ? 6 : 'auto',
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
                <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
                  END
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              testID="photo-picker-button"
              onPress={handlePickMedia}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: 'rgba(255,255,255,0.07)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Camera size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>

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
                onChangeText={handleTextChange}
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
                backgroundColor: messageText.trim() ? '#00CF35' : 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: messageText.trim() ? '#00CF35' : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 5,
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
  ) : null;

  // Ended overlay
  const endedOverlay = isEnded ? (
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
        onPress={handleBack}
        style={{
          marginTop: 24,
          backgroundColor: 'rgba(255,255,255,0.1)',
          paddingHorizontal: 28,
          paddingVertical: 12,
          borderRadius: 30,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>Go Back</Text>
      </Pressable>
    </View>
  ) : null;

  // Floating reactions overlay
  const floatingReactionsOverlay = (
    <View
      style={{ position: 'absolute', bottom: 100, left: 0, right: 0, height: 220 }}
      pointerEvents="none"
    >
      {floatingReactions.map((r) => (
        <FloatingReaction key={r.id} emoji={r.emoji} id={r.id} />
      ))}
    </View>
  );

  // Chat messages area (shared)
  const chatContent = (
    <>
      {pinnedMessage ? (
        <PinnedMessageView
          message={pinnedMessage}
          onUnpin={() => setPinnedMessage(null)}
          isCreator={isCreator}
        />
      ) : null}
      <ScrollView
        ref={scrollRef}
        testID="messages-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Session started system message */}
        <SystemMessageBubble content="🎙️ Live session started" />

        {/* Messages and system messages interleaved */}
        {(messages ?? []).length === 0 && systemMessages.length === 0 ? null : null}
        {(messages ?? []).map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === session?.user?.id}
            isPinned={pinnedMessage?.id === msg.id}
            onLongPress={
              isCreator && msg.type !== 'reaction'
                ? () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPinnedMessage(pinnedMessage?.id === msg.id ? null : msg);
                  }
                : undefined
            }
          />
        ))}
        {/* System messages (joined events) */}
        {systemMessages.map((sys) => (
          <SystemMessageBubble key={sys.id} content={sys.content} />
        ))}
      </ScrollView>
    </>
  );

  // ─── CREATOR LAYOUT ──────────────────────────────────────────────────────
  if (isCreator) {
    const cameraGranted = cameraPermission?.granted === true;

    // Still checking permissions — show loading to avoid blank camera
    if (cameraPermission === null) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" size="large" testID="camera-permission-loading" />
        </View>
      );
    }

    // Permission denied screen
    if (!cameraGranted) {
      return (
        <View
          testID="permission-denied-screen"
          style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>
            Camera access required to go live
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
            Allow camera and microphone access so your viewers can see and hear you.
          </Text>
          <Pressable
            testID="enable-camera-button"
            onPress={async () => {
              console.log('Requesting camera permission');
              const camResult = await requestCameraPermission();
              await ExpoCamera.requestMicrophonePermissionsAsync();
              const granted = camResult?.granted === true;
              console.log(granted ? 'Permission granted' : 'Permission denied');
            }}
            style={{
              backgroundColor: '#00CF35',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 30,
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 10,
            }}
          >
            <Text style={{ color: '#001935', fontSize: 16, fontWeight: '900' }}>Enable Camera</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Full-screen stream or camera preview */}
        {streamUrl && !isNotLive ? (
          <WebView
            source={{ uri: streamUrl }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={false}
            mediaCapturePermissionGrantType="grant"
            allowsAirPlayForMediaPlayback={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            onMessage={(event: WebViewMessageEvent) => {
              console.log('[LiveKit WebView]', event.nativeEvent.data);
            }}
            injectedJavaScript={`
              (function() {
                var origLog = console.log;
                var origWarn = console.warn;
                var origError = console.error;
                console.log = function() {
                  window.ReactNativeWebView.postMessage('[LOG] ' + Array.from(arguments).join(' '));
                  origLog.apply(console, arguments);
                };
                console.warn = function() {
                  window.ReactNativeWebView.postMessage('[WARN] ' + Array.from(arguments).join(' '));
                  origWarn.apply(console, arguments);
                };
                console.error = function() {
                  window.ReactNativeWebView.postMessage('[ERROR] ' + Array.from(arguments).join(' '));
                  origError.apply(console, arguments);
                };
                window.onerror = function(msg, src, line) {
                  window.ReactNativeWebView.postMessage('[JSERROR] ' + msg + ' at ' + src + ':' + line);
                };
              })();
              true;
            `}
          />
        ) : cameraGranted && isFocused ? (
          <CameraView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            facing={facingFront ? 'front' : 'back'}
            onCameraReady={() => console.log('Permission granted')}
            onMountError={() => setCameraFailed(true)}
          >
            {cameraFailed ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' }}>
                  Camera failed to initialize
                </Text>
              </View>
            ) : null}
          </CameraView>
        ) : (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#0a0a12',
            }}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'transparent', 'rgba(0,0,0,0.8)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

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
            <Pressable testID="back-button" onPress={handleBack}>
              <ArrowLeft size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 }}
                numberOfLines={1}
              >
                {moment.title}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ViewerCountDisplay count={displayViewerCount} />
              {moment.isBoosted === true && !isEnded ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: 'rgba(245,158,11,0.18)',
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(245,158,11,0.4)',
                  }}
                >
                  <Text style={{ fontSize: 10 }}>🔥</Text>
                  <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                    Boosted
                  </Text>
                </View>
              ) : null}
              {isEnded ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800' }}>ENDED</Text>
                </View>
              ) : isNotLive ? (
                <OfflineBadge />
              ) : (
                <LiveBadge />
              )}
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
            </View>
          </View>

          {/* Go live banner */}
          {isNotLive && !isEnded ? (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 8,
                backgroundColor: 'rgba(0,207,53,0.08)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(0,207,53,0.2)',
                padding: 16,
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>
                Tap to start broadcasting to your viewers
              </Text>
              <GoLivePulseButton onPress={handleGoLive} isPending={isGoingLive || isStartingStream} />
            </View>
          ) : null}

          {!isEnded && timeRemaining ? (
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
              {timeRemaining}
            </Text>
          ) : null}

          {/* Chat */}
          <View style={{ flex: 1 }}>
            {chatContent}
          </View>

          {bottomBar}
        </SafeAreaView>

        {floatingReactionsOverlay}
        {endedOverlay}

        {/* Boost Modal */}
        {showBoostModal ? (
          <View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
            }}
          >
            <View
              style={{
                backgroundColor: '#0a0a12',
                borderRadius: 24,
                padding: 28,
                marginHorizontal: 28,
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.25)',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔥</Text>
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
                Boost Your Live
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                Promote your live to more viewers for {boostPrice}
              </Text>
              <Pressable
                testID="boost-confirm-button"
                onPress={() => boostMutation.mutate()}
                disabled={boostMutation.isPending || isRestoringPurchases}
                style={{
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                {boostMutation.isPending ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={{ color: '#000000', fontSize: 15, fontWeight: '800' }}>Boost for {boostPrice}</Text>
                )}
              </Pressable>
              <Pressable
                testID="boost-restore-button"
                disabled={isRestoringPurchases || boostMutation.isPending}
                onPress={async () => {
                  setIsRestoringPurchases(true);
                  try {
                    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
                    if (!apiKey) throw new Error('Not available');
                    Purchases.configure({ apiKey, appUserID: session?.user?.id });
                    const customerInfo = await Purchases.restorePurchases();

                    // Reapply boost if the product is in the restored purchase history
                    const hadBoost =
                      customerInfo.allPurchasedProductIdentifiers?.includes('boost_live_999') ?? false;

                    if (hadBoost) {
                      await activateBoost(momentId);
                      setShowBoostModal(false);
                      Burnt.toast({ title: '🔥 Your live is now boosted!', preset: 'done' });
                    } else {
                      Burnt.toast({ title: 'No boost to restore', preset: 'none' });
                    }
                  } catch {
                    Burnt.toast({ title: 'Nothing to restore', preset: 'error' });
                  } finally {
                    setIsRestoringPurchases(false);
                  }
                }}
                style={{
                  width: '100%',
                  borderRadius: 16,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  marginBottom: 10,
                }}
              >
                {isRestoringPurchases ? (
                  <ActivityIndicator color="rgba(255,255,255,0.5)" />
                ) : (
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' }}>Restore Purchases</Text>
                )}
              </Pressable>
              <Pressable
                testID="boost-cancel-button"
                onPress={() => setShowBoostModal(false)}
                style={{
                  width: '100%',
                  borderRadius: 16,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.07)',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
                Payment charged to your Apple ID account. By purchasing you agree to our Terms of Use and Privacy Policy.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // ─── VIEWER LAYOUT ───────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Live content area - top background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CONTENT_AREA_HEIGHT + 60 }}>
        <LiveContentArea media={latestMedia} isLive={!isNotLive} />
      </View>

      {/* Stream WebView over content area if active */}
      {streamUrl ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: CONTENT_AREA_HEIGHT + 60,
            overflow: 'hidden',
          }}
        >
          <WebView
            testID="stream-webview"
            source={{ uri: streamUrl }}
            style={{ flex: 1 }}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={false}
            mediaCapturePermissionGrantType="grant"
            allowsAirPlayForMediaPlayback={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            onMessage={(event: WebViewMessageEvent) => {
              console.log('[LiveKit WebView viewer]', event.nativeEvent.data);
            }}
            injectedJavaScript={`
              (function() {
                var origLog = console.log;
                console.log = function() {
                  window.ReactNativeWebView.postMessage('[LOG] ' + Array.from(arguments).join(' '));
                  origLog.apply(console, arguments);
                };
              })();
              true;
            `}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
          />
        </View>
      ) : null}

      {/* Dark gradient from content to chat */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        style={{
          position: 'absolute',
          top: CONTENT_AREA_HEIGHT,
          left: 0,
          right: 0,
          height: 80,
        }}
      />

      {/* Full chat + header overlay */}
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
          <Pressable testID="back-button" onPress={handleBack}>
            <ArrowLeft size={18} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 }}
              numberOfLines={1}
            >
              {moment.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {moment.creator?.name ?? 'Unknown'}'s moment
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ViewerCountDisplay count={displayViewerCount} />
            {moment.isBoosted === true && !isEnded ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(245,158,11,0.18)',
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.4)',
                }}
              >
                <Text style={{ fontSize: 10 }}>🔥</Text>
                <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                  Boosted
                </Text>
              </View>
            ) : null}
            {isEnded ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800' }}>ENDED</Text>
              </View>
            ) : isNotLive ? (
              <OfflineBadge />
            ) : (
              <LiveBadge />
            )}
          </View>
        </View>

        {/* Time remaining */}
        {!isEnded && timeRemaining ? (
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
            {timeRemaining}
          </Text>
        ) : null}

        {/* Spacer for content area */}
        <View style={{ height: CONTENT_AREA_HEIGHT - 80 }} />

        {/* Stream join button (if live but no stream token) */}
        {!isEnded && !isNotLive && !streamToken ? (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Pressable
              onPress={handleJoinStream}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,59,48,0.85)',
                paddingHorizontal: 20,
                paddingVertical: 9,
                borderRadius: 24,
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>
                JOIN LIVE VIDEO
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Chat area - semi-transparent over dark bg */}
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,5,15,0.7)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.05)',
          }}
        >
          {chatContent}
        </View>

        {bottomBar}
      </SafeAreaView>

      {floatingReactionsOverlay}
      {endedOverlay}
    </View>
  );
}
