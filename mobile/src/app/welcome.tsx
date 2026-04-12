import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Logo } from '@/components/Logo';

const FEATURES = [
  {
    emoji: '📸',
    title: 'Share anything',
    body: 'Photos, videos, quotes, links — any format, your way.',
  },
  {
    emoji: '🔥',
    title: 'Discover your people',
    body: 'Follow creators and explore communities built around what you love.',
  },
  {
    emoji: '💬',
    title: 'Real conversations',
    body: 'Private messaging, live moments, and rooms with the people you trust.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/sign-up' as any);
  };

  const handleLogIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/sign-in' as any);
  };

  return (
    <View testID="welcome-screen" style={{ flex: 1, backgroundColor: '#001935' }}>
      <LinearGradient
        colors={['#001935', '#001220', '#000d1a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Subtle green glow at top */}
      <View
        style={{
          position: 'absolute',
          top: -80,
          left: '50%',
          marginLeft: -160,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: '#00CF35',
          opacity: 0.05,
        }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + (height > 700 ? 48 : 24),
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
        }}
      >
        {/* Logo + wordmark */}
        <View style={{ alignItems: 'center', marginBottom: height > 700 ? 44 : 28 }}>
          <Logo size={72} showBackground={false} />
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 34,
              fontWeight: '800',
              letterSpacing: -0.8,
              marginTop: 12,
            }}
          >
            Openly
          </Text>
          <Text
            style={{
              color: '#4a6fa5',
              fontSize: 15,
              marginTop: 6,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            The creative social platform where{'\n'}your voice actually matters.
          </Text>
        </View>

        {/* Feature list */}
        <View style={{ gap: 14, marginBottom: height > 700 ? 48 : 28 }}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
                backgroundColor: 'rgba(10,45,80,0.5)',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: '#1a3a5c',
              }}
            >
              <Text style={{ fontSize: 26, lineHeight: 30 }}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 2 }}
                >
                  {f.title}
                </Text>
                <Text style={{ color: '#4a6fa5', fontSize: 13, lineHeight: 19 }}>
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={{ gap: 12 }}>
          <Pressable
            testID="get-started-button"
            onPress={handleSignUp}
            style={{
              backgroundColor: '#00CF35',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              shadowColor: '#00CF35',
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Text style={{ color: '#001935', fontWeight: '800', fontSize: 16 }}>
              Create an account
            </Text>
          </Pressable>

          <Pressable
            testID="log-in-button"
            onPress={handleLogIn}
            style={{
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: '#1a3a5c',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
              Log in
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
