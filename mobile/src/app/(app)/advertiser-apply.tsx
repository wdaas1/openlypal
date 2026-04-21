import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Megaphone, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { useSession } from '@/lib/auth/use-session';
import { getAccessToken } from '@/lib/auth/auth-client';

type AdvertiserStatus = {
  status: 'pending' | 'approved' | 'rejected';
  company: string;
} | null;

export default function AdvertiserApplyScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');

  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['advertiser-status', backendUrl],
    queryFn: async (): Promise<AdvertiserStatus> => {
      const token = await getAccessToken();
      const res = await fetch(`${backendUrl}/api/advertiser/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const json = await res.json() as { data: AdvertiserStatus };
      return json.data;
    },
    enabled: Boolean(session?.user),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${backendUrl}/api/advertiser/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ company: company.trim(), website: website.trim() || undefined, description: description.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? 'Failed to submit application');
      }
    },
    onSuccess: () => {
      refetchStatus();
    },
  });

  const canSubmit = company.trim().length > 0 && description.trim().length > 0;

  return (
    <SafeAreaView testID="advertiser-apply-screen" style={{ flex: 1, backgroundColor: '#0a0a12' }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)',
      }}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color="#ffffff" />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Megaphone size={18} color="#00CF35" />
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 17 }}>Apply to Advertise</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {statusLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator testID="status-loading" color="#00CF35" />
            </View>
          ) : statusData ? (
            <StatusView status={statusData} onReApply={() => { refetchStatus(); }} />
          ) : (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 19, marginBottom: 28 }}>
                Tell us about your brand and what you'd like to promote. Our team reviews every application.
              </Text>

              {/* Company Name */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' }}>
                  Company Name *
                </Text>
                <TextInput
                  testID="company-input"
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Your company name"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#ffffff',
                    fontSize: 15,
                  }}
                  returnKeyType="next"
                />
              </View>

              {/* Website */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' }}>
                  Website (optional)
                </Text>
                <TextInput
                  testID="website-input"
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="https://yoursite.com"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="url"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#ffffff',
                    fontSize: 15,
                  }}
                  returnKeyType="next"
                />
              </View>

              {/* Description */}
              <View style={{ marginBottom: 28 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' }}>
                  What would you like to advertise? *
                </Text>
                <TextInput
                  testID="description-input"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Briefly describe your product, service, or campaign..."
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#ffffff',
                    fontSize: 15,
                    minHeight: 120,
                  }}
                />
              </View>

              {applyMutation.isError ? (
                <Text style={{ color: '#FF4E6A', fontSize: 13, marginBottom: 14, textAlign: 'center' }}>
                  {(applyMutation.error as Error)?.message ?? 'Something went wrong. Please try again.'}
                </Text>
              ) : null}

              <Pressable
                testID="submit-application-button"
                onPress={() => applyMutation.mutate()}
                disabled={!canSubmit || applyMutation.isPending}
                style={({ pressed }) => ({
                  backgroundColor: canSubmit ? '#00CF35' : 'rgba(255,255,255,0.1)',
                  borderRadius: 18,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {applyMutation.isPending ? (
                  <ActivityIndicator testID="submit-loading" color="#001935" />
                ) : (
                  <Text style={{ color: canSubmit ? '#001935' : 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: '800' }}>
                    Submit Application
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusView({ status, onReApply }: { status: { status: 'pending' | 'approved' | 'rejected'; company: string }; onReApply: () => void }) {
  if (status.status === 'pending') {
    return (
      <View testID="status-pending" style={{ alignItems: 'center', paddingTop: 48, gap: 16 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: 'rgba(245,158,11,0.12)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
        }}>
          <Clock size={32} color="#f59e0b" />
        </View>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
          Application Under Review
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Your application is under review. We'll get back to you shortly.
        </Text>
        <View style={{
          backgroundColor: 'rgba(245,158,11,0.1)',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: 'rgba(245,158,11,0.25)',
        }}>
          <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '700' }}>Pending Review</Text>
        </View>
      </View>
    );
  }

  if (status.status === 'approved') {
    return (
      <View testID="status-approved" style={{ alignItems: 'center', paddingTop: 48, gap: 16 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: 'rgba(0,207,53,0.12)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(0,207,53,0.3)',
        }}>
          <CheckCircle size={32} color="#00CF35" />
        </View>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
          You're an Approved Advertiser!
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Your application for {status.company} has been approved. Contact us to get started.
        </Text>
        <View style={{
          backgroundColor: 'rgba(0,207,53,0.1)',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: 'rgba(0,207,53,0.3)',
        }}>
          <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '700' }}>Approved</Text>
        </View>
      </View>
    );
  }

  // rejected
  return (
    <View testID="status-rejected" style={{ alignItems: 'center', paddingTop: 48, gap: 16 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: 'rgba(255,78,106,0.12)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,78,106,0.3)',
      }}>
        <XCircle size={32} color="#FF4E6A" />
      </View>
      <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
        Application Not Approved
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
        Unfortunately your application was not approved. You're welcome to re-apply with updated information.
      </Text>
      <Pressable
        testID="re-apply-button"
        onPress={onReApply}
        style={({ pressed }) => ({
          backgroundColor: 'rgba(255,255,255,0.09)',
          borderRadius: 18,
          paddingVertical: 13,
          paddingHorizontal: 28,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>Re-apply</Text>
      </Pressable>
    </View>
  );
}
