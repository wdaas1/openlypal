import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneOff } from 'lucide-react-native';

export default function CallScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/messenger' as any);
  };

  return (
    <View
      testID="call-screen"
      style={{ flex: 1, backgroundColor: '#000d1a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
        Call feature coming soon
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', marginBottom: 40 }}>
        We are rebuilding calls with a better experience.
      </Text>
      <Pressable
        testID="end-call-button"
        onPress={handleBack}
        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' }}
      >
        <PhoneOff size={26} color="#fff" />
      </Pressable>
    </View>
  );
}
