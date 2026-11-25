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

/* Período da Trajetória (compartilhado entre a visão geral e as categorias). */
import type { PeriodKind } from '../domain/filters';
export interface TrajPeriod {
  kind: PeriodKind;
  from: string | null;
  to: string | null;
  compare: boolean;
}
let traj: TrajPeriod = { kind: '30d', from: null, to: null, compare: false };
const tl = new Set<() => void>();
export function useTrajPeriod(): [TrajPeriod, (p: TrajPeriod) => void] {
  const p = useSyncExternalStore(
    (l) => {
      tl.add(l);
      return () => tl.delete(l);
    },
    () => traj,
  );
  return [
    p,
    (n: TrajPeriod) => {
      traj = n;
      tl.forEach((l) => l());
    },
  ];
}
