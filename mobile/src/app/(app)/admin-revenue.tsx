import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, DollarSign, Eye, MousePointerClick, TrendingUp } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type RevenueAd = {
  id: string;
  headline: string;
  impressions: number;
  clicks: number;
  budget: number | null;
  ratePerImpression: number | null;
  active: boolean;
};

type RevenueTotals = {
  totalImpressions: number;
  totalClicks: number;
  totalRevenue: number;
  totalBudgetSpent: number;
};

type RevenueData = {
  ads: RevenueAd[];
  totals: RevenueTotals;
};

export default function AdminRevenueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: revenue, isLoading } = useQuery({
    queryKey: ['admin', 'revenue'],
    queryFn: () => api.get<RevenueData>('/api/admin/revenue'),
    enabled: admin,
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-revenue-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-revenue-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-revenue-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Revenue</Text>
        <DollarSign size={18} color="#a78bfa" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !revenue ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <Text style={{ color: theme.subtext, fontSize: 14 }}>Failed to load revenue data.</Text>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Summary
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {[
                {
                  label: 'Total Impressions',
                  value: revenue.totals.totalImpressions.toLocaleString(),
                  color: '#60a5fa',
                  bg: 'rgba(96,165,250,0.12)',
                  icon: <Eye size={16} color="#60a5fa" />,
                },
                {
                  label: 'Total Clicks',
                  value: revenue.totals.totalClicks.toLocaleString(),
                  color: '#00CF35',
                  bg: 'rgba(0,207,53,0.12)',
                  icon: <MousePointerClick size={16} color="#00CF35" />,
                },
                {
                  label: 'Total Revenue',
                  value: `$${revenue.totals.totalRevenue.toFixed(2)}`,
                  color: '#a78bfa',
                  bg: 'rgba(167,139,250,0.12)',
                  icon: <DollarSign size={16} color="#a78bfa" />,
                },
                {
                  label: 'Budget Spent',
                  value: `$${revenue.totals.totalBudgetSpent.toFixed(2)}`,
                  color: '#fbbf24',
                  bg: 'rgba(251,191,36,0.12)',
                  icon: <TrendingUp size={16} color="#fbbf24" />,
                },
              ].map((card) => (
                <View
                  key={card.label}
                  testID={`admin-revenue-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
                  style={{
                    width: '47.5%',
                    backgroundColor: theme.card, borderRadius: 16,
                    borderWidth: 0.5, borderColor: theme.border, padding: 14,
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: card.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    {card.icon}
                  </View>
                  <Text style={{ color: card.color, fontSize: 22, fontWeight: '800', marginBottom: 2 }}>
                    {card.value}
                  </Text>
                  <Text style={{ color: theme.subtext, fontSize: 11 }}>{card.label}</Text>
                </View>
              ))}
            </View>

            {/* Per-ad breakdown */}
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Ad Breakdown ({revenue.ads.length})
            </Text>

            {revenue.ads.length === 0 ? (
              <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: theme.border }}>
                <Text style={{ color: theme.subtext, fontSize: 13 }}>No ads yet.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {revenue.ads.map((ad) => {
                  const earned = ad.ratePerImpression != null
                    ? ad.impressions * ad.ratePerImpression
                    : null;
                  const ctr = ad.impressions > 0
                    ? ((ad.clicks / ad.impressions) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <View
                      key={ad.id}
                      testID={`admin-revenue-ad-${ad.id}`}
                      style={{
                        backgroundColor: theme.card, borderRadius: 14, borderWidth: 0.5,
                        borderColor: ad.active ? 'rgba(0,207,53,0.3)' : theme.border,
                        padding: 14,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>{ad.headline}</Text>
                        <View style={{ backgroundColor: ad.active ? 'rgba(0,207,53,0.12)' : 'rgba(255,78,106,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: ad.active ? '#00CF35' : '#FF4E6A', fontSize: 10, fontWeight: '700' }}>
                            {ad.active ? 'ACTIVE' : 'PAUSED'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          <Text style={{ color: '#60a5fa', fontWeight: '700' }}>{ad.impressions.toLocaleString()}</Text> impressions
                        </Text>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          <Text style={{ color: '#00CF35', fontWeight: '700' }}>{ad.clicks.toLocaleString()}</Text> clicks
                        </Text>
                        <Text style={{ color: theme.subtext, fontSize: 12 }}>
                          <Text style={{ color: '#fb923c', fontWeight: '700' }}>{ctr}%</Text> CTR
                        </Text>
                        {ad.ratePerImpression !== null ? (
                          <Text style={{ color: theme.subtext, fontSize: 12 }}>
                            <Text style={{ color: '#a78bfa', fontWeight: '700' }}>${(ad.ratePerImpression * 1000).toFixed(2)}</Text> CPM
                          </Text>
                        ) : null}
                        {earned !== null ? (
                          <Text style={{ color: theme.subtext, fontSize: 12 }}>
                            <Text style={{ color: '#fbbf24', fontWeight: '700' }}>${earned.toFixed(2)}</Text> earned
                          </Text>
                        ) : null}
                        {ad.budget !== null ? (
                          <Text style={{ color: theme.subtext, fontSize: 12 }}>
                            <Text style={{ color: theme.text, fontWeight: '700' }}>${ad.budget.toFixed(2)}</Text> budget
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
