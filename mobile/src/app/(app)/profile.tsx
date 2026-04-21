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
import { Settings, Edit3, Grid3X3, Heart, Play, FileText, Globe, Link as LinkIcon, Check, MapPin, Pin, Puzzle, Rocket, Target, Smile, BookOpen, Circle, Megaphone } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import type { Post, User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { profileModulesApi, type ProfileModule, type ModuleType } from '@/lib/api/profile-modules';
import { useTheme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const GRID_COLS = 3;
const CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type ProfileTab = 'posts' | 'media' | 'liked';

type ProfileLink = { label: string; url: string };

const MODULE_TYPE_META: Record<ModuleType, { label: string; icon: React.ReactNode }> = {
  project: { label: 'Project', icon: <Rocket size={14} color="#00CF35" /> },
  goal: { label: 'Goal', icon: <Target size={14} color="#00CF35" /> },
  mood: { label: 'Mood', icon: <Smile size={14} color="#00CF35" /> },
  learning: { label: 'Learning', icon: <BookOpen size={14} color="#00CF35" /> },
  availability: { label: 'Availability', icon: <Circle size={14} color="#00CF35" /> },
};

function CompactModuleCard({ mod }: { mod: ProfileModule }) {
  const theme = useTheme();
  let parsed: Record<string, string> = {};
  try { parsed = JSON.parse(mod.content) as Record<string, string>; } catch {}
  const meta = MODULE_TYPE_META[mod.type];

  const summary = (() => {
    switch (mod.type) {
      case 'project': return parsed.name ?? '';
      case 'goal': return parsed.title ?? '';
      case 'mood': return `${parsed.emoji ?? '😊'} ${parsed.label ?? ''}`.trim();
      case 'learning': return parsed.topic ?? '';
      case 'availability': return parsed.status ?? '';
      default: return '';
    }
  })();

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 0.5,
        borderColor: 'rgba(0,207,53,0.2)',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: 'rgba(0,207,53,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {meta.icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#00CF35', fontSize: 10, fontWeight: '700' }}>{meta.label.toUpperCase()}</Text>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>{summary}</Text>
      </View>
    </View>
  );
}

function GalleryCell({ post, onPress }: { post: Post; onPress: () => void }) {
  const theme = useTheme();
  const hasMedia = !!(post.imageUrl || post.videoUrl);

  return (
    <Pressable
      testID={`gallery-cell-${post.id}`}
      onPress={onPress}
      style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: theme.card, borderRadius: 4, overflow: 'hidden' }}
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
          <FileText size={18} color={theme.border} />
          {post.title ? (
            <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 15 }} numberOfLines={3}>
              {post.title}
            </Text>
          ) : post.content ? (
            <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 15 }} numberOfLines={3}>
              {post.content}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
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

  const { data: myModules } = useQuery({
    queryKey: ['profile-modules'],
    queryFn: () => profileModulesApi.getOwn(),
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

  const followerCount = profile?.followerCount ?? 0;

  // Tab count badges
  const postsCount = myPosts?.length ?? 0;
  const mediaCount = mediaPosts.length;
  const likedCount = likedPosts?.length ?? 0;

  const tabLabel = (id: ProfileTab, base: string) => {
    const count = id === 'posts' ? postsCount : id === 'media' ? mediaCount : likedCount;
    return count > 0 ? `${base} (${count})` : base;
  };

  const TABS: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'posts', label: tabLabel('posts', 'Posts'), icon: <Grid3X3 size={15} color={activeTab === 'posts' ? '#001935' : theme.subtext} /> },
    { id: 'media', label: tabLabel('media', 'Media'), icon: <Play size={15} color={activeTab === 'media' ? '#001935' : theme.subtext} /> },
    { id: 'liked', label: tabLabel('liked', 'Liked'), icon: <Heart size={15} color={activeTab === 'liked' ? '#001935' : theme.subtext} /> },
  ];

  const statNumberStyle = {
    color: theme.text as string,
    fontWeight: '900' as const,
    fontSize: 22,
    shadowColor: '#00CF35',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  };

  return (
    <SafeAreaView testID="profile-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
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
        <View style={{ height: 220, backgroundColor: theme.card }}>
          {profile?.headerImage ? (
            <Image
              source={{ uri: profile.headerImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.card }} />
          )}
          {/* Linear gradient overlay fading into background */}
          <LinearGradient
            colors={['transparent', theme.bg] as [string, string]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
          />
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
              testID="modules-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(app)/profile-modules' as any);
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}
            >
              <Puzzle size={13} color="#00CF35" />
              <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '600' }}>Modules</Text>
            </Pressable>
            <Pressable
              testID="advertise-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(app)/advertiser-apply' as any);
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}
            >
              <Megaphone size={13} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '600' }}>Advertise</Text>
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
            {/* Avatar with premium ring and green glow */}
            <View style={{
              borderColor: theme.bg, borderWidth: 4, borderRadius: 50,
              shadowColor: '#00CF35', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.2, shadowRadius: 5, elevation: 8,
            }}>
              <UserAvatar uri={profile?.image} name={profile?.name ?? 'U'} size={88} />
            </View>

            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <View style={{
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderWidth: 0.5,
                borderColor: theme.border,
              }}>
                <Text style={statNumberStyle}>{profile?.postCount ?? 0}</Text>
                <Text style={{ color: theme.subtext, fontSize: 11 }}>Posts</Text>
              </View>
              <Pressable
                testID="followers-stat-button"
                onPress={() => {
                  if (session?.user?.id) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/(app)/user/followers' as any, params: { id: session.user.id, type: 'followers' } });
                  }
                }}
                style={{
                  alignItems: 'center',
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderWidth: 0.5,
                  borderColor: theme.border,
                }}
              >
                <Text style={statNumberStyle}>{profile?.followerCount ?? 0}</Text>
                <Text style={{ color: theme.subtext, fontSize: 11 }}>Followers</Text>
              </Pressable>
              <Pressable
                testID="following-stat-button"
                onPress={() => {
                  if (session?.user?.id) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/(app)/user/followers' as any, params: { id: session.user.id, type: 'following' } });
                  }
                }}
                style={{
                  alignItems: 'center',
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderWidth: 0.5,
                  borderColor: theme.border,
                }}
              >
                <Text style={statNumberStyle}>{profile?.followingCount ?? 0}</Text>
                <Text style={{ color: theme.subtext, fontSize: 11 }}>Following</Text>
              </Pressable>
            </View>
          </View>

          {/* Name & Bio */}
          <View style={{ marginTop: 10 }}>
            {loadingProfile ? (
              <ActivityIndicator testID="loading-indicator" color="#00CF35" />
            ) : (
              <>
                {/* Display name + verified badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', lineHeight: 22 }}>
                    {profile?.name ?? ''}
                  </Text>
                  {profile?.verified === true ? (
                    <View style={{
                      width: 16, height: 16, borderRadius: 8,
                      backgroundColor: '#00CF35',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={10} color="#001935" strokeWidth={3} />
                    </View>
                  ) : null}
                </View>

                {/* Username + pronouns */}
                {profile?.username ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Text style={{ color: theme.subtext, fontSize: 13 }}>
                      @{profile.username}
                    </Text>
                    {followerCount > 0 ? (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00CF35' }} />
                    ) : null}
                    {profile?.pronouns ? (
                      <>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>·</Text>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          {profile.pronouns}
                        </Text>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {/* Bio */}
                {profile?.bio ? (
                  <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
                    {profile.bio}
                  </Text>
                ) : null}

                {/* Location */}
                {profile?.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <MapPin size={12} color={theme.subtext} />
                    <Text style={{ color: theme.subtext, fontSize: 12 }}>{profile.location}</Text>
                  </View>
                ) : null}

                {/* Website */}
                {profile?.website ? (
                  <Pressable
                    testID="profile-website"
                    onPress={() => Linking.openURL(profile.website!)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                  >
                    <Globe size={12} color="#00CF35" />
                    <Text style={{ color: '#00CF35', fontSize: 12 }}>{profile.website}</Text>
                  </Pressable>
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
                    backgroundColor: theme.card, borderRadius: 12,
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

        {/* Profile Modules */}
        {myModules && myModules.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Puzzle size={13} color="#00CF35" />
                <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>MODULES</Text>
              </View>
              <Pressable
                testID="manage-modules-button"
                onPress={() => router.push('/(app)/profile-modules' as any)}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ color: '#4a6fa5', fontSize: 12 }}>Manage</Text>
              </Pressable>
            </View>
            {myModules.map(mod => (
              <CompactModuleCard key={mod.id} mod={mod} />
            ))}
          </View>
        ) : null}

        {/* Pinned Post */}
        {profile?.pinnedPost ? (
          <Pressable
            testID="pinned-post-card"
            onPress={() => router.push(`/(app)/post/${profile.pinnedPost!.id}` as any)}
            style={{
              backgroundColor: theme.card,
              borderRadius: 14,
              borderWidth: 0.5,
              borderColor: theme.border,
              marginHorizontal: 16,
              marginTop: 12,
              marginBottom: 8,
              padding: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <Pin size={12} color="#00CF35" />
              <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700' }}>Pinned Post</Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
              {profile.pinnedPost.title ?? profile.pinnedPost.content ?? ''}
            </Text>
          </Pressable>
        ) : null}

        {/* Tabs — pill segmented control */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: theme.card,
          borderRadius: 22,
          padding: 4,
          margin: 16,
        }}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              testID={`${tab.id}-tab`}
              onPress={() => setActiveTab(tab.id)}
              style={[
                { flex: 1, alignItems: 'center', paddingVertical: 9, flexDirection: 'row', justifyContent: 'center', gap: 6, borderRadius: 18 },
                activeTab === tab.id ? { backgroundColor: '#00CF35' } : undefined,
              ]}
            >
              {tab.icon}
              <Text style={{ fontWeight: '600', fontSize: 13, color: activeTab === tab.id ? '#001935' : theme.subtext }}>
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
            <View style={{
              width: 64, height: 64, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              backgroundColor: theme.card,
              borderWidth: 0.5,
              borderColor: theme.border,
            }}>
              {activeTab === 'liked' ? (
                <Heart size={28} color={theme.border} />
              ) : (
                <Grid3X3 size={28} color={theme.border} />
              )}
            </View>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>
              {activeTab === 'posts' ? 'No posts yet' : activeTab === 'media' ? 'No media yet' : 'No liked posts yet'}
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
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
