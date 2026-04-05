import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api/api';
import { ArrowLeft, Search, UserPlus, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSession } from '@/lib/auth/use-session';

type User = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
};

export default function AddMembersScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const { data: room } = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => api.get<{ members: { userId: string }[] }>(`/api/rooms/${roomId}`),
  });

  const memberIds = new Set((room?.members ?? []).map((m: { userId: string }) => m.userId));

  const { data: users, isLoading } = useQuery({
    queryKey: ['user-search', search],
    queryFn: () => api.get<User[]>(`/api/users/search?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 1,
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => api.post(`/api/rooms/${roomId}/members`, { userId }),
    onSuccess: (_, userId) => {
      setAddedIds((prev) => [...prev, userId]);
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const filteredUsers = (users ?? []).filter((u) => u.id !== session?.user?.id);

  return (
    <SafeAreaView testID="add-members-screen" style={{ flex: 1, backgroundColor: '#001935' }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable testID="back-button" onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Add Members</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a2d50', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#1a3a5c' }}>
          <Search size={16} color="#4a6fa5" />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by username or name..."
            placeholderTextColor="#4a6fa5"
            autoCapitalize="none"
            style={{ flex: 1, color: '#fff', padding: 12, fontSize: 15 }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            search.trim().length >= 1 ? (
              <Text style={{ color: '#4a6fa5', textAlign: 'center', marginTop: 40 }}>No users found</Text>
            ) : (
              <Text style={{ color: '#4a6fa5', textAlign: 'center', marginTop: 40 }}>Search for users to add</Text>
            )
          }
          renderItem={({ item }) => {
            const isAlreadyMember = memberIds.has(item.id);
            const isAdded = addedIds.includes(item.id);
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a2d50', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1a3a5c' }}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{(item.name ?? '?')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{item.name}</Text>
                  {item.username ? <Text style={{ color: '#4a6fa5', fontSize: 13 }}>@{item.username}</Text> : null}
                </View>
                {isAlreadyMember || isAdded ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,207,53,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Check size={13} color="#00CF35" />
                    <Text style={{ color: '#00CF35', fontSize: 12, fontWeight: '600' }}>Added</Text>
                  </View>
                ) : (
                  <Pressable
                    testID={`add-user-${item.id}`}
                    onPress={() => addMember.mutate(item.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#00CF35', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
                  >
                    <UserPlus size={13} color="#001935" />
                    <Text style={{ color: '#001935', fontWeight: '700', fontSize: 13 }}>Add</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
