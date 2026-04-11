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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, ChevronDown, X, Check } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import type { User } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { showMediaPicker } from '@/lib/file-picker';
import { uploadFile } from '@/lib/upload';

const GENDER_OPTIONS = [
  { label: 'Man', value: 'man' },
  { label: 'Woman', value: 'woman' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Genderqueer', value: 'genderqueer' },
  { label: 'Genderfluid', value: 'genderfluid' },
  { label: 'Agender', value: 'agender' },
  { label: 'Bigender', value: 'bigender' },
  { label: 'Two-Spirit', value: 'two-spirit' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

const RELATIONSHIP_OPTIONS = [
  { label: 'Single', value: 'single' },
  { label: 'In a relationship', value: 'in-a-relationship' },
  { label: 'Engaged', value: 'engaged' },
  { label: 'Married', value: 'married' },
  { label: 'Domestic partnership', value: 'domestic-partnership' },
  { label: 'Open relationship', value: 'open-relationship' },
  { label: 'Polyamorous', value: 'polyamorous' },
  { label: "It's complicated", value: 'complicated' },
  { label: 'Separated', value: 'separated' },
  { label: 'Divorced', value: 'divorced' },
  { label: 'Widowed', value: 'widowed' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

type PickerType = 'gender' | 'relationship' | null;

export default function EditProfileScreen() {
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

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [activePicker, setActivePicker] = useState<PickerType>(null);

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
      setWebsite(profile.website ?? '');
      setLocation(profile.location ?? '');
      setPronouns(profile.pronouns ?? '');
      if (profile.dateOfBirth) {
        const d = new Date(profile.dateOfBirth);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        setDateOfBirth(`${dd}/${mm}/${yyyy}`);
      }
      setGender(profile.gender ?? '');
      setRelationshipStatus(profile.relationshipStatus ?? '');
    }
  }, [profile]);

  const updateAvatarMutation = useMutation({
    mutationFn: async () => {
      const file = await new Promise<{ uri: string; filename: string; mimeType: string } | null>((resolve) => {
        showMediaPicker({ mediaType: 'image', onResult: resolve });
      });
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
      const file = await new Promise<{ uri: string; filename: string; mimeType: string } | null>((resolve) => {
        showMediaPicker({ mediaType: 'image', onResult: resolve });
      });
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
        website: website.trim() || undefined,
        location: location.trim() || undefined,
        pronouns: pronouns.trim() || undefined,
        dateOfBirth: (() => {
          const dob = dateOfBirth.trim();
          if (!dob) return undefined;
          const parts = dob.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return dob;
        })(),
        gender: gender || undefined,
        relationshipStatus: relationshipStatus || undefined,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    },
    onError: (err: Error) => {
      if (err.message?.includes('already taken') || err.message?.includes('CONFLICT')) {
        setUsernameError('Username already taken. Choose another.');
      }
    },
  });

  const genderLabel = GENDER_OPTIONS.find(o => o.value === gender)?.label ?? (gender || 'Select gender');
  const relationshipLabel = RELATIONSHIP_OPTIONS.find(o => o.value === relationshipStatus)?.label ?? (relationshipStatus || 'Select status');

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
            onPress={handleBack}
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

            {/* Pronouns */}
            <View>
              <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                Pronouns
              </Text>
              <TextInput
                testID="pronouns-input"
                value={pronouns}
                onChangeText={setPronouns}
                placeholder="e.g. they/them, she/her, he/him"
                placeholderTextColor="#2a4a6a"
                className="text-white text-base py-3 px-4 rounded-xl"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
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

            {/* Personal Info Section */}
            <View style={{ borderTopColor: '#1a3a5c', borderTopWidth: 0.5, paddingTop: 16, marginTop: 4 }}>
              <Text className="text-white font-semibold text-sm mb-4">Personal Info</Text>

              {/* Date of Birth */}
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                  Date of Birth
                </Text>
                <TextInput
                  testID="dob-input"
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#2a4a6a"
                  keyboardType="numeric"
                  maxLength={10}
                  className="text-white text-base py-3 px-4 rounded-xl"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                />
                <Text className="text-xs mt-1" style={{ color: '#2a4a6a' }}>Format: DD/MM/YYYY (e.g. 15/06/1990)</Text>
              </View>

              {/* Gender */}
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                  Gender
                </Text>
                <Pressable
                  testID="gender-picker"
                  onPress={() => setActivePicker('gender')}
                  className="flex-row items-center justify-between py-3 px-4 rounded-xl"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                >
                  <Text style={{ color: gender ? '#FFFFFF' : '#2a4a6a', fontSize: 16 }}>{genderLabel}</Text>
                  <ChevronDown size={18} color="#4a6fa5" />
                </Pressable>
              </View>

              {/* Relationship Status */}
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#4a6fa5' }}>
                  Relationship Status
                </Text>
                <Pressable
                  testID="relationship-picker"
                  onPress={() => setActivePicker('relationship')}
                  className="flex-row items-center justify-between py-3 px-4 rounded-xl"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
                >
                  <Text style={{ color: relationshipStatus ? '#FFFFFF' : '#2a4a6a', fontSize: 16 }}>{relationshipLabel}</Text>
                  <ChevronDown size={18} color="#4a6fa5" />
                </Pressable>
              </View>
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

      {/* Picker Modal */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setActivePicker(null)}
        >
          <Pressable
            style={{ backgroundColor: '#0a2d50', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between px-4 py-4" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
              <Text className="text-white font-semibold text-base">
                {activePicker === 'gender' ? 'Select Gender' : 'Select Relationship Status'}
              </Text>
              <Pressable onPress={() => setActivePicker(null)}>
                <X size={20} color="#4a6fa5" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {(activePicker === 'gender' ? GENDER_OPTIONS : RELATIONSHIP_OPTIONS).map((option) => {
                const isSelected = activePicker === 'gender' ? gender === option.value : relationshipStatus === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (activePicker === 'gender') {
                        setGender(option.value);
                      } else {
                        setRelationshipStatus(option.value);
                      }
                      setActivePicker(null);
                    }}
                    className="flex-row items-center justify-between px-4 py-4"
                    style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
                  >
                    <Text style={{ color: isSelected ? '#00CF35' : '#FFFFFF', fontSize: 16 }}>{option.label}</Text>
                    {isSelected ? <Check size={18} color="#00CF35" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
