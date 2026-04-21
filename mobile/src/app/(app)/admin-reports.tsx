import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type ReportedPost = {
  id: string;
  content: string | null;
  imageUrl: string | null;
  reportCount: number;
  hidden: boolean;
  createdAt: string;
  user: { id: string; name: string; username: string | null; image: string | null };
  reports: { category: string; reason: string | null; createdAt: string }[];
};

export default function AdminReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: reportedPosts, isLoading } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => api.get<ReportedPost[]>('/api/admin/reports'),
    enabled: admin,
  });

  const hidePost = useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/hide`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deletePost = useMutation({
    mutationFn: (postId: string) => api.delete(`/api/admin/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-reports-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-reports-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-reports-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Flagged Posts</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !reportedPosts?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,207,53,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Flag size={24} color="#00CF35" />
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>All clear</Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center' }}>No posts with 3+ reports.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {reportedPosts.map((post) => (
              <FlaggedPostCard
                key={post.id}
                post={post}
                onHide={() => hidePost.mutate(post.id)}
                onDelete={() => deletePost.mutate(post.id)}
                isHiding={hidePost.isPending === true && hidePost.variables === post.id}
                isDeleting={deletePost.isPending === true && deletePost.variables === post.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FlaggedPostCard({
  post, onHide, onDelete, isHiding, isDeleting,
}: {
  post: ReportedPost;
  onHide: () => void;
  onDelete: () => void;
  isHiding: boolean;
  isDeleting: boolean;
}) {
  const theme = useTheme();
  const borderColor = post.reportCount >= 5 ? 'rgba(255,78,106,0.6)' : post.reportCount >= 2 ? 'rgba(255,159,28,0.5)' : theme.border;
  const bgTint = post.reportCount >= 5 ? 'rgba(255,78,106,0.07)' : post.reportCount >= 2 ? 'rgba(255,159,28,0.05)' : 'transparent';

  return (
    <View
      testID={`admin-post-${post.id}`}
      style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 0.5, borderColor, overflow: 'hidden' }}
    >
      {bgTint !== 'transparent' ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bgTint, pointerEvents: 'none' }} />
      ) : null}

      <View style={{ padding: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {post.user.image ? (
          <Image source={{ uri: post.user.image }} style={{ width: 28, height: 28, borderRadius: 14 }} />
        ) : (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{post.user.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{post.user.name}</Text>
          {post.user.username !== null ? (
            <Text style={{ color: theme.subtext, fontSize: 11 }}>@{post.user.username}</Text>
          ) : null}
        </View>
        <View style={{ backgroundColor: 'rgba(255,78,106,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
          <Text style={{ color: '#FF4E6A', fontSize: 11, fontWeight: '700' }}>{post.reportCount} reports</Text>
        </View>
      </View>

      <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 }} numberOfLines={4}>
        {post.content ?? '(no text)'}
      </Text>

      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: theme.border }}>
        <Pressable
          testID={`admin-hide-${post.id}`}
          onPress={onHide}
          disabled={isHiding || isDeleting}
          style={({ pressed }) => ({
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 13, borderRightWidth: 0.5, borderRightColor: theme.border,
            opacity: pressed || isHiding ? 0.6 : 1,
          })}
        >
          <Text style={{ color: post.hidden ? theme.subtext : '#fb923c', fontWeight: '600', fontSize: 14 }}>
            {isHiding ? 'Hiding…' : post.hidden ? 'Hidden' : 'Hide'}
          </Text>
        </Pressable>
        <Pressable
          testID={`admin-delete-${post.id}`}
          onPress={onDelete}
          disabled={isDeleting || isHiding}
          style={({ pressed }) => ({
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 13,
            opacity: pressed || isDeleting ? 0.6 : 1,
          })}
        >
          <Text style={{ color: '#FF4E6A', fontWeight: '600', fontSize: 14 }}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
