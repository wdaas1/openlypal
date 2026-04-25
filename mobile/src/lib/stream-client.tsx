import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '@/lib/auth/use-session';
import { api } from '@/lib/api/api';

// Type-only import — does NOT trigger native module load at runtime
import type { StreamVideoClient } from '@stream-io/video-react-native-sdk';

const StreamClientContext = createContext<StreamVideoClient | null>(null);

export function useStreamClient() {
  return useContext(StreamClientContext);
}

export function StreamVideoProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [StreamVideoWrapper, setStreamVideoWrapper] = useState<React.ComponentType<{
    client: StreamVideoClient;
    children: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    const userName = (session?.user as any)?.name ?? 'User';
    const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY;

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

        if (!token || cancelled) return;

        // Dynamic import so the native module error is caught here, not at parse time
        let sdk: typeof import('@stream-io/video-react-native-sdk');
        try {
          sdk = await import('@stream-io/video-react-native-sdk');
        } catch {
          console.warn('[Stream] SDK unavailable — native WebRTC module not compiled into this build');
          return;
        }

        streamClient = new sdk.StreamVideoClient({
          apiKey,
          user: { id: userId, name: userName },
          token,
        });

        console.log('[Stream] Client initialised for user:', userId);
        if (!cancelled) {
          setClient(streamClient);
          setStreamVideoWrapper(() => sdk.StreamVideo as any);
        }
      } catch (e) {
        console.warn('[Stream] Init failed:', e);
      }
    };

    init();

    return () => {
      cancelled = true;
      streamClient?.disconnectUser().catch(() => {});
      setClient(null);
      setStreamVideoWrapper(null);
    };
  }, [session?.user?.id]);

  if (client && StreamVideoWrapper) {
    return (
      <StreamClientContext.Provider value={client}>
        <StreamVideoWrapper client={client}>
          {children}
        </StreamVideoWrapper>
      </StreamClientContext.Provider>
    );
  }

  return (
    <StreamClientContext.Provider value={null}>
      {children}
    </StreamClientContext.Provider>
  );
}
