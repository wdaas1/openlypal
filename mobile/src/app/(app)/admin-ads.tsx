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
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, MousePointerClick, BarChart2, X, DollarSign } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

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
  budget: number | null;
  ratePerImpression: number | null;
  spent: number | null;
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

function BudgetBar({ spent, budget, accent, theme }: { spent: number; budget: number; accent: string; theme: { border: string; subtext: string; text: string } }) {
  const pct = Math.min(spent / budget, 1);
  const isExhausted = pct >= 1;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: theme.subtext, fontSize: 10 }}>
          Spent <Text style={{ color: isExhausted ? '#FF4E6A' : accent, fontWeight: '700' }}>${spent.toFixed(2)}</Text>
          {' '}of <Text style={{ color: theme.text, fontWeight: '700' }}>${budget.toFixed(2)}</Text>
        </Text>
        <Text style={{ color: isExhausted ? '#FF4E6A' : accent, fontSize: 10, fontWeight: '700' }}>
          {isExhausted ? 'BUDGET EXHAUSTED' : `${(pct * 100).toFixed(0)}%`}
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: isExhausted ? '#FF4E6A' : accent, borderRadius: 2 }} />
      </View>
    </View>
  );
}

export default function AdminAdsScreen() {
  const appTheme = useTheme();
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
  const [adTheme, setAdTheme] = useState<'green' | 'purple' | 'orange' | 'blue'>('green');
  const [budget, setBudget] = useState('');
  const [cpm, setCpm] = useState('');

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
      const budgetVal = budget.trim() ? parseFloat(budget) : null;
      const cpmVal = cpm.trim() ? parseFloat(cpm) : null;
      const ratePerImpression = cpmVal != null ? cpmVal / 1000 : null;
      await fetch(`${baseUrl}/api/ads/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          headline,
          subtext,
          cta,
          theme: adTheme,
          clickUrl: clickUrl.trim() || null,
          active: true,
          budget: budgetVal,
          ratePerImpression,
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
      setAdTheme('green');
      setBudget('');
      setCpm('');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });

  if (!admin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: appTheme.subtext, fontSize: 16 }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.spent ?? 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  const canCreate = headline.trim() && subtext.trim() && cta.trim();

  return (
    <SafeAreaView testID="admin-ads-screen" style={{ flex: 1, backgroundColor: appTheme.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.border }}>
        <Pressable testID="back-button" onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={22} color={appTheme.text} />
        </Pressable>
        <Text style={{ color: appTheme.text, fontSize: 18, fontWeight: '800', flex: 1 }}>Sponsored Ads</Text>
        <Pressable
          testID="create-ad-button"
          onPress={() => setShowCreate(true)}
          style={{ backgroundColor: '#00CF35', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} color="#001935" />
          <Text style={{ color: '#001935', fontWeight: '700', fontSize: 13 }}>New Ad</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Stats Overview */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Views', value: totalImpressions.toLocaleString(), color: '#60a5fa' },
            { label: 'Clicks', value: totalClicks.toLocaleString(), color: '#00CF35' },
            { label: 'CTR', value: `${ctr}%`, color: '#fb923c' },
            { label: 'Revenue', value: `$${totalRevenue.toFixed(2)}`, color: '#a78bfa' },
          ].map(stat => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: appTheme.card, borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: stat.color, fontSize: 15, fontWeight: '800' }}>{stat.value}</Text>
              <Text style={{ color: appTheme.subtext, fontSize: 10, marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Ad List */}
        {isLoading ? (
          <ActivityIndicator color="#00CF35" style={{ marginTop: 40 }} />
        ) : ads.length === 0 ? (
          <Text style={{ color: appTheme.subtext, textAlign: 'center', marginTop: 40 }}>No ads yet. Tap "New Ad" to create one.</Text>
        ) : (
          ads.map(ad => {
            const accent = THEME_COLORS[ad.theme] ?? '#00CF35';
            const adCtr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
            const hasBudget = ad.budget != null && ad.spent != null;
            const cpmDisplay = ad.ratePerImpression != null ? `$${(ad.ratePerImpression * 1000).toFixed(2)} CPM` : null;
            return (
              <View key={ad.id} testID={`ad-row-${ad.id}`} style={{ backgroundColor: appTheme.card, borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: ad.active ? accent : appTheme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={{ color: appTheme.text, fontSize: 15, fontWeight: '700' }}>{ad.headline}</Text>
                      {!ad.active ? (
                        <View style={{ backgroundColor: '#FF4E6A20', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Text style={{ color: '#FF4E6A', fontSize: 9, fontWeight: '700' }}>PAUSED</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: appTheme.subtext, fontSize: 12 }}>{ad.subtext}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: `${accent}20`, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>{ad.cta}</Text>
                      </View>
                      <View style={{ backgroundColor: appTheme.border, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: appTheme.subtext, fontSize: 10 }}>{ad.theme}</Text>
                      </View>
                      {cpmDisplay ? (
                        <View style={{ backgroundColor: appTheme.border, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '600' }}>{cpmDisplay}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Pressable testID={`toggle-ad-${ad.id}`} onPress={() => toggleActive.mutate({ id: ad.id, active: !ad.active })}>
                      {ad.active ? <Eye size={18} color="#00CF35" /> : <EyeOff size={18} color={appTheme.subtext} />}
                    </Pressable>
                    <Pressable testID={`delete-ad-${ad.id}`} onPress={() => deleteAd.mutate(ad.id)}>
                      <Trash2 size={18} color="#FF4E6A" />
                    </Pressable>
                  </View>
                </View>

                {/* Stats row */}
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: appTheme.border, flexWrap: 'wrap' }}>
                  <Text style={{ color: appTheme.subtext, fontSize: 11 }}>
                    <Text style={{ color: '#60a5fa', fontWeight: '700' }}>{ad.impressions.toLocaleString()}</Text> views
                  </Text>
                  <Text style={{ color: appTheme.subtext, fontSize: 11 }}>
                    <Text style={{ color: '#00CF35', fontWeight: '700' }}>{ad.clicks.toLocaleString()}</Text> clicks
                  </Text>
                  <Text style={{ color: appTheme.subtext, fontSize: 11 }}>
                    <Text style={{ color: '#fb923c', fontWeight: '700' }}>{adCtr}%</Text> CTR
                  </Text>
                  <Text style={{ color: appTheme.subtext, fontSize: 11 }}>
                    <Text style={{ color: '#FF4E6A', fontWeight: '700' }}>{ad._count.dismissals}</Text> dismissed
                  </Text>
                  {ad.spent != null ? (
                    <Text style={{ color: appTheme.subtext, fontSize: 11 }}>
                      <Text style={{ color: '#a78bfa', fontWeight: '700' }}>${ad.spent.toFixed(2)}</Text> earned
                    </Text>
                  ) : null}
                </View>

                {/* Budget progress bar */}
                {hasBudget ? (
                  <BudgetBar spent={ad.spent!} budget={ad.budget!} accent={accent} theme={{ border: appTheme.border, subtext: appTheme.subtext, text: appTheme.text }} />
                ) : null}
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
          <ScrollView
            style={{ backgroundColor: appTheme.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: appTheme.border }}
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: appTheme.text, fontSize: 17, fontWeight: '800', flex: 1 }}>Create Ad</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <X size={20} color={appTheme.subtext} />
              </Pressable>
            </View>

            {[
              { label: 'Headline', value: headline, set: setHeadline, placeholder: 'Grow Your Audience' },
              { label: 'Subtext', value: subtext, set: setSubtext, placeholder: 'Reach thousands of readers…' },
              { label: 'CTA Button', value: cta, set: setCta, placeholder: 'Get Started' },
              { label: 'Click URL (optional)', value: clickUrl, set: setClickUrl, placeholder: 'https://example.com' },
            ].map(field => (
              <View key={field.label} style={{ marginBottom: 12 }}>
                <Text style={{ color: appTheme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{field.label}</Text>
                <TextInput
                  testID={`input-${field.label.toLowerCase().replace(/\s+/g, '-')}`}
                  value={field.value}
                  onChangeText={field.set}
                  placeholder={field.placeholder}
                  placeholderTextColor={appTheme.subtext}
                  style={{ backgroundColor: appTheme.inputBg, borderRadius: 10, padding: 12, color: appTheme.text, fontSize: 14, borderWidth: 1, borderColor: appTheme.border }}
                />
              </View>
            ))}

            {/* Pricing fields */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: appTheme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>CPM Rate ($)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: appTheme.inputBg, borderRadius: 10, borderWidth: 1, borderColor: appTheme.border, paddingHorizontal: 10 }}>
                  <DollarSign size={14} color="#a78bfa" />
                  <TextInput
                    testID="input-cpm"
                    value={cpm}
                    onChangeText={setCpm}
                    placeholder="5.00"
                    placeholderTextColor={appTheme.subtext}
                    keyboardType="decimal-pad"
                    style={{ flex: 1, padding: 12, color: appTheme.text, fontSize: 14 }}
                  />
                </View>
                <Text style={{ color: appTheme.subtext, fontSize: 10, marginTop: 3 }}>per 1,000 views</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: appTheme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Budget ($)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: appTheme.inputBg, borderRadius: 10, borderWidth: 1, borderColor: appTheme.border, paddingHorizontal: 10 }}>
                  <DollarSign size={14} color="#00CF35" />
                  <TextInput
                    testID="input-budget"
                    value={budget}
                    onChangeText={setBudget}
                    placeholder="100.00"
                    placeholderTextColor={appTheme.subtext}
                    keyboardType="decimal-pad"
                    style={{ flex: 1, padding: 12, color: appTheme.text, fontSize: 14 }}
                  />
                </View>
                <Text style={{ color: appTheme.subtext, fontSize: 10, marginTop: 3 }}>auto-pauses when reached</Text>
              </View>
            </View>

            {cpm.trim() && budget.trim() ? (
              <View style={{ backgroundColor: appTheme.inputBg, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: appTheme.border }}>
                <Text style={{ color: appTheme.subtext, fontSize: 12 }}>
                  At <Text style={{ color: '#a78bfa', fontWeight: '700' }}>${parseFloat(cpm || '0').toFixed(2)} CPM</Text>,
                  a <Text style={{ color: '#00CF35', fontWeight: '700' }}>${parseFloat(budget || '0').toFixed(2)}</Text> budget
                  buys <Text style={{ color: appTheme.text, fontWeight: '700' }}>{Math.floor((parseFloat(budget || '0') / parseFloat(cpm || '1')) * 1000).toLocaleString()}</Text> views
                </Text>
              </View>
            ) : null}

            {/* Theme picker */}
            <Text style={{ color: appTheme.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Theme</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {THEMES.map(t => (
                <Pressable
                  key={t}
                  testID={`theme-${t}`}
                  onPress={() => setAdTheme(t)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: THEME_COLORS[t], borderWidth: adTheme === t ? 3 : 0, borderColor: appTheme.text }}
                />
              ))}
            </View>

            <Pressable
              testID="submit-create-ad"
              onPress={() => createAd.mutate()}
              disabled={!canCreate || createAd.isPending}
              style={{ backgroundColor: canCreate ? '#00CF35' : appTheme.border, borderRadius: 14, padding: 14, alignItems: 'center' }}
            >
              {createAd.isPending
                ? <ActivityIndicator color="#001935" />
                : <Text style={{ color: canCreate ? '#001935' : appTheme.subtext, fontWeight: '700', fontSize: 15 }}>Create Ad</Text>
              }
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}
