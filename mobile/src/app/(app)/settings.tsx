import React, { useState, useEffect } from 'react';
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
  Sun,
  Moon,
  Smartphone,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { supabase } from '@/lib/supabase';
import { useSession, useInvalidateSession } from '@/lib/auth/use-session';
import type { User } from '@/lib/types';
import { useTheme, useThemeMode, useSetThemeMode, type ThemeMode } from '@/lib/theme';

const ADMIN_EMAIL = "your@email.com";

export default function SettingsScreen() {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const setThemeMode = useSetThemeMode();
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
  const invalidateSession = useInvalidateSession();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    notifyNewPosts: true,
    notifyLikes: true,
    notifyComments: true,
    notifyFollows: true,
    notifyReblogs: true,
  });
  const [notifLoading, setNotifLoading] = useState(false);

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
      await supabase.auth.signOut();
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

  useEffect(() => {
    if (!session?.user) return;
    api.get<typeof notifPrefs>('/api/users/me/notification-preferences').then((prefs) => {
      if (prefs) setNotifPrefs(prefs);
    }).catch(() => {});
  }, [session?.user?.id]);

  const toggleNotif = async (key: keyof typeof notifPrefs) => {
    const newValue = !notifPrefs[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: newValue }));
    try {
      await api.patch('/api/users/me/notification-preferences', { [key]: newValue });
    } catch {
      // revert on error
      setNotifPrefs((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

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
        style={{ backgroundColor: danger ? 'rgba(255,78,106,0.15)' : theme.border }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className="font-medium text-sm"
          style={{ color: danger ? '#FF4E6A' : theme.text }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="text-xs mt-0.5" style={{ color: theme.subtext }}>{sublabel}</Text>
        ) : null}
      </View>
      {rightElement ?? (
        onPress ? <ChevronRight size={16} color={theme.subtext} /> : null
      )}
    </Pressable>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      className="text-xs font-semibold uppercase tracking-wider px-4 pt-5 pb-2"
      style={{ color: theme.subtext }}
    >
      {title}
    </Text>
  );

  return (
    <SafeAreaView testID="settings-screen" className="flex-1" style={{ backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-3"
        style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}
      >
        <Pressable
          testID="back-button"
          onPress={handleBack}
          className="w-9 h-9 items-center justify-center rounded-full mr-3"
          style={{ backgroundColor: theme.card }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text className="font-semibold text-base" style={{ color: theme.text }}>Settings & Preferences</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Appearance */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24, marginTop: 16 }}>
          <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Appearance</Text>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
            {([
              { mode: 'dark' as ThemeMode, label: 'Dark', Icon: Moon },
              { mode: 'light' as ThemeMode, label: 'Light', Icon: Sun },
              { mode: 'system' as ThemeMode, label: 'System', Icon: Smartphone },
            ]).map(({ mode, label, Icon }, i) => (
              <Pressable
                key={mode}
                testID={`theme-mode-${mode}`}
                onPress={() => { setThemeMode(mode); Haptics.selectionAsync(); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: theme.border, backgroundColor: themeMode === mode ? `${theme.accent}12` : 'transparent' }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: themeMode === mode ? `${theme.accent}22` : theme.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Icon size={16} color={themeMode === mode ? theme.accent : theme.subtext} />
                </View>
                <Text style={{ flex: 1, color: themeMode === mode ? theme.text : theme.subtext, fontSize: 15, fontWeight: themeMode === mode ? '600' : '400' }}>{label}</Text>
                {themeMode === mode ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Content Preferences */}
        <SectionHeader title="Content" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}>
          <Pressable
            testID="interests-button"
            onPress={() => router.push('/(app)/interests' as any)}
            className="flex-row items-center px-4 py-4"
            style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.border }}>
              <Tag size={18} color="#00CF35" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-sm" style={{ color: theme.text }}>Interests</Text>
              <Text className="text-xs mt-0.5" style={{ color: theme.subtext }}>
                {profile?.categories
                  ? `${profile.categories.split(',').filter(Boolean).length} selected`
                  : 'Choose topics you care about'}
              </Text>
            </View>
            <ChevronRight size={16} color={theme.subtext} />
          </Pressable>

          <View className="flex-row items-center px-4 py-4">
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.border }}>
              <Eye size={18} color={theme.subtext} />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-sm" style={{ color: theme.text }}>Show Explicit Content</Text>
              <Text className="text-xs mt-0.5" style={{ color: theme.subtext }}>
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
                backgroundColor: profile?.showExplicit ? '#00CF35' : theme.border,
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
            <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}>
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
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}>
          <Pressable
            testID="support-button"
            onPress={() => router.push('/(app)/support' as any)}
            className="flex-row items-center px-4 py-4"
            style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.border }}>
              <HelpCircle size={18} color={theme.subtext} />
            </View>
            <Text className="font-medium text-sm flex-1" style={{ color: theme.text }}>Help & FAQ</Text>
            <ChevronRight size={16} color={theme.subtext} />
          </Pressable>

          <Pressable
            testID="legal-button"
            onPress={() => router.push('/(app)/legal' as any)}
            className="flex-row items-center px-4 py-4"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.border }}>
              <Shield size={18} color={theme.subtext} />
            </View>
            <Text className="font-medium text-sm flex-1" style={{ color: theme.text }}>Privacy Policy & Terms</Text>
            <ChevronRight size={16} color={theme.subtext} />
          </Pressable>
        </View>

        {/* Legal & Compliance (App Store / GDPR) */}
        <SectionHeader title="Legal & Compliance" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}>
          <View className="px-4 py-3" style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}>
            <Text className="font-medium text-sm" style={{ color: theme.text }}>Your Data Rights</Text>
            <Text className="text-xs mt-1 leading-5" style={{ color: theme.subtext }}>
              Under GDPR and applicable privacy laws, you have the right to access, rectify, export, and delete your personal data at any time. Contact us at info@clearstepsdigital.com.
            </Text>
          </View>
          <View className="px-4 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Globe size={14} color={theme.subtext} />
              <Text className="text-xs" style={{ color: theme.subtext }}>Data controller: Clear Step Digital Ltd</Text>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}>
          {([
            { key: 'notifyNewPosts' as const, label: 'New Posts', sublabel: 'Posts from people you follow' },
            { key: 'notifyLikes' as const, label: 'Likes', sublabel: 'When someone likes your post' },
            { key: 'notifyComments' as const, label: 'Comments', sublabel: 'When someone comments on your post' },
            { key: 'notifyFollows' as const, label: 'New Followers', sublabel: 'When someone follows you' },
            { key: 'notifyReblogs' as const, label: 'Reblogs', sublabel: 'When someone reblogs your post' },
          ]).map((item, index, arr) => (
            <View
              key={item.key}
              className="flex-row items-center px-4 py-4"
              style={index < arr.length - 1 ? { borderBottomColor: theme.border, borderBottomWidth: 0.5 } : undefined}
            >
              <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.border }}>
                <Bell size={18} color={theme.subtext} />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-sm" style={{ color: theme.text }}>{item.label}</Text>
                <Text className="text-xs mt-0.5" style={{ color: theme.subtext }}>{item.sublabel}</Text>
              </View>
              <Pressable
                testID={`notif-toggle-${item.key}`}
                onPress={() => toggleNotif(item.key)}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: notifPrefs[item.key] ? '#00CF35' : theme.border,
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
                    transform: [{ translateX: notifPrefs[item.key] ? 20 : 0 }],
                  }}
                />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}>
          <Pressable
            testID="sign-out-button"
            onPress={() => signOut.mutate()}
            className="flex-row items-center px-4 py-4"
            style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.border }}>
              <LogOut size={18} color={theme.subtext} />
            </View>
            <Text className="font-medium text-sm flex-1" style={{ color: theme.text }}>Sign Out</Text>
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
              <Text className="text-xs mt-0.5" style={{ color: theme.subtext }}>Permanently remove your account and data</Text>
            </View>
          </Pressable>
        </View>

        {/* App info */}
        <View className="items-center mt-8 mb-16">
          <Text className="text-xs" style={{ color: theme.border }}>
            Clear Step Digital Ltd · info@clearstepsdigital.com
          </Text>
          <Text className="text-xs mt-1" style={{ color: theme.border }}>Version 1.0.0</Text>
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
            style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 0.5 }}
          >
            <View className="items-center pt-8 pb-4 px-6">
              <View
                className="w-14 h-14 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(255,78,106,0.15)' }}
              >
                <AlertTriangle size={28} color="#FF4E6A" />
              </View>
              <Text className="font-bold text-lg text-center" style={{ color: theme.text }}>Delete Account?</Text>
              <Text className="text-sm text-center mt-2 leading-5" style={{ color: theme.subtext }}>
                This will permanently delete your account, all posts, messages, and data. This action cannot be undone.
              </Text>
            </View>

            <View style={{ borderTopColor: theme.border, borderTopWidth: 0.5 }}>
              <Pressable
                testID="confirm-delete-button"
                onPress={() => deleteAccount.mutate()}
                disabled={deleteAccount.isPending}
                className="items-center py-4"
                style={{ borderBottomColor: theme.border, borderBottomWidth: 0.5 }}
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
                <Text className="font-medium text-base" style={{ color: theme.text }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
