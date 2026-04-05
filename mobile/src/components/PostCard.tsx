import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions, Modal, TouchableWithoutFeedback, Share, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Heart,
  Repeat2,
  MessageCircle,
  MessageSquare,
  Share as ShareIcon,
  Volume2,
  VolumeX,
  Maximize,
  ShieldAlert,
  MoreHorizontal,
  Flag,
  ExternalLink,
  Bookmark,
  Clock,
  Pencil,
  Trash2,
  X,
  Copy,
  Check,
} from 'lucide-react-native';
import { Swipeable, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { formatDistanceToNow } from 'date-fns';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '@/lib/api/api';
import type { Post, User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { MediaViewer } from '@/components/MediaViewer';
import { useSession } from '@/lib/auth/use-session';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface PostCardProps {
  post: Post;
  isVisible?: boolean;
}

const REPORT_REASONS: { label: string; category: string }[] = [
  { label: 'Illegal content', category: 'illegal' },
  { label: 'Abuse / harassment', category: 'abuse' },
  { label: 'Spam', category: 'spam' },
  { label: 'Explicit content', category: 'explicit' },
];

function isRecent(createdAt: string, thresholdMs: number): boolean {
  return Date.now() - new Date(createdAt).getTime() < thresholdMs;
}

function formatCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toString();
}

export function PostCard({ post, isVisible = true }: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const heartScale = useSharedValue(1);
  const doubleTapHeartScale = useSharedValue(0);
  const [revealed, setRevealed] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(4 / 3);
  const [muted, setMuted] = useState(true);
  const [mediaViewer, setMediaViewer] = useState<{ visible: boolean; type: 'image' | 'video'; uri: string } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? '');
  const [editContent, setEditContent] = useState(post.content ?? '');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [captionCopied, setCaptionCopied] = useState(false);
  const lastTapRef = useRef<number>(0);
  const imageLastTapRef = useRef<number>(0);

  // Video scrubbing — zero React state on hot path, all via Reanimated shared values
  const scrubDimOpacity = useSharedValue(0);
  const scrubPillOpacity = useSharedValue(0);
  const scrubDisplayText = useSharedValue('0:00 / 0:00');
  const scrubStartTimeRef = useRef(0);
  const lastSeekTimeRef = useRef(0);
  const lastScrubDirectionRef = useRef(0);
  const player = useVideoPlayer(
    post.type === 'video' && post.videoUrl ? post.videoUrl : null,
    (p) => { p.loop = true; p.muted = true; }
  );
  const { data: session } = useSession();

  useEffect(() => {
    if (!player) return;
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player]);

  useEffect(() => {
    if (player) player.muted = muted;
  }, [muted, player]);

  const formatScrubTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const seekTo = (time: number, duration: number) => {
    if (!player) return;
    player.currentTime = time;
    scrubDisplayText.value = `${formatScrubTime(time)} / ${formatScrubTime(duration)}`;
  };

  const scrubDimStyle = useAnimatedStyle(() => ({
    opacity: scrubDimOpacity.value,
  }));

  const scrubPillStyle = useAnimatedStyle(() => ({
    opacity: scrubPillOpacity.value,
  }));

  const animatedTimeProps = useAnimatedProps(() => ({
    text: scrubDisplayText.value,
    defaultValue: scrubDisplayText.value,
  }));

  const videoScrubGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-8, 8])
    .failOffsetY([-15, 15])
    .onStart(() => {
      scrubStartTimeRef.current = player?.currentTime ?? 0;
      lastScrubDirectionRef.current = 0;
      scrubDimOpacity.value = withTiming(0.3, { duration: 150 });
      scrubPillOpacity.value = withTiming(1, { duration: 150 });
    })
    .onUpdate((e) => {
      if (!player) return;
      const duration = player.duration || 0;
      if (duration <= 0) return;
      // Velocity boost + edge resistance
      let raw = scrubStartTimeRef.current + e.translationX * 0.05 + e.velocityX * 0.01;
      if (raw < 0) raw = raw * 0.3;
      else if (raw > duration) raw = duration + (raw - duration) * 0.3;
      const newTime = Math.max(0, Math.min(duration, raw));
      const now = Date.now();
      if (now - lastSeekTimeRef.current >= 16) {
        lastSeekTimeRef.current = now;
        seekTo(newTime, duration);
      }
      const dir = e.translationX >= 0 ? 1 : -1;
      if (lastScrubDirectionRef.current !== 0 && dir !== lastScrubDirectionRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      lastScrubDirectionRef.current = dir;
    })
    .onEnd(() => {
      scrubDimOpacity.value = withTiming(0, { duration: 300 });
      scrubPillOpacity.value = withTiming(0, { duration: 250 });
      lastScrubDirectionRef.current = 0;
    });

  const tapToFullscreenGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMediaViewer({ visible: true, type: 'video', uri: post.videoUrl! });
    });

  const videoGesture = Gesture.Exclusive(videoScrubGesture, tapToFullscreenGesture);

  // Read user's explicit content preference from cache
  const { data: profile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>('/api/users/me'),
    enabled: !!session?.user?.id,
    staleTime: 60_000,
  });
  const userAllowsExplicit = profile?.showExplicit ?? false;
  const showContent = !post.isExplicit || userAllowsExplicit || revealed;

  // Derived time state
  const isWithin24Hours = isRecent(post.createdAt, 24 * 60 * 60 * 1000);
  const isWithin1Hour = isRecent(post.createdAt, 60 * 60 * 1000);
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const doubleTapHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: doubleTapHeartScale.value }],
    opacity: doubleTapHeartScale.value > 0.1 ? 1 : 0,
  }));

  const likeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${post.id}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (category: string) => {
      const reason = REPORT_REASONS.find((r) => r.category === category)?.label;
      await api.post('/api/reports', { postId: post.id, category, reason });
    },
    onSuccess: () => {
      setReportSubmitted(true);
      setReportError(false);
      setSelectedCategory(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setReportError(true);
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${post.id}/bookmark`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/posts/${post.id}`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete post. Please try again.');
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      await api.put(`/api/posts/${post.id}`, { title: title || null, content: content || null });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
      setEditVisible(false);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    },
  });

  const handleDeleteConfirm = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const isOwnPost = session?.user?.id === post.userId;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 6 })
    );
    likeMutation.mutate();
  };

  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      doubleTapHeartScale.value = withSequence(
        withSpring(1.4, { damping: 4 }),
        withTiming(1.4, { duration: 200 }),
        withSpring(0, { damping: 6 })
      );
      if (!post.isLiked) {
        likeMutation.mutate();
      }
    } else {
      // Single tap - navigate to post
      const timer = setTimeout(() => {
        router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id } });
      }, DOUBLE_TAP_DELAY + 50);
      lastTapRef.current = now;
      // Actually store so double tap can clear navigation
      return () => clearTimeout(timer);
    }
    lastTapRef.current = now;
  };

  const handleImageTap = (e: any) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - imageLastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap — heart it
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      doubleTapHeartScale.value = withSequence(
        withSpring(1.4, { damping: 4 }),
        withTiming(1.4, { duration: 200 }),
        withSpring(0, { damping: 6 })
      );
      if (!post.isLiked) {
        likeMutation.mutate();
      }
    } else {
      // Single tap — open viewer after delay (cancelled if double-tap follows)
      const timer = setTimeout(() => {
        setMediaViewer({ visible: true, type: 'image', uri: post.imageUrl! });
      }, DOUBLE_TAP_DELAY + 50);
      imageLastTapRef.current = now;
      return () => clearTimeout(timer);
    }
    imageLastTapRef.current = now;
  };

  const reblogMutation = useMutation({    mutationFn: async () => {
      await api.post(`/api/posts/${post.id}/reblog`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const tags = Array.isArray(post.tags) ? post.tags : [];

  const videoHeight = Math.round(width * 9 / 16);

  // Repost/reblog combined count and active state
  const repostTotal = (post.reblogCount ?? 0) + (post.repostCount ?? 0);
  const repostActive = post.isReposted ?? repostTotal > 0;

  // Poll helpers
  const pollTotalVotes = post.poll
    ? post.poll.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/(app)/messenger/[userId]' as any, params: { userId: post.userId } });
      }}
      style={{
        backgroundColor: '#00CF35',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        marginBottom: 10,
        marginHorizontal: 12,
        borderRadius: 16,
      }}
    >
      <MessageSquare size={24} color="#001935" />
      <Text style={{ color: '#001935', fontSize: 10, fontWeight: '700', marginTop: 4 }}>DM</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
    <Pressable
      testID={`post-card-${post.id}`}
      onPress={handleTap}
      style={{
        backgroundColor: 'rgba(10,30,60,0.95)',
        borderRadius: 16,
        marginHorizontal: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: post.isExplicit ? '#FF4E6A' : 'rgba(255,255,255,0.06)',
        borderLeftColor: post.isExplicit ? '#FF4E6A' : 'rgba(255,255,255,0.06)',
        borderLeftWidth: post.isExplicit ? 3 : 0.5,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
        <Pressable
          testID={`post-user-avatar-${post.id}`}
          onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: post.userId } })}
          style={isWithin24Hours ? {
            borderRadius: 22,
            borderWidth: 2,
            borderColor: '#00CF35',
            padding: 1,
          } : undefined}
        >
          <UserAvatar uri={post.user.image} name={post.user.name} size={38} />
        </Pressable>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
              {post.user.username ?? post.user.name}
            </Text>
            {post.isExplicit ? (
              <View style={{
                backgroundColor: '#FF4E6A',
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}>
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>18+</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            {isWithin1Hour ? (
              <Text style={{ color: '#00CF35', fontSize: 11 }}>
                {'• '}{timeAgo}
              </Text>
            ) : (
              <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                {timeAgo}
              </Text>
            )}
            {post.category != null ? (
              <View style={{
                backgroundColor: 'rgba(74,111,165,0.15)',
                borderRadius: 8,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}>
                <Text style={{ color: '#4a6fa5', fontSize: 10, fontWeight: '600' }}>
                  {'#'}{post.category}
                </Text>
              </View>
            ) : null}
            {post.readTime != null && post.readTime > 0 ? (
              <View style={{
                backgroundColor: 'rgba(74,111,165,0.12)',
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              }}>
                <Clock size={10} color="#4a6fa5" />
                <Text style={{ color: '#4a6fa5', fontSize: 10, fontWeight: '500' }}>
                  {post.readTime} min read
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {/* More options button */}
        <Pressable
          testID={`post-menu-button-${post.id}`}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMenuVisible(true);
          }}
          style={{ padding: 4 }}
        >
          <MoreHorizontal size={18} color="#4a6fa5" />
        </Pressable>
      </View>

      {/* Title */}
      {post.title ? (
        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 17, paddingHorizontal: 14, paddingBottom: 6, lineHeight: 22 }}>
          {post.title}
        </Text>
      ) : null}

      {/* Content */}
      {post.content ? (
        <Text style={{ color: 'rgba(255,255,255,0.88)', paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, lineHeight: 20 }}>
          {post.content}
        </Text>
      ) : null}

      {/* Poll */}
      {post.poll != null ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
            {post.poll.question}
          </Text>
          <View style={{ gap: 8 }}>
            {post.poll.options.map((option, index) => {
              const pct = pollTotalVotes > 0 ? (option.votes / pollTotalVotes) * 100 : 0;
              return (
                <View
                  key={index}
                  style={{
                    height: 40,
                    borderRadius: 10,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(0,207,53,0.4)',
                    position: 'relative',
                  }}
                >
                  {/* Fill bar */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${pct}%` as any,
                      backgroundColor: 'rgba(0,207,53,0.2)',
                    }}
                  />
                  {/* Option row */}
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 12,
                  }}>
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                      {option.text}
                    </Text>
                    <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                      {option.votes}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={{ color: '#4a6fa5', fontSize: 11, marginTop: 8 }}>
            {formatCount(pollTotalVotes)} votes{' '}
            {post.poll.endsAt ? `· ends ${formatDistanceToNow(new Date(post.poll.endsAt), { addSuffix: true })}` : null}
          </Text>
        </View>
      ) : null}

      {/* Image - full width */}
      {post.imageUrl ? (
        !showContent ? (
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: post.imageUrl }}
              style={{ width: '100%', aspectRatio: imageAspectRatio }}
              contentFit="contain"
              blurRadius={25}
              onLoad={(e) => {
                const { width: w, height: h } = e.source;
                if (w && h) setImageAspectRatio(w / h);
              }}
            />
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,78,106,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={24} color="#FF4E6A" />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Sensitive Content</Text>
              <Text style={{ fontSize: 11, color: '#a0b4c8', textAlign: 'center', paddingHorizontal: 24 }}>
                This post may contain explicit material.
              </Text>
              <Pressable
                testID={`reveal-image-button-${post.id}`}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setRevealed(true);
                }}
                style={{ marginTop: 4, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a3a5c', borderColor: '#2a4a6a', borderWidth: 1 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#a0b4c8' }}>Tap to reveal</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            testID={`open-image-viewer-${post.id}`}
            onPress={handleImageTap}
          >
            <Image
              source={{ uri: post.imageUrl }}
              style={{ width: '100%', aspectRatio: imageAspectRatio }}
              contentFit="contain"
              onLoad={(e) => {
                const { width: w, height: h } = e.source;
                if (w && h) setImageAspectRatio(w / h);
              }}
              testID={`post-image-${post.id}`}
            />
          </Pressable>
        )
      ) : null}

      {/* Video - full width inline */}
      {post.type === 'video' && post.videoUrl ? (
        !showContent ? (
          <View style={{ height: videoHeight, backgroundColor: '#071d35', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,78,106,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={24} color="#FF4E6A" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Sensitive Content</Text>
            <Pressable
              testID={`reveal-video-button-${post.id}`}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRevealed(true);
              }}
              style={{ marginTop: 4, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a3a5c', borderColor: '#2a4a6a', borderWidth: 1 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#a0b4c8' }}>Tap to reveal</Text>
            </Pressable>
          </View>
        ) : (
          <GestureDetector gesture={videoGesture}>
            <View
              testID={`video-tap-fullscreen-${post.id}`}
              style={{ height: videoHeight, backgroundColor: '#000000', position: 'relative' }}
            >
              <VideoView
                testID={`post-video-${post.id}`}
                player={player}
                style={{ width: '100%', height: videoHeight }}
                contentFit="cover"
                allowsFullscreen={false}
                allowsPictureInPicture={false}
              />

              {/* Scrub dim overlay */}
              <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrubDimStyle]}
                pointerEvents="none"
              />

              {/* Small pill time indicator — always mounted, fades in/out via Reanimated */}
              <Animated.View
                pointerEvents="none"
                style={[
                  scrubPillStyle,
                  {
                    position: 'absolute',
                    top: 10,
                    alignSelf: 'center',
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  },
                ]}
              >
                <View style={{
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}>
                  <AnimatedTextInput
                    animatedProps={animatedTimeProps}
                    editable={false}
                    style={{ color: '#fff', fontSize: 13, fontWeight: '600', padding: 0 }}
                  />
                </View>
              </Animated.View>

              <Pressable
                testID={`mute-button-${post.id}`}
                onPress={(e) => {
                  e.stopPropagation();
                  setMuted(!muted);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  position: 'absolute', bottom: 10, left: 12,
                  backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16,
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 10, paddingVertical: 5, gap: 5,
                }}
              >
                {muted ? <VolumeX size={14} color="#ffffff" /> : <Volume2 size={14} color="#ffffff" />}
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
                  {muted ? 'Tap to unmute' : 'Muted off'}
                </Text>
              </Pressable>
              <Pressable
                testID={`fullscreen-button-${post.id}`}
                onPress={(e) => {
                  e.stopPropagation();
                  setMediaViewer({ visible: true, type: 'video', uri: post.videoUrl! });
                }}
                style={{
                  position: 'absolute', bottom: 10, right: 12,
                  backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
                }}
              >
                <Maximize size={15} color="#ffffff" />
              </Pressable>
            </View>
          </GestureDetector>
        )
      ) : null}

      {/* Double-tap heart animation overlay */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <Animated.View style={doubleTapHeartStyle}>
          <Heart size={80} color="#FF4E6A" fill="#FF4E6A" />
        </Animated.View>
      </View>

      {/* Link */}
      {post.linkUrl ? (
        <View style={{
          marginHorizontal: 14,
          marginBottom: 10,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: '#001935',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <ExternalLink size={12} color="#00CF35" />
          <Text style={{ color: '#00CF35', fontSize: 12, flex: 1 }} numberOfLines={1}>
            {post.linkUrl}
          </Text>
        </View>
      ) : null}

      {/* Tags */}
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 6, gap: 6 }}>
          {tags.map((tag: string) => (
            <View
              key={tag}
              style={{
                backgroundColor: 'rgba(0,207,53,0.08)',
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 0.5,
                borderColor: 'rgba(0,207,53,0.2)',
              }}
            >
              <Text style={{ color: '#00CF35', fontSize: 12 }}>
                {'#'}{tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Action Bar */}
      <View
        onStartShouldSetResponder={() => true}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderTopWidth: 0.5,
          borderTopColor: '#1a3a5c',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}>
        {/* Like */}
        <Pressable
          testID={`like-button-${post.id}`}
          onPress={(e) => { e.stopPropagation(); handleLike(); }}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}
        >
          <Animated.View style={[
            heartAnimatedStyle,
            post.isLiked ? {
              shadowColor: '#FF4E6A',
              shadowOpacity: 0.8,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            } : undefined,
          ]}>
            <Heart
              size={20}
              color={post.isLiked ? '#FF4E6A' : '#4a6fa5'}
              fill={post.isLiked ? '#FF4E6A' : 'transparent'}
            />
          </Animated.View>
          {post.likeCount > 0 ? (
            <Text style={[
              { marginLeft: 6, fontSize: 12, color: post.isLiked ? '#FF4E6A' : '#4a6fa5' },
              post.isLiked ? {
                shadowColor: '#FF4E6A',
                shadowOpacity: 0.8,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              } : undefined,
            ]}>
              {post.likeCount}
            </Text>
          ) : null}
        </Pressable>

        {/* Repost / Reblog */}
        <Pressable
          testID={`reblog-button-${post.id}`}
          onPress={(e) => { e.stopPropagation(); reblogMutation.mutate(); }}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}
        >
          <Repeat2 size={20} color={repostActive ? '#00CF35' : '#4a6fa5'} />
          {repostTotal > 0 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, color: '#00CF35' }}>
              {repostTotal}
            </Text>
          ) : null}
        </Pressable>

        {/* Comment */}
        <Pressable
          testID={`comment-button-${post.id}`}
          onPress={(e) => {
            e.stopPropagation();
            router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id } });
          }}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}
        >
          <MessageCircle size={20} color={post.commentCount > 0 ? 'rgba(255,255,255,0.5)' : '#4a6fa5'} />
          {post.commentCount > 0 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {post.commentCount}
            </Text>
          ) : null}
        </Pressable>

        {/* Bookmark */}
        <Pressable
          testID={`bookmark-button-${post.id}`}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            bookmarkMutation.mutate();
          }}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 'auto' }}
        >
          <Bookmark
            size={18}
            color={post.isBookmarked ? '#00CF35' : '#4a6fa5'}
            fill={post.isBookmarked ? '#00CF35' : 'transparent'}
          />
          {post.bookmarkCount != null && post.bookmarkCount > 0 ? (
            <Text style={{ marginLeft: 5, fontSize: 12, color: '#00CF35' }}>
              {post.bookmarkCount}
            </Text>
          ) : null}
        </Pressable>

        {/* View count */}
        {post.viewCount != null && post.viewCount > 0 ? (
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginRight: 14 }}>
            {formatCount(post.viewCount)} views
          </Text>
        ) : null}

        {/* Share */}
        <Pressable
          testID={`share-button-${post.id}`}
          onPress={(e) => {
            e.stopPropagation();
            const author = post.user.username ? `@${post.user.username}` : post.user.name;
            const parts: string[] = [];
            if (post.title) parts.push(post.title);
            if (post.content) {
              const preview = post.content.length > 200 ? post.content.slice(0, 200) + '…' : post.content;
              parts.push(preview);
            }
            parts.push(`— ${author} on Openly`);
            const caption = parts.join('\n\n');
            setShareCaption(caption);
            setCaptionCopied(false);
            Clipboard.setStringAsync(caption).then(() => setCaptionCopied(true));
            setShareModalVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <ShareIcon size={18} color="#4a6fa5" />
        </Pressable>
      </View>

      {/* Media Viewer */}
      {mediaViewer ? (
        <MediaViewer
          visible={mediaViewer.visible}
          type={mediaViewer.type}
          uri={mediaViewer.uri}
          onClose={() => setMediaViewer(null)}
        />
      ) : null}

      {/* Options Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{
                backgroundColor: '#0a2d50',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 32,
                paddingTop: 8,
              }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#1a3a5c', alignSelf: 'center', marginBottom: 16 }} />
                {isOwnPost ? (
                  <>
                    <Pressable
                      testID="menu-edit-button"
                      onPress={() => {
                        setMenuVisible(false);
                        setEditTitle(post.title ?? '');
                        setEditContent(post.content ?? '');
                        setEditVisible(true);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}
                    >
                      <Pencil size={18} color="#00CF35" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }}>Edit Post</Text>
                    </Pressable>
                    <Pressable
                      testID="menu-delete-button"
                      onPress={() => {
                        setMenuVisible(false);
                        handleDeleteConfirm();
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}
                    >
                      <Trash2 size={18} color="#FF4E6A" />
                      <Text style={{ color: '#FF4E6A', fontSize: 15, fontWeight: '500' }}>Delete Post</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      testID="menu-report-button"
                      onPress={() => {
                        setMenuVisible(false);
                        setReportVisible(true);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}
                    >
                      <Flag size={18} color="#FF4E6A" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }}>Report</Text>
                    </Pressable>
                    <Pressable
                      testID="menu-not-interested-button"
                      onPress={() => setMenuVisible(false)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}
                    >
                      <MoreHorizontal size={18} color="#4a6fa5" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }}>Not interested</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit Post Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setEditVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={{
                  backgroundColor: '#0a2d50',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingBottom: 32,
                  paddingTop: 8,
                  paddingHorizontal: 24,
                }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#1a3a5c', alignSelf: 'center', marginBottom: 16 }} />
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1 }}>Edit Post</Text>
                    <Pressable testID="edit-modal-close" onPress={() => setEditVisible(false)}>
                      <X size={20} color="#4a6fa5" />
                    </Pressable>
                  </View>
                  {/* Title input */}
                  <Text style={{ color: '#4a6fa5', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title</Text>
                  <TextInput
                    testID="edit-title-input"
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Post title (optional)"
                    placeholderTextColor="#2a4a6a"
                    style={{
                      color: '#FFFFFF',
                      fontSize: 15,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: '#001935',
                      borderColor: '#1a3a5c',
                      borderWidth: 1,
                      marginBottom: 16,
                    }}
                  />
                  {/* Content input */}
                  <Text style={{ color: '#4a6fa5', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Content</Text>
                  <TextInput
                    testID="edit-content-input"
                    value={editContent}
                    onChangeText={setEditContent}
                    placeholder="What's on your mind?"
                    placeholderTextColor="#2a4a6a"
                    multiline
                    numberOfLines={5}
                    style={{
                      color: '#FFFFFF',
                      fontSize: 14,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: '#001935',
                      borderColor: '#1a3a5c',
                      borderWidth: 1,
                      marginBottom: 20,
                      minHeight: 110,
                      textAlignVertical: 'top',
                    }}
                  />
                  {/* Save button */}
                  <Pressable
                    testID="edit-save-button"
                    onPress={() => editMutation.mutate({ title: editTitle, content: editContent })}
                    disabled={editMutation.isPending}
                    style={{
                      backgroundColor: '#00CF35',
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                  >
                    {editMutation.isPending ? (
                      <ActivityIndicator color="#001935" size="small" />
                    ) : (
                      <Text style={{ color: '#001935', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>
                    )}
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setReportVisible(false);
          setReportSubmitted(false);
          setReportError(false);
          setSelectedCategory(null);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setReportVisible(false);
          setReportSubmitted(false);
          setReportError(false);
          setSelectedCategory(null);
        }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{
                backgroundColor: '#0a2d50',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 32,
                paddingTop: 8,
                paddingHorizontal: 24,
              }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#1a3a5c', alignSelf: 'center', marginBottom: 16 }} />

                {reportSubmitted ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,207,53,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Flag size={26} color="#00CF35" />
                    </View>
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>Post reported</Text>
                    <Text style={{ color: '#4a6fa5', fontSize: 13, textAlign: 'center' }}>
                      Thanks for letting us know. We'll review this post.
                    </Text>
                    <Pressable
                      testID="report-done-button"
                      onPress={() => {
                        setReportVisible(false);
                        setReportSubmitted(false);
                        setSelectedCategory(null);
                      }}
                      style={{
                        marginTop: 8,
                        backgroundColor: '#00CF35',
                        borderRadius: 14,
                        paddingVertical: 12,
                        paddingHorizontal: 40,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#001935', fontWeight: '700', fontSize: 15 }}>Done</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 16 }}>Report Post</Text>
                    <Text style={{ color: '#4a6fa5', fontSize: 13, marginBottom: 14 }}>Select a reason:</Text>
                    <View style={{ gap: 10, marginBottom: 20 }}>
                      {REPORT_REASONS.map((item) => (
                        <Pressable
                          key={item.category}
                          testID={`report-category-${item.category}`}
                          onPress={() => setSelectedCategory(item.category)}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: selectedCategory === item.category ? '#00CF35' : '#1a3a5c',
                            backgroundColor: selectedCategory === item.category ? 'rgba(0,207,53,0.08)' : 'transparent',
                          }}
                        >
                          <Text style={{ color: selectedCategory === item.category ? '#00CF35' : '#FFFFFF', fontWeight: '500' }}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {reportError ? (
                      <Text style={{ color: '#FF4E6A', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                        Something went wrong. Please try again.
                      </Text>
                    ) : null}
                    <Pressable
                      testID="submit-report-button"
                      onPress={() => selectedCategory && reportMutation.mutate(selectedCategory)}
                      disabled={!selectedCategory || reportMutation.isPending}
                      style={{
                        backgroundColor: selectedCategory ? '#00CF35' : '#1a3a5c',
                        borderRadius: 14,
                        paddingVertical: 14,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: selectedCategory ? '#001935' : '#4a6fa5', fontWeight: '700', fontSize: 15 }}>
                        {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Share Caption Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShareModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={{
                  backgroundColor: '#0a2d50',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingBottom: 32,
                  paddingTop: 8,
                  paddingHorizontal: 24,
                }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#1a3a5c', alignSelf: 'center', marginBottom: 16 }} />
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1 }}>Share Post</Text>
                    <Pressable testID="share-modal-close" onPress={() => setShareModalVisible(false)}>
                      <X size={20} color="#4a6fa5" />
                    </Pressable>
                  </View>
                  {/* Copied badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 }}>
                    {captionCopied ? (
                      <>
                        <Check size={13} color="#00CF35" />
                        <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '600' }}>Caption copied to clipboard</Text>
                      </>
                    ) : (
                      <Text style={{ color: '#4a6fa5', fontSize: 12 }}>Edit your caption before sharing</Text>
                    )}
                  </View>
                  {/* Caption editor */}
                  <TextInput
                    testID="share-caption-input"
                    value={shareCaption}
                    onChangeText={setShareCaption}
                    multiline
                    numberOfLines={5}
                    placeholderTextColor="#2a4a6a"
                    style={{
                      color: '#FFFFFF',
                      fontSize: 14,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: '#001935',
                      borderColor: '#1a3a5c',
                      borderWidth: 1,
                      marginBottom: 14,
                      minHeight: 120,
                      textAlignVertical: 'top',
                    }}
                  />
                  {/* Action row */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      testID="share-copy-button"
                      onPress={() => {
                        Clipboard.setStringAsync(shareCaption).then(() => {
                          setCaptionCopied(true);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        });
                      }}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: 14,
                        paddingVertical: 13,
                        backgroundColor: '#001935',
                        borderWidth: 1,
                        borderColor: '#1a3a5c',
                      }}
                    >
                      <Copy size={15} color={captionCopied ? '#00CF35' : '#4a6fa5'} />
                      <Text style={{ color: captionCopied ? '#00CF35' : '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                        {captionCopied ? 'Copied!' : 'Copy'}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID="share-open-button"
                      onPress={() => {
                        const author = post.user.username ? `@${post.user.username}` : post.user.name;
                        const mediaUrl = post.imageUrl ?? post.videoUrl ?? null;
                        const message = Platform.OS === 'android' && mediaUrl
                          ? `${shareCaption}\n\n${mediaUrl}`
                          : shareCaption;
                        const shareOptions: Parameters<typeof Share.share>[0] = {
                          message,
                          title: post.title ?? `Post by ${author} on Openly`,
                        };
                        if (Platform.OS === 'ios' && mediaUrl) shareOptions.url = mediaUrl;
                        setShareModalVisible(false);
                        Share.share(shareOptions);
                      }}
                      style={{
                        flex: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: 14,
                        paddingVertical: 13,
                        backgroundColor: '#00CF35',
                      }}
                    >
                      <ShareIcon size={15} color="#001935" />
                      <Text style={{ color: '#001935', fontWeight: '700', fontSize: 14 }}>Share</Text>
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Pressable>
    </Swipeable>
  );
}
