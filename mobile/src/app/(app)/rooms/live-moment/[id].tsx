import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function LiveMomentRedirect() {
  // This route is deprecated - navigate to room-context version
  // Without roomId we can't redirect properly, so just go to rooms
  const router = useRouter();
  useEffect(() => {
    router.replace('/(app)/rooms' as any);
  }, []);
  return null;
}
