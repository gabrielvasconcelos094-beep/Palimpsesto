import { useMemo } from 'react';
import { useSharedFilters, useTrajPeriod } from '../../app/filters';
import { useData } from '../../app/store';
import { contextFor, inDays, matchMood, periodDays } from '../../domain/filters';
import { addDays, dayKey } from '../../domain/util';

/** Dados da Trajetória já recortados pelo período e pelos filtros compartilhados. */
export function useTrajectory() {
  const data = useData();
  const [period, setPeriod] = useTrajPeriod();
  const [filters, setFilters] = useSharedFilters();
  const memo = useMemo(() => {
    const earliest = [...data.moodEntries.map((m) => m.at.slice(0, 10)), ...data.experiences.map((x) => x.at.slice(0, 10))].sort()[0] ?? dayKey(new Date());
    const r = period.kind === 'all' ? { from: earliest, to: dayKey(new Date()) } : periodDays({ period: period.kind, from: period.from, to: period.to });
    const range = { from: r.from ?? earliest, to: r.to ?? dayKey(new Date()) };
    const len = Math.round((new Date(range.to + 'T12:00:00').getTime() - new Date(range.from + 'T12:00:00').getTime()) / 86400000) + 1;
    const prevRange = { from: dayKey(addDays(new Date(range.from + 'T12:00:00'), -len)), to: dayKey(addDays(new Date(range.from + 'T12:00:00'), -1)) };
    // Os filtros (exceto período e tipo) valem para os registros de humor da Trajetória.
    const f = { ...filters, type: 'mood' as const, period: 'all' as const };
    const ctx = contextFor(data);
    const all = data.moodEntries.filter((m) => matchMood(m, f, ctx));
    const entries = all.filter((m) => inDays(m.at.slice(0, 10), range));
    const prevEntries = all.filter((m) => inDays(m.at.slice(0, 10), prevRange));
    const uses = data.uses.filter((u) => inDays(u.at.slice(0, 10), range));
    const experiences = data.experiences.filter((x) => inDays(x.at.slice(0, 10), range));
    const events = data.events.filter((e) => (e.endDate ?? e.date) >= range.from && e.date <= range.to);
    return { data, period, filters, range, prevRange, len, entries, prevEntries, uses, experiences, events, allFiltered: all };
  }, [data, period, filters]);
  return { ...memo, setPeriod, setFilters };
}
