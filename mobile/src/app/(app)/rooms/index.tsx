import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api/api';
import { Layers, Plus, Users, FileText, X, ChevronRight, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/theme';

type Room = {
  id: string;
  name: string;
  ownerId: string;
  owner: { id: string; name: string; username: string | null; image: string | null };
  memberCount: number;
  postCount: number;
  createdAt: string;
};

export default function RoomsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/api/rooms'),
  });

  const createRoom = useMutation({
    mutationFn: (name: string) => api.post<Room>('/api/rooms', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowCreate(false);
      setRoomName('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const renderRoom = ({ item }: { item: Room }) => (
    <Pressable
      testID={`room-item-${item.id}`}
      onPress={() => router.push(`/(app)/rooms/${item.id}` as any)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(0,207,53,0.12)',
        borderWidth: 1, borderColor: 'rgba(0,207,53,0.25)',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 14,
      }}>
        <Lock size={20} color="#00CF35" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>{item.name}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={12} color={theme.subtext} />
            <Text style={{ color: theme.subtext, fontSize: 12 }}>{item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <FileText size={12} color={theme.subtext} />
            <Text style={{ color: theme.subtext, fontSize: 12 }}>{item.postCount} {item.postCount === 1 ? 'post' : 'posts'}</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={18} color={theme.subtext} />
    </Pressable>
  );

  return (
    <SafeAreaView testID="rooms-screen" style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Layers size={22} color="#00CF35" />
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Rooms</Text>
        </View>
        <Pressable
          testID="create-room-button"
          onPress={() => setShowCreate(true)}
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: '#00CF35',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Plus size={20} color="#001935" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator testID="loading-indicator" color="#00CF35" />
        </View>
      ) : (
        <FlatList
          data={rooms ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View testID="empty-state" style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,207,53,0.1)', borderWidth: 1, borderColor: 'rgba(0,207,53,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={32} color="#00CF35" />
              </View>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>No rooms yet</Text>
              <Text style={{ color: theme.subtext, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Create a private room to share posts{'\n'}with a select group of friends.
              </Text>
              <Pressable
                onPress={() => setShowCreate(true)}
                style={{ backgroundColor: '#00CF35', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }}
              >
                <Text style={{ color: '#001935', fontWeight: '700', fontSize: 15 }}>Create a Room</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Create Room Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Create Room</Text>
                <Pressable onPress={() => setShowCreate(false)}>
                  <X size={22} color={theme.subtext} />
                </Pressable>
              </View>
              <TextInput
                testID="room-name-input"
                value={roomName}
                onChangeText={setRoomName}
                placeholder='e.g. "Close Friends"'
                placeholderTextColor={theme.subtext}
                autoFocus
                style={{
                  backgroundColor: theme.inputBg, borderRadius: 12, padding: 14,
                  color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
                  marginBottom: 16,
                }}
              />
              {createRoom.isError ? (
                <Text style={{ color: '#FF4E6A', fontSize: 13, marginBottom: 12 }}>{(createRoom.error as Error).message}</Text>
              ) : null}
              <Pressable
                testID="confirm-create-room"
                onPress={() => { if (roomName.trim()) createRoom.mutate(roomName.trim()); }}
                disabled={!roomName.trim() || createRoom.isPending}
                style={{ backgroundColor: roomName.trim() ? '#00CF35' : theme.border, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                {createRoom.isPending ? (
                  <ActivityIndicator color="#001935" />
                ) : (
                  <Text style={{ color: roomName.trim() ? '#001935' : theme.subtext, fontWeight: '700', fontSize: 15 }}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
