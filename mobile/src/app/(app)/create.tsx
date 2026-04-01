import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Type, ImageIcon, Quote, Link } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { cn } from '@/lib/cn';

type PostType = 'text' | 'photo' | 'quote' | 'link';

const postTypes: { key: PostType; label: string; icon: typeof Type }[] = [
  { key: 'text', label: 'Text', icon: Type },
  { key: 'photo', label: 'Photo', icon: ImageIcon },
  { key: 'quote', label: 'Quote', icon: Quote },
  { key: 'link', label: 'Link', icon: Link },
];

export default function CreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const createPost = useMutation({
    mutationFn: async () => {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .join(',');

      return api.post('/api/posts', {
        type: postType,
        title: title || null,
        content: content || null,
        imageUrl: postType === 'photo' ? imageUrl || null : null,
        linkUrl: postType === 'link' ? linkUrl || null : null,
        tags: tags || null,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setTitle('');
      setContent('');
      setImageUrl('');
      setLinkUrl('');
      setTagsInput('');
      router.navigate('/(app)' as any);
    },
  });

  const tagChips = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const canPost = content.trim().length > 0 || imageUrl.trim().length > 0;

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
        <View className="flex-row gap-2 mb-6">
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
                  'flex-1 items-center py-3 rounded-xl',
                )}
                style={{
                  backgroundColor: isActive ? '#00CF35' : '#0a2d50',
                  borderColor: '#1a3a5c',
                  borderWidth: isActive ? 0 : 1,
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
        </View>

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

        {/* Image URL for photo posts */}
        {postType === 'photo' ? (
          <TextInput
            testID="image-url-input"
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="Image URL"
            placeholderTextColor="#4a6fa5"
            className="rounded-xl px-4 py-3 text-white text-sm mb-4"
            style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
          />
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

        {createPost.isError ? (
          <Text className="text-red-400 text-center text-sm mt-2">
            {createPost.error.message}
          </Text>
        ) : null}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
