import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'local-store' });

export const localStore = {
  get: <T>(key: string): T | null => {
    try {
      const val = storage.getString(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch {
      return null;
    }
  },
  set: <T>(key: string, value: T) => {
    try {
      storage.set(key, JSON.stringify(value));
    } catch {}
  },
  delete: (key: string) => {
    try {
      storage.delete(key);
    } catch {}
  },
};
