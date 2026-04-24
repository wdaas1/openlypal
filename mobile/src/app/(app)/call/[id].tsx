import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { useCameraPermissions, Camera as ExpoCamera } from 'expo-camera';
import { PhoneOff, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { callsApi } from '@/lib/api/api';

export default function CallScreen() {
  const router = useRouter();
  const { id, token, wsUrl, type, otherUserName } = useLocalSearchParams<{
    id: string;
    token: string;
    wsUrl: string;
    type: 'video' | 'audio';
    otherUserName: string;
  }>();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const permissionRequested = useRef(false);

  // Request camera + mic permissions on mount
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;

    const requestPerms = async () => {
      if (type !== 'audio') await requestCameraPermission();
      await ExpoCamera.requestMicrophonePermissionsAsync();
    };

    requestPerms();
  }, [requestCameraPermission]);

  const handleEnd = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      if (id) {
        await callsApi.end(id);
      }
    } catch {
      // ignore errors when ending
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/messenger' as any);
    }
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string };
      if (data.type === 'end_call' || data.type === 'call_ended') {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/messenger' as any);
        }
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  // Wait for permission to be determined
  if (cameraPermission === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
      </View>
    );
  }

  const backendBaseUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
  const callUrl = id && token && wsUrl
    ? `${backendBaseUrl}/call/${id}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(wsUrl)}&type=${type ?? 'video'}`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }} testID="call-screen">
      {callUrl ? (
        <WebView
          testID="call-webview"
          source={{ uri: callUrl }}
          style={{ flex: 1 }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={false}
          mediaCapturePermissionGrantType="grant"
          allowsAirPlayForMediaPlayback={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          onMessage={handleWebViewMessage}
          injectedJavaScript={`
            (function() {
              var origLog = console.log;
              var origError = console.error;
              console.log = function() {
                window.ReactNativeWebView.postMessage('[LOG] ' + Array.from(arguments).join(' '));
                origLog.apply(console, arguments);
              };
              console.error = function() {
                window.ReactNativeWebView.postMessage('[ERROR] ' + Array.from(arguments).join(' '));
                origError.apply(console, arguments);
              };
            })();
            true;
          `}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00CF35" size="large" testID="loading-indicator" />
        </View>
      )}

      {/* Overlay header with name and end button */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        edges={['top']}
        pointerEvents="box-none"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 12,
          }}
        >
          <Pressable
            testID="back-button"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(app)/messenger' as any);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.9)" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 16,
                fontWeight: '700',
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
              numberOfLines={1}
            >
              {otherUserName ?? 'Call'}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 12,
                fontWeight: '500',
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {type === 'audio' ? 'Voice call' : 'Video call'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* End call button pinned at bottom */}
      <SafeAreaView
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}
        edges={['bottom']}
        pointerEvents="box-none"
      >
        <View style={{ paddingBottom: 32 }}>
          <Pressable
            testID="end-call-button"
            onPress={handleEnd}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FF3B30',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#FF3B30',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 10,
            }}
          >
            <PhoneOff size={26} color="#ffffff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
