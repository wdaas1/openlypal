import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldOff, ShieldCheck, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api/api';
import { useSession } from '@/lib/auth/use-session';
import { isAdmin } from '@/lib/auth/is-admin';
import { useTheme } from '@/lib/theme';

type AdminUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  role: string;
  status: string;
  createdAt: string;
  _count: { posts: number; reports: number };
};

export default function AdminUsersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUser[]>('/api/admin/users'),
    enabled: admin,
  });

  const banUser = useMutation({
    mutationFn: (userId: string) => api.patch(`/api/admin/users/${userId}/ban`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/api/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  if (!admin) {
    return (
      <SafeAreaView testID="admin-users-denied" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: '#FF4E6A', fontSize: 16, fontWeight: '700' }}>Access denied</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="admin-users-screen" style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Pressable
          testID="admin-users-back"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <ArrowLeft size={18} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>Users</Text>
        {users ? (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>{users.length} total</Text>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color="#00CF35" />
          </View>
        ) : !users?.length ? (
          <View style={{ alignItems: 'center', padding: 48 }}>
            <Text style={{ color: theme.subtext, fontSize: 14 }}>No users found.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onBan={() => banUser.mutate(user.id)}
                onSetRole={() =>
                  setRole.mutate({
                    userId: user.id,
                    role: user.role === 'moderator' ? 'user' : 'moderator',
                  })
                }
                isBanLoading={banUser.isPending === true && banUser.variables === user.id}
                isRoleLoading={setRole.isPending === true && setRole.variables?.userId === user.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UserRow({
  user, onBan, onSetRole, isBanLoading, isRoleLoading,
}: {
  user: AdminUser;
  onBan: () => void;
  onSetRole: () => void;
  isBanLoading: boolean;
  isRoleLoading: boolean;
}) {
  const theme = useTheme();
  const isBanned = user.status === 'banned';
  const isMod = user.role === 'moderator';
  const isAdminRole = user.role === 'admin';

  return (
    <View
      testID={`admin-user-${user.id}`}
      style={{
        backgroundColor: theme.card, borderRadius: 14, borderWidth: 0.5,
        borderColor: isBanned ? '#FF4E6A33' : theme.border,
        padding: 12, gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {user.image !== null ? (
          <Image source={{ uri: user.image }} style={{ width: 40, height: 40, borderRadius: 20, opacity: isBanned ? 0.5 : 1 }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center', opacity: isBanned ? 0.5 : 1 }}>
            <Text style={{ color: theme.subtext, fontWeight: '700' }}>{user.name[0]}</Text>
          </View>
        )}

        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: isBanned ? theme.subtext : theme.text, fontWeight: '600', fontSize: 14 }}>{user.name}</Text>
            {isAdminRole ? (
              <View style={{ backgroundColor: 'rgba(0,207,53,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                <Text style={{ color: '#00CF35', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
              </View>
            ) : null}
            {isMod ? (
              <View style={{ backgroundColor: 'rgba(96,165,250,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '700' }}>MOD</Text>
              </View>
            ) : null}
            {isBanned ? (
              <View style={{ backgroundColor: 'rgba(255,78,106,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                <Text style={{ color: '#FF4E6A', fontSize: 10, fontWeight: '700' }}>BANNED</Text>
              </View>
            ) : null}
          </View>
          {user.username !== null ? (
            <Text style={{ color: theme.subtext, fontSize: 12 }}>@{user.username}</Text>
          ) : null}
          <Text style={{ color: theme.border, fontSize: 11 }}>
            {user._count.posts} posts · {user._count.reports} reports filed
          </Text>
        </View>
      </View>

      {/* Action buttons row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Set Role button — disabled for admins */}
        <Pressable
          testID={`admin-setrole-${user.id}`}
          onPress={onSetRole}
          disabled={isRoleLoading || isAdminRole}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            paddingVertical: 8, borderRadius: 10,
            backgroundColor: isMod ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.08)',
            borderWidth: 0.5,
            borderColor: isAdminRole ? theme.border : 'rgba(96,165,250,0.3)',
            opacity: pressed || isRoleLoading || isAdminRole ? 0.5 : 1,
          })}
        >
          <Shield size={13} color={isAdminRole ? theme.subtext : '#60a5fa'} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: isAdminRole ? theme.subtext : '#60a5fa' }}>
            {isRoleLoading ? '…' : isMod ? 'Remove Mod' : 'Make Mod'}
          </Text>
        </Pressable>

        {/* Ban/Unban button */}
        <Pressable
          testID={`admin-ban-${user.id}`}
          onPress={onBan}
          disabled={isBanLoading || isAdminRole}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            paddingVertical: 8, borderRadius: 10,
            backgroundColor: isBanned ? 'rgba(0,207,53,0.12)' : 'rgba(255,78,106,0.12)',
            borderWidth: 0.5,
            borderColor: isAdminRole ? theme.border : isBanned ? 'rgba(0,207,53,0.3)' : 'rgba(255,78,106,0.3)',
            opacity: pressed || isBanLoading || isAdminRole ? 0.5 : 1,
          })}
        >
          {isBanned ? (
            <ShieldCheck size={13} color={isAdminRole ? theme.subtext : '#00CF35'} />
          ) : (
            <ShieldOff size={13} color={isAdminRole ? theme.subtext : '#FF4E6A'} />
          )}
          <Text style={{ fontSize: 12, fontWeight: '700', color: isAdminRole ? theme.subtext : isBanned ? '#00CF35' : '#FF4E6A' }}>
            {isBanLoading ? '…' : isBanned ? 'Unban' : 'Ban'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
