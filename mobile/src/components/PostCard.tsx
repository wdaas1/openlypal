import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Heart, Repeat2, MessageCircle, Share, Play, EyeOff } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api/api';
import type { Post } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const heartScale = useSharedValue(1);
  const [revealed, setRevealed] = useState(false);

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

  return (
    <Pressable
      testID={`post-card-${post.id}`}
      onPress={() => router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id } })}
      className="mb-3 mx-3 rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#0a2d50' }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Pressable
          testID={`post-user-avatar-${post.id}`}
          onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: post.userId } })}
        >
          <UserAvatar uri={post.user.image} name={post.user.name} size={36} />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-white font-semibold text-sm">
            {post.user.username ?? post.user.name}
          </Text>
          <Text className="text-xs" style={{ color: '#4a6fa5' }}>
            {timeAgo}
          </Text>
        </View>
      </View>

      {/* Title */}
      {post.title ? (
        <Text className="text-white font-bold text-lg px-4 pb-1">
          {post.title}
        </Text>
      ) : null}

      {/* Content */}
      {post.content ? (
        <Text className="text-white px-4 pb-3 text-sm leading-5" style={{ opacity: 0.9 }}>
          {post.content}
        </Text>
      ) : null}

      {/* Image */}
      {post.imageUrl ? (
        post.isExplicit && !revealed ? (
          <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0a2d50', alignItems: 'center', justifyContent: 'center' }}>
            <EyeOff size={32} color="#4a6fa5" />
            <Text className="text-sm font-medium mt-2" style={{ color: '#4a6fa5' }}>Sensitive content</Text>
            <Pressable
              testID={`reveal-image-button-${post.id}`}
              onPress={() => setRevealed(true)}
              className="mt-3 rounded-full px-5 py-2"
              style={{ backgroundColor: '#1a3a5c' }}
            >
              <Text className="text-xs font-semibold" style={{ color: '#FFFFFF' }}>Show</Text>
            </Pressable>
          </View>
        ) : (
          <Image
            source={{ uri: post.imageUrl }}
            style={{ width: '100%', aspectRatio: 16 / 9 }}
            contentFit="cover"
            testID={`post-image-${post.id}`}
          />
        )
      ) : null}

      {/* Video */}
      {post.type === 'video' && post.videoUrl ? (
        post.isExplicit && !revealed ? (
          <View className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50', height: 200, alignItems: 'center', justifyContent: 'center' }}>
            <EyeOff size={32} color="#4a6fa5" />
            <Text className="text-sm font-medium mt-2" style={{ color: '#4a6fa5' }}>Sensitive content</Text>
            <Pressable
              testID={`reveal-video-button-${post.id}`}
              onPress={() => setRevealed(true)}
              className="mt-3 rounded-full px-5 py-2"
              style={{ backgroundColor: '#1a3a5c' }}
            >
              <Text className="text-xs font-semibold" style={{ color: '#FFFFFF' }}>Show</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ backgroundColor: '#0a2d50', height: 200, alignItems: 'center', justifyContent: 'center' }}>
            <View className="items-center gap-2">
              <View className="rounded-full items-center justify-center" style={{ width: 56, height: 56, backgroundColor: 'rgba(0,207,53,0.2)' }}>
                <Play size={28} color="#00CF35" fill="#00CF35" />
              </View>
              <Text className="text-sm font-medium" style={{ color: '#4a6fa5' }}>Tap to watch</Text>
            </View>
          </View>
        )
      ) : null}

      {/* Link */}
      {post.linkUrl ? (
        <View className="mx-4 mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: '#001935' }}>
          <Text className="text-xs" style={{ color: '#00CF35' }} numberOfLines={1}>
            {post.linkUrl}
          </Text>
        </View>
      ) : null}

      {/* Tags */}
      {tags.length > 0 ? (
        <View className="flex-row flex-wrap px-4 pb-2 gap-1">
          {tags.map((tag: string) => (
            <Text key={tag} className="text-xs" style={{ color: '#00CF35' }}>
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Action Bar */}
      <View className="flex-row items-center px-4 py-3" style={{ borderTopColor: '#1a3a5c', borderTopWidth: 0.5 }}>
        <Pressable
          testID={`like-button-${post.id}`}
          onPress={handleLike}
          className="flex-row items-center mr-6"
        >
          <Animated.View style={heartAnimatedStyle}>
            <Heart
              size={20}
              color={post.isLiked ? '#FF4E6A' : '#4a6fa5'}
              fill={post.isLiked ? '#FF4E6A' : 'transparent'}
            />
          </Animated.View>
          {post.likeCount > 0 ? (
            <Text className="ml-1.5 text-xs" style={{ color: post.isLiked ? '#FF4E6A' : '#4a6fa5' }}>
              {post.likeCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          testID={`reblog-button-${post.id}`}
          onPress={() => reblogMutation.mutate()}
          className="flex-row items-center mr-6"
        >
          <Repeat2 size={20} color="#4a6fa5" />
          {post.reblogCount > 0 ? (
            <Text className="ml-1.5 text-xs" style={{ color: '#4a6fa5' }}>
              {post.reblogCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          testID={`comment-button-${post.id}`}
          onPress={() => router.push({ pathname: '/(app)/post/[id]' as any, params: { id: post.id } })}
          className="flex-row items-center mr-6"
        >
          <MessageCircle size={20} color="#4a6fa5" />
          {post.commentCount > 0 ? (
            <Text className="ml-1.5 text-xs" style={{ color: '#4a6fa5' }}>
              {post.commentCount}
            </Text>
          ) : null}
        </Pressable>

        <Pressable testID={`share-button-${post.id}`} className="ml-auto">
          <Share size={18} color="#4a6fa5" />
        </Pressable>
      </View>
    </Pressable>
  );
}
