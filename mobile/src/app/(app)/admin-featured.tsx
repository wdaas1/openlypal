import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, StarOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type FeaturedPost = {
  id: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; username: string | null; image: string | null };
  _count: { likes: number; comments: number; reblogs: number };
};

type TopPost = {
  id: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; username: string | null; image: string | null };
  _count: { likes: number; comments: number; reblogs: number };
};

export default function AdminFeaturedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: featuredPosts, isLoading: featuredLoading } = useQuery({
    queryKey: ['admin', 'featured'],
    queryFn: () => api.get<FeaturedPost[]>('/api/admin/featured'),
    enabled: admin,
  });

  const { data: topPosts, isLoading: topLoading } = useQuery({
    queryKey: ['admin', 'top-content'],
    queryFn: () => api.get<TopPost[]>('/api/admin/top-content'),
    enabled: admin,
  });

  const featurePost = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/posts/${id}/feature`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'top-content'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const unfeaturePost = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/posts/${id}/unfeature`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'top-content'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-featured-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  const featuredIds = new Set((featuredPosts ?? []).map((p) => p.id));

  return (
    <SafeAreaView testID="admin-featured-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-featured-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Featured Posts</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Currently Featured */}
        <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Currently Featured
        </Text>

        {featuredLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !featuredPosts?.length ? (
          <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 0.5, borderColor: theme.border }}>
            <Star size={20} color={theme.subtext} />
            <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 8, textAlign: 'center' }}>No featured posts yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 24 }}>
            {featuredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isFeatured={true}
                onToggle={() => unfeaturePost.mutate(post.id)}
                isLoading={unfeaturePost.isPending === true && unfeaturePost.variables === post.id}
              />
            ))}
          </View>
        )}

        {/* Top Posts — Feature Candidates */}
        <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Top Content — Feature Candidates
        </Text>

        {topLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !topPosts?.length ? (
          <View style={{ alignItems: 'center', padding: 24 }}>
            <Text style={{ color: theme.subtext, fontSize: 13 }}>No posts available.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {topPosts.map((post) => {
              const isFeatured = featuredIds.has(post.id);
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  isFeatured={isFeatured}
                  onToggle={() => {
                    if (isFeatured) {
                      unfeaturePost.mutate(post.id);
                    } else {
                      featurePost.mutate(post.id);
                    }
                  }}
                  isLoading={
                    (featurePost.isPending === true && featurePost.variables === post.id) ||
                    (unfeaturePost.isPending === true && unfeaturePost.variables === post.id)
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PostCard({
  post, isFeatured, onToggle, isLoading,
}: {
  post: TopPost | FeaturedPost;
  isFeatured: boolean;
  onToggle: () => void;
  isLoading: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      testID={`admin-featured-post-${post.id}`}
      style={{
        backgroundColor: theme.card, borderRadius: 14, borderWidth: 0.5,
        borderColor: isFeatured ? 'rgba(251,191,36,0.5)' : theme.border,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', padding: 12, gap: 10 }}>
        {post.imageUrl !== null ? (
          <Image source={{ uri: post.imageUrl }} style={{ width: 56, height: 56, borderRadius: 10 }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {post.user.image !== null ? (
              <Image source={{ uri: post.user.image }} style={{ width: 20, height: 20, borderRadius: 10 }} />
            ) : null}
            <Text style={{ color: theme.subtext, fontSize: 12 }}>{post.user.name}</Text>
            {isFeatured ? (
              <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                <Text style={{ color: '#fbbf24', fontSize: 9, fontWeight: '700' }}>FEATURED</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: theme.text, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {post.content ?? '(no text)'}
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 4 }}>
            {post._count.likes} likes · {post._count.comments} comments · {post._count.reblogs} reblogs
          </Text>
        </View>
      </View>

      <View style={{ borderTopWidth: 0.5, borderTopColor: theme.border }}>
        <Pressable
          testID={`admin-feature-toggle-${post.id}`}
          onPress={onToggle}
          disabled={isLoading}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 11,
            backgroundColor: isFeatured ? 'rgba(251,191,36,0.08)' : 'transparent',
            opacity: pressed || isLoading ? 0.6 : 1,
          })}
        >
          {isFeatured ? (
            <StarOff size={14} color="#fb923c" />
          ) : (
            <Star size={14} color="#fbbf24" />
          )}
          <Text style={{ color: isFeatured ? '#fb923c' : '#fbbf24', fontWeight: '600', fontSize: 13 }}>
            {isLoading ? '…' : isFeatured ? 'Unfeature' : 'Feature'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
