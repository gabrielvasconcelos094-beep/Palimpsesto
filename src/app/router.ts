/**
 * Roteador mínimo baseado em hash, pensado para o botão "voltar" do Android.
 * Usa history.pushState com a profundidade no `state`, para saber quando
 * voltar uma tela e quando sair do app.
 */
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
  /** true quando a última navegação substituiu a entrada (ex.: /nova → /<id>). */
  replaced: boolean;
}

let replacedFlag = false;
function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? ''), replaced: replacedFlag };
}

let current = parse();
const depthOf = () => (typeof history.state?.depth === 'number' ? history.state.depth : 0);
const listeners = new Set<() => void>();
const emit = (replaced = false) => {
  replacedFlag = replaced;
  current = parse();
  listeners.forEach((l) => l());
};

window.addEventListener('popstate', () => emit());
// Mudanças de hash feitas fora do roteador (ex.: digitando na barra) também contam.
window.addEventListener('hashchange', () => {
  if (parse().path !== current.path || parse().query.toString() !== current.query.toString()) emit();
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
  if (opts.replace) history.replaceState({ depth: depthOf() }, '', target);
  else {
    history.pushState({ depth: depthOf() + 1 }, '', target);
    window.scrollTo(0, 0);
  }
  emit(!!opts.replace);
}

/** Volta uma tela; se não houver histórico interno, vai para `fallback`. */
export function goBack(fallback = '/') {
  if (depthOf() > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function canGoBack() {
  return depthOf() > 0;
}

export function setQuery(key: string, value: string) {
  const q = new URLSearchParams(current.query);
  q.set(key, value);
  navigate(`${current.path}?${q.toString()}`, { replace: true });
}
