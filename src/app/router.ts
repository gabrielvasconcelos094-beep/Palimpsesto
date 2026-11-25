/**
 * Roteador mínimo baseado em hash, pensado para o botão "voltar" do Android:
 * mantém a profundidade da pilha para saber quando voltar e quando sair.
 */
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
}

let current = parse();
let depth = Number(sessionStorage.getItem('pal.depth') ?? '0') || 0;
const listeners = new Set<() => void>();
const emit = () => {
  current = parse();
  listeners.forEach((l) => l());
};

window.addEventListener('hashchange', emit);
window.addEventListener('popstate', () => {
  depth = Math.max(0, depth - 1);
  sessionStorage.setItem('pal.depth', String(depth));
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = '#' + (to.startsWith('/') ? to : '/' + to);
  if (location.hash === target) return;
  if (opts.replace) {
    history.replaceState(null, '', target);
    emit();
  } else {
    depth++;
    sessionStorage.setItem('pal.depth', String(depth));
    location.hash = target;
  }
  window.scrollTo(0, 0);
}

/** Volta uma tela; se não houver histórico interno, vai para `fallback`. */
export function goBack(fallback = '/') {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function canGoBack() {
  return depth > 0;
}

export function setQuery(key: string, value: string) {
  const q = new URLSearchParams(current.query);
  q.set(key, value);
  navigate(`${current.path}?${q.toString()}`, { replace: true });
}
