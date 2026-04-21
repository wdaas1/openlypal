import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Plus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type BannedWord = {
  id: string;
  word: string;
  createdAt: string;
};

export default function AdminKeywordsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);
  const [newWord, setNewWord] = useState('');

  const { data: words, isLoading } = useQuery({
    queryKey: ['admin', 'banned-words'],
    queryFn: () => api.get<BannedWord[]>('/api/admin/banned-words'),
    enabled: admin,
  });

  const addWord = useMutation({
    mutationFn: (word: string) => api.post('/api/admin/banned-words', { word }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banned-words'] });
      setNewWord('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deleteWord = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/banned-words/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banned-words'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleAdd = () => {
    const trimmed = newWord.trim();
    if (!trimmed) return;
    addWord.mutate(trimmed);
  };

  if (!admin) {
    return (
      <SafeAreaView testID="admin-keywords-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-keywords-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-keywords-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Banned Keywords</Text>
        {words ? (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>{words.length} words</Text>
        ) : null}
      </View>

      {/* Add input */}
      <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            testID="admin-keywords-input"
            value={newWord}
            onChangeText={setNewWord}
            placeholder="Enter a word to ban…"
            placeholderTextColor={theme.subtext}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleAdd}
            style={{
              flex: 1, backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
              color: theme.text, fontSize: 14, borderWidth: 0.5, borderColor: theme.border,
            }}
          />
          <Pressable
            testID="admin-keywords-add"
            onPress={handleAdd}
            disabled={!newWord.trim() || addWord.isPending}
            style={({ pressed }) => ({
              width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: newWord.trim() ? '#FF4E6A' : theme.card,
              borderWidth: 0.5, borderColor: newWord.trim() ? '#FF4E6A' : theme.border,
              opacity: pressed || addWord.isPending ? 0.6 : 1,
            })}
          >
            {addWord.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Plus size={18} color={newWord.trim() ? '#fff' : theme.subtext} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !words?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,78,106,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ban size={24} color="#FF4E6A" />
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>No banned words yet</Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center' }}>Add words above to block them from posts and comments.</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {words.map((item) => (
              <View
                key={item.id}
                testID={`admin-keyword-${item.id}`}
                style={{
                  backgroundColor: theme.card, borderRadius: 12, borderWidth: 0.5,
                  borderColor: theme.border, flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 12, gap: 10,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,78,106,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={14} color="#FF4E6A" />
                </View>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{item.word}</Text>
                <Text style={{ color: theme.subtext, fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Pressable
                  testID={`admin-keyword-delete-${item.id}`}
                  onPress={() => deleteWord.mutate(item.id)}
                  disabled={deleteWord.isPending === true && deleteWord.variables === item.id}
                  style={({ pressed }) => ({
                    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(255,78,106,0.1)',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  {deleteWord.isPending === true && deleteWord.variables === item.id ? (
                    <ActivityIndicator size="small" color="#FF4E6A" />
                  ) : (
                    <Trash2 size={14} color="#FF4E6A" />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
