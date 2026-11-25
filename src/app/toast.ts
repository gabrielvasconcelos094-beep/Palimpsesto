import { useSyncExternalStore } from 'react';

export interface ToastAction {
  label: string;
  run: () => void;
}
export interface ToastState {
  text: string;
  action?: ToastAction;
}

let current: ToastState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

/** Mensagem breve. Com `action`, fica mais tempo na tela (ex.: "Desfazer"). */
export function toast(text: string, opts: number | { ms?: number; action?: ToastAction } = {}) {
  const o = typeof opts === 'number' ? { ms: opts } : opts;
  current = { text, action: o.action };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(dismissToast, o.ms ?? (o.action ? 6000 : 2600));
}

export function dismissToast() {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => current,
  );
}
