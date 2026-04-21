import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Eye, EyeOff, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type AdminComment = {
  id: string;
  content: string;
  hidden: boolean;
  reportCount: number;
  createdAt: string;
  user: { id: string; name: string; username: string | null; image: string | null };
  post: { id: string; content: string | null };
};

export default function AdminCommentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: comments, isLoading } = useQuery({
    queryKey: ['admin', 'comments'],
    queryFn: () => api.get<AdminComment[]>('/api/admin/comments'),
    enabled: admin,
  });

  const hideComment = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/comments/${id}/hide`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const unhideComment = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/comments/${id}/unhide`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deleteComment = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-comments-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-comments-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-comments-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Comments</Text>
        {comments ? (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>{comments.length} total</Text>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !comments?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(52,211,153,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <MessageSquare size={24} color="#34d399" />
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>No comments</Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center' }}>Comments will appear here.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onHide={() => hideComment.mutate(comment.id)}
                onUnhide={() => unhideComment.mutate(comment.id)}
                onDelete={() => deleteComment.mutate(comment.id)}
                isHiding={hideComment.isPending === true && hideComment.variables === comment.id}
                isUnhiding={unhideComment.isPending === true && unhideComment.variables === comment.id}
                isDeleting={deleteComment.isPending === true && deleteComment.variables === comment.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CommentCard({
  comment, onHide, onUnhide, onDelete, isHiding, isUnhiding, isDeleting,
}: {
  comment: AdminComment;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
  isHiding: boolean;
  isUnhiding: boolean;
  isDeleting: boolean;
}) {
  const theme = useTheme();
  const isBusy = isHiding || isUnhiding || isDeleting;

  return (
    <View
      testID={`admin-comment-${comment.id}`}
      style={{
        backgroundColor: theme.card, borderRadius: 14, borderWidth: 0.5,
        borderColor: comment.hidden ? theme.border : comment.reportCount > 0 ? 'rgba(255,78,106,0.4)' : theme.border,
        overflow: 'hidden',
        opacity: comment.hidden ? 0.75 : 1,
      }}
    >
      {/* User row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8, gap: 8 }}>
        {comment.user.image !== null ? (
          <Image source={{ uri: comment.user.image }} style={{ width: 28, height: 28, borderRadius: 14 }} />
        ) : (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{comment.user.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{comment.user.name}</Text>
          {comment.user.username !== null ? (
            <Text style={{ color: theme.subtext, fontSize: 11 }}>@{comment.user.username}</Text>
          ) : null}
        </View>
        {comment.reportCount > 0 ? (
          <View style={{ backgroundColor: 'rgba(255,78,106,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
            <Text style={{ color: '#FF4E6A', fontSize: 10, fontWeight: '700' }}>{comment.reportCount} reports</Text>
          </View>
        ) : null}
        {comment.hidden ? (
          <View style={{ backgroundColor: 'rgba(251,146,60,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
            <Text style={{ color: '#fb923c', fontSize: 10, fontWeight: '700' }}>HIDDEN</Text>
          </View>
        ) : null}
      </View>

      {/* Comment content */}
      <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 6 }} numberOfLines={3}>
        {comment.content}
      </Text>

      {/* Post context */}
      {comment.post.content !== null ? (
        <Text style={{ color: theme.subtext, fontSize: 11, paddingHorizontal: 12, paddingBottom: 12 }} numberOfLines={1}>
          on: {comment.post.content}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: theme.border }}>
        <Pressable
          testID={`admin-comment-toggle-${comment.id}`}
          onPress={comment.hidden ? onUnhide : onHide}
          disabled={isBusy}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            paddingVertical: 11, borderRightWidth: 0.5, borderRightColor: theme.border,
            opacity: pressed || isBusy ? 0.6 : 1,
          })}
        >
          {comment.hidden ? (
            <Eye size={14} color="#00CF35" />
          ) : (
            <EyeOff size={14} color="#fb923c" />
          )}
          <Text style={{ color: comment.hidden ? '#00CF35' : '#fb923c', fontWeight: '600', fontSize: 13 }}>
            {isHiding ? 'Hiding…' : isUnhiding ? 'Unhiding…' : comment.hidden ? 'Unhide' : 'Hide'}
          </Text>
        </Pressable>

        <Pressable
          testID={`admin-comment-delete-${comment.id}`}
          onPress={onDelete}
          disabled={isBusy}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            paddingVertical: 11,
            opacity: pressed || isDeleting ? 0.6 : 1,
          })}
        >
          <Trash2 size={14} color="#FF4E6A" />
          <Text style={{ color: '#FF4E6A', fontWeight: '600', fontSize: 13 }}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
