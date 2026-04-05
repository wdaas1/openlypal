import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import type { User } from '@/lib/types';

const CATEGORIES = [
  { id: 'art', label: 'Art & Design', emoji: '🎨' },
  { id: 'photography', label: 'Photography', emoji: '📷' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'writing', label: 'Writing & Poetry', emoji: '✍️' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'fashion', label: 'Fashion & Style', emoji: '👗' },
  { id: 'food', label: 'Food & Cooking', emoji: '🍔' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'nature', label: 'Nature & Animals', emoji: '🌿' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'tech', label: 'Technology', emoji: '💻' },
  { id: 'humor', label: 'Humor & Memes', emoji: '😂' },
  { id: 'film', label: 'Film & TV', emoji: '🎬' },
  { id: 'comics', label: 'Comics', emoji: '💥' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'lgbtq', label: 'LGBTQ+', emoji: '🏳️‍🌈' },
  { id: 'wellness', label: 'Wellness', emoji: '🌿' },
  { id: 'social', label: 'Social', emoji: '💬' },
  { id: 'dating', label: 'Dating', emoji: '❤️' },
  { id: 'friendships', label: 'Friendships', emoji: '🤝' },
  { id: 'politics', label: 'Politics', emoji: '🗳️' },
  { id: 'thoughts', label: 'Thoughts', emoji: '🧠' },
];

export default function InterestsScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load profile once to prefill selections
  useQuery({
    queryKey: ['profile-interests', session?.user?.id, initialized],
    queryFn: async () => {
      const user = await api.get<User>(`/api/users/${session?.user?.id}`);
      const existing = user?.categories
        ? user.categories.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      setSelectedIds(existing);
      setInitialized(true);
      return user;
    },
    enabled: !!session?.user?.id && !initialized,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.patch('/api/users/me', { categories: selectedIds.join(',') });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    },
  });

  const toggleCategory = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const renderItem = ({ item }: { item: typeof CATEGORIES[number] }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <Pressable
        testID={`interest-${item.id}`}
        onPress={() => toggleCategory(item.id)}
        style={{
          flex: 1,
          margin: 6,
          borderRadius: 16,
          paddingVertical: 20,
          paddingHorizontal: 12,
          alignItems: 'center',
          backgroundColor: isSelected ? 'rgba(0,207,53,0.12)' : '#0a2d50',
          borderWidth: 1.5,
          borderColor: isSelected ? '#00CF35' : '#1a3a5c',
        }}
      >
        <Text style={{ fontSize: 32, marginBottom: 8 }}>{item.emoji}</Text>
        <Text
          className="text-xs font-semibold text-center"
          style={{ color: isSelected ? '#00CF35' : '#a0b4c8' }}
          numberOfLines={2}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView testID="interests-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
        <Pressable testID="back-button" onPress={handleBack}>
          <Text style={{ color: '#4a6fa5' }} className="text-base">Cancel</Text>
        </Pressable>
        <Text className="text-white font-bold text-lg">Interests</Text>
        <Pressable
          testID="save-interests-button"
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-full px-4 py-1.5"
          style={{ backgroundColor: '#00CF35' }}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator testID="save-loading-indicator" color="#001935" size="small" />
          ) : (
            <Text className="font-bold text-sm" style={{ color: '#001935' }}>Save</Text>
          )}
        </Pressable>
      </View>

      <View className="px-4 py-4">
        <Text className="text-white font-semibold text-base mb-1">What are you into?</Text>
        <Text className="text-sm" style={{ color: '#4a6fa5' }}>
          Select topics to personalize your feed. {selectedIds.length > 0 ? `${selectedIds.length} selected.` : null}
        </Text>
      </View>

      <FlatList
        testID="interests-list"
        data={CATEGORIES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />

      {saveMutation.isError ? (
        <Text className="text-red-400 text-sm text-center mx-4 mb-4">
          {saveMutation.error.message}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
