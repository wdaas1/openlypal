import React, { createContext, useContext, useEffect, useState } from 'react';
import { StreamVideoClient } from '@stream-io/video-client';
import { useSession } from '@/lib/auth/use-session';
import { api } from '@/lib/api/api';

const StreamClientContext = createContext<StreamVideoClient | null>(null);

export function useStreamClient() {
  return useContext(StreamClientContext);
}

export function StreamVideoProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [client, setClient] = useState<StreamVideoClient | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    const userName = (session?.user as any)?.name ?? 'User';
    const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY;

    console.log('STREAM KEY:', apiKey);

    if (!userId || !apiKey) {
      setClient(null);
      return;
    }

    let streamClient: StreamVideoClient | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const result = await api.post<{ token: string }>('/api/stream-token', { userId });
        const token = result?.token ?? '';
        console.log('TOKEN:', token ? `${token.slice(0, 20)}...` : '(empty)');

        if (!token || cancelled) return;

        streamClient = new StreamVideoClient({
          apiKey,
          user: { id: userId, name: userName },
          token,
        });

        console.log('[Stream] Client initialised for user:', userId);
        if (!cancelled) setClient(streamClient);
      } catch (e) {
        console.error('[Stream] Init failed:', e);
      }
    };

    init();

    return () => {
      cancelled = true;
      streamClient?.disconnectUser().catch(() => {});
      setClient(null);
    };
  }, [session?.user?.id]);

  return (
    <StreamClientContext.Provider value={client}>
      {children}
    </StreamClientContext.Provider>
  );
}
