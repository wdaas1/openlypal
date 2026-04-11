type Listener = (isVisible: boolean) => void;
const listeners = new Map<string, Listener>();
let currentVisible = new Set<string>();

export const videoVisibility = {
  register(key: string, listener: Listener): () => void {
    listeners.set(key, listener);
    listener(currentVisible.has(key));
    return () => listeners.delete(key);
  },
  update(visibleKeys: Set<string>) {
    const prev = currentVisible;
    currentVisible = visibleKeys;
    listeners.forEach((listener, key) => {
      const wasVisible = prev.has(key);
      const isNowVisible = visibleKeys.has(key);
      if (wasVisible !== isNowVisible) {
        listener(isNowVisible);
      }
    });
  },
};
