import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { authClient } from '@/lib/auth/auth-client';
import { useSession } from '@/lib/auth/use-session';
import type { User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { pickImage } from '@/lib/file-picker';
import { uploadFile } from '@/lib/upload';

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>('/api/users/me'),
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setUsername(profile.username ?? '');
      setBio(profile.bio ?? '');
      setWebsite((profile as User & { website?: string }).website ?? '');
      setLocation((profile as User & { location?: string }).location ?? '');
    }
  }, [profile]);

  const updateAvatarMutation = useMutation({
    mutationFn: async () => {
      const file = await pickImage();
      if (!file) return null;
      const result = await uploadFile(file.uri, file.filename, file.mimeType);
      return api.patch('/api/users/me', { image: result.url });
    },
    onSuccess: (result) => {
      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    },
  });

  const updateHeaderMutation = useMutation({
    mutationFn: async () => {
      const file = await pickImage();
      if (!file) return null;
      const result = await uploadFile(file.uri, file.filename, file.mimeType);
      return api.patch('/api/users/me', { headerImage: result.url });
    },
    onSuccess: (result) => {
      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      setUsernameError('');
      return api.patch('/api/users/me', {
        name: name.trim(),
        username: username.trim() || undefined,
        bio: bio.trim(),
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.push('/(app)/profile' as any);
    },
    onError: (err: Error) => {
      if (err.message?.includes('already taken') || err.message?.includes('CONFLICT')) {
        setUsernameError('Username already taken. Choose another.');
      }
    },
  });

  return (
    <SafeAreaView testID="edit-profile-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-4 py-3"
          style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
        >
          <Pressable
            testID="back-button"
            onPress={() => router.push('/(app)/profile' as any)}
            className="w-9 h-9 items-center justify-center rounded-full"
            style={{ backgroundColor: '#0a2d50' }}
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="text-white font-semibold text-base">Edit Profile</Text>
          <Pressable
            testID="save-button"
            onPress={() => saveProfile.mutate()}
            disabled={saveProfile.isPending}
            className="rounded-full px-4 py-2"
            style={{ backgroundColor: '#00CF35' }}
          >
            {saveProfile.isPending ? (
              <ActivityIndicator size="small" color="#001935" />
            ) : (
              <Text className="font-semibold text-sm" style={{ color: '#001935' }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Header Image */}
          <Pressable
            onPress={() => updateHeaderMutation.mutate()}
            disabled={updateHeaderMutation.isPending}
            style={{ height: 140, backgroundColor: '#0a2d50' }}
          >
            {profile?.headerImage ? (
              <Image
                source={{ uri: profile.headerImage }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <View className="flex-1" style={{ backgroundColor: '#0a2d50' }} />
            )}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)'
            }}>
              {updateHeaderMutation.isPending ? (
                <ActivityIndicator color="#00CF35" />
              ) : (
                <View className="items-center gap-1">
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 }}>
                    <Camera size={20} color="#FFFFFF" />
                  </View>
                  <Text className="text-white text-xs font-medium">Change Cover</Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* Avatar */}
          <View className="px-4 -mt-10 mb-4">
            <Pressable
              onPress={() => updateAvatarMutation.mutate()}
              disabled={updateAvatarMutation.isPending}
              style={{ width: 80, borderColor: '#001935', borderWidth: 4, borderRadius: 44, position: 'relative', alignSelf: 'flex-start' }}
            >
              <UserAvatar uri={profile?.image} name={profile?.name ?? 'U'} size={72} />
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 36, alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.45)'
              }}>
                {updateAvatarMutation.isPending ? (
                  <ActivityIndicator color="#00CF35" size="small" />
                ) : (
                  <Camera size={18} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
            <Text className="text-xs mt-2" style={{ color: '#4a6fa5' }}>Tap to change profile photo</Text>
          </View>

          {/* Form Fields */}
          <View className="px-4 gap-4">
            {/* Name */}
            <View>
              <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                Full Name
              </Text>
              <TextInput
                testID="name-input"
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#2a4a6a"
                className="text-white text-base py-3 px-4 rounded-xl"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
            </View>

            {/* Username */}
            <View>
              <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                Username
              </Text>
              <View style={{ position: 'relative' }}>
                <Text style={{
                  position: 'absolute', left: 14, top: 12, color: '#4a6fa5',
                  fontSize: 16, zIndex: 1
                }}>@</Text>
                <TextInput
                  testID="username-input"
                  value={username}
                  onChangeText={(t) => { setUsername(t); setUsernameError(''); }}
                  placeholder="username"
                  placeholderTextColor="#2a4a6a"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="text-white text-base py-3 rounded-xl"
                  style={{
                    backgroundColor: '#0a2d50',
                    borderColor: usernameError ? '#FF4E6A' : '#1a3a5c',
                    borderWidth: 1,
                    paddingLeft: 32,
                    paddingRight: 14,
                  }}
                />
              </View>
              {usernameError ? (
                <Text className="text-xs mt-1" style={{ color: '#FF4E6A' }}>{usernameError}</Text>
              ) : null}
            </View>

            {/* Bio */}
            <View>
              <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                Bio
              </Text>
              <TextInput
                testID="bio-input"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself..."
                placeholderTextColor="#2a4a6a"
                multiline
                numberOfLines={4}
                maxLength={500}
                className="text-white text-base py-3 px-4 rounded-xl"
                style={{
                  backgroundColor: '#0a2d50',
                  borderColor: '#1a3a5c',
                  borderWidth: 1,
                  textAlignVertical: 'top',
                  minHeight: 100,
                }}
              />
              <Text className="text-xs mt-1 text-right" style={{ color: '#2a4a6a' }}>{bio.length}/500</Text>
            </View>

            {/* Contact Details Section */}
            <View style={{ borderTopColor: '#1a3a5c', borderTopWidth: 0.5, paddingTop: 16, marginTop: 4 }}>
              <Text className="text-white font-semibold text-sm mb-4">Contact Details</Text>

              {/* Website */}
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                  Website
                </Text>
                <TextInput
                  testID="website-input"
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="https://yourwebsite.com"
                  placeholderTextColor="#2a4a6a"
                  autoCapitalize="none"
                  keyboardType="url"
                  className="text-white text-base py-3 px-4 rounded-xl"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                />
              </View>

              {/* Location */}
              <View>
                <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                  Location
                </Text>
                <TextInput
                  testID="location-input"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  placeholderTextColor="#2a4a6a"
                  className="text-white text-base py-3 px-4 rounded-xl"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                />
              </View>
            </View>
          </View>

          <View className="h-16" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
