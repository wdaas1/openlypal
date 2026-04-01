import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import { useInvalidateSession } from '@/lib/auth/use-session';
import * as Haptics from 'expo-haptics';
import { Logo } from '@/components/Logo';

export default function SignUpScreen() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signUp = useMutation({
    mutationFn: async () => {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to create account');
      }
      return result;
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidateSession();
    },
  });

  const isValid = name.length >= 1 && email.includes('@') && password.length >= 6;

  return (
    <SafeAreaView testID="sign-up-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
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
              <Logo size={80} showBackground={false} />
              <Text className="text-white text-xl font-semibold mt-2">
                Join Openly.
              </Text>
            </View>

            {/* Inputs */}
            <View className="gap-3 mb-6">
              <TextInput
                testID="name-input"
                value={name}
                onChangeText={setName}
                placeholder="Display name"
                placeholderTextColor="#4a6fa5"
                autoCapitalize="words"
                autoComplete="name"
                className="rounded-xl px-5 py-4 text-white text-base"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
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
                placeholder="Password (min 6 characters)"
                placeholderTextColor="#4a6fa5"
                secureTextEntry
                autoComplete="new-password"
                className="rounded-xl px-5 py-4 text-white text-base"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
            </View>

            {/* Error */}
            {signUp.isError ? (
              <Text className="text-red-400 text-sm text-center mb-4">
                {signUp.error.message}
              </Text>
            ) : null}

            {/* Create Account Button */}
            <Pressable
              testID="create-account-button"
              onPress={() => signUp.mutate()}
              disabled={!isValid || signUp.isPending}
              className="rounded-xl py-4 items-center mb-4"
              style={{ backgroundColor: isValid ? '#00CF35' : '#0a2d50' }}
            >
              {signUp.isPending ? (
                <ActivityIndicator testID="loading-indicator" color="#001935" />
              ) : (
                <Text
                  className="text-base font-bold"
                  style={{ color: isValid ? '#001935' : '#4a6fa5' }}
                >
                  Create account
                </Text>
              )}
            </Pressable>

            {/* Sign In Link */}
            <Pressable
              testID="signin-link"
              onPress={() => router.back()}
              className="items-center py-3"
            >
              <Text style={{ color: '#4a6fa5' }} className="text-sm">
                Already have an account?{' '}
                <Text style={{ color: '#00CF35' }} className="font-semibold">
                  Log in
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
