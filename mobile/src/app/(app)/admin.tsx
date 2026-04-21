import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Megaphone,
  BarChart2,
  DollarSign,
  Flag,
  EyeOff,
  MessageSquare,
  Radio,
  Star,
  TrendingUp,
  Users,
  Ban,
  Settings,
} from 'lucide-react-native';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type NavCard = {
  testID: string;
  route: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
};

export default function AdminScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };

  if (!session) return null;
  if (!admin) {
    return (
      <SafeAreaView
        testID="admin-access-denied"
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}
        edges={['top']}
      >
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  const NAV_CARDS: NavCard[] = [
    {
      testID: 'admin-nav-ads',
      route: '/(app)/admin-ads',
      icon: <Megaphone size={20} color="#00CF35" />,
      title: 'Ads Manager',
      description: 'Create & manage sponsored ads',
      accentColor: '#00CF35',
    },
    {
      testID: 'admin-nav-stats',
      route: '/(app)/admin-stats',
      icon: <BarChart2 size={20} color="#60a5fa" />,
      title: 'App Stats',
      description: 'Users, posts & engagement',
      accentColor: '#60a5fa',
    },
    {
      testID: 'admin-nav-revenue',
      route: '/(app)/admin-revenue',
      icon: <DollarSign size={20} color="#a78bfa" />,
      title: 'Revenue',
      description: 'Ad revenue & spend summary',
      accentColor: '#a78bfa',
    },
    {
      testID: 'admin-nav-reports',
      route: '/(app)/admin-reports',
      icon: <Flag size={20} color="#FF4E6A" />,
      title: 'Flagged Posts',
      description: 'Review reported content',
      accentColor: '#FF4E6A',
    },
    {
      testID: 'admin-nav-hidden',
      route: '/(app)/admin-hidden',
      icon: <EyeOff size={20} color="#fb923c" />,
      title: 'Hidden Posts',
      description: 'View & restore hidden posts',
      accentColor: '#fb923c',
    },
    {
      testID: 'admin-nav-comments',
      route: '/(app)/admin-comments',
      icon: <MessageSquare size={20} color="#34d399" />,
      title: 'Comments',
      description: 'Moderate all comments',
      accentColor: '#34d399',
    },
    {
      testID: 'admin-nav-live-moments',
      route: '/(app)/admin-live-moments',
      icon: <Radio size={20} color="#f472b6" />,
      title: 'Live Moments',
      description: 'Active & past live sessions',
      accentColor: '#f472b6',
    },
    {
      testID: 'admin-nav-featured',
      route: '/(app)/admin-featured',
      icon: <Star size={20} color="#fbbf24" />,
      title: 'Featured Posts',
      description: 'Curate featured content',
      accentColor: '#fbbf24',
    },
    {
      testID: 'admin-nav-top-content',
      route: '/(app)/admin-top-content',
      icon: <TrendingUp size={20} color="#00CF35" />,
      title: 'Top Content',
      description: 'Top 20 posts by likes',
      accentColor: '#00CF35',
    },
    {
      testID: 'admin-nav-users',
      route: '/(app)/admin-users',
      icon: <Users size={20} color="#60a5fa" />,
      title: 'Users',
      description: 'Manage roles & bans',
      accentColor: '#60a5fa',
    },
    {
      testID: 'admin-nav-keywords',
      route: '/(app)/admin-keywords',
      icon: <Ban size={20} color="#FF4E6A" />,
      title: 'Banned Keywords',
      description: 'Manage blocked words',
      accentColor: '#FF4E6A',
    },
    {
      testID: 'admin-nav-settings',
      route: '/(app)/admin-settings-panel',
      icon: <Settings size={20} color="#fb923c" />,
      title: 'App Settings',
      description: 'Maintenance & announcements',
      accentColor: '#fb923c',
    },
  ];

  return (
    <SafeAreaView testID="admin-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: theme.border,
      }}>
        <Pressable
          testID="admin-back-button"
          onPress={handleBack}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Admin Panel</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
          Management Tools
        </Text>

        {/* 2-column grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {NAV_CARDS.map((card) => (
            <Pressable
              key={card.testID}
              testID={card.testID}
              onPress={() => router.push(card.route as any)}
              style={({ pressed }) => ({
                width: '47.5%',
                backgroundColor: theme.card,
                borderRadius: 16,
                padding: 16,
                borderWidth: 0.5,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: `${card.accentColor}18`,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 10,
                borderWidth: 1,
                borderColor: `${card.accentColor}30`,
              }}>
                {card.icon}
              </View>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 4 }}>{card.title}</Text>
              <Text style={{ color: theme.subtext, fontSize: 11, lineHeight: 15 }}>{card.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
