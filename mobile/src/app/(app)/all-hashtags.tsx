import React from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { api } from '@/lib/api/api';
import type { TrendingHashtag } from '@/lib/types';

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

  const { data: allHashtags, isLoading } = useQuery({
    queryKey: ['explore', 'tags'],
    queryFn: async () => {
      const result = await api.get<TrendingHashtag[]>('/api/explore/tags');
      return (result ?? []).sort((a, b) => b.count - a.count);
    },
  });

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
            {isLoading ? 'Loading...' : `${allHashtags?.length ?? 0} tags`}
          </Text>
        </View>
        <TrendingUp size={20} color="#00CF35" />
      </View>

      {isLoading ? (
        <View testID="hashtags-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" size="large" />
        </View>
      ) : (
        <FlatList
          testID="all-hashtags-list"
          data={allHashtags ?? []}
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
      )}
    </SafeAreaView>
  );
}
