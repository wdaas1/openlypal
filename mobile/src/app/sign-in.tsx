import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Eye, EyeOff, Mail } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Logo } from '@/components/Logo';

type SignInError = Error & { code?: string };

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resendVerification = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: 'https://openlypal.com' },
      });
      if (error) throw new Error(error.message ?? 'Failed to send verification email');
    },
  });

  const signIn = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not verified') ||
          error.message.toLowerCase().includes('confirm')
        ) {
          const err = new Error('Please verify your email before signing in.') as SignInError;
          err.code = 'EMAIL_NOT_VERIFIED';
          throw err;
        }
        throw new Error(error.message ?? 'Invalid email or password');
      }
      if (!data.session) {
        const err = new Error('Please verify your email before signing in.') as SignInError;
        err.code = 'EMAIL_NOT_VERIFIED';
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const signInError = signIn.error as SignInError | null;
  const isEmailNotVerified = signInError?.code === 'EMAIL_NOT_VERIFIED';
  const isValid = email.includes('@') && password.length >= 6;

  return (
    <SafeAreaView testID="sign-in-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={{ paddingHorizontal: 32, paddingTop: 48, paddingBottom: 32 }}>
            <View className="items-center mb-12">
              <Logo size={80} showBackground={false} />
              <Text className="text-white text-xl font-semibold mt-2">
                Welcome back.
              </Text>
            </View>

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

            {signIn.isError ? (
              <View
                style={{
                  backgroundColor: isEmailNotVerified ? 'rgba(10,45,80,0.8)' : 'transparent',
                  borderRadius: 10,
                  paddingVertical: isEmailNotVerified ? 12 : 0,
                  paddingHorizontal: isEmailNotVerified ? 14 : 0,
                  marginBottom: 12,
                  borderWidth: isEmailNotVerified ? 1 : 0,
                  borderColor: isEmailNotVerified ? '#1a3a5c' : 'transparent',
                }}
              >
                <Text style={{ color: isEmailNotVerified ? '#4a6fa5' : '#FF4E6A', fontSize: 13, textAlign: 'center' }}>
                  {signInError?.message ?? null}
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

            <Pressable
              testID="login-button"
              onPress={() => signIn.mutate()}
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

            <Pressable
              testID="forgot-password-link"
              onPress={() => router.push('/forgot-password' as any)}
              className="items-center py-2"
            >
              <Text style={{ color: '#4a6fa5' }} className="text-sm">Forgot password?</Text>
            </Pressable>

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
    </SafeAreaView>
  );
}
