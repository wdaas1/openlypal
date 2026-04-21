import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type HiddenPost = {
  id: string;
  content: string | null;
  imageUrl: string | null;
  reportCount: number;
  createdAt: string;
  user: { id: string; name: string; username: string | null; image: string | null };
};

export default function AdminHiddenScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: hiddenPosts, isLoading } = useQuery({
    queryKey: ['admin', 'hidden'],
    queryFn: () => api.get<HiddenPost[]>('/api/admin/hidden'),
    enabled: admin,
  });

  const unhidePost = useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/unhide`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deletePost = useMutation({
    mutationFn: (postId: string) => api.delete(`/api/admin/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-hidden-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-hidden-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-hidden-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Hidden Posts</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !hiddenPosts?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(251,146,60,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <EyeOff size={24} color="#fb923c" />
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>No hidden posts</Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center' }}>Hidden posts will appear here.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {hiddenPosts.map((post) => (
              <HiddenPostCard
                key={post.id}
                post={post}
                onUnhide={() => unhidePost.mutate(post.id)}
                onDelete={() => deletePost.mutate(post.id)}
                isUnhiding={unhidePost.isPending === true && unhidePost.variables === post.id}
                isDeleting={deletePost.isPending === true && deletePost.variables === post.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HiddenPostCard({
  post, onUnhide, onDelete, isUnhiding, isDeleting,
}: {
  post: HiddenPost;
  onUnhide: () => void;
  onDelete: () => void;
  isUnhiding: boolean;
  isDeleting: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      testID={`admin-hidden-post-${post.id}`}
      style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 0.5, borderColor: theme.border, overflow: 'hidden', opacity: 0.85 }}
    >
      <View style={{ padding: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {post.user.image !== null ? (
          <Image source={{ uri: post.user.image }} style={{ width: 28, height: 28, borderRadius: 14 }} />
        ) : (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{post.user.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.subtext, fontSize: 13, fontWeight: '600' }}>{post.user.name}</Text>
          {post.user.username !== null ? (
            <Text style={{ color: theme.subtext, fontSize: 11 }}>@{post.user.username}</Text>
          ) : null}
        </View>
        {post.reportCount > 0 ? (
          <Text style={{ color: theme.subtext, fontSize: 11 }}>{post.reportCount} reports</Text>
        ) : null}
      </View>

      <Text style={{ color: theme.subtext, fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 }} numberOfLines={4}>
        {post.content ?? '(no text)'}
      </Text>

      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: theme.border }}>
        <Pressable
          testID={`admin-unhide-${post.id}`}
          onPress={onUnhide}
          disabled={isUnhiding || isDeleting}
          style={({ pressed }) => ({
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 13, borderRightWidth: 0.5, borderRightColor: theme.border,
            opacity: pressed || isUnhiding ? 0.6 : 1,
          })}
        >
          <Text style={{ color: '#00CF35', fontWeight: '600', fontSize: 14 }}>
            {isUnhiding ? 'Unhiding…' : 'Unhide'}
          </Text>
        </Pressable>
        <Pressable
          testID={`admin-hidden-delete-${post.id}`}
          onPress={onDelete}
          disabled={isDeleting || isUnhiding}
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
