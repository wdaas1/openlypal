import React from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Hash } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import type { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { useTheme } from '@/lib/theme';

export default function TagFeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const decodedTag = decodeURIComponent(tag ?? '');

  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts', 'tag', decodedTag],
    queryFn: () => api.get<Post[]>(`/api/posts?tag=${encodeURIComponent(decodedTag)}&limit=50`),
    enabled: !!decodedTag,
  });

  return (
    <SafeAreaView testID="tag-feed-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.card,
      }}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{ padding: 6, marginRight: 10, borderRadius: 20, backgroundColor: theme.card }}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={theme.text} />
        </Pressable>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(0,207,53,0.1)',
          borderWidth: 1,
          borderColor: 'rgba(0,207,53,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}>
          <Hash size={18} color="#00CF35" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 20 }}>#{decodedTag}</Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>
            {isLoading ? 'Loading...' : `${posts?.length ?? 0} posts`}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View testID="tag-feed-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" size="large" />
        </View>
      ) : (posts ?? []).length === 0 ? (
        <View testID="tag-feed-empty" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(0,207,53,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Hash size={28} color="#00CF35" />
          </View>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>No posts yet</Text>
          <Text style={{ color: theme.subtext, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>
            Be the first to post with #{decodedTag}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="tag-feed-list"
          data={posts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}
    </SafeAreaView>
  );
}
