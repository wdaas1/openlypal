import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Megaphone, Globe, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { getAccessToken } from '@/lib/auth/auth-client';
import { useTheme } from '@/lib/theme';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

type AdvertiserApplication = {
  id: string;
  status: ApplicationStatus;
  company: string;
  website?: string | null;
  description: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
};

export default function AdminAdvertiserApplicationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const admin = isAdmin(session?.user);
  const backendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');

  const { data: applications, isLoading } = useQuery({
    queryKey: ['admin-advertiser-applications', backendUrl],
    queryFn: async (): Promise<AdvertiserApplication[]> => {
      const token = await getAccessToken();
      const res = await fetch(`${backendUrl}/api/advertiser/admin/applications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      const json = await res.json() as { data: AdvertiserApplication[] };
      return json.data ?? [];
    },
    enabled: Boolean(session?.user) && admin,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const token = await getAccessToken();
      const res = await fetch(`${backendUrl}/api/advertiser/admin/applications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertiser-applications', backendUrl] });
    },
  });

  if (!admin) {
    return (
      <SafeAreaView
        testID="admin-access-denied"
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}
        edges={['top']}
      >
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  const pending = (applications ?? []).filter((a) => a.status === 'pending');
  const reviewed = (applications ?? []).filter((a) => a.status !== 'pending');

  return (
    <SafeAreaView testID="admin-advertiser-applications-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: theme.border,
      }}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Megaphone size={18} color="#f59e0b" />
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Advertiser Applications</Text>
        </View>
        {(applications ?? []).length > 0 ? (
          <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700' }}>{pending.length} pending</Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator testID="loading-indicator" color="#f59e0b" />
        </View>
      ) : (applications ?? []).length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 18,
            backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, borderWidth: 0.5, borderColor: theme.border,
          }}>
            <Megaphone size={28} color={theme.border} />
          </View>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>No applications yet</Text>
          <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
            Advertiser applications will appear here
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {pending.length > 0 ? (
            <>
              <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                Pending Review ({pending.length})
              </Text>
              {pending.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onApprove={() => updateStatusMutation.mutate({ id: app.id, status: 'approved' })}
                  onReject={() => updateStatusMutation.mutate({ id: app.id, status: 'rejected' })}
                  isPending={updateStatusMutation.isPending}
                  theme={theme}
                />
              ))}
            </>
          ) : null}

          {reviewed.length > 0 ? (
            <>
              <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: pending.length > 0 ? 20 : 0, marginBottom: 12 }}>
                Reviewed ({reviewed.length})
              </Text>
              {reviewed.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onApprove={() => updateStatusMutation.mutate({ id: app.id, status: 'approved' })}
                  onReject={() => updateStatusMutation.mutate({ id: app.id, status: 'rejected' })}
                  isPending={updateStatusMutation.isPending}
                  theme={theme}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type ThemeType = ReturnType<typeof useTheme>;

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = {
    pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Pending', icon: <Clock size={11} color="#f59e0b" /> },
    approved: { color: '#00CF35', bg: 'rgba(0,207,53,0.12)', label: 'Approved', icon: <CheckCircle size={11} color="#00CF35" /> },
    rejected: { color: '#FF4E6A', bg: 'rgba(255,78,106,0.12)', label: 'Rejected', icon: <XCircle size={11} color="#FF4E6A" /> },
  }[status];

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: config.bg, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 3,
    }}>
      {config.icon}
      <Text style={{ color: config.color, fontSize: 11, fontWeight: '700' }}>{config.label}</Text>
    </View>
  );
}

function ApplicationCard({
  application,
  onApprove,
  onReject,
  isPending,
  theme,
}: {
  application: AdvertiserApplication;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  theme: ThemeType;
}) {
  return (
    <View
      testID={`application-card-${application.id}`}
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        borderWidth: 0.5,
        borderColor: theme.border,
        marginBottom: 12,
        padding: 16,
      }}
    >
      {/* User info row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
            {application.user.name ?? application.user.email}
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>{application.user.email}</Text>
        </View>
        <StatusBadge status={application.status} />
      </View>

      {/* Company info */}
      <View style={{ gap: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Megaphone size={13} color={theme.subtext} />
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{application.company}</Text>
        </View>
        {application.website ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Globe size={13} color={theme.subtext} />
            <Text style={{ color: '#00CF35', fontSize: 12 }}>{application.website}</Text>
          </View>
        ) : null}
        <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
          {application.description}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          testID={`approve-button-${application.id}`}
          onPress={onApprove}
          disabled={isPending || application.status === 'approved'}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            backgroundColor: application.status === 'approved' ? 'rgba(0,207,53,0.08)' : 'rgba(0,207,53,0.15)',
            borderRadius: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(0,207,53,0.25)',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <CheckCircle size={14} color="#00CF35" />
          <Text style={{ color: '#00CF35', fontSize: 13, fontWeight: '700' }}>Approve</Text>
        </Pressable>
        <Pressable
          testID={`reject-button-${application.id}`}
          onPress={onReject}
          disabled={isPending || application.status === 'rejected'}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            backgroundColor: application.status === 'rejected' ? 'rgba(255,78,106,0.08)' : 'rgba(255,78,106,0.12)',
            borderRadius: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,78,106,0.25)',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <XCircle size={14} color="#FF4E6A" />
          <Text style={{ color: '#FF4E6A', fontSize: 13, fontWeight: '700' }}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}
