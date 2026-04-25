import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Radio } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LiveComingSoonScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/live-moments' as any);
  };

  return (
    <View
      testID="live-coming-soon-screen"
      style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: 'rgba(0,207,53,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          borderWidth: 1,
          borderColor: 'rgba(0,207,53,0.25)',
        }}
      >
        <Radio size={36} color="#00CF35" />
      </View>
      <Text
        style={{
          color: '#ffffff',
          fontSize: 22,
          fontWeight: '800',
          marginBottom: 10,
          textAlign: 'center',
          letterSpacing: 0.2,
        }}
      >
        Live Streaming Coming Soon
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 15,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 40,
        }}
      >
        We're building an amazing live streaming experience.
      </Text>
      <Pressable
        testID="live-coming-soon-back"
        onPress={handleBack}
        style={{
          paddingHorizontal: 28,
          paddingVertical: 14,
          borderRadius: 30,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' }}>
          Go Back
        </Text>
      </Pressable>
    </View>
  );
}
