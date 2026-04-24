import React, { useEffect, useState } from 'react';
import { StreamVideoClient } from '@stream-io/video-client';
import { StreamVideo } from '@stream-io/video-react-native-sdk';
import { useSession } from '@/lib/auth/use-session';
import { api } from '@/lib/api/api';

export function StreamVideoProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [client, setClient] = useState<StreamVideoClient | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    const userName = (session?.user as any)?.name ?? 'User';
    const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY;

    console.log('STREAM KEY:', apiKey);

    if (!userId || !apiKey) {
      client?.disconnectUser().catch(() => {});
      setClient(null);
      return;
    }

    const c = new StreamVideoClient({
      apiKey,
      user: { id: userId, name: userName },
      tokenProvider: async () => {
        const result = await api.get<{ token: string; apiKey: string }>('/api/calls/stream-token');
        return result?.token ?? '';
      },
    });

    console.log('[Stream] Client initialised for user:', userId);
    setClient(c);

    return () => {
      c.disconnectUser().catch(() => {});
      setClient(null);
    };
  }, [session?.user?.id]);

  if (!client) return <>{children}</>;

  return <StreamVideo client={client}>{children}</StreamVideo>;
}
