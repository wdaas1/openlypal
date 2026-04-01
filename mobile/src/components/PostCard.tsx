import React, { useState, useRef } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Heart, Repeat2, MessageCircle, Share, EyeOff, Volume2, VolumeX, Maximize } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Video, ResizeMode } from 'expo-av';
import { api } from '@/lib/api/api';
import type { Post } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { MediaViewer } from '@/components/MediaViewer';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const heartScale = useSharedValue(1);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mediaViewer, setMediaViewer] = useState<{ visible: boolean; type: 'image' | 'video'; uri: string } | null>(null);
  const videoRef = useRef<Video>(null);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
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

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 6 })
    );
    likeMutation.mutate();
  };

  const reblogMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${post.id}/reblog`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const tags = Array.isArray(post.tags) ? post.tags : [];
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const videoHeight = Math.round(width * 9 / 16);

  return (
    <Pressable
      testID={`post-card-${post.id}`}
      onPress={() => router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id } })}
      style={{ width, backgroundColor: '#0a2d50', marginBottom: 8 }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
        <Pressable
          testID={`post-user-avatar-${post.id}`}
          onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: post.userId } })}
        >
          <UserAvatar uri={post.user.image} name={post.user.name} size={38} />
        </Pressable>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
            {post.user.username ?? post.user.name}
          </Text>
          <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 1 }}>
            {timeAgo}
          </Text>
        </View>
      </View>

      {/* Title */}
      {post.title ? (
        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 17, paddingHorizontal: 16, paddingBottom: 6, lineHeight: 22 }}>
          {post.title}
        </Text>
      ) : null}

      {/* Content */}
      {post.content ? (
        <Text style={{ color: 'rgba(255,255,255,0.88)', paddingHorizontal: 16, paddingBottom: 10, fontSize: 14, lineHeight: 20 }}>
          {post.content}
        </Text>
      ) : null}

      {/* Image - full width */}
      {post.imageUrl ? (
        post.isExplicit && !revealed ? (
          <View style={{ width, aspectRatio: 16 / 9, backgroundColor: '#071d35', alignItems: 'center', justifyContent: 'center' }}>
            <EyeOff size={32} color="#4a6fa5" />
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 8, color: '#4a6fa5' }}>Sensitive content</Text>
            <Pressable
              testID={`reveal-image-button-${post.id}`}
              onPress={() => setRevealed(true)}
              style={{ marginTop: 12, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a3a5c' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#ffffff' }}>Show</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID={`open-image-viewer-${post.id}`}
            onPress={(e) => {
              e.stopPropagation();
              setMediaViewer({ visible: true, type: 'image', uri: post.imageUrl! });
            }}
          >
            <Image
              source={{ uri: post.imageUrl }}
              style={{ width, aspectRatio: 16 / 9 }}
              contentFit="cover"
              testID={`post-image-${post.id}`}
            />
          </Pressable>
        )
      ) : null}

      {/* Video - full width inline */}
      {post.type === 'video' && post.videoUrl ? (
        post.isExplicit && !revealed ? (
          <View style={{ width, height: videoHeight, backgroundColor: '#071d35', alignItems: 'center', justifyContent: 'center' }}>
            <EyeOff size={32} color="#4a6fa5" />
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 8, color: '#4a6fa5' }}>Sensitive content</Text>
            <Pressable
              testID={`reveal-video-button-${post.id}`}
              onPress={() => setRevealed(true)}
              style={{ marginTop: 12, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a3a5c' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#ffffff' }}>Show</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ width, height: videoHeight, backgroundColor: '#000000', position: 'relative' }}>
            <Video
              ref={videoRef}
              testID={`post-video-${post.id}`}
              source={{ uri: post.videoUrl }}
              style={{ width, height: videoHeight }}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted={muted}
              useNativeControls={false}
            />
            {/* Mute/unmute overlay */}
            <Pressable
              testID={`mute-button-${post.id}`}
              onPress={(e) => {
                e.stopPropagation();
                setMuted(!muted);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                position: 'absolute',
                bottom: 10,
                left: 12,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 5,
                gap: 5,
              }}
            >
              {muted ? (
                <VolumeX size={14} color="#ffffff" />
              ) : (
                <Volume2 size={14} color="#ffffff" />
              )}
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
                {muted ? 'Tap to unmute' : 'Muted off'}
              </Text>
            </Pressable>
            {/* Fullscreen hint */}
            <Pressable
              testID={`fullscreen-button-${post.id}`}
              onPress={(e) => {
                e.stopPropagation();
                setMediaViewer({ visible: true, type: 'video', uri: post.videoUrl! });
              }}
              style={{
                position: 'absolute',
                bottom: 10,
                right: 12,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
              }}
            >
              <Maximize size={15} color="#ffffff" />
            </Pressable>
          </View>
        )
      ) : null}

      {/* Link */}
      {post.linkUrl ? (
        <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#001935' }}>
          <Text style={{ color: '#00CF35', fontSize: 12 }} numberOfLines={1}>
            {post.linkUrl}
          </Text>
        </View>
      ) : null}

      {/* Tags */}
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 6, gap: 4 }}>
          {tags.map((tag: string) => (
            <Text key={tag} style={{ color: '#00CF35', fontSize: 12 }}>
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Action Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: '#1a3a5c' }}>
        <Pressable
          testID={`like-button-${post.id}`}
          onPress={handleLike}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
        >
          <Animated.View style={heartAnimatedStyle}>
            <Heart
              size={20}
              color={post.isLiked ? '#FF4E6A' : '#4a6fa5'}
              fill={post.isLiked ? '#FF4E6A' : 'transparent'}
            />
          </Animated.View>
          {post.likeCount > 0 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, color: post.isLiked ? '#FF4E6A' : '#4a6fa5' }}>
              {post.likeCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          testID={`reblog-button-${post.id}`}
          onPress={() => reblogMutation.mutate()}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
        >
          <Repeat2 size={20} color="#4a6fa5" />
          {post.reblogCount > 0 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, color: '#4a6fa5' }}>
              {post.reblogCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          testID={`comment-button-${post.id}`}
          onPress={() => router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
        >
          <MessageCircle size={20} color="#4a6fa5" />
          {post.commentCount > 0 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, color: '#4a6fa5' }}>
              {post.commentCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable testID={`share-button-${post.id}`} style={{ marginLeft: 'auto' }}>
          <Share size={18} color="#4a6fa5" />
        </Pressable>
      </View>

      {mediaViewer ? (
        <MediaViewer
          visible={mediaViewer.visible}
          type={mediaViewer.type}
          uri={mediaViewer.uri}
          onClose={() => setMediaViewer(null)}
        />
      ) : null}
    </Pressable>
  );
}
