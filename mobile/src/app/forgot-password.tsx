import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import { Mail, ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/rooms');
    }
  };
  const [email, setEmail] = useState('');

  const requestReset = useMutation({
    mutationFn: async () => {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: 'openly://reset-password',
      });
      if (result.error) throw new Error(result.error.message ?? 'Failed to send reset email');
    },
  });

  const isValid = email.includes('@');

  return (
    <SafeAreaView testID="forgot-password-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
      <View className="flex-1 px-8 pt-8 pb-8">
        {/* Back button */}
        <Pressable
          testID="back-button"
          onPress={handleBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 }}
        >
          <ArrowLeft size={18} color="#4a6fa5" />
          <Text style={{ color: '#4a6fa5', fontSize: 15 }}>Back</Text>
        </Pressable>

        <Text className="text-white text-2xl font-bold mb-2">Forgot password?</Text>
        <Text style={{ color: '#4a6fa5' }} className="text-base mb-8">
          Enter your email and we'll send you a reset link.
        </Text>

        <TextInput
          testID="email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#4a6fa5"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          className="rounded-xl px-5 py-4 text-white text-base mb-4"
          style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
        />

        {requestReset.isError ? (
          <Text testID="error-message" className="text-red-400 text-sm text-center mb-4">
            {(requestReset.error as Error).message}
          </Text>
        ) : null}

        {requestReset.isSuccess ? (
          <View
            testID="success-message"
            style={{
              backgroundColor: 'rgba(0,207,53,0.1)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(0,207,53,0.3)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Mail size={18} color="#00CF35" />
            <Text style={{ color: '#00CF35', fontSize: 13, flex: 1, lineHeight: 18 }}>
              If an account with that email exists, we sent a password reset link. Check your inbox.
            </Text>
          </View>
        ) : null}

        <Pressable
          testID="send-reset-button"
          onPress={() => requestReset.mutate()}
          disabled={!isValid || requestReset.isPending || requestReset.isSuccess}
          className="rounded-xl py-4 items-center"
          style={{ backgroundColor: isValid && !requestReset.isSuccess ? '#00CF35' : '#0a2d50' }}
        >
          {requestReset.isPending ? (
            <ActivityIndicator testID="loading-indicator" color="#001935" />
          ) : (
            <Text
              className="text-base font-bold"
              style={{ color: isValid && !requestReset.isSuccess ? '#001935' : '#4a6fa5' }}
            >
              {requestReset.isSuccess ? 'Email sent' : 'Send reset link'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
