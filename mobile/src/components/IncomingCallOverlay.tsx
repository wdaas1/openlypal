import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callsApi, type Call, type CallUser } from '@/lib/api/api';
import { UserAvatar } from '@/components/UserAvatar';
import { useSession } from '@/lib/auth/use-session';

type IncomingCall = Call & { caller: CallUser };

export function IncomingCallOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtonePlayer = useAudioPlayer({ uri: 'https://www.soundjay.com/phone/sounds/phone-ringing-01a.mp3' });

  // Pulse animation for the avatar ring
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 800 }),
        withTiming(0.6, { duration: 800 })
      ),
      -1,
      false
    );
  }, [pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Accept / Decline button spring
  const acceptScale = useSharedValue(1);
  const declineScale = useSharedValue(1);

  const acceptAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: acceptScale.value }],
  }));
  const declineAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: declineScale.value }],
  }));

  // Poll for incoming calls every 2 seconds when logged in
  useEffect(() => {
    if (!session?.user) {
      setIncomingCall(null);
      return;
    }

    const poll = async () => {
      try {
        const result = await callsApi.getIncoming();
        const call = result?.call ?? null;
        setIncomingCall((prev) => {
          // If call disappeared, auto-dismiss
          if (!call) return null;
          // New call arrived — trigger haptic
          if (!prev && call) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          return call;
        });
      } catch {
        // ignore poll errors silently
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [session?.user]);

  // Play ringtone while incoming call is ringing
  useEffect(() => {
    if (incomingCall) {
      try {
        ringtonePlayer.loop = true;
        ringtonePlayer.play();
      } catch {
        // non-fatal if sound fails to load
      }
    } else {
      try { ringtonePlayer.pause(); } catch {}
    }
  }, [!!incomingCall]);

  const handleAccept = async () => {
    if (!incomingCall || isAccepting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    acceptScale.value = withSpring(0.9, { damping: 8, stiffness: 300 }, () => {
      acceptScale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });

    setIsAccepting(true);
    try {
      await callsApi.accept(incomingCall.id);

      setIncomingCall(null);

      router.push({
        pathname: '/(app)/call/[id]',
        params: {
          id: incomingCall.id,
          type: incomingCall.type,
          otherUserName: incomingCall.caller?.name ?? 'Caller',
          role: 'callee',
        },
      } as any);
    } catch {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try { ringtonePlayer.pause(); } catch {}
    declineScale.value = withSpring(0.9, { damping: 8, stiffness: 300 }, () => {
      declineScale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });

    const callToDecline = incomingCall;
    setIncomingCall(null);
    try {
      await callsApi.decline(callToDecline.id);
    } catch {
      // ignore
    }
  };

  if (!incomingCall) return null;

  const callerName = incomingCall.caller?.name ?? 'Unknown';
  const isVideo = incomingCall.type === 'video';

  return (
    <Modal
      testID="incoming-call-modal"
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        style={{ flex: 1 }}
      >
        {/* Blur backdrop */}
        <BlurView
          intensity={60}
          tint="dark"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Dark overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,9,20,0.75)',
          }}
        />

        {/* Content */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: 32,
          }}
        >
          {/* Call type badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: isVideo ? 'rgba(0,207,53,0.15)' : 'rgba(0,122,255,0.15)',
              borderWidth: 1,
              borderColor: isVideo ? 'rgba(0,207,53,0.35)' : 'rgba(0,122,255,0.35)',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginBottom: 36,
            }}
          >
            {isVideo ? (
              <Video size={14} color={isVideo ? '#00CF35' : '#007AFF'} />
            ) : (
              <Phone size={14} color="#007AFF" />
            )}
            <Text
              style={{
                color: isVideo ? '#00CF35' : '#007AFF',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.5,
              }}
            >
              {isVideo ? 'Incoming video call' : 'Incoming voice call'}
            </Text>
          </View>

          {/* Pulsing avatar */}
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            {/* Outer pulse ring */}
            <Animated.View
              style={[
                pulseStyle,
                {
                  position: 'absolute',
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 2,
                  borderColor: isVideo ? '#00CF35' : '#007AFF',
                },
              ]}
            />
            {/* Avatar */}
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                borderWidth: 3,
                borderColor: isVideo ? '#00CF35' : '#007AFF',
                overflow: 'hidden',
              }}
            >
              <UserAvatar
                uri={incomingCall.caller?.image}
                name={callerName}
                size={88}
              />
            </View>
          </View>

          {/* Caller name */}
          <Text
            style={{
              color: '#ffffff',
              fontSize: 26,
              fontWeight: '800',
              letterSpacing: -0.3,
              marginBottom: 6,
              textAlign: 'center',
            }}
          >
            {callerName}
          </Text>

          {incomingCall.caller?.username ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 14,
                fontWeight: '500',
                marginBottom: 56,
              }}
            >
              @{incomingCall.caller.username}
            </Text>
          ) : (
            <View style={{ marginBottom: 56 }} />
          )}

          {/* Action buttons */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 52,
            }}
          >
            {/* Decline */}
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Animated.View style={declineAnimStyle}>
                <Pressable
                  testID="decline-call-button"
                  onPress={handleDecline}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    backgroundColor: '#FF3B30',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#FF3B30',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    elevation: 10,
                  }}
                >
                  <PhoneOff size={28} color="#ffffff" />
                </Pressable>
              </Animated.View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>
                Decline
              </Text>
            </View>

            {/* Accept */}
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Animated.View style={acceptAnimStyle}>
                <Pressable
                  testID="accept-call-button"
                  onPress={handleAccept}
                  disabled={isAccepting}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    backgroundColor: '#00CF35',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#00CF35',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    elevation: 10,
                  }}
                >
                  {isAccepting ? (
                    <ActivityIndicator color="#001935" size="small" />
                  ) : isVideo ? (
                    <Video size={28} color="#001935" />
                  ) : (
                    <Phone size={28} color="#001935" />
                  )}
                </Pressable>
              </Animated.View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>
                Accept
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
