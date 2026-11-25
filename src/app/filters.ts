/** Estado dos filtros compartilhado entre Diário e Trajetória (somente na sessão). */
import { useSyncExternalStore } from 'react';
import { NO_FILTERS, type RecordFilters } from '../domain/filters';

let current: RecordFilters = NO_FILTERS;
const ls = new Set<() => void>();

export function setSharedFilters(f: RecordFilters) {
  current = f;
  ls.forEach((l) => l());
}
export function getSharedFilters() {
  return current;
}
export function useSharedFilters(): [RecordFilters, (f: RecordFilters) => void] {
  const f = useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => current,
  );
  return [f, setSharedFilters];
}
export { NO_FILTERS };
