import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { PhoneOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { callsApi, api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';

export default function CallScreen() {
  const router = useRouter();
  const { id, type, otherUserName, role } = useLocalSearchParams<{
    id: string;
    type: 'video' | 'audio';
    otherUserName: string;
    role: 'caller' | 'callee';
  }>();

  const { data: session } = useSession();
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleHangup = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try { if (id) await callsApi.end(id); } catch {}
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/messenger' as any);
  };

  useEffect(() => {
    const userId = session?.user?.id;
    const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY;
    if (!userId || !apiKey || !id) return;

    (async () => {
      try {
        const result = await api.post<{ token: string }>('/api/stream-token', { userId });
        const token = result?.token;
        if (!token) { setError('Failed to get call token'); return; }

        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        const userName = (session?.user as any)?.name ?? 'User';
        const qs = [
          `callId=${encodeURIComponent(id)}`,
          `token=${encodeURIComponent(token)}`,
          `apiKey=${encodeURIComponent(apiKey)}`,
          `userId=${encodeURIComponent(userId)}`,
          `userName=${encodeURIComponent(userName)}`,
          `otherUserName=${encodeURIComponent(otherUserName ?? '')}`,
          `role=${encodeURIComponent(role ?? 'callee')}`,
          `type=${encodeURIComponent(type ?? 'video')}`,
        ].join('&');
        setWebViewUrl(`${backendUrl}/api/calls/webview/${id}?${qs}`);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to connect');
      }
    })();
  }, [session?.user?.id, id]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#FF3B30', fontSize: 15, textAlign: 'center', marginBottom: 24 }}>{error}</Text>
        <Pressable
          testID="end-call-button"
          onPress={handleHangup}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' }}
        >
          <PhoneOff size={26} color="#fff" />
        </Pressable>
      </View>
    );
  }

  if (!webViewUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 16 }}>Connecting…</Text>
        {otherUserName ? (
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 }}>{otherUserName}</Text>
        ) : null}
        <Pressable
          testID="end-call-button"
          onPress={handleHangup}
          style={{ marginTop: 32, width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' }}
        >
          <PhoneOff size={26} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="call-screen">
      <WebView
        source={{ uri: webViewUrl }}
        style={{ flex: 1 }}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'hangup') handleHangup();
          } catch {}
        }}
      />
    </View>
  );
}
