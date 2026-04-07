import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api/api';

type LinkMeta = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

export function LinkPreview({ url }: { url: string }) {
  const { data, isLoading } = useQuery<LinkMeta>({
    queryKey: ['link-preview', url],
    queryFn: () => api.get<LinkMeta>(`/api/link-preview?url=${encodeURIComponent(url)}`),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const handlePress = () => {
    WebBrowser.openBrowserAsync(url);
  };

  if (isLoading) {
    return (
      <Pressable onPress={handlePress} style={{ marginHorizontal: 14, marginBottom: 10, borderRadius: 12, backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ActivityIndicator size="small" color="#4a6fa5" />
        <Text style={{ color: '#4a6fa5', fontSize: 12, flex: 1 }} numberOfLines={1}>{url}</Text>
      </Pressable>
    );
  }

  const displayHost = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  return (
    <Pressable
      onPress={handlePress}
      style={{ marginHorizontal: 14, marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderColor: '#1a3a5c', borderWidth: 1, backgroundColor: '#0a2d50' }}
    >
      {data?.image ? (
        <Image
          source={{ uri: data.image }}
          style={{ width: '100%', aspectRatio: 1.91 }}
          contentFit="cover"
        />
      ) : null}
      <View style={{ padding: 12, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <ExternalLink size={11} color="#4a6fa5" />
          <Text style={{ color: '#4a6fa5', fontSize: 11 }}>{data?.siteName ?? displayHost}</Text>
        </View>
        {data?.title ? (
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', lineHeight: 19 }} numberOfLines={2}>{data.title}</Text>
        ) : (
          <Text style={{ color: '#4a6fa5', fontSize: 12 }} numberOfLines={1}>{url}</Text>
        )}
        {data?.description ? (
          <Text style={{ color: '#7a9fc0', fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{data.description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
