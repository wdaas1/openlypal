import React, { useEffect, useState } from 'react';
import { StreamVideoClient } from '@stream-io/video-client';
import { StreamVideo } from '@stream-io/video-react-native-sdk';
import { useSession } from '@/lib/auth/use-session';

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
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
        const res = await fetch(`${baseUrl}/api/stream-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId }),
        });
        const json = await res.json();
        const token: string = json?.data?.token ?? '';
        console.log('TOKEN:', token);

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

  if (!client) return <>{children}</>;

  return <StreamVideo client={client}>{children}</StreamVideo>;
}
