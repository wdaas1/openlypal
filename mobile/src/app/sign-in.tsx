import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Eye, EyeOff, Mail } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import { useInvalidateSession } from '@/lib/auth/use-session';
import * as Haptics from 'expo-haptics';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api/api';
import type { User } from '@/lib/types';

type SignInError = Error & { code?: string };

export default function SignInScreen() {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resendVerification = useMutation({
    mutationFn: async () => {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: 'vibecode://',
      });
      if (result.error) throw new Error(result.error.message ?? 'Failed to send verification email');
    },
  });

  const signIn = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        if (
          result.error.code === 'EMAIL_NOT_VERIFIED' ||
          (result.error.message ?? '').toLowerCase().includes('not verified') ||
          (result.error.message ?? '').toLowerCase().includes('verify')
        ) {
          const err = new Error('Please verify your email before signing in.') as SignInError;
          err.code = 'EMAIL_NOT_VERIFIED';
          throw err;
        }
        throw new Error(result.error.message ?? 'Invalid email or password');
      }
      // Check if account is banned
      const profile = await api.get<User>('/api/users/me');
      if (profile?.status === 'banned') {
        await authClient.signOut();
        throw new Error('Account suspended');
      }
      return result;
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidateSession();
    },
  });

  const signInError = signIn.error as SignInError | null;
  const isEmailNotVerified = signInError?.code === 'EMAIL_NOT_VERIFIED';
  const isValid = email.includes('@') && password.length >= 6;

  return (
    <SafeAreaView testID="sign-in-screen" className="flex-1" style={{ backgroundColor: '#001935' }} onTouchStart={() => console.log('[SignIn] Screen touched')}>
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
                autoCorrect={false}
                spellCheck={false}
                className="rounded-xl px-5 py-4 text-white text-base"
                style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1 }}
              />
              <View style={{ position: 'relative' }}>
                <TextInput
                  testID="password-input"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#4a6fa5"
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  className="rounded-xl px-5 py-4 text-white text-base"
                  style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, paddingRight: 52 }}
                />
                <Pressable
                  testID="password-toggle"
                  onPress={() => setShowPassword(prev => !prev)}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword
                    ? <EyeOff size={20} color="#4a6fa5" />
                    : <Eye size={20} color="#4a6fa5" />
                  }
                </Pressable>
              </View>
            </View>

            {/* Error */}
            {signIn.isError ? (
              <View
                style={{
                  backgroundColor: signInError?.message === 'Account suspended'
                    ? 'rgba(255,78,106,0.12)'
                    : isEmailNotVerified
                    ? 'rgba(10,45,80,0.8)'
                    : 'transparent',
                  borderRadius: 10,
                  paddingVertical: (signInError?.message === 'Account suspended' || isEmailNotVerified) ? 12 : 0,
                  paddingHorizontal: (signInError?.message === 'Account suspended' || isEmailNotVerified) ? 14 : 0,
                  marginBottom: 12,
                  borderWidth: isEmailNotVerified ? 1 : 0,
                  borderColor: isEmailNotVerified ? '#1a3a5c' : 'transparent',
                }}
              >
                {signInError?.message === 'Account suspended' ? (
                  <Text style={{ color: '#FF4E6A', fontWeight: '700', fontSize: 14, textAlign: 'center', marginBottom: 2 }}>
                    Account suspended
                  </Text>
                ) : null}
                <Text style={{ color: isEmailNotVerified ? '#4a6fa5' : '#FF4E6A', fontSize: 13, textAlign: 'center' }}>
                  {signInError?.message === 'Account suspended'
                    ? 'Your account has been suspended. Contact support if you think this is a mistake.'
                    : signInError?.message ?? null}
                </Text>
                {isEmailNotVerified ? (
                  <Pressable
                    testID="resend-verification-button"
                    onPress={() => resendVerification.mutate()}
                    disabled={resendVerification.isPending || resendVerification.isSuccess}
                    style={{ marginTop: 10, alignItems: 'center' }}
                  >
                    {resendVerification.isPending ? (
                      <ActivityIndicator size="small" color="#00CF35" />
                    ) : resendVerification.isSuccess ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Mail size={14} color="#00CF35" />
                        <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '600' }}>
                          Verification email sent
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Mail size={14} color="#00CF35" />
                        <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '600' }}>
                          Resend verification email
                        </Text>
                      </View>
                    )}
                    {resendVerification.isError ? (
                      <Text style={{ color: '#FF4E6A', fontSize: 12, marginTop: 4 }}>
                        {(resendVerification.error as Error).message}
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Log In Button */}
            <Pressable
              testID="login-button"
              onPress={() => { console.log('[SignIn] Login button pressed'); signIn.mutate(); }}
              disabled={!isValid || signIn.isPending}
              className="rounded-xl py-4 items-center mb-2"
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

            {/* Forgot Password Link */}
            <Pressable
              testID="forgot-password-link"
              onPress={() => router.push('/forgot-password' as any)}
              className="items-center py-2"
            >
              <Text style={{ color: '#4a6fa5' }} className="text-sm">Forgot password?</Text>
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
