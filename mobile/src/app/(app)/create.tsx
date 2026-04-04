import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Type, ImageIcon, Quote, Link, X, Video as VideoIcon, Camera } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';
import { pickImage, pickVideo, takePhoto, recordVideo } from '@/lib/file-picker';
import { uploadFile, uploadFileWithProgress } from '@/lib/upload';

type PostType = 'text' | 'photo' | 'quote' | 'link' | 'video';

const postTypes: { key: PostType; label: string; icon: typeof Type }[] = [
  { key: 'text', label: 'Text', icon: Type },
  { key: 'photo', label: 'Photo', icon: ImageIcon },
  { key: 'quote', label: 'Quote', icon: Quote },
  { key: 'link', label: 'Link', icon: Link },
  { key: 'video', label: 'Video', icon: VideoIcon },
];

const CATEGORIES = [
  'Art & Design', 'Photography', 'Music', 'Writing & Poetry', 'Gaming',
  'Fashion & Style', 'Food & Cooking', 'Travel', 'Nature & Animals', 'Sports',
  'Technology', 'Humor & Memes', 'Film & TV', 'Comics', 'Science', 'LGBTQ+',
  'Wellness', 'Social', 'Dating', 'Friendships', 'Politics', 'Thoughts',
];

export default function CreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(4 / 3);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = await pickImage();
      if (!file) return null;
      return uploadFile(file.uri, file.filename, file.mimeType);
    },
    onSuccess: (result) => {
      if (result) setImageUrl(result.url);
    },
  });

  const takePictureMutation = useMutation({
    mutationFn: async () => {
      const file = await takePhoto();
      if (!file) return null;
      return uploadFile(file.uri, file.filename, file.mimeType);
    },
    onSuccess: (result) => {
      if (result) setImageUrl(result.url);
    },
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async () => {
      const file = await pickVideo();
      if (!file) return null;
      setVideoUploadProgress(0);
      return uploadFileWithProgress(file.uri, file.filename, file.mimeType, setVideoUploadProgress);
    },
    onSuccess: (result) => {
      if (result) setVideoUrl(result.url);
      setVideoUploadProgress(0);
    },
    onError: () => setVideoUploadProgress(0),
  });

  const recordVideoMutation = useMutation({
    mutationFn: async () => {
      const file = await recordVideo();
      if (!file) return null;
      setVideoUploadProgress(0);
      return uploadFileWithProgress(file.uri, file.filename, file.mimeType, setVideoUploadProgress);
    },
    onSuccess: (result) => {
      if (result) setVideoUrl(result.url);
      setVideoUploadProgress(0);
    },
    onError: () => setVideoUploadProgress(0),
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      return api.post('/api/posts', {
        type: postType,
        title: title || undefined,
        content: content || undefined,
        imageUrl: postType === 'photo' ? imageUrl || undefined : undefined,
        videoUrl: postType === 'video' ? videoUrl || undefined : undefined,
        linkUrl: postType === 'link' ? linkUrl || undefined : undefined,
        tags: tags.length > 0 ? tags : undefined,
        category: category || undefined,
        isExplicit,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTitle('');
      setContent('');
      setImageUrl('');
      setVideoUrl('');
      setLinkUrl('');
      setTagsInput('');
      setCategory('');
      setIsExplicit(false);
      router.navigate('/(app)' as any);
    },
  });

  const tagChips = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const canPost = content.trim().length > 0 || imageUrl.trim().length > 0 || videoUrl.trim().length > 0;
  const isUploading = uploadMutation.isPending || takePictureMutation.isPending;
  const isVideoUploading = uploadVideoMutation.isPending || recordVideoMutation.isPending;

  return (
    <SafeAreaView testID="create-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Pressable testID="cancel-button" onPress={() => router.back()}>
          <Text style={{ color: '#4a6fa5' }} className="text-base">Cancel</Text>
        </Pressable>
        <Text className="text-white font-bold text-lg">New Post</Text>
        <Pressable
          testID="post-button"
          onPress={() => createPost.mutate()}
          disabled={!canPost || createPost.isPending}
          className="rounded-full px-5 py-1.5"
          style={{ backgroundColor: canPost ? '#00CF35' : '#0a2d50' }}
        >
          {createPost.isPending ? (
            <ActivityIndicator testID="loading-indicator" color="#001935" size="small" />
          ) : (
            <Text className="font-bold text-sm" style={{ color: canPost ? '#001935' : '#4a6fa5' }}>
              Post
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Post Type Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
          {postTypes.map((pt) => {
            const isActive = postType === pt.key;
            const IconComponent = pt.icon;
            return (
              <Pressable
                key={pt.key}
                testID={`post-type-${pt.key}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPostType(pt.key);
                }}
                className={cn(
                  'items-center py-3 rounded-xl px-4',
                )}
                style={{
                  backgroundColor: isActive ? '#00CF35' : '#0a2d50',
                  borderColor: '#1a3a5c',
                  borderWidth: isActive ? 0 : 1,
                  minWidth: 64,
                }}
              >
                <IconComponent size={20} color={isActive ? '#001935' : '#4a6fa5'} />
                <Text
                  className="text-xs font-medium mt-1"
                  style={{ color: isActive ? '#001935' : '#4a6fa5' }}
                >
                  {pt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Title */}
        {(postType === 'text' || postType === 'link') ? (
          <TextInput
            testID="title-input"
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor="#4a6fa5"
            className="text-white text-xl font-bold mb-4 pb-3"
            style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
          />
        ) : null}

        {/* Content */}
        <TextInput
          testID="content-input"
          value={content}
          onChangeText={setContent}
          placeholder={postType === 'quote' ? 'Enter your quote...' : 'Go ahead, put anything.'}
          placeholderTextColor="#4a6fa5"
          multiline
          textAlignVertical="top"
          className="text-white text-base mb-4 min-h-[120px]"
          style={{ lineHeight: 22 }}
        />

        {/* Image picker for photo posts */}
        {postType === 'photo' ? (
          <View className="mb-4">
            {imageUrl ? (
              <View className="rounded-xl overflow-hidden" style={{ position: 'relative', backgroundColor: '#0a2d50' }}>
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: '100%', aspectRatio: imageAspectRatio, borderRadius: 12 }}
                  contentFit="contain"
                  onLoad={(e) => {
                    const { width: w, height: h } = e.source;
                    if (w && h) setImageAspectRatio(w / h);
                  }}
                />
                <Pressable
                  testID="remove-image-button"
                  onPress={() => setImageUrl('')}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 16,
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Pressable
                  testID="pick-image-button"
                  onPress={() => uploadMutation.mutate()}
                  disabled={isUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {uploadMutation.isPending ? (
                    <ActivityIndicator testID="upload-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <ImageIcon size={24} color="#4a6fa5" />
                      <Text className="text-xs mt-2" style={{ color: '#4a6fa5' }}>Library</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="take-photo-button"
                  onPress={() => takePictureMutation.mutate()}
                  disabled={isUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {takePictureMutation.isPending ? (
                    <ActivityIndicator testID="camera-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <Camera size={24} color="#4a6fa5" />
                      <Text className="text-xs mt-2" style={{ color: '#4a6fa5' }}>Camera</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
            {uploadMutation.isError ? (
              <Text className="text-red-400 text-xs mt-2 text-center">
                {uploadMutation.error.message}
              </Text>
            ) : null}
            {takePictureMutation.isError ? (
              <Text className="text-red-400 text-xs mt-2 text-center">
                {takePictureMutation.error.message}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Video picker for video posts */}
        {postType === 'video' ? (
          <View className="mb-4">
            {videoUrl ? (
              <View className="rounded-xl overflow-hidden items-center justify-center" style={{ backgroundColor: '#0a2d50', height: 120, position: 'relative' }}>
                <VideoIcon size={28} color="#00CF35" />
                <Text className="text-sm mt-2 px-4 text-center" style={{ color: '#4a6fa5' }} numberOfLines={1}>
                  {videoUrl}
                </Text>
                <Pressable
                  testID="remove-video-button"
                  onPress={() => setVideoUrl('')}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 16,
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Pressable
                  testID="pick-video-button"
                  onPress={() => uploadVideoMutation.mutate()}
                  disabled={isVideoUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {uploadVideoMutation.isPending ? (
                    <ActivityIndicator testID="upload-video-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <VideoIcon size={24} color="#4a6fa5" />
                      <Text className="text-xs mt-2" style={{ color: '#4a6fa5' }}>Library</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="record-video-button"
                  onPress={() => recordVideoMutation.mutate()}
                  disabled={isVideoUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {recordVideoMutation.isPending ? (
                    <ActivityIndicator testID="record-video-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <Camera size={24} color="#4a6fa5" />
                      <Text className="text-xs mt-2" style={{ color: '#4a6fa5' }}>Record</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
            {uploadVideoMutation.isError ? (
              <Text className="text-red-400 text-xs mt-2 text-center">
                {uploadVideoMutation.error.message}
              </Text>
            ) : null}
            {recordVideoMutation.isError ? (
              <Text className="text-red-400 text-xs mt-2 text-center">
                {recordVideoMutation.error.message}
              </Text>
            ) : null}
            {(uploadVideoMutation.isPending || recordVideoMutation.isPending) && videoUploadProgress > 0 ? (
              <View className="mt-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs" style={{ color: '#4a6fa5' }}>Uploading video…</Text>
                  <Text className="text-xs font-semibold" style={{ color: '#00CF35' }}>
                    {Math.round(videoUploadProgress * 100)}%
                  </Text>
                </View>
                <View style={{ height: 4, backgroundColor: '#0a2d50', borderRadius: 2, overflow: 'hidden' }}>
                  <View
                    testID="video-upload-progress-bar"
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#00CF35',
                      width: `${Math.round(videoUploadProgress * 100)}%`,
                    }}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Link URL for link posts */}
        {postType === 'link' ? (
          <TextInput
            testID="link-url-input"
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="Link URL"
            placeholderTextColor="#4a6fa5"
            autoCapitalize="none"
            keyboardType="url"
            className="rounded-xl px-4 py-3 text-white text-sm mb-4"
            style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
          />
        ) : null}

        {/* Tags */}
        <TextInput
          testID="tags-input"
          value={tagsInput}
          onChangeText={setTagsInput}
          placeholder="Tags (comma separated)"
          placeholderTextColor="#4a6fa5"
          className="rounded-xl px-4 py-3 text-white text-sm mb-3"
          style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
        />

        {tagChips.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {tagChips.map((tag) => (
              <View key={tag} className="rounded-full px-3 py-1" style={{ backgroundColor: '#0a2d50' }}>
                <Text style={{ color: '#00CF35' }} className="text-xs">#{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Categories */}
        <Text className="text-white font-semibold text-sm mb-2">Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
          {CATEGORIES.map((cat) => {
            const isActive = category === cat;
            return (
              <Pressable
                key={cat}
                testID={`category-${cat}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCategory(isActive ? '' : cat);
                }}
                className="rounded-full px-4 py-2"
                style={{
                  backgroundColor: isActive ? '#00CF35' : 'transparent',
                  borderColor: isActive ? '#00CF35' : '#1a3a5c',
                  borderWidth: 1,
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: isActive ? '#001935' : '#4a6fa5' }}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Explicit Content Toggle */}
        <View className="flex-row items-center justify-between mb-2 py-3" style={{ borderTopColor: '#1a3a5c', borderTopWidth: 0.5 }}>
          <View className="flex-1">
            <Text className="text-white font-semibold text-sm">Explicit content</Text>
            {isExplicit ? (
              <Text className="text-xs mt-0.5" style={{ color: '#FF6B35' }}>
                This post will require a content warning
              </Text>
            ) : null}
          </View>
          <Pressable
            testID="explicit-toggle"
            onPress={() => {
              Haptics.selectionAsync();
              setIsExplicit(!isExplicit);
            }}
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              backgroundColor: isExplicit ? '#FF6B35' : '#0a2d50',
              borderColor: isExplicit ? '#FF6B35' : '#1a3a5c',
              borderWidth: 1,
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FFFFFF',
                transform: [{ translateX: isExplicit ? 20 : 0 }],
              }}
            />
          </Pressable>
        </View>

        {createPost.isError ? (
          <Text className="text-red-400 text-center text-sm mt-2">
            {createPost.error.message}
          </Text>
        ) : null}

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
