import React, { useState } from 'react';
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
import { ArrowLeft, Flag, Eye, EyeOff, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import type { User } from '@/lib/types';

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

const CATEGORY_LABELS: Record<string, string> = {
  illegal: 'Illegal content',
  abuse: 'Abuse / harassment',
  spam: 'Spam',
  explicit: 'Explicit content',
};

export default function AdminScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  // Check role
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>('/api/users/me'),
    enabled: !!session?.user?.id,
  });

  const { data: reportedPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => api.get<ReportedPost[]>('/api/admin/reports'),
    enabled: profile?.role === 'admin',
  });

  const toggleHide = useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/hide`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  if (profileLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#001935', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00CF35" />
      </SafeAreaView>
    );
  }

  // Block non-admins
  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView testID="admin-blocked-screen" style={{ flex: 1, backgroundColor: '#001935', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,78,106,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <AlertTriangle size={28} color="#FF4E6A" />
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Access Denied</Text>
        <Text style={{ color: '#4a6fa5', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          You don't have permission to view this page.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#071e38', borderRadius: 12 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
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
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Admin Panel</Text>
          <Text style={{ color: '#4a6fa5', fontSize: 12 }}>Reported posts</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,78,106,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
          <Flag size={12} color="#FF4E6A" />
          <Text style={{ color: '#FF4E6A', fontSize: 12, fontWeight: '700' }}>
            {reportedPosts?.length ?? 0}
          </Text>
        </View>
      </View>

      {postsLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" />
        </View>
      ) : !reportedPosts?.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,207,53,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Flag size={24} color="#00CF35" />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 6 }}>All clear</Text>
          <Text style={{ color: '#4a6fa5', fontSize: 13, textAlign: 'center' }}>No reported posts right now.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {reportedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onToggleHide={() => toggleHide.mutate(post.id)}
              isLoading={toggleHide.isPending === true && toggleHide.variables === post.id}
            />
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PostCard({
  post,
  onToggleHide,
  isLoading,
}: {
  post: ReportedPost;
  onToggleHide: () => void;
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const topCategories = post.reports
    .map((r) => r.category)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);

  return (
    <View
      testID={`admin-post-${post.id}`}
      style={{
        backgroundColor: '#071e38',
        borderRadius: 16,
        borderWidth: 0.5,
        borderColor: post.hidden ? '#1a3a5c' : '#FF4E6A44',
        overflow: 'hidden',
      }}
    >
      {/* User row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
        {post.user.image ? (
          <Image source={{ uri: post.user.image }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#112847' }} />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#112847', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#4a6fa5', fontWeight: '700' }}>{post.user.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{post.user.name}</Text>
          {post.user.username ? (
            <Text style={{ color: '#4a6fa5', fontSize: 11 }}>@{post.user.username}</Text>
          ) : null}
        </View>
        {/* Report count badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,78,106,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
          <Flag size={11} color="#FF4E6A" />
          <Text style={{ color: '#FF4E6A', fontWeight: '700', fontSize: 12 }}>{post.reportCount}</Text>
        </View>
      </View>

      {/* Content */}
      {post.content ? (
        <Text
          style={{ color: post.hidden ? '#4a6fa5' : '#c8d9f0', fontSize: 13, lineHeight: 18, paddingHorizontal: 12, paddingBottom: 10 }}
          numberOfLines={3}
        >
          {post.content}
        </Text>
      ) : null}
      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={{ width: '100%', height: 140, opacity: post.hidden ? 0.3 : 1 }}
          resizeMode="cover"
        />
      ) : null}

      {/* Categories row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
        {topCategories.map((cat) => (
          <View key={cat} style={{ backgroundColor: '#112847', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: '#4a6fa5', fontSize: 11 }}>{CATEGORY_LABELS[cat] ?? cat}</Text>
          </View>
        ))}
        {post.hidden ? (
          <View style={{ backgroundColor: 'rgba(255,78,106,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: '#FF4E6A', fontSize: 11, fontWeight: '600' }}>Hidden</Text>
          </View>
        ) : null}
      </View>

      {/* Expand reports */}
      {post.reports.length > 0 ? (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: '#4a6fa5', fontSize: 12 }}>
            {expanded ? 'Hide report details ↑' : `View ${post.reports.length} report details ↓`}
          </Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: '#001935', borderRadius: 10, padding: 10, gap: 6 }}>
          {post.reports.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <View style={{ backgroundColor: '#112847', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 1 }}>
                <Text style={{ color: '#4a6fa5', fontSize: 10 }}>{CATEGORY_LABELS[r.category] ?? r.category}</Text>
              </View>
              {r.reason ? (
                <Text style={{ color: '#c8d9f0', fontSize: 12, flex: 1 }}>{r.reason}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Action bar */}
      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#1a3a5c' }}>
        <Pressable
          testID={`admin-toggle-hide-${post.id}`}
          onPress={onToggleHide}
          disabled={isLoading}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            opacity: pressed || isLoading ? 0.6 : 1,
            backgroundColor: post.hidden ? 'rgba(0,207,53,0.08)' : 'rgba(255,78,106,0.08)',
          })}
        >
          {post.hidden ? (
            <Eye size={15} color="#00CF35" />
          ) : (
            <EyeOff size={15} color="#FF4E6A" />
          )}
          <Text style={{ fontSize: 13, fontWeight: '600', color: post.hidden ? '#00CF35' : '#FF4E6A' }}>
            {isLoading ? 'Updating...' : post.hidden ? 'Unhide post' : 'Hide post'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
