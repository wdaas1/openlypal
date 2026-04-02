import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, ShieldOff, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';

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

type AdminUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  role: string;
  status: string;
  createdAt: string;
  _count: { posts: number; reports: number };
};

export default function AdminScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const admin = isAdmin(session?.user);

  const { data: reportedPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => api.get<ReportedPost[]>('/api/admin/reports'),
    enabled: admin,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUser[]>('/api/admin/users'),
    enabled: admin,
  });

  const hidePost = useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/hide`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deletePost = useMutation({
    mutationFn: (postId: string) => api.delete(`/api/admin/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const banUser = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/users/${userId}/ban`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  if (!session) return null;
  if (!admin) {
    return (
      <SafeAreaView testID="admin-access-denied" style={{ flex: 1, backgroundColor: '#001935', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1a3a5c' }}>
        <Pressable
          testID="admin-back-button"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0a2d50', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, flex: 1 }}>🛡️ Admin Panel</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Flagged Posts section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          <Text style={{ color: '#4a6fa5', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
            Flagged Posts
          </Text>
        </View>

        {postsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !reportedPosts?.length ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,207,53,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Flag size={24} color="#00CF35" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 6 }}>All clear</Text>
            <Text style={{ color: '#4a6fa5', fontSize: 13, textAlign: 'center' }}>No posts with 3+ reports.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
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

        {/* Users section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 }}>
          <Text style={{ color: '#4a6fa5', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
            Users
          </Text>
        </View>

        {usersLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !users?.length ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ color: '#4a6fa5', fontSize: 14 }}>No users found.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onBan={() => banUser.mutate(user.id)}
                isLoading={banUser.isPending === true && banUser.variables === user.id}
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
  const borderColor = post.reportCount >= 5 ? 'rgba(255,78,106,0.6)' : post.reportCount >= 2 ? 'rgba(255,159,28,0.5)' : '#1a3a5c';
  const bgTint = post.reportCount >= 5 ? 'rgba(255,78,106,0.07)' : post.reportCount >= 2 ? 'rgba(255,159,28,0.05)' : 'transparent';

  return (
    <View
      testID={`admin-post-${post.id}`}
      style={{ backgroundColor: '#071e38', borderRadius: 16, borderWidth: 0.5, borderColor, overflow: 'hidden' }}
    >
      {/* color tint strip */}
      {bgTint !== 'transparent' ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bgTint, pointerEvents: 'none' }} />
      ) : null}
      {/* post.content */}
      <Text
        style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20, padding: 14, paddingBottom: 8 }}
        numberOfLines={4}
      >
        {post.content ?? '(no text)'}
      </Text>

      {/* Reports: N */}
      <Text style={{ color: '#FF4E6A', fontSize: 12, fontWeight: '700', paddingHorizontal: 14, paddingBottom: 14 }}>
        Reports: {post.reportCount}
      </Text>

      {/* Buttons */}
      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#1a3a5c' }}>
        <Pressable
          testID={`admin-hide-${post.id}`}
          onPress={onHide}
          disabled={isHiding || isDeleting}
          style={({ pressed }) => ({
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 13, borderRightWidth: 0.5, borderRightColor: '#1a3a5c',
            opacity: pressed || isHiding ? 0.6 : 1,
          })}
        >
          <Text style={{ color: post.hidden ? '#4a6fa5' : '#FF4E6A', fontWeight: '600', fontSize: 14 }}>
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

function UserRow({ user, onBan, isLoading }: { user: AdminUser; onBan: () => void; isLoading: boolean }) {
  const isBanned = user.status === 'banned';

  return (
    <View
      testID={`admin-user-${user.id}`}
      style={{
        backgroundColor: '#071e38', borderRadius: 14, borderWidth: 0.5,
        borderColor: isBanned ? '#FF4E6A33' : '#1a3a5c',
        flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
      }}
    >
      {user.image ? (
        <Image source={{ uri: user.image }} style={{ width: 40, height: 40, borderRadius: 20, opacity: isBanned ? 0.5 : 1 }} />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#112847', alignItems: 'center', justifyContent: 'center', opacity: isBanned ? 0.5 : 1 }}>
          <Text style={{ color: '#4a6fa5', fontWeight: '700' }}>{user.name[0]}</Text>
        </View>
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: isBanned ? '#4a6fa5' : '#FFFFFF', fontWeight: '600', fontSize: 14 }}>{user.name}</Text>
          {user.role === 'admin' ? (
            <View style={{ backgroundColor: 'rgba(0,207,53,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
              <Text style={{ color: '#00CF35', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
            </View>
          ) : null}
          {isBanned ? (
            <View style={{ backgroundColor: 'rgba(255,78,106,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
              <Text style={{ color: '#FF4E6A', fontSize: 10, fontWeight: '700' }}>BANNED</Text>
            </View>
          ) : null}
        </View>
        {user.username ? (
          <Text style={{ color: '#4a6fa5', fontSize: 12 }}>@{user.username}</Text>
        ) : null}
        <Text style={{ color: '#1a3a5c', fontSize: 11 }}>
          {user._count.posts} posts · {user._count.reports} reports filed
        </Text>
      </View>

      <Pressable
        testID={`admin-ban-${user.id}`}
        onPress={onBan}
        disabled={isLoading || user.role === 'admin'}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
          backgroundColor: isBanned ? 'rgba(0,207,53,0.12)' : 'rgba(255,78,106,0.12)',
          opacity: pressed || isLoading || user.role === 'admin' ? 0.5 : 1,
        })}
      >
        {isBanned ? (
          <ShieldCheck size={14} color="#00CF35" />
        ) : (
          <ShieldOff size={14} color="#FF4E6A" />
        )}
        <Text style={{ fontSize: 12, fontWeight: '700', color: isBanned ? '#00CF35' : '#FF4E6A' }}>
          {isLoading ? '…' : isBanned ? 'Unban' : 'Ban'}
        </Text>
      </Pressable>
    </View>
  );
}
