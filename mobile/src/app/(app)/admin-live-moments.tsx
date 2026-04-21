import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Radio, StopCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type LiveMoment = {
  id: string;
  title: string;
  status: string;
  isLive: boolean;
  createdAt: string;
  expiresAt: string | null;
  creator: { id: string; name: string; username: string | null; image: string | null };
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminLiveMomentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: moments, isLoading } = useQuery({
    queryKey: ['admin', 'live-moments'],
    queryFn: () => api.get<LiveMoment[]>('/api/admin/live-moments'),
    enabled: admin,
  });

  const endMoment = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/live-moments/${id}/end`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'live-moments'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-live-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  const active = moments?.filter((m) => m.status === 'active') ?? [];
  const ended = moments?.filter((m) => m.status !== 'active') ?? [];

  return (
    <SafeAreaView testID="admin-live-moments-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-live-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Live Moments</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !moments?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(244,114,182,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Radio size={24} color="#f472b6" />
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>No live moments</Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center' }}>Live moments will appear here.</Text>
          </View>
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  Active ({active.length})
                </Text>
                <View style={{ gap: 10, marginBottom: 24 }}>
                  {active.map((moment) => (
                    <MomentCard
                      key={moment.id}
                      moment={moment}
                      onEnd={() => endMoment.mutate(moment.id)}
                      isEnding={endMoment.isPending === true && endMoment.variables === moment.id}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {ended.length > 0 ? (
              <>
                <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  Ended ({ended.length})
                </Text>
                <View style={{ gap: 10 }}>
                  {ended.map((moment) => (
                    <MomentCard
                      key={moment.id}
                      moment={moment}
                      onEnd={() => endMoment.mutate(moment.id)}
                      isEnding={endMoment.isPending === true && endMoment.variables === moment.id}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MomentCard({
  moment, onEnd, isEnding,
}: {
  moment: LiveMoment;
  onEnd: () => void;
  isEnding: boolean;
}) {
  const theme = useTheme();
  const isActive = moment.status === 'active';

  return (
    <View
      testID={`admin-moment-${moment.id}`}
      style={{
        backgroundColor: theme.card, borderRadius: 14, borderWidth: 0.5,
        borderColor: isActive ? 'rgba(244,114,182,0.4)' : theme.border,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {moment.creator.image !== null ? (
          <Image source={{ uri: moment.creator.image }} style={{ width: 36, height: 36, borderRadius: 18 }} />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.subtext, fontWeight: '700' }}>{moment.creator.name[0]}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{moment.title}</Text>
            {isActive ? (
              <View style={{ backgroundColor: 'rgba(244,114,182,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {moment.isLive ? (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f472b6' }} />
                ) : null}
                <Text style={{ color: '#f472b6', fontSize: 10, fontWeight: '700' }}>ACTIVE</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
                <Text style={{ color: theme.subtext, fontSize: 10, fontWeight: '700' }}>ENDED</Text>
              </View>
            )}
          </View>

          <Text style={{ color: theme.subtext, fontSize: 12 }}>
            {moment.creator.name}
            {moment.creator.username !== null ? ` · @${moment.creator.username}` : null}
          </Text>

          {moment.expiresAt !== null ? (
            <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 4 }}>
              Expires: {formatDate(moment.expiresAt)}
            </Text>
          ) : null}
        </View>
      </View>

      {isActive ? (
        <Pressable
          testID={`admin-end-moment-${moment.id}`}
          onPress={onEnd}
          disabled={isEnding}
          style={({ pressed }) => ({
            marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 10, borderRadius: 10,
            backgroundColor: 'rgba(255,78,106,0.12)',
            borderWidth: 0.5, borderColor: 'rgba(255,78,106,0.3)',
            opacity: pressed || isEnding ? 0.6 : 1,
          })}
        >
          <StopCircle size={14} color="#FF4E6A" />
          <Text style={{ color: '#FF4E6A', fontWeight: '700', fontSize: 13 }}>
            {isEnding ? 'Ending…' : 'End Moment'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
