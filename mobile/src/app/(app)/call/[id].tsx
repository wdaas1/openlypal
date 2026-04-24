import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStreamVideoClient, StreamCall, CallContent } from '@stream-io/video-react-native-sdk';
import type { Call } from '@stream-io/video-client';
import { PhoneOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { callsApi } from '@/lib/api/api';

export default function CallScreen() {
  const router = useRouter();
  const { id, type, otherUserName, role } = useLocalSearchParams<{
    id: string;
    type: 'video' | 'audio';
    otherUserName: string;
    role: 'caller' | 'callee';
  }>();

  const client = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const [error, setError] = useState<string | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    if (!client || !id) return;

    const streamCall = client.call('default', id);
    callRef.current = streamCall;

    const join = async () => {
      try {
        setStatus('Joining call...');
        console.log('[Stream] Joining call:', id, 'role:', role);
        await streamCall.join({ create: role === 'caller' });
        if (type === 'audio') {
          await streamCall.camera.disable();
        }
        console.log('[Stream] Joined successfully');
        setCall(streamCall);
      } catch (e: any) {
        console.error('[Stream] Join failed:', e?.message ?? e);
        setError(e?.message ?? 'Failed to connect to call');
      }
    };

    join();

    return () => {
      streamCall.leave().catch(() => {});
    };
  }, [client, id]);

  const handleHangup = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try { await callRef.current?.leave(); } catch {}
    try { if (id) await callsApi.end(id); } catch {}
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/messenger' as any);
  };

  if (!client) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
          Stream Video not configured
        </Text>
        <Pressable onPress={handleHangup} style={{ marginTop: 24 }}>
          <Text style={{ color: '#00CF35' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#FF3B30', fontSize: 16, textAlign: 'center', marginBottom: 24 }}>{error}</Text>
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

  if (!call) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 14, fontSize: 14 }}>{status}</Text>
        {otherUserName ? (
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 }}>{otherUserName}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="call-screen">
      <StreamCall call={call}>
        <CallContent
          onHangupCallHandler={handleHangup}
        />
      </StreamCall>
    </View>
  );
}
