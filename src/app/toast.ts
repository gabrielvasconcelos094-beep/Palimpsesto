import { useSyncExternalStore } from 'react';

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const ls = new Set<() => void>();

export function toast(msg: string, ms = 2600) {
  message = msg;
  ls.forEach((l) => l());
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    ls.forEach((l) => l());
  }, ms);
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => message,
  );
}
