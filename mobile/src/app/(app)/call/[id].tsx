import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, NativeModules } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Check BEFORE any require — prevents Metro from loading the broken native module
const WEBRTC_AVAILABLE = !!NativeModules.WebRTCModule;
import { PhoneOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { callsApi } from '@/lib/api/api';
import { useStreamClient } from '@/lib/stream-client';

export default function CallScreen() {
  const router = useRouter();
  const { id, type, otherUserName, role } = useLocalSearchParams<{
    id: string;
    type: 'video' | 'audio';
    otherUserName: string;
    role: 'caller' | 'callee';
  }>();

  const streamClient = useStreamClient();

  const handleHangup = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try { if (id) await callsApi.end(id); } catch {}
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/messenger' as any);
  };

  // Show loading while Stream client initialises (token fetch in progress)
  if (!streamClient) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <ActivityIndicator color="#00CF35" size="large" style={{ marginBottom: 16 }} />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          Connecting…
        </Text>
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

  return <CallScreenInner id={id} type={type} otherUserName={otherUserName} role={role} onHangup={handleHangup} />;
}

function CallScreenInner({
  id, type, otherUserName, role, onHangup,
}: {
  id: string; type: string; otherUserName: string; role: string; onHangup: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [call, setCall] = useState<any>(null);
  const callRef = useRef<any>(null);
  const streamClient = useStreamClient();

  useEffect(() => {
    if (!streamClient || !id) return;

    if (!WEBRTC_AVAILABLE) {
      setError('Video calls require a native app build. The WebRTC module is not linked in this environment.');
      return;
    }

    const streamCall = streamClient.call('default', id);
    callRef.current = streamCall;

    const join = async () => {
      try {
        console.log('[Stream] Joining call:', id, 'role:', role);
        await streamCall.join({ create: role === 'caller' });
        if (type === 'audio') await streamCall.camera.disable();
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
  }, [streamClient, id]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#FF3B30', fontSize: 15, textAlign: 'center', marginBottom: 24 }}>{error}</Text>
        <Pressable
          testID="end-call-button"
          onPress={onHangup}
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
        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 14, fontSize: 14 }}>Joining call…</Text>
        {otherUserName ? (
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 }}>{otherUserName}</Text>
        ) : null}
      </View>
    );
  }

  // Only reached when WEBRTC_AVAILABLE is true and call is joined
  const { StreamCall, CallContent } = require('@stream-io/video-react-native-sdk');
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="call-screen">
      <StreamCall call={call}>
        <CallContent onHangupCallHandler={onHangup} />
      </StreamCall>
    </View>
  );
}
