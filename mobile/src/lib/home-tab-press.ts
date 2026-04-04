const handlers = new Set<() => void>();

export function onHomeTabPress(fn: () => void) {
  handlers.add(fn);
  return () => handlers.delete(fn);
}

export function fireHomeTabPress() {
  handlers.forEach((fn) => fn());
}
