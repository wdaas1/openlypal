import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Settings, AlertTriangle, Megaphone, Layers } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type AppSettings = {
  maintenanceMode: boolean;
  announcementText: string | null;
  announcementActive: boolean;
  featuresJson: string | null;
};

export default function AdminSettingsPanelScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<AppSettings>('/api/admin/settings'),
    enabled: admin,
  });

  useEffect(() => {
    if (settings && !hydrated) {
      setMaintenanceMode(settings.maintenanceMode);
      setAnnouncementActive(settings.announcementActive);
      setAnnouncementText(settings.announcementText ?? '');
      setAnnouncementDraft(settings.announcementText ?? '');
      setHydrated(true);
    }
  }, [settings, hydrated]);

  const updateSettings = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => api.patch('/api/admin/settings', patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleMaintenanceToggle = (val: boolean) => {
    setMaintenanceMode(val);
    updateSettings.mutate({ maintenanceMode: val });
  };

  const handleAnnouncementToggle = (val: boolean) => {
    setAnnouncementActive(val);
    updateSettings.mutate({ announcementActive: val });
  };

  const handleSaveAnnouncement = () => {
    setAnnouncementText(announcementDraft);
    updateSettings.mutate({ announcementText: announcementDraft });
  };

  if (!admin) {
    return (
      <SafeAreaView testID="admin-settings-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-settings-panel-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-settings-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>App Settings</Text>
        {updateSettings.isPending ? (
          <ActivityIndicator size="small" color="#00CF35" />
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : (
          <>
            {/* Maintenance Mode */}
            <View style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 0.5, borderColor: maintenanceMode ? 'rgba(255,78,106,0.5)' : theme.border, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,78,106,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} color="#FF4E6A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Maintenance Mode</Text>
                  <Text style={{ color: theme.subtext, fontSize: 12 }}>Block non-admin access to the app</Text>
                </View>
                <Switch
                  testID="admin-maintenance-toggle"
                  value={maintenanceMode}
                  onValueChange={handleMaintenanceToggle}
                  trackColor={{ false: theme.border, true: '#FF4E6A' }}
                  thumbColor="#fff"
                />
              </View>

              {maintenanceMode ? (
                <View style={{ backgroundColor: 'rgba(255,78,106,0.1)', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,78,106,0.3)' }}>
                  <Text style={{ color: '#FF4E6A', fontSize: 12, fontWeight: '600' }}>
                    Maintenance mode is ON. Regular users will see a maintenance screen.
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Announcement Banner */}
            <View style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 0.5, borderColor: announcementActive ? 'rgba(251,191,36,0.5)' : theme.border, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(251,191,36,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={18} color="#fbbf24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Announcement Banner</Text>
                  <Text style={{ color: theme.subtext, fontSize: 12 }}>Show a dismissible banner to all users</Text>
                </View>
                <Switch
                  testID="admin-announcement-toggle"
                  value={announcementActive}
                  onValueChange={handleAnnouncementToggle}
                  trackColor={{ false: theme.border, true: '#fbbf24' }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Announcement Text</Text>
              <TextInput
                testID="admin-announcement-input"
                value={announcementDraft}
                onChangeText={setAnnouncementDraft}
                placeholder="Enter announcement message…"
                placeholderTextColor={theme.subtext}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: theme.inputBg, borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 10,
                  color: theme.text, fontSize: 14, borderWidth: 0.5, borderColor: theme.border,
                  minHeight: 72, textAlignVertical: 'top',
                }}
              />

              {announcementDraft !== announcementText ? (
                <Pressable
                  testID="admin-announcement-save"
                  onPress={handleSaveAnnouncement}
                  disabled={updateSettings.isPending}
                  style={({ pressed }) => ({
                    marginTop: 10, backgroundColor: '#fbbf24', borderRadius: 10,
                    paddingVertical: 10, alignItems: 'center',
                    opacity: pressed || updateSettings.isPending ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: '#001935', fontWeight: '700', fontSize: 14 }}>
                    {updateSettings.isPending ? 'Saving…' : 'Save Announcement'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Feature Flags (display only) */}
            <View style={{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 0.5, borderColor: theme.border, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(96,165,250,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={18} color="#60a5fa" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Feature Flags</Text>
                  <Text style={{ color: theme.subtext, fontSize: 12 }}>Current feature configuration (read-only)</Text>
                </View>
              </View>

              <View style={{ backgroundColor: theme.inputBg, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: theme.border }}>
                <Text style={{ color: theme.subtext, fontSize: 12, fontFamily: 'monospace', lineHeight: 18 }}>
                  {settings?.featuresJson
                    ? (() => {
                        try {
                          return JSON.stringify(JSON.parse(settings.featuresJson), null, 2);
                        } catch {
                          return settings.featuresJson;
                        }
                      })()
                    : 'No feature flags configured.'}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
