import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { MentionTextInput } from '@/components/MentionTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Type, ImageIcon, Quote, Link, X, Video as VideoIcon, Camera, Layers, Lock } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';
import { pickMultipleImages, pickVideo, takePhoto, recordVideo } from '@/lib/file-picker';
import { uploadFile, uploadFileWithProgress } from '@/lib/upload';
import { useTheme } from '@/lib/theme';

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
  const theme = useTheme();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const queryClient = useQueryClient();
  const { roomId: paramRoomId } = useLocalSearchParams<{ roomId?: string }>();
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [category, setCategory] = useState<string>('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(paramRoomId ?? null);

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/api/rooms'),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const files = await pickMultipleImages();
      if (!files.length) return [];
      return Promise.all(files.map((f) => uploadFile(f.uri, f.filename, f.mimeType)));
    },
    onSuccess: (results) => {
      const urls = results.filter(Boolean).map((r) => r!.url);
      setImageUrls((prev) => [...prev, ...urls]);
    },
  });

  const takePictureMutation = useMutation({
    mutationFn: async () => {
      const file = await takePhoto();
      if (!file) return null;
      return uploadFile(file.uri, file.filename, file.mimeType);
    },
    onSuccess: (result) => {
      if (result) setImageUrls((prev) => [...prev, result.url]);
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

  const handleTagInputChange = (text: string) => {
    const delimiter = text.endsWith(',') || text.endsWith(' ');
    if (delimiter) {
      const newTag = text.replace(/[, ]+$/, '').trim().toLowerCase().replace(/^#+/, '');
      if (newTag && !tags.includes(newTag)) {
        setTags((prev) => [...prev, newTag]);
      }
      setTagInput('');
    } else {
      setTagInput(text);
    }
  };

  const handleTagInputSubmit = () => {
    const newTag = tagInput.trim().toLowerCase().replace(/^#+/, '');
    if (newTag && !tags.includes(newTag)) {
      setTags((prev) => [...prev, newTag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const createPost = useMutation({
    mutationFn: async () => {
      const allTags = tagInput.trim()
        ? [...tags, tagInput.trim().toLowerCase().replace(/^#+/, '')].filter(Boolean)
        : tags;

      return api.post('/api/posts', {
        type: postType,
        title: title || undefined,
        content: content || undefined,
        imageUrls: postType === 'photo' ? (imageUrls.length > 0 ? imageUrls : undefined) : undefined,
        videoUrl: postType === 'video' ? videoUrl || undefined : undefined,
        linkUrl: postType === 'link' ? linkUrl || undefined : undefined,
        tags: allTags.length > 0 ? allTags : undefined,
        category: category || undefined,
        isExplicit,
        roomId: selectedRoomId || undefined,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTitle('');
      setContent('');
      setImageUrls([]);
      setVideoUrl('');
      setLinkUrl('');
      setTags([]);
      setTagInput('');
      setCategory('');
      setIsExplicit(false);
      setSelectedRoomId(null);
      router.back();
    },
  });

  const canPost = content.trim().length > 0 || imageUrls.length > 0 || videoUrl.trim().length > 0;
  const isUploading = uploadMutation.isPending || takePictureMutation.isPending;
  const isVideoUploading = uploadVideoMutation.isPending || recordVideoMutation.isPending;

  return (
    <SafeAreaView testID="create-screen" className="flex-1" style={{ backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}>
        <Pressable testID="cancel-button" onPress={handleBack}>
          <Text style={{ color: theme.subtext }} className="text-base">Cancel</Text>
        </Pressable>
        <Text style={{ color: theme.text }} className="font-bold text-lg">New Post</Text>
        <Pressable
          testID="post-button"
          onPress={() => createPost.mutate()}
          disabled={!canPost || createPost.isPending}
          className="rounded-full px-5 py-1.5"
          style={{ backgroundColor: canPost ? '#00CF35' : theme.card }}
        >
          {createPost.isPending ? (
            <ActivityIndicator testID="loading-indicator" color="#001935" size="small" />
          ) : (
            <Text className="font-bold text-sm" style={{ color: canPost ? '#001935' : theme.subtext }}>
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
                  backgroundColor: isActive ? '#00CF35' : theme.card,
                  borderColor: theme.border,
                  borderWidth: isActive ? 0 : 1,
                  minWidth: 64,
                }}
              >
                <IconComponent size={20} color={isActive ? '#001935' : theme.subtext} />
                <Text
                  className="text-xs font-medium mt-1"
                  style={{ color: isActive ? '#001935' : theme.subtext }}
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
            placeholderTextColor={theme.subtext}
            style={{ color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16, paddingBottom: 12, borderBottomColor: theme.border, borderBottomWidth: 0.5 }}
          />
        ) : null}

        {/* Content */}
        <MentionTextInput
          testID="content-input"
          value={content}
          onChangeText={setContent}
          placeholder={postType === 'quote' ? 'Enter your quote...' : 'Go ahead, put anything.'}
          placeholderTextColor={theme.subtext}
          multiline
          style={{ color: theme.text, fontSize: 16, marginBottom: 16, minHeight: 120, lineHeight: 22 }}
        />

        {/* Image picker for photo posts */}
        {postType === 'photo' ? (
          <View className="mb-4">
            {imageUrls.length > 0 ? (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                  {imageUrls.map((url, index) => (
                    <View key={url} style={{ width: 120, height: 120, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: theme.card }}>
                      <Image
                        source={{ uri: url }}
                        style={{ width: 120, height: 120, borderRadius: 12 }}
                        contentFit="cover"
                      />
                      <Pressable
                        onPress={() => setImageUrls((prev) => prev.filter((_, i) => i !== index))}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
                          width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <X size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => uploadMutation.mutate()}
                    disabled={isUploading}
                    style={{ width: 120, height: 120, borderRadius: 12, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {uploadMutation.isPending ? (
                      <ActivityIndicator color="#00CF35" />
                    ) : (
                      <>
                        <ImageIcon size={20} color={theme.subtext} />
                        <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 4 }}>Add more</Text>
                      </>
                    )}
                  </Pressable>
                </ScrollView>
                <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 4 }}>{imageUrls.length} photo{imageUrls.length !== 1 ? 's' : ''} selected</Text>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Pressable
                  testID="pick-image-button"
                  onPress={() => uploadMutation.mutate()}
                  disabled={isUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {uploadMutation.isPending ? (
                    <ActivityIndicator testID="upload-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <ImageIcon size={24} color={theme.subtext} />
                      <Text className="text-xs mt-2" style={{ color: theme.subtext }}>Library</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="take-photo-button"
                  onPress={() => takePictureMutation.mutate()}
                  disabled={isUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {takePictureMutation.isPending ? (
                    <ActivityIndicator testID="camera-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <Camera size={24} color={theme.subtext} />
                      <Text className="text-xs mt-2" style={{ color: theme.subtext }}>Camera</Text>
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
              <View className="rounded-xl overflow-hidden items-center justify-center" style={{ backgroundColor: theme.card, height: 120, position: 'relative' }}>
                <VideoIcon size={28} color="#00CF35" />
                <Text className="text-sm mt-2 px-4 text-center" style={{ color: theme.subtext }} numberOfLines={1}>
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
                  style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {uploadVideoMutation.isPending ? (
                    <ActivityIndicator testID="upload-video-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <VideoIcon size={24} color={theme.subtext} />
                      <Text className="text-xs mt-2" style={{ color: theme.subtext }}>Library</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="record-video-button"
                  onPress={() => recordVideoMutation.mutate()}
                  disabled={isVideoUploading}
                  className="flex-1 rounded-xl items-center justify-center py-8"
                  style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed' }}
                >
                  {recordVideoMutation.isPending ? (
                    <ActivityIndicator testID="record-video-loading-indicator" color="#00CF35" />
                  ) : (
                    <>
                      <Camera size={24} color={theme.subtext} />
                      <Text className="text-xs mt-2" style={{ color: theme.subtext }}>Record</Text>
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
                  <Text className="text-xs" style={{ color: theme.subtext }}>Uploading video…</Text>
                  <Text className="text-xs font-semibold" style={{ color: '#00CF35' }}>
                    {Math.round(videoUploadProgress * 100)}%
                  </Text>
                </View>
                <View style={{ height: 4, backgroundColor: theme.card, borderRadius: 2, overflow: 'hidden' }}>
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
            placeholderTextColor={theme.subtext}
            autoCapitalize="none"
            keyboardType="url"
            style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, fontSize: 14, marginBottom: 16 }}
          />
        ) : null}

        {/* Tags */}
        {tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => removeTag(tag)}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,207,53,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4, borderWidth: 0.5, borderColor: 'rgba(0,207,53,0.3)' }}
              >
                <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '600' }}>#{tag}</Text>
                <X size={12} color="#00CF35" />
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextInput
          testID="tags-input"
          value={tagInput}
          onChangeText={handleTagInputChange}
          onSubmitEditing={handleTagInputSubmit}
          placeholder="Add tags (type + space or comma)"
          placeholderTextColor={theme.subtext}
          returnKeyType="done"
          blurOnSubmit={false}
          style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, fontSize: 14, marginBottom: 12 }}
        />

        {/* Categories */}
        <Text style={{ color: theme.text }} className="font-semibold text-sm mb-2">Category</Text>
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
                  borderColor: isActive ? '#00CF35' : theme.border,
                  borderWidth: 1,
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: isActive ? '#001935' : theme.subtext }}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Explicit Content Toggle */}
        <View className="flex-row items-center justify-between mb-2 py-3" style={{ borderTopColor: theme.border, borderTopWidth: 0.5 }}>
          <View className="flex-1">
            <Text style={{ color: theme.text }} className="font-semibold text-sm">Explicit content</Text>
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
              backgroundColor: isExplicit ? '#FF6B35' : theme.card,
              borderColor: isExplicit ? '#FF6B35' : theme.border,
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

        {/* Post to Room */}
        {rooms && rooms.length > 0 ? (
          <View style={{ borderTopColor: theme.border, borderTopWidth: 0.5, paddingTop: 12, marginTop: 4, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Layers size={14} color={theme.subtext} />
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>Post to Room</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              <Pressable
                onPress={() => setSelectedRoomId(null)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: selectedRoomId === null ? '#00CF35' : 'transparent',
                  borderWidth: 1, borderColor: selectedRoomId === null ? '#00CF35' : theme.border,
                }}
              >
                <Text style={{ color: selectedRoomId === null ? '#001935' : theme.subtext, fontSize: 13, fontWeight: '600' }}>Public</Text>
              </Pressable>
              {rooms.map((room) => (
                <Pressable
                  key={room.id}
                  testID={`room-option-${room.id}`}
                  onPress={() => setSelectedRoomId(selectedRoomId === room.id ? null : room.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: selectedRoomId === room.id ? '#00CF35' : 'transparent',
                    borderWidth: 1, borderColor: selectedRoomId === room.id ? '#00CF35' : theme.border,
                  }}
                >
                  <Lock size={11} color={selectedRoomId === room.id ? '#001935' : theme.subtext} />
                  <Text style={{ color: selectedRoomId === room.id ? '#001935' : theme.subtext, fontSize: 13, fontWeight: '600' }}>{room.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

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
