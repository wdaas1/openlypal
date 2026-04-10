import React from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import type { TrendingHashtag } from '@/lib/types';

const POPULAR_HASHTAGS: TrendingHashtag[] = [
  { tag: 'art', count: 14200, trend: 'up' },
  { tag: 'photography', count: 9800, trend: 'stable' },
  { tag: 'music', count: 8300, trend: 'up' },
  { tag: 'writing', count: 6100, trend: 'down' },
  { tag: 'memes', count: 22400, trend: 'up' },
  { tag: 'aesthetic', count: 11700, trend: 'stable' },
  { tag: 'nature', count: 7600, trend: 'down' },
  { tag: 'fashion', count: 5400, trend: 'up' },
];

const ALL_HASHTAGS = [...POPULAR_HASHTAGS].sort((a, b) => b.count - a.count);

function accentColorForTrend(trend?: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '#00CF35';
  if (trend === 'down') return '#FF4E6A';
  return '#4a6fa5';
}

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp size={14} color="#00CF35" />;
  if (trend === 'down') return <TrendingDown size={14} color="#FF4E6A" />;
  if (trend === 'stable') return <Minus size={14} color="#4a6fa5" />;
  return null;
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function AllHashtagsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView testID="all-hashtags-screen" style={{ flex: 1, backgroundColor: '#001935' }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#0a2d50',
      }}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{ padding: 6, marginRight: 10, borderRadius: 20, backgroundColor: '#0a2d50' }}
          hitSlop={8}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 20 }}>Trending Hashtags</Text>
          <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 1 }}>
            {ALL_HASHTAGS.length} tags
          </Text>
        </View>
        <TrendingUp size={20} color="#00CF35" />
      </View>

      <FlatList
        testID="all-hashtags-list"
        data={ALL_HASHTAGS}
        keyExtractor={(item) => item.tag}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item, index }) => (
          <Pressable
            testID={`hashtag-row-${item.tag}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#0a2d50',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#1a3a5c',
              paddingVertical: 16,
              paddingHorizontal: 16,
              overflow: 'hidden',
            }}
          >
            {/* Left accent bar */}
            <View style={{
              width: 3,
              height: 36,
              borderRadius: 2,
              backgroundColor: accentColorForTrend(item.trend),
              marginRight: 14,
            }} />

            {/* Rank */}
            <Text style={{ color: '#00CF35', fontWeight: '900', fontSize: 18, width: 30 }}>
              {index + 1}
            </Text>

            {/* Tag info */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#00CF35', fontWeight: '700', fontSize: 16 }}>
                #{item.tag}
              </Text>
              <Text style={{ color: '#4a6fa5', fontSize: 12, marginTop: 2 }}>
                {formatCount(item.count)} posts
              </Text>
            </View>

            {/* Trend icon + label */}
            <View style={{ alignItems: 'center', gap: 3 }}>
              <TrendIcon trend={item.trend} />
              <Text style={{
                fontSize: 10,
                color: accentColorForTrend(item.trend),
                fontWeight: '600',
              }}>
                {item.trend === 'up' ? 'Rising' : item.trend === 'down' ? 'Falling' : 'Stable'}
              </Text>
            </View>

            {/* Watermark */}
            <Text style={{
              position: 'absolute',
              right: 12,
              fontSize: 48,
              fontWeight: '900',
              color: '#00CF35',
              opacity: 0.06,
            }}>
              {index + 1}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
