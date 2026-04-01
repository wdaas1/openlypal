import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import * as Haptics from 'expo-haptics';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const sendOtp = useMutation({
    mutationFn: async () => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send code');
      }
      return result;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/verify-otp' as any, params: { email } });
    },
  });

  const isValidEmail = email.includes('@') && email.includes('.');

  return (
    <SafeAreaView testID="sign-in-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
      <View className="flex-1 px-8 pt-20">
        {/* Logo */}
        <View className="items-center mb-16">
          <Text className="text-8xl font-black text-white" style={{ fontStyle: 'italic' }}>
            t
          </Text>
          <Text className="text-white text-lg mt-4 opacity-70">
            Welcome back.
          </Text>
        </View>

        {/* Email Input */}
        <View className="mb-6">
          <TextInput
            testID="email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#4a6fa5"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            className="rounded-xl px-5 py-4 text-white text-base"
            style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
          />
        </View>

        {/* Continue Button */}
        <Pressable
          testID="continue-button"
          onPress={() => sendOtp.mutate()}
          disabled={!isValidEmail || sendOtp.isPending}
          className="rounded-xl py-4 items-center"
          style={{
            backgroundColor: isValidEmail ? '#00CF35' : '#0a2d50',
            opacity: sendOtp.isPending ? 0.7 : 1,
          }}
        >
          {sendOtp.isPending ? (
            <ActivityIndicator testID="loading-indicator" color="#001935" />
          ) : (
            <Text
              className="text-base font-bold"
              style={{ color: isValidEmail ? '#001935' : '#4a6fa5' }}
            >
              Continue
            </Text>
          )}
        </Pressable>

        {sendOtp.isError ? (
          <Text className="text-red-400 text-center mt-4 text-sm">
            {sendOtp.error.message}
          </Text>
        ) : null}

        {/* Footer */}
        <View className="items-center mt-8">
          <Text className="text-sm" style={{ color: '#4a6fa5' }}>
            We will send you a verification code
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
