import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart2 } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type AdminStats = {
  totalUsers: number;
  totalPosts: number;
  totalReports: number;
  newUsersToday: number;
  newPostsToday: number;
  bannedUsers: number;
  hiddenPosts: number;
  activeAds: number;
  totalAdRevenue: number;
};

type StatCard = {
  label: string;
  value: string;
  color: string;
  bg: string;
};

export default function AdminStatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<AdminStats>('/api/admin/stats'),
    enabled: admin,
    refetchInterval: 30000,
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-stats-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  const statCards: StatCard[] = stats ? [
    {
      label: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      color: '#00CF35',
      bg: 'rgba(0,207,53,0.12)',
    },
    {
      label: 'Total Posts',
      value: stats.totalPosts.toLocaleString(),
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.12)',
    },
    {
      label: 'Total Reports',
      value: stats.totalReports.toLocaleString(),
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.12)',
    },
    {
      label: 'New Users Today',
      value: `+${stats.newUsersToday}`,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.12)',
    },
    {
      label: 'New Posts Today',
      value: `+${stats.newPostsToday}`,
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.12)',
    },
    {
      label: 'Banned Users',
      value: stats.bannedUsers.toLocaleString(),
      color: '#FF4E6A',
      bg: 'rgba(255,78,106,0.12)',
    },
    {
      label: 'Hidden Posts',
      value: stats.hiddenPosts.toLocaleString(),
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.12)',
    },
    {
      label: 'Active Ads',
      value: stats.activeAds.toLocaleString(),
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)',
    },
    {
      label: 'Ad Revenue',
      value: `$${stats.totalAdRevenue.toFixed(2)}`,
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.12)',
    },
  ] : [];

  return (
    <SafeAreaView testID="admin-stats-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-stats-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>App Stats</Text>
        <BarChart2 size={18} color="#60a5fa" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !stats ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <Text style={{ color: theme.subtext, fontSize: 14 }}>Failed to load stats.</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
              Overview
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {statCards.map((card) => (
                <View
                  key={card.label}
                  testID={`admin-stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
                  style={{
                    width: '47.5%',
                    backgroundColor: theme.card,
                    borderRadius: 16, borderWidth: 0.5, borderColor: theme.border,
                    padding: 16,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: card.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Text style={{ color: card.color, fontSize: 16, fontWeight: '800' }}>#</Text>
                  </View>
                  <Text style={{ color: card.color, fontSize: 26, fontWeight: '800', marginBottom: 4 }}>
                    {card.value}
                  </Text>
                  <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '500' }}>{card.label}</Text>
                </View>
              ))}
            </View>

            <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 24, textAlign: 'center' }}>
              Refreshes every 30 seconds
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
