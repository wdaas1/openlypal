import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Edit3, Grid3X3, Heart, Play, FileText, Globe, Link as LinkIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import type { Post, User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type ProfileTab = 'posts' | 'media' | 'liked';

type ProfileLink = { label: string; url: string };

function GalleryCell({ post, onPress }: { post: Post; onPress: () => void }) {
  const hasMedia = !!(post.imageUrl || post.videoUrl);

  return (
    <Pressable
      testID={`gallery-cell-${post.id}`}
      onPress={onPress}
      style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#0a2d50' }}
    >
      {hasMedia ? (
        <>
          <Image
            source={{ uri: post.imageUrl ?? post.videoUrl ?? undefined }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          {post.videoUrl ? (
            <View style={{
              position: 'absolute', top: 6, right: 6,
              backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 4,
            }}>
              <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <FileText size={18} color="#2a4a6a" />
          {post.title ? (
            <Text style={{ color: '#4a6fa5', fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 15 }} numberOfLines={3}>
              {post.title}
            </Text>
          ) : post.content ? (
            <Text style={{ color: '#4a6fa5', fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 15 }} numberOfLines={3}>
              {post.content}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>('/api/users/me'),
    enabled: !!session?.user?.id,
  });

  const { data: myPosts, isLoading: loadingPosts, isRefetching } = useQuery({
    queryKey: ['posts', 'user', session?.user?.id],
    queryFn: () => api.get<Post[]>(`/api/posts?userId=${session?.user?.id}`),
    enabled: !!session?.user?.id,
  });

  const { data: likedPosts } = useQuery({
    queryKey: ['posts', 'liked'],
    queryFn: () => api.get<Post[]>('/api/posts?liked=true'),
  });

  const mediaPosts = (myPosts ?? []).filter(p => !!(p.imageUrl || p.videoUrl));

  const displayPosts =
    activeTab === 'posts' ? myPosts :
    activeTab === 'media' ? mediaPosts :
    likedPosts;

  // Parse links from JSON
  let parsedLinks: ProfileLink[] = [];
  if (profile?.links) {
    try {
      parsedLinks = JSON.parse(profile.links);
    } catch {
      parsedLinks = [];
    }
  }

  const TABS: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'posts', label: 'Posts', icon: <Grid3X3 size={15} color={activeTab === 'posts' ? '#FFFFFF' : '#4a6fa5'} /> },
    { id: 'media', label: 'Media', icon: <Play size={15} color={activeTab === 'media' ? '#FFFFFF' : '#4a6fa5'} /> },
    { id: 'liked', label: 'Liked', icon: <Heart size={15} color={activeTab === 'liked' ? '#FFFFFF' : '#4a6fa5'} /> },
  ];

  return (
    <SafeAreaView testID="profile-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['profile'] });
              queryClient.invalidateQueries({ queryKey: ['posts'] });
            }}
            tintColor="#00CF35"
          />
        }
      >
        {/* Header Banner */}
        <View style={{ height: 180, backgroundColor: '#0a2d50' }}>
          {profile?.headerImage ? (
            <Image
              source={{ uri: profile.headerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#0a2d50' }} />
          )}
          {/* Gradient overlay at bottom for text readability */}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
            backgroundColor: 'rgba(0,25,53,0.6)',
          }} />
          {/* Top-right action buttons */}
          <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 }}>
            <Pressable
              testID="edit-profile-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(app)/edit-profile' as any);
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}
            >
              <Edit3 size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Edit Profile</Text>
            </Pressable>
            <Pressable
              testID="settings-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(app)/settings' as any);
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20, width: 32, height: 32,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Settings size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Avatar + Stats row */}
        <View style={{ paddingHorizontal: 16, marginTop: -36 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {/* Avatar with green glow */}
            <View style={{
              borderColor: '#001935', borderWidth: 4, borderRadius: 46,
              shadowColor: '#00CF35', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
            }}>
              <UserAvatar uri={profile?.image} name={profile?.name ?? 'U'} size={80} />
            </View>

            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 20, marginBottom: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20 }}>{profile?.postCount ?? 0}</Text>
                <Text style={{ color: '#4a6fa5', fontSize: 11 }}>Posts</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20 }}>{profile?.followerCount ?? 0}</Text>
                <Text style={{ color: '#4a6fa5', fontSize: 11 }}>Followers</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20 }}>{profile?.followingCount ?? 0}</Text>
                <Text style={{ color: '#4a6fa5', fontSize: 11 }}>Following</Text>
              </View>
            </View>
          </View>

          {/* Name & Bio */}
          <View style={{ marginTop: 10 }}>
            {loadingProfile ? (
              <ActivityIndicator testID="loading-indicator" color="#00CF35" />
            ) : (
              <>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 22 }}>
                  {profile?.name ?? ''}
                </Text>
                {profile?.username ? (
                  <Text style={{ color: '#4a6fa5', fontSize: 13, marginTop: 2 }}>
                    @{profile.username}
                  </Text>
                ) : null}
                {profile?.bio ? (
                  <Text style={{ color: '#a0b4c8', fontSize: 13, marginTop: 8, lineHeight: 18 }}>
                    {profile.bio}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {/* Links section */}
          {parsedLinks.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginTop: 12 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {parsedLinks.map((link, idx) => (
                <Pressable
                  key={idx}
                  testID={`profile-link-${idx}`}
                  onPress={() => Linking.openURL(link.url)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: '#0a2d50', borderRadius: 12,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}
                >
                  <Globe size={12} color="#00CF35" />
                  <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '500' }}>{link.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* Tabs */}
        <View
          style={{ flexDirection: 'row', marginTop: 20, borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              testID={`${tab.id}-tab`}
              onPress={() => setActiveTab(tab.id)}
              style={[
                { flex: 1, alignItems: 'center', paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
                activeTab === tab.id ? { borderBottomColor: '#00CF35', borderBottomWidth: 2 } : undefined,
              ]}
            >
              {tab.icon}
              <Text style={{ fontWeight: '600', fontSize: 13, color: activeTab === tab.id ? '#FFFFFF' : '#4a6fa5' }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Gallery Grid */}
        {loadingPosts ? (
          <ActivityIndicator color="#00CF35" style={{ marginTop: 48 }} />
        ) : (displayPosts ?? []).length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 64, paddingHorizontal: 32 }}>
            <View style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: '#0a2d50' }}>
              {activeTab === 'liked' ? (
                <Heart size={28} color="#2a4a6a" />
              ) : (
                <Grid3X3 size={28} color="#2a4a6a" />
              )}
            </View>
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
              {activeTab === 'posts' ? 'No posts yet' : activeTab === 'media' ? 'No media yet' : 'No liked posts yet'}
            </Text>
            <Text style={{ color: '#4a6fa5', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
              {activeTab === 'posts'
                ? 'Share your first post to get started'
                : activeTab === 'media'
                ? 'Posts with images or videos will appear here'
                : 'Posts you like will appear here'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
            {(displayPosts ?? []).map((post) => (
              <GalleryCell
                key={post.id}
                post={post}
                onPress={() => router.push(`/(app)/post/${post.id}` as any)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
