import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { OtpInput } from 'react-native-otp-entry';
import { authClient } from '@/lib/auth/auth-client';
import { useInvalidateSession } from '@/lib/auth/use-session';
import * as Haptics from 'expo-haptics';

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const invalidateSession = useInvalidateSession();

  const verifyOtp = useMutation({
    mutationFn: async (otp: string) => {
      const result = await authClient.signIn.emailOtp({
        email: email ?? '',
        otp,
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Invalid code');
      }
      return result;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateSession();
    },
  });

  const resendOtp = useMutation({
    mutationFn: async () => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email ?? '',
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to resend');
      }
      return result;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  return (
    <SafeAreaView testID="verify-otp-screen" className="flex-1" style={{ backgroundColor: '#001935' }}>
      <View className="flex-1 px-8 pt-20">
        {/* Back button */}
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          className="mb-8"
        >
          <Text className="text-white text-base">Back</Text>
        </Pressable>

        {/* Header */}
        <Text className="text-white text-2xl font-bold mb-3">
          Enter your code
        </Text>
        <Text className="mb-10 text-base" style={{ color: '#4a6fa5' }}>
          We sent a verification code to {email}
        </Text>

        {/* OTP Input */}
        <View className="mb-8">
          <OtpInput
            numberOfDigits={6}
            onFilled={(otp) => verifyOtp.mutate(otp)}
            focusColor="#00CF35"
            theme={{
              containerStyle: { gap: 10 },
              pinCodeContainerStyle: {
                backgroundColor: '#0a2d50',
                borderColor: '#1a3a5c',
                borderWidth: 1,
                borderRadius: 12,
                width: 48,
                height: 56,
              },
              pinCodeTextStyle: {
                color: '#FFFFFF',
                fontSize: 20,
                fontWeight: '600',
              },
              focusedPinCodeContainerStyle: {
                borderColor: '#00CF35',
              },
            }}
          />
        </View>

        {verifyOtp.isPending ? (
          <ActivityIndicator testID="loading-indicator" color="#00CF35" className="mb-4" />
        ) : null}

        {verifyOtp.isError ? (
          <Text className="text-red-400 text-center mb-4 text-sm">
            {verifyOtp.error.message}
          </Text>
        ) : null}

        {/* Resend */}
        <Pressable
          testID="resend-button"
          onPress={() => resendOtp.mutate()}
          disabled={resendOtp.isPending}
          className="items-center mt-4"
        >
          <Text style={{ color: resendOtp.isPending ? '#4a6fa5' : '#00CF35' }} className="text-sm font-medium">
            {resendOtp.isPending ? 'Sending...' : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
