import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth/auth-client';
import { Eye, EyeOff, CheckCircle } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      if (!token) throw new Error('Invalid or missing reset link');
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) throw new Error(result.error.message ?? 'Failed to reset password');
    },
  });

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const isValid = password.length >= 6 && passwordsMatch;

  return (
    <SafeAreaView testID="reset-password-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
      <View className="flex-1 px-8 pt-16 pb-8">
        <Text className="text-white text-2xl font-bold mb-2">Set new password</Text>
        <Text style={{ color: '#4a6fa5' }} className="text-base mb-8">
          Choose a strong password for your account.
        </Text>

        {/* New password */}
        <View style={{ position: 'relative', marginBottom: 12 }}>
          <TextInput
            testID="password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="New password (min 6 characters)"
            placeholderTextColor="#4a6fa5"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            className="rounded-xl px-5 py-4 text-white text-base"
            style={{ backgroundColor: '#0a2d50', borderColor: '#1a3a5c', borderWidth: 1, paddingRight: 52 }}
          />
          <Pressable
            testID="password-toggle"
            onPress={() => setShowPassword(prev => !prev)}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' }}
          >
            {showPassword ? <EyeOff size={20} color="#4a6fa5" /> : <Eye size={20} color="#4a6fa5" />}
          </Pressable>
        </View>

        {/* Confirm password */}
        <View style={{ position: 'relative', marginBottom: 4 }}>
          <TextInput
            testID="confirm-password-input"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor="#4a6fa5"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            className="rounded-xl px-5 py-4 text-white text-base"
            style={{
              backgroundColor: '#0a2d50',
              borderColor: confirmPassword.length > 0 && !passwordsMatch ? '#FF4E6A' : '#1a3a5c',
              borderWidth: 1,
              paddingRight: 52,
            }}
          />
          {passwordsMatch ? (
            <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
              <CheckCircle size={20} color="#00CF35" />
            </View>
          ) : null}
        </View>

        {confirmPassword.length > 0 && !passwordsMatch ? (
          <Text style={{ color: '#FF4E6A', fontSize: 12, marginBottom: 12, marginLeft: 4 }}>
            Passwords do not match
          </Text>
        ) : (
          <View style={{ marginBottom: 12 }} />
        )}

        {resetPassword.isError ? (
          <Text testID="error-message" className="text-red-400 text-sm text-center mb-4">
            {(resetPassword.error as Error).message}
          </Text>
        ) : null}

        {resetPassword.isSuccess ? (
          <View
            testID="success-message"
            style={{
              backgroundColor: 'rgba(0,207,53,0.1)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(0,207,53,0.3)',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle size={24} color="#00CF35" />
            <Text style={{ color: '#00CF35', fontSize: 14, fontWeight: '600' }}>
              Password updated!
            </Text>
            <Text style={{ color: '#4a6fa5', fontSize: 13, textAlign: 'center' }}>
              Your password has been reset. You can now sign in with your new password.
            </Text>
            <Pressable
              testID="go-to-signin-button"
              onPress={() => router.replace('/sign-in' as any)}
              style={{
                marginTop: 4,
                backgroundColor: '#00CF35',
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 28,
              }}
            >
              <Text style={{ color: '#001935', fontWeight: '700', fontSize: 14 }}>Log in</Text>
            </Pressable>
          </View>
        ) : null}

        {!resetPassword.isSuccess ? (
          <Pressable
            testID="reset-password-button"
            onPress={() => resetPassword.mutate()}
            disabled={!isValid || resetPassword.isPending}
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: isValid ? '#00CF35' : '#0a2d50' }}
          >
            {resetPassword.isPending ? (
              <ActivityIndicator testID="loading-indicator" color="#001935" />
            ) : (
              <Text className="text-base font-bold" style={{ color: isValid ? '#001935' : '#4a6fa5' }}>
                Reset password
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
