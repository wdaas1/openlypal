import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Tag,
  Eye,
  HelpCircle,
  Shield,
  LogOut,
  Trash2,
  AlertTriangle,
  Globe,
  FileText,
  Bell,
  ShieldAlert,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { authClient } from '@/lib/auth/auth-client';
import { useSession, useInvalidateSession } from '@/lib/auth/use-session';
import type { User } from '@/lib/types';

const ADMIN_EMAIL = "your@email.com";

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  const { data: profile } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => api.get<User>('/api/users/me'),
    enabled: !!session?.user?.id,
  });

  const updateShowExplicit = useMutation({
    mutationFn: async (value: boolean) => {
      return api.patch('/api/users/me', { showExplicit: value });
    },
    onSuccess: () => {
      Haptics.selectionAsync();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      invalidateSession();
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      return api.delete('/api/users/me');
    },
    onSuccess: () => {
      invalidateSession();
      setShowDeleteModal(false);
    },
  });

  const SettingRow = ({
    icon,
    label,
    sublabel,
    onPress,
    rightElement,
    danger,
    testId,
  }: {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
    testId?: string;
  }) => (
    <Pressable
      testID={testId}
      onPress={onPress}
      className="flex-row items-center px-4 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: danger ? 'rgba(255,78,106,0.15)' : '#112847' }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className="font-medium text-sm"
          style={{ color: danger ? '#FF4E6A' : '#FFFFFF' }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>{sublabel}</Text>
        ) : null}
      </View>
      {rightElement ?? (
        onPress ? <ChevronRight size={16} color="#4a6fa5" /> : null
      )}
    </Pressable>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      className="text-xs font-semibold uppercase tracking-wider px-4 pt-5 pb-2"
      style={{ color: '#4a6fa5' }}
    >
      {title}
    </Text>
  );

  return (
    <SafeAreaView testID="settings-screen" className="flex-1" style={{ backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-3"
        style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
      >
        <Pressable
          testID="back-button"
          onPress={() => router.push('/(app)/profile' as any)}
          className="w-9 h-9 items-center justify-center rounded-full mr-3"
          style={{ backgroundColor: '#0a2d50' }}
        >
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white font-semibold text-base">Settings & Preferences</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Content Preferences */}
        <SectionHeader title="Content" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: '#071e38', borderColor: '#1a3a5c', borderWidth: 0.5 }}>
          <Pressable
            testID="interests-button"
            onPress={() => router.push('/(app)/interests' as any)}
            className="flex-row items-center px-4 py-4"
            style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#112847' }}>
              <Tag size={18} color="#00CF35" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium text-sm">Interests</Text>
              <Text className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>
                {profile?.categories
                  ? `${profile.categories.split(',').filter(Boolean).length} selected`
                  : 'Choose topics you care about'}
              </Text>
            </View>
            <ChevronRight size={16} color="#4a6fa5" />
          </Pressable>

          <View className="flex-row items-center px-4 py-4">
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#112847' }}>
              <Eye size={18} color="#4a6fa5" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium text-sm">Show Explicit Content</Text>
              <Text className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>
                Adult content marked 18+
              </Text>
            </View>
            <Pressable
              testID="show-explicit-toggle"
              onPress={() => updateShowExplicit.mutate(!(profile?.showExplicit ?? false))}
              style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                backgroundColor: profile?.showExplicit ? '#00CF35' : '#1a3a5c',
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#FFFFFF',
                  transform: [{ translateX: profile?.showExplicit ? 20 : 0 }],
                }}
              />
            </Pressable>
          </View>
        </View>

        {/* Admin Panel — only shown to admins */}
        {isAdmin ? (
          <>
            <SectionHeader title="Admin" />
            <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: '#071e38', borderColor: '#1a3a5c', borderWidth: 0.5 }}>
              <SettingRow
                testId="admin-panel-button"
                icon={<ShieldAlert size={18} color="#FF4E6A" />}
                label="Admin Panel"
                sublabel="Manage reported posts"
                onPress={() => router.push('/(app)/admin' as any)}
              />
            </View>
          </>
        ) : null}

        {/* Support */}
        <SectionHeader title="Support" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: '#071e38', borderColor: '#1a3a5c', borderWidth: 0.5 }}>
          <Pressable
            testID="support-button"
            onPress={() => router.push('/(app)/support' as any)}
            className="flex-row items-center px-4 py-4"
            style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#112847' }}>
              <HelpCircle size={18} color="#4a6fa5" />
            </View>
            <Text className="text-white font-medium text-sm flex-1">Help & FAQ</Text>
            <ChevronRight size={16} color="#4a6fa5" />
          </Pressable>

          <Pressable
            testID="legal-button"
            onPress={() => router.push('/(app)/legal' as any)}
            className="flex-row items-center px-4 py-4"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#112847' }}>
              <Shield size={18} color="#4a6fa5" />
            </View>
            <Text className="text-white font-medium text-sm flex-1">Privacy Policy & Terms</Text>
            <ChevronRight size={16} color="#4a6fa5" />
          </Pressable>
        </View>

        {/* Legal & Compliance (App Store / GDPR) */}
        <SectionHeader title="Legal & Compliance" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: '#071e38', borderColor: '#1a3a5c', borderWidth: 0.5 }}>
          <View className="px-4 py-3" style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}>
            <Text className="text-white font-medium text-sm">Your Data Rights</Text>
            <Text className="text-xs mt-1 leading-5" style={{ color: '#4a6fa5' }}>
              Under GDPR and applicable privacy laws, you have the right to access, rectify, export, and delete your personal data at any time. Contact us at info@clearstepsdigital.com.
            </Text>
          </View>
          <View className="px-4 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Globe size={14} color="#4a6fa5" />
              <Text className="text-xs" style={{ color: '#4a6fa5' }}>Data controller: Clear Step Digital Ltd</Text>
            </View>
          </View>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: '#071e38', borderColor: '#1a3a5c', borderWidth: 0.5 }}>
          <Pressable
            testID="sign-out-button"
            onPress={() => signOut.mutate()}
            className="flex-row items-center px-4 py-4"
            style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#112847' }}>
              <LogOut size={18} color="#4a6fa5" />
            </View>
            <Text className="text-white font-medium text-sm flex-1">Sign Out</Text>
          </Pressable>

          <Pressable
            testID="delete-account-button"
            onPress={() => setShowDeleteModal(true)}
            className="flex-row items-center px-4 py-4"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(255,78,106,0.15)' }}>
              <Trash2 size={18} color="#FF4E6A" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-sm" style={{ color: '#FF4E6A' }}>Delete Account</Text>
              <Text className="text-xs mt-0.5" style={{ color: '#4a6fa5' }}>Permanently remove your account and data</Text>
            </View>
          </Pressable>
        </View>

        {/* App info */}
        <View className="items-center mt-8 mb-16">
          <Text className="text-xs" style={{ color: '#1a3a5c' }}>
            Clear Step Digital Ltd · info@clearstepsdigital.com
          </Text>
          <Text className="text-xs mt-1" style={{ color: '#1a3a5c' }}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <Pressable className="flex-1" onPress={() => setShowDeleteModal(false)} />
          <View
            className="mx-4 mb-8 rounded-3xl overflow-hidden"
            style={{ backgroundColor: '#071e38', borderColor: '#1a3a5c', borderWidth: 0.5 }}
          >
            <View className="items-center pt-8 pb-4 px-6">
              <View
                className="w-14 h-14 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(255,78,106,0.15)' }}
              >
                <AlertTriangle size={28} color="#FF4E6A" />
              </View>
              <Text className="text-white font-bold text-lg text-center">Delete Account?</Text>
              <Text className="text-sm text-center mt-2 leading-5" style={{ color: '#4a6fa5' }}>
                This will permanently delete your account, all posts, messages, and data. This action cannot be undone.
              </Text>
            </View>

            <View style={{ borderTopColor: '#1a3a5c', borderTopWidth: 0.5 }}>
              <Pressable
                testID="confirm-delete-button"
                onPress={() => deleteAccount.mutate()}
                disabled={deleteAccount.isPending}
                className="items-center py-4"
                style={{ borderBottomColor: '#1a3a5c', borderBottomWidth: 0.5 }}
              >
                {deleteAccount.isPending ? (
                  <ActivityIndicator color="#FF4E6A" />
                ) : (
                  <Text className="font-semibold text-base" style={{ color: '#FF4E6A' }}>
                    Yes, Delete My Account
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                className="items-center py-4"
              >
                <Text className="font-medium text-base text-white">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
