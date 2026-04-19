import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api/api';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { ArrowLeft, UserPlus, Pencil, Check, X, LogOut, Trash2, Lock, FileText, Camera, Play } from 'lucide-react-native';
import { useSession } from '@/lib/auth/use-session';
import { getAccessToken } from '@/lib/auth/auth-client';
import * as Haptics from 'expo-haptics';
import { showMediaPicker } from '@/lib/file-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/lib/theme';

type ActiveLiveMoment = {
  id: string;
  title: string;
  creatorId: string;
  creator: { id: string; name: string; image: string | null };
  isLive: boolean;
  status: string;
  expiresAt: string;
  viewerCount: number;
};

type Member = {
  id: string;
  userId: string;
  user: { id: string; name: string; username: string | null; image: string | null };
  joinedAt: string;
};

type Room = {
  id: string;
  name: string;
  ownerId: string;
  owner: { id: string; name: string; username: string | null; image: string | null };
  members: Member[];
  memberCount: number;
  postCount: number;
};

type Post = {
  id: string;
  type: string;
  content: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  title: string | null;
  user: { id: string; name: string; username: string | null; image: string | null };
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type ComposeMedia = {
  uri: string;
  isVideo: boolean;
  mimeType: string;
};

function VideoPost({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 200, borderRadius: 10, marginTop: 10 }}
      allowsFullscreen
      allowsPictureInPicture={false}
      contentFit="cover"
    />
  );
}

export default function RoomDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'members'>('posts');
  const [composeText, setComposeText] = useState('');
  const [composeMedia, setComposeMedia] = useState<ComposeMedia | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: room, isLoading } = useQuery({
    queryKey: ['room', id],
    queryFn: () => api.get<Room>(`/api/rooms/${id}`),
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['room-posts', id],
    queryFn: () => api.get<Post[]>(`/api/rooms/${id}/posts`),
    enabled: activeTab === 'posts',
  });

  const { data: activeLiveMoment, refetch: refetchLiveMoment } = useQuery({
    queryKey: ['room-live-moment', id],
    queryFn: () => api.get<ActiveLiveMoment | null>(`/api/rooms/${id}/live-moment`),
    refetchInterval: 5000,
  });

  const startLiveMoment = useMutation({
    mutationFn: () =>
      liveMomentsApi.create({
        title: `${room?.name ?? 'Room'} Live`,
        expiresAfter: 60,
        invitedUserIds: (room?.members ?? []).map((m: Member) => m.userId).filter((uid: string) => uid !== userId),
        roomId: id,
      }),
    onSuccess: async (moment) => {
      queryClient.invalidateQueries({ queryKey: ['room-live-moment', id] });
      if (moment?.id) {
        router.push(`/(app)/live-moments/${moment.id}` as any);
      } else {
        const result = await refetchLiveMoment();
        if (result.data?.id) {
          router.push(`/(app)/live-moments/${result.data.id}` as any);
        }
      }
    },
  });

  const renameRoom = useMutation({
    mutationFn: (name: string) => api.patch(`/api/rooms/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room', id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setEditingName(false);
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/api/rooms/${id}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room', id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const leaveRoom = useMutation({
    mutationFn: () => api.delete(`/api/rooms/${id}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.replace('/(app)/rooms' as any);
    },
  });

  const deleteRoom = useMutation({
    mutationFn: () => api.delete(`/api/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.replace('/(app)/rooms' as any);
    },
  });

  const { mutate: createPost, isPending: isCreatingPost } = useMutation({
    mutationFn: (payload: { content?: string; imageUrl?: string; videoUrl?: string; type: string }) =>
      api.post('/api/posts', { ...payload, roomId: id }),
    onSuccess: () => {
      setComposeText('');
      setComposeMedia(null);
      queryClient.invalidateQueries({ queryKey: ['room-posts', id] });
    },
  });

  const handlePickMedia = useCallback(() => {
    showMediaPicker({
      mediaType: 'both',
      onResult: (picked) => {
        if (!picked) return;
        const isVideo = picked.mimeType.startsWith('video/');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setComposeMedia({
          uri: picked.uri,
          isVideo,
          mimeType: picked.mimeType,
        });
      },
    });
  }, []);

  const handlePost = useCallback(async () => {
    if (!composeText.trim() && !composeMedia) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!composeMedia) {
      createPost({ content: composeText.trim(), type: 'text' });
      return;
    }

    setIsUploading(true);
    try {
      const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('file', {
        uri: composeMedia.uri,
        type: composeMedia.mimeType,
        name: composeMedia.isVideo ? 'video.mp4' : 'photo.jpg',
      } as any);

      const uploadRes = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadJson = await uploadRes.json() as { data: { url: string } };
        const remoteUrl = uploadJson.data.url;
        createPost({
          content: composeText.trim() || undefined,
          type: composeMedia.isVideo ? 'video' : 'photo',
          imageUrl: composeMedia.isVideo ? undefined : remoteUrl,
          videoUrl: composeMedia.isVideo ? remoteUrl : undefined,
        });
      } else {
        if (composeText.trim()) {
          createPost({ content: composeText.trim(), type: 'text' });
        }
      }
    } catch {
      if (composeText.trim()) {
        createPost({ content: composeText.trim(), type: 'text' });
      }
    } finally {
      setIsUploading(false);
    }
  }, [composeText, composeMedia, createPost]);

  if (isLoading || !room) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator testID="loading-indicator" color="#00CF35" />
      </SafeAreaView>
    );
  }

  const isOwner = userId === room.ownerId;
  const canPost = composeText.trim().length > 0 || composeMedia !== null;
  const isPosting = isUploading || isCreatingPost;

  const composer = (
    <View
      style={{
        marginHorizontal: -4,
        marginTop: 0,
        marginBottom: 8,
        backgroundColor: theme.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 12,
      }}
    >
      <TextInput
        testID="compose-input"
        placeholder={`Post in ${room.name}...`}
        placeholderTextColor={theme.subtext}
        value={composeText}
        onChangeText={setComposeText}
        multiline
        style={{
          color: theme.text,
          fontSize: 15,
          minHeight: 52,
          textAlignVertical: 'top',
        }}
      />

      {/* Media preview */}
      {composeMedia ? (
        <View style={{ marginTop: 10, position: 'relative' }}>
          {composeMedia.isVideo ? (
            <View style={{
              width: '100%', height: 160, borderRadius: 10,
              backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(0,207,53,0.3)',
            }}>
              <Play size={36} color="rgba(255,255,255,0.7)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 6 }}>Video selected</Text>
            </View>
          ) : (
            <Image
              source={{ uri: composeMedia.uri }}
              style={{ width: '100%', height: 160, borderRadius: 10 }}
              resizeMode="cover"
            />
          )}
          <Pressable
            testID="remove-media-button"
            onPress={() => setComposeMedia(null)}
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: 'rgba(0,0,0,0.7)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {/* Actions row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
        <Pressable
          testID="media-picker-button"
          onPress={handlePickMedia}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(0,207,53,0.1)',
            borderWidth: 1, borderColor: 'rgba(0,207,53,0.25)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Camera size={16} color="#00CF35" />
        </Pressable>

        <View style={{ flex: 1 }} />

        {canPost ? (
          <Pressable
            testID="post-button"
            onPress={handlePost}
            disabled={isPosting}
            style={{
              backgroundColor: '#00CF35',
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: isPosting ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#001935', fontSize: 14, fontWeight: '800' }}>
              {isPosting ? 'Posting...' : 'Post'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView testID="room-detail-screen" style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable testID="back-button" onPress={handleBack}>
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {editingName ? (
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              style={{ color: theme.text, fontSize: 18, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#00CF35', paddingBottom: 2 }}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Lock size={16} color="#00CF35" />
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{room.name}</Text>
            </View>
          )}
        </View>
        {isOwner && editingName ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => { if (newName.trim()) renameRoom.mutate(newName.trim()); }}>
              <Check size={20} color="#00CF35" />
            </Pressable>
            <Pressable onPress={() => setEditingName(false)}>
              <X size={20} color={theme.subtext} />
            </Pressable>
          </View>
        ) : isOwner ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable testID="rename-room-button" onPress={() => { setNewName(room.name); setEditingName(true); }}>
              <Pencil size={18} color={theme.subtext} />
            </Pressable>
            <Pressable testID="delete-room-button" onPress={() => deleteRoom.mutate()}>
              <Trash2 size={18} color="#FF4E6A" />
            </Pressable>
          </View>
        ) : (
          <Pressable testID="leave-room-button" onPress={() => leaveRoom.mutate()}>
            <LogOut size={18} color="#FF4E6A" />
          </Pressable>
        )}
      </View>

      {/* Live Session Banner */}
      {activeLiveMoment ? (
        <Pressable
          onPress={() => router.push(`/(app)/live-moments/${activeLiveMoment.id}` as any)}
          style={{
            marginHorizontal: 16,
            marginBottom: 10,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,59,48,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,59,48,0.35)',
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: activeLiveMoment.isLive ? '#FF3B30' : '#FF9500',
          }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>
              {activeLiveMoment.isLive ? '🔴 LIVE NOW' : '⏳ Live Session Scheduled'}
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
              {activeLiveMoment.title} · {activeLiveMoment.viewerCount} watching
            </Text>
          </View>
          <View style={{
            backgroundColor: '#FF3B30',
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
          }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>
              {activeLiveMoment.isLive ? 'Join Live' : 'Open'}
            </Text>
          </View>
        </Pressable>
      ) : isOwner ? (
        <Pressable
          onPress={() => startLiveMoment.mutate()}
          disabled={startLiveMoment.isPending}
          style={{
            marginHorizontal: 16,
            marginBottom: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(0,207,53,0.25)',
            backgroundColor: 'rgba(0,207,53,0.07)',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text style={{ color: '#00CF35', fontWeight: '800', fontSize: 14 }}>
            {startLiveMoment.isPending ? 'Starting...' : '▶ Start Live Session'}
          </Text>
        </Pressable>
      ) : null}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
        {(['posts', 'members'] as const).map((tab) => (
          <Pressable
            key={tab}
            testID={`tab-${tab}`}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20,
              backgroundColor: activeTab === tab ? '#00CF35' : theme.card,
              borderWidth: 1, borderColor: activeTab === tab ? '#00CF35' : theme.border,
            }}
          >
            <Text style={{ color: activeTab === tab ? '#001935' : theme.subtext, fontWeight: '600', fontSize: 14, textTransform: 'capitalize' }}>{tab}</Text>
          </Pressable>
        ))}
        {isOwner ? (
          <Pressable
            testID="add-member-button"
            onPress={() => router.push(`/(app)/rooms/add-members?roomId=${id}` as any)}
            style={{
              marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
              backgroundColor: 'rgba(0,207,53,0.12)', borderWidth: 1, borderColor: 'rgba(0,207,53,0.3)',
            }}
          >
            <UserPlus size={14} color="#00CF35" />
            <Text style={{ color: '#00CF35', fontWeight: '600', fontSize: 13 }}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      {activeTab === 'posts' ? (
        postsLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : (
          <FlatList
            data={posts ?? []}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            ListHeaderComponent={composer}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
                <FileText size={40} color={theme.border} />
                <Text style={{ color: theme.subtext, fontSize: 15 }}>No posts in this room yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === 'live_recap') {
                return (
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 14,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(255,59,48,0.25)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Recap header */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 14,
                      backgroundColor: 'rgba(255,59,48,0.08)',
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,59,48,0.15)',
                    }}>
                      <View style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: '#FF3B30',
                      }} />
                      <Text style={{ color: '#FF3B30', fontWeight: '900', fontSize: 12, letterSpacing: 1.5, flex: 1 }}>
                        LIVE RECAP
                      </Text>
                      <Text style={{ color: theme.subtext, fontSize: 11 }}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <View style={{ padding: 14 }}>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
                        {item.title ?? 'Live Session'}
                      </Text>
                      <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 18 }}>
                        {item.content}
                      </Text>

                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={{ width: '100%', height: 160, borderRadius: 10, marginTop: 12 }}
                          resizeMode="cover"
                        />
                      ) : item.videoUrl ? (
                        <VideoPost uri={item.videoUrl} />
                      ) : null}
                    </View>
                  </View>
                );
              }

              return (
                <Pressable
                  onPress={() => router.push(`/(app)/rooms/${id}/post/${item.id}` as any)}
                  style={{ backgroundColor: theme.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    {item.user.image ? (
                      <Image source={{ uri: item.user.image }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{(item.user.name ?? '?')[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{item.user.name}</Text>
                      {item.user.username ? <Text style={{ color: theme.subtext, fontSize: 12 }}>@{item.user.username}</Text> : null}
                    </View>
                  </View>
                  {item.title ? <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 6 }}>{item.title}</Text> : null}
                  {item.content ? <Text style={{ color: theme.subtext, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{item.content}</Text> : null}
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: '100%', height: 200, borderRadius: 10, marginTop: 10 }}
                      resizeMode="cover"
                    />
                  ) : item.videoUrl ? (
                    <VideoPost uri={item.videoUrl} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )
      ) : (
        <FlatList
          data={room.members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border }}>
              {item.user.image ? (
                <Image source={{ uri: item.user.image }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{(item.user.name ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{item.user.name}</Text>
                {item.user.username ? <Text style={{ color: theme.subtext, fontSize: 13 }}>@{item.user.username}</Text> : null}
              </View>
              {item.userId === room.ownerId ? (
                <View style={{ backgroundColor: 'rgba(0,207,53,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#00CF35', fontSize: 11, fontWeight: '700' }}>Owner</Text>
                </View>
              ) : isOwner ? (
                <Pressable
                  testID={`remove-member-${item.userId}`}
                  onPress={() => removeMember.mutate(item.userId)}
                  style={{ padding: 6 }}
                >
                  <X size={16} color="#FF4E6A" />
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
