import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X, Search, Check, Radio } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { liveMomentsApi } from '@/lib/api/live-moments';
import { api } from '@/lib/api/api';
import type { User } from '@/lib/types';

const DURATIONS = [
  { label: '30m', value: 30 * 60 * 1000 },
  { label: '1hr', value: 60 * 60 * 1000 },
  { label: '6hr', value: 6 * 60 * 60 * 1000 },
  { label: '24hr', value: 24 * 60 * 60 * 1000 },
];

export default function CreateMomentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[1].value);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: () =>
      searchQuery.trim().length > 1
        ? api.get<User[]>(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
        : Promise.resolve([] as User[]),
    enabled: searchQuery.trim().length > 1,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      liveMomentsApi.create({
        title: title.trim(),
        expiresAfter: selectedDuration,
        invitedUserIds: selectedUserIds,
      }),
    onSuccess: (moment) => {
      queryClient.invalidateQueries({ queryKey: ['live-moments'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (moment?.id) {
        router.replace(`/(app)/live-moments/${moment.id}` as any);
      } else {
        router.back();
      }
    },
  });

  const toggleUser = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const canGoLive = title.trim().length > 0 && !createMutation.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: '#000d1a' }}>
      <LinearGradient
        colors={['#000d1a', '#001025', '#000d1a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 20,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: 0.3 }}>
            Create Moment
          </Text>
          <Pressable
            testID="close-create-button"
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title input */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            WHAT'S HAPPENING?
          </Text>
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: title.length > 0 ? 'rgba(0,207,53,0.4)' : 'rgba(255,255,255,0.1)',
              marginBottom: 28,
            }}
          >
            <BlurView intensity={30} tint="dark">
              <TextInput
                testID="moment-title-input"
                value={title}
                onChangeText={setTitle}
                placeholder="Give your moment a title..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                style={{
                  color: '#ffffff',
                  fontSize: 18,
                  fontWeight: '700',
                  padding: 18,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                maxLength={100}
              />
            </BlurView>
          </View>

          {/* Duration picker */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            HOW LONG?
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginBottom: 28,
            }}
          >
            {DURATIONS.map((d) => {
              const isSelected = selectedDuration === d.value;
              return (
                <Pressable
                  testID={`duration-${d.label}`}
                  key={d.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDuration(d.value);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 30,
                    alignItems: 'center',
                    backgroundColor: isSelected ? '#00CF35' : 'rgba(255,255,255,0.07)',
                    borderWidth: 1,
                    borderColor: isSelected ? '#00CF35' : 'rgba(255,255,255,0.1)',
                    shadowColor: isSelected ? '#00CF35' : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isSelected ? 0.6 : 0,
                    shadowRadius: 10,
                    elevation: isSelected ? 6 : 0,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? '#001935' : 'rgba(255,255,255,0.6)',
                      fontSize: 14,
                      fontWeight: '800',
                    }}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Invite friends */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            INVITE FRIENDS
          </Text>
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              marginBottom: 16,
            }}
          >
            <BlurView intensity={30} tint="dark">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 10,
                }}
              >
                <Search size={16} color="rgba(255,255,255,0.35)" />
                <TextInput
                  testID="user-search-input"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name or username..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={{ flex: 1, color: '#ffffff', fontSize: 15 }}
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color="#00CF35" />
                ) : null}
              </View>
            </BlurView>
          </View>

          {(searchResults ?? []).length > 0 && (
            <View
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                marginBottom: 24,
              }}
            >
              <BlurView intensity={20} tint="dark">
                {(searchResults ?? []).map((user, index) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <Pressable
                      testID={`invite-user-${user.id}`}
                      key={user.id}
                      onPress={() => toggleUser(user.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: 'rgba(255,255,255,0.06)',
                        backgroundColor: isSelected ? 'rgba(0,207,53,0.07)' : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: 'rgba(0,207,53,0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ color: '#00CF35', fontSize: 14, fontWeight: '800' }}>
                          {(user.name ?? '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
                          {user.name}
                        </Text>
                        {user.username ? (
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                            @{user.username}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: '#00CF35',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={14} color="#001935" />
                        </View>
                      ) : (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: 'rgba(255,255,255,0.2)',
                          }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </BlurView>
            </View>
          )}

          {selectedUserIds.length > 0 && (
            <Text
              style={{
                color: '#00CF35',
                fontSize: 13,
                fontWeight: '700',
                marginBottom: 24,
                textAlign: 'center',
              }}
            >
              {selectedUserIds.length} friend{selectedUserIds.length !== 1 ? 's' : ''} invited
            </Text>
          )}

          {/* GO LIVE button */}
          <Pressable
            testID="go-live-button"
            onPress={() => {
              if (!canGoLive) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              createMutation.mutate();
            }}
            disabled={!canGoLive}
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              opacity: canGoLive ? 1 : 0.4,
              shadowColor: '#00CF35',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: canGoLive ? 0.8 : 0,
              shadowRadius: 24,
              elevation: canGoLive ? 12 : 0,
              marginTop: 8,
            }}
          >
            <LinearGradient
              colors={['#00CF35', '#00a82b']}
              style={{
                paddingVertical: 20,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#001935" />
              ) : (
                <>
                  <Radio size={22} color="#001935" />
                  <Text
                    style={{
                      color: '#001935',
                      fontSize: 22,
                      fontWeight: '900',
                      letterSpacing: 3,
                    }}
                  >
                    GO LIVE
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
