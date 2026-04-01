import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import { useInvalidateSession } from '@/lib/auth/use-session';
import * as Haptics from 'expo-haptics';

export default function SignInScreen() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Invalid email or password');
      }
      return result;
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidateSession();
    },
  });

  const isValid = email.includes('@') && password.length >= 6;

  return (
    <SafeAreaView testID="sign-in-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-8 pt-16 pb-8">
            {/* Logo */}
            <View className="items-center mb-12">
              <Text
                className="font-black text-white"
                style={{ fontSize: 80, fontStyle: 'italic', lineHeight: 90 }}
              >
                O
              </Text>
              <Text className="text-white text-xl font-semibold mt-2">
                Welcome back.
              </Text>
            </View>

            {/* Inputs */}
            <View className="gap-3 mb-6">
              <TextInput
                testID="email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="#4a6fa5"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="rounded-xl px-5 py-4 text-white text-base"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
              <TextInput
                testID="password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#4a6fa5"
                secureTextEntry
                autoComplete="current-password"
                className="rounded-xl px-5 py-4 text-white text-base"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
            </View>

            {/* Error */}
            {signIn.isError ? (
              <Text className="text-red-400 text-sm text-center mb-4">
                {signIn.error.message}
              </Text>
            ) : null}

            {/* Log In Button */}
            <Pressable
              testID="login-button"
              onPress={() => signIn.mutate()}
              disabled={!isValid || signIn.isPending}
              className="rounded-xl py-4 items-center mb-4"
              style={{ backgroundColor: isValid ? '#00CF35' : '#0a2d50' }}
            >
              {signIn.isPending ? (
                <ActivityIndicator testID="loading-indicator" color="#001935" />
              ) : (
                <Text
                  className="text-base font-bold"
                  style={{ color: isValid ? '#001935' : '#4a6fa5' }}
                >
                  Log in
                </Text>
              )}
            </Pressable>

            {/* Sign Up Link */}
            <Pressable
              testID="signup-link"
              onPress={() => router.push('/sign-up' as any)}
              className="items-center py-3"
            >
              <Text style={{ color: '#4a6fa5' }} className="text-sm">
                Don't have an account?{' '}
                <Text style={{ color: '#00CF35' }} className="font-semibold">
                  Sign up
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
