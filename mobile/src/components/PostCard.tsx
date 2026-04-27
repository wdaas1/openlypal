import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, useWindowDimensions, Modal, TouchableWithoutFeedback, Share, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, InteractionManager, Linking } from 'react-native';

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
import { LinkPreview } from './LinkPreview';
import { useSession } from '@/lib/auth/use-session';
import { videoVisibility } from '@/lib/videoVisibility';
import { relationshipsApi } from '@/lib/api/relationships';
import { useTheme } from '@/lib/theme';
import { renderTextWithMentions } from '@/lib/renderMentions';

const imageAspectRatioCache = new Map<string, number>();

interface PostCardProps {
  post: Post;
  isVisible?: boolean;
  videoKey?: string;
  from?: string;
  roomId?: string;
  momentId?: string;
}

const REPORT_REASONS: { label: string; category: string }[] = [
  { label: 'Spam', category: 'spam' },
  { label: 'Abuse / harassment', category: 'abuse' },
  { label: 'Nudity', category: 'nudity' },
  { label: 'Violence', category: 'violence' },
  { label: 'Other', category: 'other' },
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

const PostCard = React.memo(function PostCard({ post, isVisible = true, videoKey, from, roomId, momentId }: PostCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width, height: screenHeight } = useWindowDimensions();
  const heartScale = useSharedValue(1);
  const doubleTapHeartScale = useSharedValue(0);
  const [localIsLiked, setLocalIsLiked] = useState(post.isLiked);
  const [localLikeCount, setLocalLikeCount] = useState(post.likeCount);
  const [revealed, setRevealed] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(() => {
    const firstImage = (post.imageUrls?.[0] ?? post.imageUrl);
    return firstImage ? (imageAspectRatioCache.get(firstImage) ?? 4 / 3) : 4 / 3;
  });
  const [muted, setMuted] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ visible: boolean; type: 'image' | 'video'; uri: string; post?: typeof post } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? '');
  const [editContent, setEditContent] = useState(post.content ?? '');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const lastTapRef = useRef<number>(0);
  const imageLastTapRef = useRef<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video scrubbing — zero React state on hot path, all via Reanimated shared values
  const scrubDimOpacity = useSharedValue(0);
  const progressOpacity = useSharedValue(0);
  const progressFraction = useSharedValue(0);
  const thumbOpacity = useSharedValue(0);
  const progressBarHeight = useSharedValue(3);
  const scrubStartTimeRef = useRef(0);
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastScrubDirectionRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useVideoPlayer(
    post.type === 'video' && post.videoUrl ? post.videoUrl : null,
    (p) => { p.loop = false; p.muted = true; }
  );
  const { data: session } = useSession();

  const { data: relationships } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => relationshipsApi.getAll(),
    enabled: shareModalVisible,
  });

  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    if (!videoKey || Platform.OS === 'web') return;
    return videoVisibility.register(videoKey, (visible) => {
      InteractionManager.runAfterInteractions(() => {
        if (visible) {
          setVideoEnded(false);
          playerRef.current?.seekBy(-playerRef.current.currentTime);
          playerRef.current?.play();
        } else playerRef.current?.pause();
      });
    });
  }, [videoKey]);

  useEffect(() => {
    if (player) player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playToEnd', () => {
      setVideoEnded(true);
    });
    return () => sub.remove();
  }, [player]);

  const scheduleBarHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      progressOpacity.value = withTiming(0, { duration: 400 });
      thumbOpacity.value = withTiming(0, { duration: 200 });
    }, 2000);
  };

  const showBar = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    progressOpacity.value = withTiming(1, { duration: 180 });
  };

  const startLerpLoop = (duration: number) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const tick = () => {
      const target = targetTimeRef.current;
      const prev = currentTimeRef.current;
      const factor = isScrubbingRef.current ? 0.12 : 0.22;
      const diff = target - prev;
      const next = Math.abs(diff) < 0.01 ? target : prev + diff * factor;
      currentTimeRef.current = next;
      const p = playerRef.current;
      if (p) {
        p.currentTime = next;
        if (duration > 0) progressFraction.value = next / duration;
      }
      if (!isScrubbingRef.current && Math.abs(next - target) < 0.01) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopLerpLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const scrubDimStyle = useAnimatedStyle(() => ({
    opacity: scrubDimOpacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const fillFlexStyle = useAnimatedStyle(() => ({
    flex: Math.max(progressFraction.value, 0.001),
  }));

  const remainingFlexStyle = useAnimatedStyle(() => ({
    flex: Math.max(1 - progressFraction.value, 0.001),
  }));

  const thumbAnimStyle = useAnimatedStyle(() => ({
    opacity: progressFraction.value > 0.02 && progressFraction.value < 0.98
      ? thumbOpacity.value
      : 0,
  }));

  const progressBarHeightStyle = useAnimatedStyle(() => ({
    height: progressBarHeight.value,
  }));

  const videoScrubGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-8, 8])
    .failOffsetY([-5, 5])
    .onStart(() => {
      const start = playerRef.current?.currentTime ?? 0;
      const duration = playerRef.current?.duration || 0;
      scrubStartTimeRef.current = start;
      currentTimeRef.current = start;
      targetTimeRef.current = start;
      lastScrubDirectionRef.current = 0;
      isScrubbingRef.current = true;
      playerRef.current?.pause();
      if (duration > 0) progressFraction.value = start / duration;
      scrubDimOpacity.value = withTiming(0.28, { duration: 150 });
      thumbOpacity.value = withTiming(1, { duration: 150 });
      progressBarHeight.value = withSpring(5, { damping: 12, stiffness: 180 });
      showBar();
      startLerpLoop(duration);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      const p = playerRef.current;
      if (!p) return;
      const duration = p.duration || 0;
      if (duration <= 0) return;
      let raw = scrubStartTimeRef.current + e.translationX * 0.04 + e.velocityX * 0.007;
      if (raw < 0) raw = raw * 0.18;
      else if (raw > duration) raw = duration + (raw - duration) * 0.18;
      targetTimeRef.current = Math.max(0, Math.min(duration, raw));
      const dir = e.translationX >= 0 ? 1 : -1;
      if (lastScrubDirectionRef.current !== 0 && dir !== lastScrubDirectionRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scrubStartTimeRef.current = currentTimeRef.current;
      }
      lastScrubDirectionRef.current = dir;
    })
    .onEnd(() => {
      isScrubbingRef.current = false;
      scrubDimOpacity.value = withTiming(0, { duration: 350 });
      progressBarHeight.value = withSpring(3, { damping: 12, stiffness: 180 });
      scheduleBarHide();
      lastScrubDirectionRef.current = 0;
      setTimeout(() => {
        if (!isScrubbingRef.current) {
          playerRef.current?.play();
        }
      }, 220);
    });

  const tapToFullscreenGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMediaViewer({ visible: true, type: 'video', uri: post.videoUrl!, post });
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

  const blockMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/users/${post.userId}/block`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${post.id}/bookmark`);
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

  const { mutate: mutateLike } = likeMutation;
  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 6 })
    );
    const nowLiked = !localIsLiked;
    setLocalIsLiked(nowLiked);
    setLocalLikeCount(prev => prev + (nowLiked ? 1 : -1));
    mutateLike();
  }, [localIsLiked, heartScale, mutateLike]);

  const { mutate: mutateBookmark } = bookmarkMutation;
  const handleBookmark = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mutateBookmark();
  }, [mutateBookmark]);

  const handleShare = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setCaptionCopied(false);
    setShareModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleMenuOpen = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible(true);
  }, []);

  const handleMentionPress = async (username: string) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
      const res = await fetch(`${baseUrl}/api/users/by-username/${encodeURIComponent(username)}`);
      const json = await res.json();
      if (json.data?.id) {
        router.push(`/(app)/user/${json.data.id}` as any);
      }
    } catch {}
  };

  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap — cancel pending navigation
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      doubleTapHeartScale.value = withSequence(
        withSpring(1.4, { damping: 4 }),
        withTiming(1.4, { duration: 200 }),
        withSpring(0, { damping: 6 })
      );
      if (!localIsLiked) {
        setLocalIsLiked(true);
        setLocalLikeCount(prev => prev + 1);
        likeMutation.mutate();
      }
    } else {
      // Single tap - navigate to post
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        from === 'room' && roomId
          ? router.push(`/(app)/rooms/${roomId}/post/${post.id}` as any)
          : router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id, from: from ?? 'feed', roomId: roomId ?? '', momentId: momentId ?? '' } });
      }, DOUBLE_TAP_DELAY + 50);
    }
    lastTapRef.current = now;
  };

  const handleImageTap = (e: any) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - imageLastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap — heart it, cancel any pending single-tap open
      if (imageTimerRef.current) {
        clearTimeout(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      doubleTapHeartScale.value = withSequence(
        withSpring(1.4, { damping: 4 }),
        withTiming(1.4, { duration: 200 }),
        withSpring(0, { damping: 6 })
      );
      if (!localIsLiked) {
        setLocalIsLiked(true);
        setLocalLikeCount(prev => prev + 1);
        likeMutation.mutate();
      }
    } else {
      // Single tap — open viewer after delay (cancelled if double-tap follows)
      imageTimerRef.current = setTimeout(() => {
        imageTimerRef.current = null;
        setMediaViewer({ visible: true, type: 'image', uri: (post.imageUrls?.[0] ?? post.imageUrl)! });
      }, DOUBLE_TAP_DELAY + 50);
    }
    imageLastTapRef.current = now;
  };

  const [hasReposted, setHasReposted] = useState(post.isReposted ?? false);

  const reblogMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${post.id}/reblog`);
    },
    onSuccess: () => {
      setHasReposted(true);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      if (error.message === 'Already reposted') {
        setHasReposted(true);
      }
    },
  });

  const tags = Array.isArray(post.tags) ? post.tags : [];

  const videoHeight = post.type === 'video' ? screenHeight : Math.round(width * 9 / 16);

  // Repost/reblog combined count and active state
  const repostTotal = (post.reblogCount ?? 0) + (post.repostCount ?? 0);
  const repostActive = (post.isReposted ?? false) || hasReposted;

  // Poll helpers
  const pollTotalVotes = post.poll
    ? post.poll.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  const renderRightActions = () => {
    if (isOwnPost) return null;
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const shareUrl = `https://openlypal.com/post/${post.id}`;
          const shareText = post.content?.slice(0, 80) ?? 'Check out this post';
          Share.share({
            message: `Check this out on Openly 👇\n\n${shareText}\n\n${shareUrl}`,
            url: shareUrl,
          });
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
        <ShareIcon size={24} color="#001935" />
        <Text style={{ color: '#001935', fontSize: 10, fontWeight: '700', marginTop: 4 }}>Share</Text>
      </Pressable>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
    <Pressable
      testID={`post-card-${post.id}`}
      onPress={handleTap}
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        marginHorizontal: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: post.isExplicit ? '#FF4E6A' : theme.border,
        borderLeftColor: post.isExplicit ? '#FF4E6A' : theme.border,
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
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
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
              <Text style={{ color: theme.subtext, fontSize: 11 }}>
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
                <Text style={{ color: theme.subtext, fontSize: 10, fontWeight: '600' }}>
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
                <Clock size={10} color={theme.subtext} />
                <Text style={{ color: theme.subtext, fontSize: 10, fontWeight: '500' }}>
                  {post.readTime} min read
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {/* More options button */}
        <Pressable
          testID={`post-menu-button-${post.id}`}
          onPress={handleMenuOpen}
          style={{ padding: 4 }}
        >
          <MoreHorizontal size={18} color={theme.subtext} />
        </Pressable>
      </View>

      {/* Title */}
      {post.title ? (
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 17, paddingHorizontal: 14, paddingBottom: 6, lineHeight: 22 }}>
          {post.title}
        </Text>
      ) : null}

      {/* Content */}
      {post.content ? (
        <Text style={{ color: theme.text, paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, lineHeight: 20 }}>
          {renderTextWithMentions(
            post.content,
            handleMentionPress,
            { color: theme.text, fontSize: 14, lineHeight: 20 },
          )}
        </Text>
      ) : null}

      {/* Poll */}
      {post.poll != null ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14, marginBottom: 10, lineHeight: 20 }}>
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
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
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
          <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 8 }}>
            {formatCount(pollTotalVotes)} votes{' '}
            {post.poll.endsAt ? `· ends ${formatDistanceToNow(new Date(post.poll.endsAt), { addSuffix: true })}` : null}
          </Text>
        </View>
      ) : null}

      {/* Image - full width (supports multiple, photo posts only) */}
      {post.type === 'photo' && (() => {
        const images = (post.imageUrls && post.imageUrls.length > 0)
          ? post.imageUrls
          : post.imageUrl ? [post.imageUrl] : [];
        if (images.length === 0) return null;
        if (!showContent) {
          return (
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: images[0] }}
                style={{ width: '100%', aspectRatio: imageAspectRatio }}
                contentFit="contain"
                transition={0}
                blurRadius={5}
                onLoad={(e) => {
                  const { width: w, height: h } = e.source;
                  if (w && h) {
                    const ratio = w / h;
                    const imgUrl = images[0];
                    if (imgUrl) imageAspectRatioCache.set(imgUrl, ratio);
                    setImageAspectRatio(ratio);
                  }
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
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Sensitive Content</Text>
                <Text style={{ fontSize: 11, color: theme.subtext, textAlign: 'center', paddingHorizontal: 24 }}>
                  This post may contain explicit material.
                </Text>
                <Pressable
                  testID={`reveal-image-button-${post.id}`}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRevealed(true);
                  }}
                  style={{ marginTop: 4, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: theme.border, borderColor: theme.border, borderWidth: 1 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.subtext }}>Tap to reveal</Text>
                </Pressable>
              </View>
            </View>
          );
        }
        if (images.length === 1) {
          return (
            <Pressable
              testID={`open-image-viewer-${post.id}`}
              onPress={handleImageTap}
            >
              <Image
                source={{ uri: images[0] }}
                style={{ width: '100%', aspectRatio: imageAspectRatio }}
                contentFit="contain"
                transition={0}
                onLoad={(e) => {
                  const { width: w, height: h } = e.source;
                  if (w && h) {
                    const ratio = w / h;
                    const imgUrl = images[0];
                    if (imgUrl) imageAspectRatioCache.set(imgUrl, ratio);
                    setImageAspectRatio(ratio);
                  }
                }}
                testID={`post-image-${post.id}`}
              />
            </Pressable>
          );
        }
        // Multiple images — horizontal scroll
        return (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
            >
              {images.map((uri, i) => (
                <Pressable
                  key={uri}
                  testID={i === 0 ? `open-image-viewer-${post.id}` : undefined}
                  onPress={() => setMediaViewer({ visible: true, type: 'image', uri })}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: width - 24, aspectRatio: 4 / 3 }}
                    contentFit="cover"
                    transition={0}
                    testID={i === 0 ? `post-image-${post.id}` : undefined}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 6 }}>
              {images.map((_, i) => (
                <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.subtext }} />
              ))}
            </View>
          </View>
        );
      })()}

      {/* Video - full width inline */}
      {post.type === 'video' && post.videoUrl ? (
        !showContent ? (
          <View style={{ height: videoHeight, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,78,106,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={24} color="#FF4E6A" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Sensitive Content</Text>
            <Pressable
              testID={`reveal-video-button-${post.id}`}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRevealed(true);
              }}
              style={{ marginTop: 4, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: theme.border, borderColor: theme.border, borderWidth: 1 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.subtext }}>Tap to reveal</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            testID={`video-tap-fullscreen-${post.id}`}
            style={{ height: videoHeight, backgroundColor: '#000000', position: 'relative' }}
          >
            <GestureDetector gesture={videoGesture}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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

                {/* Thin progress bar — fades in on scrub/tap, auto-hides after 2s */}
                <Animated.View
                  pointerEvents="none"
                  style={[progressBarStyle, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}
                >
                  <Animated.View style={[{ flexDirection: 'row' }, progressBarHeightStyle]}>
                    <Animated.View style={[{ backgroundColor: '#00CF35' }, fillFlexStyle, progressBarHeightStyle]}>
                      <Animated.View style={[thumbAnimStyle, {
                        position: 'absolute', right: -5, top: -2,
                        width: 10, height: 10, borderRadius: 5,
                        backgroundColor: '#ffffff',
                      }]} />
                    </Animated.View>
                    <Animated.View style={[{ backgroundColor: 'rgba(255,255,255,0.2)' }, remainingFlexStyle, progressBarHeightStyle]} />
                  </Animated.View>
                </Animated.View>
              </View>
            </GestureDetector>

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
                {muted ? 'Tap to unmute' : 'Sound on'}
              </Text>
            </Pressable>
            <Pressable
              testID={`fullscreen-button-${post.id}`}
              onPress={(e) => {
                e.stopPropagation();
                setMediaViewer({ visible: true, type: 'video', uri: post.videoUrl!, post });
              }}
              style={{
                position: 'absolute', bottom: 10, right: 12,
                backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16,
                alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
              }}
            >
              <Maximize size={15} color="#ffffff" />
            </Pressable>

            {/* Play Again overlay */}
            {videoEnded ? (
              <Pressable
                testID={`play-again-button-${post.id}`}
                onPress={(e) => {
                  e.stopPropagation();
                  setVideoEnded(false);
                  player?.seekBy(-(player.currentTime));
                  player?.play();
                }}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }}>
                    <Repeat2 size={26} color="#ffffff" />
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>Play Again</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
          </Pressable>
        )
      ) : null}

      {/* Double-tap heart animation overlay */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <Animated.View style={doubleTapHeartStyle}>
          <Heart size={80} color="#FF4E6A" fill="#FF4E6A" />
        </Animated.View>
      </View>

      {/* Link */}
      {post.linkUrl ? <LinkPreview url={post.linkUrl} /> : null}

      {/* Tags */}
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 6, gap: 6 }}>
          {tags.map((tag: string) => (
            <Pressable
              key={tag}
              onPress={() => router.push(`/(app)/tag/${encodeURIComponent(tag)}` as any)}
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
            </Pressable>
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
          borderTopColor: theme.border,
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
            localIsLiked ? {
              shadowColor: '#FF4E6A',
              shadowOpacity: 0.2,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 0 },
            } : undefined,
          ]}>
            <Heart
              size={20}
              color={localIsLiked ? '#FF4E6A' : theme.subtext}
              fill={localIsLiked ? '#FF4E6A' : 'transparent'}
            />
          </Animated.View>
          {localLikeCount > 0 ? (
            <Text style={[
              { marginLeft: 6, fontSize: 12, color: localIsLiked ? '#FF4E6A' : theme.subtext },
              localIsLiked ? {
                shadowColor: '#FF4E6A',
                shadowOpacity: 0.2,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 0 },
              } : undefined,
            ]}>
              {localLikeCount}
            </Text>
          ) : null}
        </Pressable>

        {/* Repost / Reblog */}
        <Pressable
          testID={`reblog-button-${post.id}`}
          onPress={(e) => {
            e.stopPropagation();
            if (!repostActive && !reblogMutation.isPending) {
              reblogMutation.mutate();
            }
          }}
          disabled={repostActive || reblogMutation.isPending}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, opacity: repostActive ? 0.6 : 1 }}
        >
          <Repeat2 size={20} color={repostActive ? '#00CF35' : theme.subtext} />
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
            from === 'room' && roomId
              ? router.push(`/(app)/rooms/${roomId}/post/${post.id}` as any)
              : router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id, from: from ?? 'feed', roomId: roomId ?? '', momentId: momentId ?? '' } });
          }}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}
        >
          <MessageCircle size={20} color={post.commentCount > 0 ? theme.subtext : theme.subtext} />
          {post.commentCount > 0 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, color: theme.subtext }}>
              {post.commentCount}
            </Text>
          ) : null}
        </Pressable>

        {/* Bookmark */}
        <Pressable
          testID={`bookmark-button-${post.id}`}
          onPress={handleBookmark}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 'auto' }}
        >
          <Bookmark
            size={18}
            color={post.isBookmarked ? '#00CF35' : theme.subtext}
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
          <Text style={{ color: theme.subtext, fontSize: 11, marginRight: 14, opacity: 0.6 }}>
            {formatCount(post.viewCount)} views
          </Text>
        ) : null}

      </View>

      {/* Media Viewer */}
      {mediaViewer ? (
        <MediaViewer
          visible={mediaViewer.visible}
          type={mediaViewer.type}
          uri={mediaViewer.uri}
          post={mediaViewer.post}
          onClose={() => setMediaViewer(null)}
        />
      ) : null}

      {/* Options Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{
                backgroundColor: theme.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 32,
                paddingTop: 8,
              }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />
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
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>Edit Post</Text>
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
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>Report</Text>
                    </Pressable>
                    <Pressable
                      testID="menu-block-button"
                      onPress={() => {
                        setMenuVisible(false);
                        Alert.alert(
                          'Block User',
                          `Block @${post.user.username ?? post.user.name}? Their posts will be hidden and they won't be able to interact with you.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Block',
                              style: 'destructive',
                              onPress: () => blockMutation.mutate(),
                            },
                          ]
                        );
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}
                    >
                      <ShieldAlert size={18} color="#FF4E6A" />
                      <Text style={{ color: '#FF4E6A', fontSize: 15, fontWeight: '500' }}>Block User</Text>
                    </Pressable>
                    <Pressable
                      testID="menu-not-interested-button"
                      onPress={() => setMenuVisible(false)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 }}
                    >
                      <MoreHorizontal size={18} color={theme.subtext} />
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>Not interested</Text>
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
                  backgroundColor: theme.card,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingBottom: 32,
                  paddingTop: 8,
                  paddingHorizontal: 24,
                }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', flex: 1 }}>Edit Post</Text>
                    <Pressable testID="edit-modal-close" onPress={() => setEditVisible(false)}>
                      <X size={20} color={theme.subtext} />
                    </Pressable>
                  </View>
                  {/* Title input */}
                  <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title</Text>
                  <TextInput
                    testID="edit-title-input"
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Post title (optional)"
                    placeholderTextColor={theme.subtext}
                    style={{
                      color: theme.text,
                      fontSize: 15,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: theme.inputBg,
                      borderColor: theme.border,
                      borderWidth: 1,
                      marginBottom: 16,
                    }}
                  />
                  {/* Content input */}
                  <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Content</Text>
                  <TextInput
                    testID="edit-content-input"
                    value={editContent}
                    onChangeText={setEditContent}
                    placeholder="What's on your mind?"
                    placeholderTextColor={theme.subtext}
                    multiline
                    numberOfLines={5}
                    style={{
                      color: theme.text,
                      fontSize: 14,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: theme.inputBg,
                      borderColor: theme.border,
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
                backgroundColor: theme.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 32,
                paddingTop: 8,
                paddingHorizontal: 24,
              }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />

                {reportSubmitted ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,207,53,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Flag size={26} color="#00CF35" />
                    </View>
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>Post reported</Text>
                    <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center' }}>
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
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', marginBottom: 16 }}>Report Post</Text>
                    <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 14 }}>Select a reason:</Text>
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
                            borderColor: selectedCategory === item.category ? '#00CF35' : theme.border,
                            backgroundColor: selectedCategory === item.category ? 'rgba(0,207,53,0.08)' : 'transparent',
                          }}
                        >
                          <Text style={{ color: selectedCategory === item.category ? '#00CF35' : theme.text, fontWeight: '500' }}>{item.label}</Text>
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
                        backgroundColor: selectedCategory ? '#00CF35' : theme.border,
                        borderRadius: 14,
                        paddingVertical: 14,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: selectedCategory ? '#001935' : theme.subtext, fontWeight: '700', fontSize: 15 }}>
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

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShareModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{
                backgroundColor: theme.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: 36,
                paddingTop: 8,
              }}>
                {/* Drag handle */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />

                {/* Post preview */}
                {(() => {
                  const author = post.user.username ? `@${post.user.username}` : post.user.name;
                  const thumbnail = post.imageUrls?.[0] ?? post.imageUrl ?? null;
                  const caption = post.title ?? post.content ?? post.linkUrl ?? null;
                  return (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginHorizontal: 16,
                      marginBottom: 20,
                      padding: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.cardAlt,
                      gap: 10,
                    }}>
                      {thumbnail ? (
                        <Image
                          source={{ uri: thumbnail }}
                          style={{ width: 64, height: 64, borderRadius: 8 }}
                          contentFit="cover"
                          transition={0}
                        />
                      ) : post.type === 'video' ? (
                        <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 24 }}>🎬</Text>
                        </View>
                      ) : (
                        <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                          <ShareIcon size={20} color={theme.subtext} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <UserAvatar uri={post.user.image} name={post.user.name} size={18} />
                          <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '700' }}>{author}</Text>
                        </View>
                        {caption ? (
                          <Text style={{ color: theme.text, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{caption}</Text>
                        ) : null}
                        <Text style={{ color: theme.subtext, fontSize: 10 }}>openlypal.com/post/{post.id}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Send to — contacts row */}
                {relationships && relationships.length > 0 ? (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginHorizontal: 16, marginBottom: 12 }}>Send to</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ flexGrow: 0 }}
                      contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
                    >
                      {relationships.slice(0, 8).map((rel) => {
                        const postUrl = `https://openlypal.com/post/${post.id}`;
                        const authorName = post.user.username ? `@${post.user.username}` : post.user.name;
                        const caption = post.title ?? post.content ?? '';
                        const preview = caption.length > 80 ? caption.slice(0, 80) + '…' : caption;
                        const message = preview
                          ? `${preview}\n\n— ${authorName} on Openly\n${postUrl}`
                          : `${authorName} on Openly\n${postUrl}`;
                        return (
                          <Pressable
                            key={rel.user.id}
                            testID={`share-contact-${rel.user.id}`}
                            onPress={() => {
                              setShareModalVisible(false);
                              setTimeout(() => Share.share({ message, ...(Platform.OS === 'ios' ? { url: postUrl } : {}) }), 300);
                            }}
                            style={{ alignItems: 'center', gap: 6, width: 60 }}
                          >
                            <UserAvatar uri={rel.user.image} name={rel.user.name} size={52} />
                            <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
                              {rel.user.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Platform icons row */}
                {(() => {
                  const postUrl = `https://openlypal.com/post/${post.id}`;
                  const authorName = post.user.username ? `@${post.user.username}` : post.user.name;
                  const captionText = post.title ?? post.content ?? '';
                  const preview = captionText.length > 80 ? captionText.slice(0, 80) + '…' : captionText;
                  const message = preview
                    ? `${preview}\n\n— ${authorName} on Openly\n${postUrl}`
                    : `${authorName} on Openly\n${postUrl}`;
                  const encoded = encodeURIComponent(message);
                  const encodedUrl = encodeURIComponent(postUrl);

                  const platforms: {
                    key: string;
                    label: string;
                    bg: string;
                    labelColor?: string;
                    icon?: React.ReactNode;
                    iconText?: string;
                    onPress: () => void;
                  }[] = [
                    {
                      key: 'copy',
                      label: 'Copy Link',
                      bg: '#2a4060',
                      icon: <Copy size={22} color="#FFFFFF" />,
                      onPress: () => {
                        Clipboard.setStringAsync(postUrl).then(() => {
                          setCaptionCopied(true);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          setTimeout(() => setCaptionCopied(false), 2000);
                        });
                      },
                    },
                    {
                      key: 'messages',
                      label: 'Messages',
                      bg: '#00CF35',
                      icon: <MessageSquare size={22} color="#FFFFFF" />,
                      onPress: () => {
                        setShareModalVisible(false);
                        setTimeout(() => Linking.openURL(`sms:?body=${encoded}`), 300);
                      },
                    },
                    {
                      key: 'whatsapp',
                      label: 'WhatsApp',
                      bg: '#25D366',
                      iconText: 'WA',
                      onPress: () => {
                        setShareModalVisible(false);
                        setTimeout(() => Linking.openURL(`whatsapp://send?text=${encoded}`), 300);
                      },
                    },
                    {
                      key: 'twitter',
                      label: 'X (Twitter)',
                      bg: '#000000',
                      iconText: 'X',
                      onPress: () => {
                        setShareModalVisible(false);
                        setTimeout(() => {
                          Linking.canOpenURL('twitter://post').then((can) => {
                            if (can) {
                              Linking.openURL(`twitter://post?message=${encoded}`);
                            } else {
                              Linking.openURL(`https://twitter.com/intent/tweet?text=${encoded}`);
                            }
                          });
                        }, 300);
                      },
                    },
                    {
                      key: 'facebook',
                      label: 'Facebook',
                      bg: '#1877F2',
                      iconText: 'f',
                      onPress: () => {
                        setShareModalVisible(false);
                        setTimeout(() => Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`), 300);
                      },
                    },
                    {
                      key: 'telegram',
                      label: 'Telegram',
                      bg: '#229ED9',
                      iconText: 'TG',
                      onPress: () => {
                        setShareModalVisible(false);
                        setTimeout(() => Linking.openURL(`tg://msg?text=${encoded}`), 300);
                      },
                    },
                    {
                      key: 'more',
                      label: 'More',
                      bg: '#2a4060',
                      icon: <MoreHorizontal size={22} color="#FFFFFF" />,
                      onPress: () => {
                        setShareModalVisible(false);
                        const shareOptions: Parameters<typeof Share.share>[0] = { message };
                        if (Platform.OS === 'ios') shareOptions.url = postUrl;
                        setTimeout(() => Share.share(shareOptions), 300);
                      },
                    },
                  ];

                  return (
                    <View style={{ marginBottom: 20 }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flexGrow: 0 }}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
                      >
                        {platforms.map((p) => (
                          <Pressable
                            key={p.key}
                            testID={`share-platform-${p.key}`}
                            onPress={p.onPress}
                            style={{ alignItems: 'center', gap: 6, width: 60 }}
                          >
                            <View style={{
                              width: 56,
                              height: 56,
                              borderRadius: 28,
                              backgroundColor: p.bg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {p.icon ? p.icon : (
                                <Text style={{ color: p.labelColor ?? '#FFFFFF', fontSize: p.iconText === 'f' ? 22 : 16, fontWeight: '800' }}>{p.iconText}</Text>
                              )}
                            </View>
                            <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>{p.label}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })()}

                {/* Copy Link full-width button */}
                <Pressable
                  testID="share-copy-button"
                  onPress={() => {
                    const url = `https://openlypal.com/post/${post.id}`;
                    Clipboard.setStringAsync(url).then(() => {
                      setCaptionCopied(true);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setTimeout(() => setCaptionCopied(false), 2000);
                    });
                  }}
                  style={{
                    marginHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 14,
                    paddingVertical: 14,
                    backgroundColor: captionCopied ? 'rgba(0,207,53,0.12)' : theme.inputBg,
                    borderWidth: 1,
                    borderColor: captionCopied ? '#00CF35' : theme.border,
                  }}
                >
                  {captionCopied ? <Check size={16} color="#00CF35" /> : <Copy size={16} color={theme.subtext} />}
                  <Text style={{ color: captionCopied ? '#00CF35' : theme.text, fontWeight: '600', fontSize: 15 }}>
                    {captionCopied ? 'Link Copied!' : 'Copy Link'}
                  </Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Pressable>
    </Swipeable>
  );
});

export { PostCard };
