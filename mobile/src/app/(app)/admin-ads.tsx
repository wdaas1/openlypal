import React, { useState } from 'react';
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
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, MousePointerClick, BarChart2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';

type AdminAd = {
  id: string;
  headline: string;
  subtext: string;
  cta: string;
  theme: 'green' | 'purple' | 'orange' | 'blue';
  clickUrl: string | null;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
  _count: { dismissals: number };
};

const THEME_COLORS: Record<string, string> = {
  green: '#00CF35',
  purple: '#a78bfa',
  orange: '#fb923c',
  blue: '#60a5fa',
};

const THEMES = ['green', 'purple', 'orange', 'blue'] as const;

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

function fetchAdminAds(): Promise<AdminAd[]> {
  return fetch(`${baseUrl}/api/ads/admin`, { credentials: 'include' })
    .then(r => r.json())
    .then(d => d.data ?? []);
}

export default function AdminAdsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [cta, setCta] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [theme, setTheme] = useState<'green' | 'purple' | 'orange' | 'blue'>('green');

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ['admin-ads'],
    queryFn: fetchAdminAds,
    enabled: !!admin,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await fetch(`${baseUrl}/api/ads/admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });

  const deleteAd = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${baseUrl}/api/ads/admin/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });

  const createAd = useMutation({
    mutationFn: async () => {
      await fetch(`${baseUrl}/api/ads/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          headline,
          subtext,
          cta,
          theme,
          clickUrl: clickUrl.trim() || null,
          active: true,
        }),
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreate(false);
      setHeadline('');
      setSubtext('');
      setCta('');
      setClickUrl('');
      setTheme('green');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });

  if (!admin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#001935', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#4a6fa5', fontSize: 16 }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  return (
    <SafeAreaView testID="admin-ads-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a3a5c' }}>
        <Pressable testID="back-button" onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', flex: 1 }}>Sponsored Ads</Text>
        <Pressable
          testID="create-ad-button"
          onPress={() => setShowCreate(true)}
          style={{ backgroundColor: '#00CF35', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} color="#001935" />
          <Text style={{ color: '#001935', fontWeight: '700', fontSize: 13 }}>New Ad</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Stats Overview */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Impressions', value: totalImpressions.toLocaleString(), icon: BarChart2, color: '#60a5fa' },
            { label: 'Clicks', value: totalClicks.toLocaleString(), icon: MousePointerClick, color: '#00CF35' },
            { label: 'CTR', value: `${ctr}%`, icon: BarChart2, color: '#fb923c' },
          ].map(stat => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: '#0a2d50', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: stat.color, fontSize: 18, fontWeight: '800' }}>{stat.value}</Text>
              <Text style={{ color: '#4a6fa5', fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Ad List */}
        {isLoading ? (
          <ActivityIndicator color="#00CF35" />
        ) : ads.length === 0 ? (
          <Text style={{ color: '#4a6fa5', textAlign: 'center', marginTop: 40 }}>No ads yet. Create your first one.</Text>
        ) : (
          ads.map(ad => {
            const accent = THEME_COLORS[ad.theme] ?? '#00CF35';
            const adCtr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
            return (
              <View key={ad.id} testID={`ad-row-${ad.id}`} style={{ backgroundColor: '#0a2d50', borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: accent }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{ad.headline}</Text>
                    <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 2 }}>{ad.subtext}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: `${accent}20`, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>{ad.cta}</Text>
                      </View>
                      <View style={{ backgroundColor: '#1a3a5c', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: '#4a6fa5', fontSize: 10 }}>{ad.theme}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Pressable
                      testID={`toggle-ad-${ad.id}`}
                      onPress={() => toggleActive.mutate({ id: ad.id, active: !ad.active })}
                    >
                      {ad.active
                        ? <Eye size={18} color="#00CF35" />
                        : <EyeOff size={18} color="#4a6fa5" />
                      }
                    </Pressable>
                    <Pressable
                      testID={`delete-ad-${ad.id}`}
                      onPress={() => deleteAd.mutate(ad.id)}
                    >
                      <Trash2 size={18} color="#FF4E6A" />
                    </Pressable>
                  </View>
                </View>

                {/* Stats row */}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a3a5c' }}>
                  <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                    <Text style={{ color: '#60a5fa', fontWeight: '700' }}>{ad.impressions.toLocaleString()}</Text> views
                  </Text>
                  <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                    <Text style={{ color: '#00CF35', fontWeight: '700' }}>{ad.clicks.toLocaleString()}</Text> clicks
                  </Text>
                  <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                    <Text style={{ color: '#fb923c', fontWeight: '700' }}>{adCtr}%</Text> CTR
                  </Text>
                  <Text style={{ color: '#4a6fa5', fontSize: 11 }}>
                    <Text style={{ color: '#FF4E6A', fontWeight: '700' }}>{ad._count.dismissals}</Text> dismissed
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create Ad Sheet */}
      {showCreate ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          <View style={{ backgroundColor: '#0a1f35', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#1a3a5c' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', flex: 1 }}>Create Ad</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <X size={20} color="#4a6fa5" />
              </Pressable>
            </View>

            {[
              { label: 'Headline', value: headline, set: setHeadline, placeholder: 'Grow Your Audience' },
              { label: 'Subtext', value: subtext, set: setSubtext, placeholder: 'Reach thousands of readers\u2026' },
              { label: 'CTA Button', value: cta, set: setCta, placeholder: 'Get Started' },
              { label: 'Click URL (optional)', value: clickUrl, set: setClickUrl, placeholder: 'https://example.com' },
            ].map(field => (
              <View key={field.label} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#4a6fa5', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{field.label}</Text>
                <TextInput
                  testID={`input-${field.label.toLowerCase().replace(/\s/g, '-')}`}
                  value={field.value}
                  onChangeText={field.set}
                  placeholder={field.placeholder}
                  placeholderTextColor="#2a4a6a"
                  style={{ backgroundColor: '#001935', borderRadius: 10, padding: 12, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#1a3a5c' }}
                />
              </View>
            ))}

            {/* Theme picker */}
            <Text style={{ color: '#4a6fa5', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Theme</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {THEMES.map(t => (
                <Pressable
                  key={t}
                  testID={`theme-${t}`}
                  onPress={() => setTheme(t)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: THEME_COLORS[t],
                    borderWidth: theme === t ? 3 : 0,
                    borderColor: '#FFFFFF',
                  }}
                />
              ))}
            </View>

            <Pressable
              testID="submit-create-ad"
              onPress={() => createAd.mutate()}
              disabled={!headline.trim() || !subtext.trim() || !cta.trim() || createAd.isPending}
              style={{
                backgroundColor: headline.trim() && subtext.trim() && cta.trim() ? '#00CF35' : '#1a3a5c',
                borderRadius: 14,
                padding: 14,
                alignItems: 'center',
              }}
            >
              {createAd.isPending
                ? <ActivityIndicator color="#001935" />
                : <Text style={{ color: headline.trim() && subtext.trim() && cta.trim() ? '#001935' : '#4a6fa5', fontWeight: '700', fontSize: 15 }}>Create Ad</Text>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}
