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
  Image,
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
import { ArrowLeft, Eye, Send, StopCircle, FlipHorizontal, Camera } from 'lucide-react-native';
import WebView from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { useSession } from '@/lib/auth/use-session';
import { getAuthToken } from '@/lib/auth/auth-client';
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
        ) : message.type === 'image' && message.contentUrl ? (
          <View
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isOwn ? 'rgba(0,207,53,0.3)' : 'rgba(255,255,255,0.1)',
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

export default function LiveMomentScreen() {
  const { id: momentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleBack = () => {
    router.back();
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
      const token = await getAuthToken();
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
            | { type: 'typing'; userId: string; userName: string };

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
    if ((messages ?? []).length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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
    },
  });
  const endMoment = endMomentMutation.mutate;

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

  const handleGoLive = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsStartingStream(true);
    try {
      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const token = await getAuthToken();
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
        setStreamToken(json.data.token);
        setStreamWsUrl(json.data.wsUrl);
      }
      goLive();
    } catch {
      goLive();
    } finally {
      setIsStartingStream(false);
    }
  }, [momentId, goLive]);

  const handleJoinStream = useCallback(async () => {
    try {
      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const token = await getAuthToken();
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

  const handlePickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const token = await getAuthToken();

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: isVideo ? (asset.mimeType ?? 'video/mp4') : (asset.mimeType ?? 'image/jpeg'),
        name: isVideo ? 'video.mp4' : 'photo.jpg',
      } as any);

      const uploadRes = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!uploadRes.ok) {
        if (!isVideo) {
          sendMessage({ content: 'Photo', type: 'image', contentUrl: asset.uri });
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
      if (asset.type !== 'video') {
        sendMessage({ content: 'Photo', type: 'image', contentUrl: asset.uri });
      }
    }
  }, [sendMessage]);

  const isCreator = moment?.creatorId === session?.user?.id;
  const isEnded = moment?.status === 'ended' || timeRemaining === 'Ended';
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

  const overlayContent = (
    <SafeAreaView
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      edges={['top', 'bottom']}
    >
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
          ) : isNotLive ? (
            <OfflineBadge />
          ) : (
            <LiveBadge />
          )}

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

      {isCreator && isNotLive && !isEnded ? (
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
            This moment is not live yet. Tap to go live.
          </Text>
          <GoLivePulseButton onPress={handleGoLive} isPending={isGoingLive || isStartingStream} />
        </View>
      ) : null}

      {!isCreator && !isEnded && !isNotLive ? (
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>
            📡 Watching live...
          </Text>
        </View>
      ) : null}

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

      {streamUrl ? (
        <View
          style={{
            height: 260,
            backgroundColor: '#000',
            overflow: 'hidden',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
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
          />
        </View>
      ) : null}

      {!isCreator && !isEnded && (isNotLive || (!isNotLive && !streamToken)) ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32 }}>📡</Text>
          {isNotLive ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 15,
                fontWeight: '600',
                marginTop: 12,
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              Creator hasn't gone live yet
            </Text>
          ) : (
            <>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 15,
                  fontWeight: '600',
                  marginTop: 12,
                  textAlign: 'center',
                  paddingHorizontal: 40,
                }}
              >
                Stream is live!
              </Text>
              <Pressable
                onPress={handleJoinStream}
                style={{
                  marginTop: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#FF3B30',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 24,
                  shadowColor: '#FF3B30',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 8,
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>
                  JOIN LIVE
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
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
      )}

      <View
        style={{ position: 'absolute', bottom: 100, right: 0, width: 120, height: 160 }}
        pointerEvents="none"
      >
        {floatingReactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} id={r.id} />
        ))}
      </View>

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
      ) : null}

      {!isEnded ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={20} tint="dark">
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
      ) : null}
    </SafeAreaView>
  );

  if (isCreator) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
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
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {overlayContent}
      </View>
    );
  }

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
