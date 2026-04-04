import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import { useInvalidateSession } from '@/lib/auth/use-session';
import { api } from '@/lib/api/api';
import * as Haptics from 'expo-haptics';
import { Logo } from '@/components/Logo';
import { Mail } from 'lucide-react-native';

function buildUsername(displayName: string, suffix: number): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);
  return base ? `${base}${suffix}` : '';
}

export default function SignUpScreen() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  // Stable random suffix so it doesn't jump around while typing
  const suffixRef = useRef(Math.floor(1000 + Math.random() * 9000));

  const handleNameChange = (text: string) => {
    setName(text);
    if (!usernameEdited) {
      setUsername(buildUsername(text, suffixRef.current));
    }
  };

  const handleUsernameChange = (text: string) => {
    setUsernameEdited(true);
    // Only allow lowercase letters, numbers, underscores
    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  const signUp = useMutation({
    mutationFn: async () => {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: 'vibecode://',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to create account');
      }
      // Set the auto-generated (or edited) username right after account creation
      const trimmedUsername = username.trim();
      if (trimmedUsername) {
        try {
          await api.patch('/api/users/me', { username: trimmedUsername });
        } catch {
          // Non-fatal — user can change it later in edit profile
        }
      }
      return result;
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerificationSent(true);
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
              {/* Display name */}
              <TextInput
                testID="name-input"
                value={name}
                onChangeText={handleNameChange}
                placeholder="Display name"
                placeholderTextColor="#4a6fa5"
                autoCapitalize="words"
                autoComplete="name"
                className="rounded-xl px-5 py-4 text-white text-base"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />

              {/* Username — auto-filled, editable */}
              <View>
                <View style={{ position: 'relative' }}>
                  <Text style={{
                    position: 'absolute', left: 18, top: 14,
                    color: '#4a6fa5', fontSize: 16, zIndex: 1,
                  }}>@</Text>
                  <TextInput
                    testID="username-input"
                    value={username}
                    onChangeText={handleUsernameChange}
                    placeholder="username"
                    placeholderTextColor="#2a4a6a"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="rounded-xl py-4 text-white text-base"
                    style={{
                      backgroundColor: '#0a2d50',
                      borderColor: '#1a3a5c',
                      borderWidth: 1,
                      paddingLeft: 34,
                      paddingRight: 18,
                    }}
                  />
                </View>
                {username ? (
                  <Text style={{ color: '#2a4a6a', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                    You can always change this later
                  </Text>
                ) : null}
              </View>

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

            {/* Email verification notice */}
            {verificationSent ? (
              <View
                testID="verification-notice"
                style={{
                  backgroundColor: 'rgba(0,207,53,0.1)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(0,207,53,0.3)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Mail size={18} color="#00CF35" />
                <Text style={{ color: '#00CF35', fontSize: 13, flex: 1, lineHeight: 18 }}>
                  Check your email to verify your account before signing in.
                </Text>
              </View>
            ) : null}

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
