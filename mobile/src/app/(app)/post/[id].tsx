import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, Repeat2, MessageCircle, Share, Send } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api/api';
import type { Post, Comment } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { MediaViewer } from '@/components/MediaViewer';

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 240, borderRadius: 12, marginBottom: 16 }}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [mediaViewer, setMediaViewer] = useState<{ visible: boolean; type: 'image' | 'video'; uri: string } | null>(null);
  const heartScale = useSharedValue(1);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const { data: post, isLoading: loadingPost } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get<Post>(`/api/posts/${id}`),
    enabled: !!id,
  });

  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => api.get<Comment[]>(`/api/posts/${id}/comments`),
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/posts/${id}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
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
      await api.post(`/api/posts/${id}/reblog`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      return api.post(`/api/posts/${id}/comments`, { content: commentText });
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
  });

  if (loadingPost) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#001935' }}>
        <ActivityIndicator testID="loading-indicator" color="#00CF35" size="large" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#001935' }}>
        <Text style={{ color: '#4a6fa5' }}>Post not found</Text>
      </SafeAreaView>
    );
  }

  const tags = Array.isArray(post.tags) ? post.tags : [];
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <SafeAreaView testID="post-detail-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Pressable testID="back-button" onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white font-bold text-lg ml-4">Post</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1">
          {/* Post */}
          <View className="px-4 pt-4">
            {/* User */}
            <Pressable
              testID="post-user-header"
              onPress={() => router.push({ pathname: '/(app)/user/[id]' as any, params: { id: post.userId } })}
              className="flex-row items-center mb-4"
            >
              <UserAvatar uri={post.user.image} name={post.user.name} size={44} />
              <View className="ml-3">
                <Text className="text-white font-bold text-base">
                  {post.user.username ?? post.user.name}
                </Text>
                <Text className="text-xs" style={{ color: '#4a6fa5' }}>{timeAgo}</Text>
              </View>
            </Pressable>

            {/* Title */}
            {post.title ? (
              <Text className="text-white font-bold text-2xl mb-3">{post.title}</Text>
            ) : null}

            {/* Content */}
            {post.content ? (
              <Text className="text-white text-base mb-4 leading-6" style={{ opacity: 0.9 }}>
                {post.content}
              </Text>
            ) : null}

            {/* Image */}
            {post.imageUrl ? (
              <Pressable
                testID="detail-open-image-viewer"
                onPress={() => setMediaViewer({ visible: true, type: 'image', uri: post.imageUrl! })}
              >
                <Image
                  source={{ uri: post.imageUrl }}
                  style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 16 }}
                  contentFit="cover"
                />
              </Pressable>
            ) : null}

            {/* Video */}
            {post.type === 'video' && post.videoUrl ? (
              <VideoPlayer uri={post.videoUrl} />
            ) : null}

            {/* Link */}
            {post.linkUrl ? (
              <View className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: '#0a2d50' }}>
                <Text style={{ color: '#00CF35' }} className="text-sm">{post.linkUrl}</Text>
              </View>
            ) : null}

            {/* Tags */}
            {tags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2 mb-4">
                {tags.map((tag) => (
                  <Text key={tag} className="text-sm" style={{ color: '#00CF35' }}>#{tag}</Text>
                ))}
              </View>
            ) : null}

            {/* Actions */}
            <View className="flex-row items-center py-4" style={{ borderTopColor: '#1a3a5c', borderTopWidth: 0.5, borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
              <Pressable testID="detail-like-button" onPress={handleLike} className="flex-row items-center mr-8">
                <Animated.View style={heartAnimatedStyle}>
                  <Heart
                    size={22}
                    color={post.isLiked ? '#FF4E6A' : '#4a6fa5'}
                    fill={post.isLiked ? '#FF4E6A' : 'transparent'}
                  />
                </Animated.View>
                <Text className="ml-2 text-sm" style={{ color: post.isLiked ? '#FF4E6A' : '#4a6fa5' }}>
                  {post.likeCount}
                </Text>
              </Pressable>

              <Pressable testID="detail-reblog-button" onPress={() => reblogMutation.mutate()} className="flex-row items-center mr-8">
                <Repeat2 size={22} color="#4a6fa5" />
                <Text className="ml-2 text-sm" style={{ color: '#4a6fa5' }}>{post.reblogCount}</Text>
              </Pressable>

              <Pressable className="flex-row items-center mr-8">
                <MessageCircle size={22} color="#4a6fa5" />
                <Text className="ml-2 text-sm" style={{ color: '#4a6fa5' }}>{post.commentCount}</Text>
              </Pressable>

              <Pressable testID="detail-share-button" className="ml-auto">
                <Share size={20} color="#4a6fa5" />
              </Pressable>
            </View>
          </View>

          {/* Comments */}
          <View className="px-4 pt-4">
            <Text className="text-white font-bold text-base mb-4">
              Comments ({comments?.length ?? 0})
            </Text>

            {loadingComments ? (
              <ActivityIndicator color="#00CF35" className="mb-4" />
            ) : (comments ?? []).length === 0 ? (
              <Text className="text-sm mb-4" style={{ color: '#4a6fa5' }}>No comments yet</Text>
            ) : (
              (comments ?? []).map((comment) => (
                <View key={comment.id} testID={`comment-${comment.id}`} className="flex-row mb-4">
                  <UserAvatar uri={comment.user.image} name={comment.user.name} size={32} />
                  <View className="flex-1 ml-3 rounded-xl px-3 py-2" style={{ backgroundColor: '#0a2d50' }}>
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-white font-semibold text-xs">
                        {comment.user.username ?? comment.user.name}
                      </Text>
                      <Text className="text-xs" style={{ color: '#4a6fa5' }}>
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </Text>
                    </View>
                    <Text className="text-white text-sm" style={{ opacity: 0.9 }}>
                      {comment.content}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View className="h-20" />
        </ScrollView>

        {/* Comment Input */}
        <View className="flex-row items-center px-4 py-3" style={{ backgroundColor: '#0a2d50', borderTopColor: '#1a3a5c', borderTopWidth: 0.5 }}>
          <TextInput
            testID="comment-input"
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor="#4a6fa5"
            className="flex-1 text-white text-sm mr-3 rounded-xl px-4 py-2"
            style={{ backgroundColor: '#001935', borderColor: '#1a3a5c', borderWidth: 1 }}
          />
          <Pressable
            testID="send-comment-button"
            onPress={() => addComment.mutate()}
            disabled={!commentText.trim() || addComment.isPending}
            className="rounded-full p-2"
            style={{ backgroundColor: commentText.trim() ? '#00CF35' : '#1a3a5c' }}
          >
            {addComment.isPending ? (
              <ActivityIndicator color="#001935" size="small" />
            ) : (
              <Send size={18} color={commentText.trim() ? '#001935' : '#4a6fa5'} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {mediaViewer ? (
        <MediaViewer
          visible={mediaViewer.visible}
          type={mediaViewer.type}
          uri={mediaViewer.uri}
          onClose={() => setMediaViewer(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
