import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api/api';
import { ArrowLeft, UserPlus, Pencil, Check, X, LogOut, Trash2, Lock, FileText } from 'lucide-react-native';
import { useSession } from '@/lib/auth/use-session';
import * as Haptics from 'expo-haptics';

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
  title: string | null;
  user: { id: string; name: string; username: string | null; image: string | null };
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'members'>('posts');

  const { data: room, isLoading } = useQuery({
    queryKey: ['room', id],
    queryFn: () => api.get<Room>(`/api/rooms/${id}`),
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['room-posts', id],
    queryFn: () => api.get<Post[]>(`/api/rooms/${id}/posts`),
    enabled: activeTab === 'posts',
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
      router.back();
    },
  });

  const deleteRoom = useMutation({
    mutationFn: () => api.delete(`/api/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.back();
    },
  });

  if (isLoading || !room) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#001935', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator testID="loading-indicator" color="#00CF35" />
      </SafeAreaView>
    );
  }

  const isOwner = userId === room.ownerId;

  return (
    <SafeAreaView testID="room-detail-screen" style={{ flex: 1, backgroundColor: '#001935' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable testID="back-button" onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          {editingName ? (
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              style={{ color: '#fff', fontSize: 18, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#00CF35', paddingBottom: 2 }}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Lock size={16} color="#00CF35" />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{room.name}</Text>
            </View>
          )}
        </View>
        {isOwner && editingName ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => { if (newName.trim()) renameRoom.mutate(newName.trim()); }}>
              <Check size={20} color="#00CF35" />
            </Pressable>
            <Pressable onPress={() => setEditingName(false)}>
              <X size={20} color="#4a6fa5" />
            </Pressable>
          </View>
        ) : isOwner ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable testID="rename-room-button" onPress={() => { setNewName(room.name); setEditingName(true); }}>
              <Pencil size={18} color="#4a6fa5" />
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

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
        {(['posts', 'members'] as const).map((tab) => (
          <Pressable
            key={tab}
            testID={`tab-${tab}`}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20,
              backgroundColor: activeTab === tab ? '#00CF35' : '#0a2d50',
              borderWidth: 1, borderColor: activeTab === tab ? '#00CF35' : '#1a3a5c',
            }}
          >
            <Text style={{ color: activeTab === tab ? '#001935' : '#4a6fa5', fontWeight: '600', fontSize: 14, textTransform: 'capitalize' }}>{tab}</Text>
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
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <FileText size={40} color="#1a3a5c" />
                <Text style={{ color: '#4a6fa5', fontSize: 15 }}>No posts in this room yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(app)/post/${item.id}` as any)}
                style={{ backgroundColor: '#0a2d50', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1a3a5c' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {item.user.image ? (
                    <Image source={{ uri: item.user.image }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{(item.user.name ?? '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{item.user.name}</Text>
                    {item.user.username ? <Text style={{ color: '#4a6fa5', fontSize: 12 }}>@{item.user.username}</Text> : null}
                  </View>
                </View>
                {item.title ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 6 }}>{item.title}</Text> : null}
                {item.content ? <Text style={{ color: '#c0d0e0', fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{item.content}</Text> : null}
                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: 180, borderRadius: 10, marginTop: 10 }} resizeMode="cover" /> : null}
              </Pressable>
            )}
          />
        )
      ) : (
        <FlatList
          data={room.members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a2d50', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1a3a5c' }}>
              {item.user.image ? (
                <Image source={{ uri: item.user.image }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{(item.user.name ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{item.user.name}</Text>
                {item.user.username ? <Text style={{ color: '#4a6fa5', fontSize: 13 }}>@{item.user.username}</Text> : null}
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
