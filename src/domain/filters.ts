/**
 * Filtros de registros, compartilhados entre Diário e Trajetória.
 * Regras: categorias diferentes se combinam com E; opções dentro de uma
 * categoria, com OU (exceto emoções, que podem exigir "todas").
 * Datas são comparadas como dias locais (AAAA-MM-DD), sem conversão de fuso.
 */
import type { AppData, Experience, LifeEvent, MoodEntry } from './schema';
import { addDays, dayKey, fold, matchesSearch } from './util';

export type PeriodKind = 'all' | '7d' | '30d' | '90d' | '365d' | 'custom';

export interface RecordFilters {
  type: 'all' | 'mood' | 'exp' | 'event';
  period: PeriodKind;
  from: string | null;
  to: string | null;
  valences: number[];
  emotions: string[];
  emotionMode: 'any' | 'all';
  energies: number[];
  itemIds: string[];
  tags: string[];
  retroOnly: boolean;
  q: string;
}

export const NO_FILTERS: RecordFilters = {
  type: 'all',
  period: 'all',
  from: null,
  to: null,
  valences: [],
  emotions: [],
  emotionMode: 'any',
  energies: [],
  itemIds: [],
  tags: [],
  retroOnly: false,
  q: '',
};

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '3 meses',
  '365d': '12 meses',
  all: 'Tudo',
  custom: 'Personalizado',
};

/** Intervalo de dias (inclusivo) do período, ou nulls para "tudo". */
export function periodDays(f: Pick<RecordFilters, 'period' | 'from' | 'to'>, now = new Date()): { from: string | null; to: string | null } {
  if (f.period === 'all') return { from: null, to: null };
  if (f.period === 'custom') return { from: f.from, to: f.to };
  const n = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[f.period];
  return { from: dayKey(addDays(now, -(n - 1))), to: dayKey(now) };
}

export const inDays = (day: string, r: { from: string | null; to: string | null }) => (!r.from || day >= r.from) && (!r.to || day <= r.to);

/** Registro escrito num dia posterior ao dia em que aconteceu. */
export const isRetro = (createdAt: string, at: string) => dayKey(createdAt) > at.slice(0, 10);

export function activeCount(f: RecordFilters, includePeriod = true): number {
  return (
    (includePeriod && f.period !== 'all' ? 1 : 0) +
    (f.type !== 'all' ? 1 : 0) +
    f.valences.length +
    f.emotions.length +
    f.energies.length +
    f.itemIds.length +
    f.tags.length +
    (f.retroOnly ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  );
}

export interface FilterContext {
  emotionLabel: (id: string) => string | undefined;
  itemName: (id: string) => string | undefined;
}

export function contextFor(data: AppData): FilterContext {
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const items = new Map(data.repertoire.map((i) => [i.id, i.name]));
  return { emotionLabel: (id) => emo.get(id), itemName: (id) => items.get(id) };
}

const hasTags = (have: string[], want: string[]) => {
  const set = new Set(have.map(fold));
  return want.some((t) => set.has(fold(t)));
};

export function matchMood(m: MoodEntry, f: RecordFilters, ctx: FilterContext, range = periodDays(f)): boolean {
  if (f.type !== 'all' && f.type !== 'mood') return false;
  if (!inDays(m.at.slice(0, 10), range)) return false;
  if (f.valences.length && !f.valences.includes(m.valence)) return false;
  if (f.emotions.length) {
    const ok = f.emotionMode === 'all' ? f.emotions.every((e) => m.emotionIds.includes(e)) : f.emotions.some((e) => m.emotionIds.includes(e));
    if (!ok) return false;
  }
  if (f.energies.length && !(m.energy && f.energies.includes(m.energy))) return false;
  if (f.itemIds.length && !f.itemIds.some((i) => m.itemIds.includes(i))) return false;
  if (f.tags.length && !hasTags(m.tags, f.tags)) return false;
  if (f.retroOnly && !isRetro(m.createdAt, m.at)) return false;
  if (f.q.trim() && !matchesSearch([m.note, ...m.tags, ...m.emotionIds.map(ctx.emotionLabel), ...m.itemIds.map(ctx.itemName)], f.q)) return false;
  return true;
}

export function matchExperience(x: Experience, f: RecordFilters, ctx: FilterContext, data: AppData, range = periodDays(f)): boolean {
  if (f.type !== 'all' && f.type !== 'exp') return false;
  if (!inDays(x.at.slice(0, 10), range)) return false;
  if (f.valences.length && !(f.valences.includes(x.feelingBefore as number) || f.valences.includes(x.feelingAfter as number))) return false;
  if (f.emotions.length) {
    const ok = f.emotionMode === 'all' ? f.emotions.every((e) => x.emotionIds.includes(e)) : f.emotions.some((e) => x.emotionIds.includes(e));
    if (!ok) return false;
  }
  if (f.energies.length) return false; // experiências não têm nível de energia
  if (f.itemIds.length && !data.uses.some((u) => u.experienceId === x.id && f.itemIds.includes(u.itemId))) return false;
  if (f.tags.length && !hasTags(x.tags, f.tags)) return false;
  if (f.retroOnly && !isRetro(x.createdAt, x.at)) return false;
  if (
    f.q.trim() &&
    !matchesSearch([x.title, x.whatHappened, x.learned, x.whatHelped, x.whatWorsened, x.whatIDid, x.howIFeltAfter, ...x.tags, ...x.emotionIds.map(ctx.emotionLabel)], f.q)
  )
    return false;
  return true;
}

export function matchEvent(e: LifeEvent, f: RecordFilters, range = periodDays(f)): boolean {
  if (f.type !== 'all' && f.type !== 'event') return false;
  // Sobreposição de intervalos: o acontecimento entra se tocar o período.
  const end = e.endDate ?? e.date;
  if (range.from && end < range.from) return false;
  if (range.to && e.date > range.to) return false;
  if (f.valences.length || f.emotions.length || f.energies.length || f.itemIds.length) return false;
  if (f.tags.length && !hasTags(e.tags, f.tags)) return false;
  if (f.retroOnly && !(dayKey(e.createdAt) > e.date)) return false;
  if (f.q.trim() && !matchesSearch([e.title, e.description, ...e.tags], f.q)) return false;
  return true;
}

/** Descrição legível dos filtros ativos (para mostrar ao usuário). */
export function describeFilters(f: RecordFilters, data: AppData, valenceName: (v: number) => string, includePeriod = true): string[] {
  const ctx = contextFor(data);
  const out: string[] = [];
  if (includePeriod && f.period !== 'all') out.push(f.period === 'custom' ? `${f.from ?? '…'} a ${f.to ?? '…'}` : PERIOD_LABELS[f.period]);
  if (f.type !== 'all') out.push({ mood: 'Humor', exp: 'Experiências', event: 'Acontecimentos', all: '' }[f.type]);
  f.valences.forEach((v) => out.push(valenceName(v)));
  if (f.emotions.length) out.push((f.emotionMode === 'all' ? 'todas: ' : '') + f.emotions.map((e) => ctx.emotionLabel(e) ?? '?').join(f.emotionMode === 'all' ? ' + ' : ' ou '));
  if (f.energies.length) out.push(`energia ${f.energies.sort().join(', ')}`);
  f.itemIds.forEach((i) => out.push(ctx.itemName(i) ?? '?'));
  f.tags.forEach((t) => out.push(`#${t}`));
  if (f.retroOnly) out.push('só retroativos');
  if (f.q.trim()) out.push(`“${f.q.trim()}”`);
  return out;
}
