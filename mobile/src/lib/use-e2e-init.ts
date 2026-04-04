import { useEffect, useRef } from 'react';
import { getOrCreateKeypair } from './crypto';
import { api } from './api/api';
import { useSession } from './auth/use-session';

export function useE2EInit() {
  const { data: session } = useSession();
  const initialized = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const { publicKey } = await getOrCreateKeypair();
        await api.patch('/api/users/me/public-key', { publicKey });
      } catch {}
    })();
  }, [session?.user?.id]);
}
