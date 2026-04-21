import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp, Star, StarOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type TopPost = {
  id: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  featured?: boolean;
  user: { id: string; name: string; username: string | null; image: string | null };
  _count: { likes: number; comments: number; reblogs: number };
};

export default function AdminTopContentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['admin', 'top-content'],
    queryFn: () => api.get<TopPost[]>('/api/admin/top-content'),
    enabled: admin,
  });

  const { data: featuredPosts } = useQuery({
    queryKey: ['admin', 'featured'],
    queryFn: () => api.get<TopPost[]>('/api/admin/featured'),
    enabled: admin,
  });

  const featurePost = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/posts/${id}/feature`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'top-content'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const unfeaturePost = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/posts/${id}/unfeature`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'top-content'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-top-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  const featuredIds = new Set((featuredPosts ?? []).map((p) => p.id));

  return (
    <SafeAreaView testID="admin-top-content-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-top-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Top Content</Text>
        <TrendingUp size={18} color="#00CF35" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !posts?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <Text style={{ color: theme.subtext, fontSize: 14 }}>No posts available.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {posts.map((post, index) => {
              const isFeatured = featuredIds.has(post.id);
              return (
                <View
                  key={post.id}
                  testID={`admin-top-post-${post.id}`}
                  style={{
                    backgroundColor: theme.card, borderRadius: 14, borderWidth: 0.5,
                    borderColor: isFeatured ? 'rgba(251,191,36,0.4)' : theme.border,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row', padding: 12, gap: 10, alignItems: 'flex-start' }}>
                    {/* Rank */}
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: index < 3 ? 'rgba(0,207,53,0.15)' : theme.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: index < 3 ? '#00CF35' : theme.subtext, fontSize: 12, fontWeight: '800' }}>#{index + 1}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      {/* User */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {post.user.image !== null ? (
                          <Image source={{ uri: post.user.image }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                        ) : null}
                        <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '600' }}>{post.user.name}</Text>
                        {isFeatured ? (
                          <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ color: '#fbbf24', fontSize: 9, fontWeight: '700' }}>FEATURED</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Content */}
                      <Text style={{ color: theme.text, fontSize: 14, lineHeight: 19 }} numberOfLines={3}>
                        {post.content ?? '(no text)'}
                      </Text>

                      {/* Stats */}
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          <Text style={{ color: '#FF4E6A', fontWeight: '700' }}>{post._count.likes}</Text> likes
                        </Text>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          <Text style={{ color: '#60a5fa', fontWeight: '700' }}>{post._count.comments}</Text> comments
                        </Text>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          <Text style={{ color: '#00CF35', fontWeight: '700' }}>{post._count.reblogs}</Text> reblogs
                        </Text>
                      </View>
                    </View>

                    {post.imageUrl !== null ? (
                      <Image source={{ uri: post.imageUrl }} style={{ width: 50, height: 50, borderRadius: 8 }} />
                    ) : null}
                  </View>

                  {/* Feature toggle */}
                  <View style={{ borderTopWidth: 0.5, borderTopColor: theme.border }}>
                    <Pressable
                      testID={`admin-top-feature-${post.id}`}
                      onPress={() => {
                        if (isFeatured) {
                          unfeaturePost.mutate(post.id);
                        } else {
                          featurePost.mutate(post.id);
                        }
                      }}
                      disabled={
                        (featurePost.isPending === true && featurePost.variables === post.id) ||
                        (unfeaturePost.isPending === true && unfeaturePost.variables === post.id)
                      }
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        paddingVertical: 10,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      {isFeatured ? (
                        <StarOff size={13} color="#fb923c" />
                      ) : (
                        <Star size={13} color="#fbbf24" />
                      )}
                      <Text style={{ color: isFeatured ? '#fb923c' : '#fbbf24', fontSize: 12, fontWeight: '600' }}>
                        {isFeatured ? 'Unfeature' : 'Feature Post'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
