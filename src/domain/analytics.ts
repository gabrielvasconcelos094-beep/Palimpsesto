/**
 * Análises da Trajetória.
 *
 * A valência é uma escala ORDINAL: não calculamos médias. Trabalhamos com
 * contagens, proporções e distribuições. Para comparar dois grupos usamos o
 * delta de Cliff — a probabilidade de um registro de um grupo estar acima de
 * um registro do outro, menos o inverso — que só depende da ordem.
 *
 * Os padrões são ASSOCIAÇÕES observadas nos registros, nunca causas.
 */
import { ALPHA, benjaminiHochberg, fisherExactP, mannWhitneyP } from './stats';
import type { AppData, IndicatorKey, MoodEntry, Outcome, StrategyUse } from './schema';
import { addDays, dayKey, fold, startOfDay, startOfWeek } from './util';

export type Counts5 = [number, number, number, number, number];
const zero5 = (): Counts5 => [0, 0, 0, 0, 0];

export interface Period {
  from: Date; // inclusivo (início do dia)
  to: Date; // inclusivo (fim do dia)
}

export function periodPreset(kind: '7d' | '30d' | '90d' | '365d' | 'all', now = new Date(), earliest?: Date): Period {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (kind === 'all') return { from: startOfDay(earliest ?? addDays(now, -29)), to };
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[kind];
  return { from: startOfDay(addDays(now, -(days - 1))), to };
}

/** Período imediatamente anterior, de mesma duração. */
export function previousPeriod(p: Period): Period {
  const len = Math.round((startOfDay(p.to).getTime() - startOfDay(p.from).getTime()) / 86400000) + 1;
  const to = new Date(addDays(p.from, -1));
  to.setHours(23, 59, 59, 999);
  return { from: startOfDay(addDays(p.from, -len)), to };
}

export function inPeriod(iso: string, p: Period) {
  const t = new Date(iso).getTime();
  return t >= p.from.getTime() && t <= p.to.getTime();
}

export function valenceCounts(entries: Pick<MoodEntry, 'valence'>[]): Counts5 {
  const c = zero5();
  for (const e of entries) c[e.valence + 2]++;
  return c;
}

export function energyCounts(entries: Pick<MoodEntry, 'energy'>[]): Counts5 {
  const c = zero5();
  for (const e of entries) if (e.energy) c[e.energy - 1]++;
  return c;
}

export function indicatorCounts(entries: MoodEntry[], key: IndicatorKey): Counts5 {
  const c = zero5();
  for (const e of entries) {
    const v = e.indicators[key];
    if (v) c[v - 1]++;
  }
  return c;
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function shares(c: number[]): number[] {
  const n = sum(c);
  return c.map((x) => (n ? x / n : 0));
}

/** Mediana ordinal (categoria central) — útil como resumo, não como medida exata. */
export function medianCategory(c: Counts5): number | null {
  const n = sum(c);
  if (!n) return null;
  let acc = 0;
  for (let i = 0; i < 5; i++) {
    acc += c[i];
    if (acc >= n / 2) return i;
  }
  return 4;
}

export interface Bucket {
  start: Date;
  label: string;
  counts: Counts5;
  total: number;
}

/** Agrupa em semanas (ou meses, se o período for longo) para a evolução. */
export function buckets(
  entries: MoodEntry[],
  p: Period,
  pick: (e: MoodEntry) => number | null | undefined,
  weekStartsOn: 0 | 1 = 1,
): { unit: 'day' | 'week' | 'month'; items: Bucket[] } {
  const days = Math.round((p.to.getTime() - p.from.getTime()) / 86400000);
  const unit = days <= 14 ? 'day' : days <= 120 ? 'week' : 'month';
  const keyOf = (d: Date) =>
    unit === 'day' ? dayKey(d) : unit === 'week' ? dayKey(startOfWeek(d, weekStartsOn)) : `${d.getFullYear()}-${d.getMonth()}`;
  const map = new Map<string, Bucket>();
  // Cria os baldes vazios para que lacunas apareçam (sem punição: apenas espaço vazio).
  let cursor = unit === 'week' ? startOfWeek(p.from, weekStartsOn) : startOfDay(p.from);
  if (unit === 'month') cursor = new Date(p.from.getFullYear(), p.from.getMonth(), 1);
  while (cursor.getTime() <= p.to.getTime()) {
    const k = keyOf(cursor);
    if (!map.has(k)) map.set(k, { start: new Date(cursor), label: bucketLabel(cursor, unit), counts: zero5(), total: 0 });
    cursor =
      unit === 'day' ? addDays(cursor, 1) : unit === 'week' ? addDays(cursor, 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  for (const e of entries) {
    const v = pick(e);
    if (v === null || v === undefined) continue;
    const b = map.get(keyOf(new Date(e.at)));
    if (!b) continue;
    b.counts[v]++;
    b.total++;
  }
  return { unit, items: [...map.values()] };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function bucketLabel(d: Date, unit: 'day' | 'week' | 'month') {
  if (unit === 'month') return `${MONTHS[d.getMonth()]}${d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function emotionFrequency(entries: Array<{ emotionIds: string[] }>): Array<{ id: string; count: number; share: number }> {
  const map = new Map<string, number>();
  for (const e of entries) for (const id of new Set(e.emotionIds)) map.set(id, (map.get(id) ?? 0) + 1);
  const n = entries.length || 1;
  return [...map.entries()].map(([id, count]) => ({ id, count, share: count / n })).sort((a, b) => b.count - a.count);
}

export function tagFrequency(entries: Array<{ tags: string[] }>): Array<{ tag: string; count: number }> {
  const map = new Map<string, { tag: string; count: number }>();
  for (const e of entries)
    for (const t of e.tags) {
      const k = fold(t);
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { tag: t, count: 1 });
    }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export const CONTEXT_MIN_RECORDS = 3;

export interface ContextRow {
  tag: string;
  records: number;
  dates: number;
  /** Avaliações −2…+2 (índices 0…4) nos registros com este contexto. */
  valence: Counts5;
  /** Emoções mais frequentes junto deste contexto (id, vezes, fração dos registros). */
  emotions: Array<{ id: string; count: number; share: number }>;
}

/**
 * Resumo DESCRITIVO dos contextos relatados: quantas vezes cada um aparece, com que
 * avaliações e com quais emoções. Por registro (é o que a pessoa marcou), sem testes:
 * serve para olhar, não para concluir. As diferenças entre contextos que resistem ao
 * acaso ficam em findPatterns. A linha "sem contexto" permite comparar com o restante.
 */
export function contextSummary(entries: MoodEntry[], minRecords = CONTEXT_MIN_RECORDS): { rows: ContextRow[]; none: ContextRow; withContext: number } {
  const build = (tag: string, list: MoodEntry[]): ContextRow => {
    const valence = zero5();
    const emo = new Map<string, number>();
    for (const e of list) {
      valence[e.valence + 2]++;
      for (const id of new Set(e.emotionIds)) emo.set(id, (emo.get(id) ?? 0) + 1);
    }
    return {
      tag,
      records: list.length,
      dates: new Set(list.map((e) => e.at.slice(0, 10))).size,
      valence,
      emotions: [...emo.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => ({ id, count, share: count / list.length })),
    };
  };
  const rows = tagFrequency(entries)
    .filter((t) => t.count >= minRecords)
    .map(({ tag }) => build(tag, entries.filter((e) => e.tags.some((x) => fold(x) === fold(tag)))));
  const none = entries.filter((e) => e.tags.length === 0);
  return { rows, none: build('sem contexto marcado', none), withContext: entries.length - none.length };
}

/** Delta de Cliff: P(a > b) − P(a < b), entre −1 e 1. */
export function cliffsDelta(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  // Contagem por categoria torna o cálculo O(k²) em vez de O(n·m).
  const ca = new Map<number, number>();
  const cb = new Map<number, number>();
  a.forEach((x) => ca.set(x, (ca.get(x) ?? 0) + 1));
  b.forEach((x) => cb.set(x, (cb.get(x) ?? 0) + 1));
  let gt = 0;
  let lt = 0;
  for (const [x, nx] of ca)
    for (const [y, ny] of cb) {
      if (x > y) gt += nx * ny;
      else if (x < y) lt += nx * ny;
    }
  return (gt - lt) / (a.length * b.length);
}

/** Por dia: categorias registradas (para o calendário). */
export function calendarMap(entries: MoodEntry[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const e of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    const k = dayKey(e.at);
    const arr = map.get(k) ?? [];
    arr.push(e.valence);
    map.set(k, arr);
  }
  return map;
}

/* ------------------------------------------------------------------------ */
/* Padrões                                                                   */
/* ------------------------------------------------------------------------ */

export const PATTERN_MIN_ENTRIES = 20;
export const PATTERN_MIN_GROUP = 5;
export const PATTERN_MIN_DELTA = 0.3;

export type PatternMetric = 'valence' | 'energy' | IndicatorKey | `emotion:${string}`;

export interface Pattern {
  id: string;
  tag: string;
  metric: PatternMetric;
  direction: 'higher' | 'lower';
  delta: number; // Cliff (ordinal) ou diferença de proporções (emoções)
  withN: number;
  withoutN: number;
  withShare: number; // proporção do desfecho "alto" no grupo com o marcador
  withoutShare: number;
  withCounts?: Counts5;
  withoutCounts?: Counts5;
  /** Valor q (Benjamini-Hochberg) da comparação. */
  q?: number;
}

/**
 * Procura associações entre marcadores de contexto e:
 *  - valência, energia e indicadores (comparação ordinal por delta de Cliff);
 *  - presença de emoções (diferença de proporções).
 * Exige um mínimo de registros no total e em cada grupo, e um efeito mínimo.
 */
export function findPatterns(entries: MoodEntry[], opts: { indicators?: IndicatorKey[] } = {}): {
  enough: boolean;
  total: number;
  patterns: Pattern[];
  /** Quantas comparações foram feitas (para explicar a correção). */
  tests?: number;
} {
  const total = entries.length;
  if (total < PATTERN_MIN_ENTRIES) return { enough: false, total, patterns: [] };
  const tags = tagFrequency(entries).filter((t) => t.count >= PATTERN_MIN_GROUP && total - t.count >= PATTERN_MIN_GROUP);
  const out: Pattern[] = [];
  // Todas as comparações feitas entram na correção para comparações múltiplas,
  // inclusive as que não passariam do tamanho mínimo de efeito.
  const tested: Array<{ p: number; pattern: Pattern | null }> = [];

  const ordinal = (metric: PatternMetric, pick: (e: MoodEntry) => number | null | undefined, highFrom: number) => {
    for (const { tag } of tags) {
      const k = fold(tag);
      const withV: number[] = [];
      const withoutV: number[] = [];
      for (const e of entries) {
        const v = pick(e);
        if (v === null || v === undefined) continue;
        (e.tags.some((t) => fold(t) === k) ? withV : withoutV).push(v);
      }
      if (withV.length < PATTERN_MIN_GROUP || withoutV.length < PATTERN_MIN_GROUP) continue;
      const d = cliffsDelta(withV, withoutV);
      const pv = mannWhitneyP(withV, withoutV);
      if (Math.abs(d) < PATTERN_MIN_DELTA) {
        tested.push({ p: pv, pattern: null });
        continue;
      }
      const toCounts = (xs: number[]) => {
        const c = zero5();
        xs.forEach((x) => c[x]++);
        return c;
      };
      tested.push({ p: pv, pattern: {
        id: `${metric}|${k}`,
        tag,
        metric,
        direction: d > 0 ? 'higher' : 'lower',
        delta: d,
        withN: withV.length,
        withoutN: withoutV.length,
        withShare: withV.filter((x) => x >= highFrom).length / withV.length,
        withoutShare: withoutV.filter((x) => x >= highFrom).length / withoutV.length,
        withCounts: toCounts(withV),
        withoutCounts: toCounts(withoutV),
      } });
    }
  };

  // Índices 0..4 em todas as métricas ordinais; "alto" = duas categorias superiores.
  ordinal('valence', (e) => e.valence + 2, 3);
  ordinal('energy', (e) => (e.energy ? e.energy - 1 : null), 3);
  for (const ind of opts.indicators ?? []) ordinal(ind, (e) => (e.indicators[ind] ? e.indicators[ind]! - 1 : null), 3);

  // Emoções: proporção de registros em que a emoção aparece, com e sem o marcador.
  const emotions = emotionFrequency(entries).filter((x) => x.count >= 4);
  for (const { tag } of tags) {
    const k = fold(tag);
    const withE = entries.filter((e) => e.tags.some((t) => fold(t) === k));
    const withoutE = entries.filter((e) => !e.tags.some((t) => fold(t) === k));
    for (const { id } of emotions) {
      const a = withE.filter((e) => e.emotionIds.includes(id)).length;
      const b = withoutE.filter((e) => e.emotionIds.includes(id)).length;
      const pa = a / withE.length;
      const pb = b / withoutE.length;
      const pv = fisherExactP(a, withE.length - a, b, withoutE.length - b);
      const diff = pa - pb;
      if ((a < 3 && pa > pb) || Math.abs(diff) < 0.25 || Math.max(pa, pb) < 0.3) {
        tested.push({ p: pv, pattern: null });
        continue;
      }
      tested.push({ p: pv, pattern: {
        id: `emotion:${id}|${k}`,
        tag,
        metric: `emotion:${id}`,
        direction: diff > 0 ? 'higher' : 'lower',
        delta: diff,
        withN: withE.length,
        withoutN: withoutE.length,
        withShare: pa,
        withoutShare: pb,
      } });
    }
  }
  // Benjamini-Hochberg sobre todas as comparações: só fica o que é improvável por acaso.
  const q = benjaminiHochberg(tested.map((t) => t.p));
  tested.forEach((t, i) => {
    if (t.pattern && q[i] < ALPHA) out.push({ ...t.pattern, q: q[i] });
  });
  out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return { enough: true, total, patterns: out.slice(0, 24), tests: tested.length };
}

/* ------------------------------------------------------------------------ */
/* Repertório                                                                */
/* ------------------------------------------------------------------------ */

export function outcomeCounts(uses: StrategyUse[]): Record<Outcome, number> {
  const c: Record<Outcome, number> = { worked: 0, partial: 0, didnt: 0, worse: 0, unknown: 0 };
  for (const u of uses) c[u.outcome]++;
  return c;
}

/** Avaliações de um item agrupadas por contexto (marcadores do uso). */
export function outcomesByContext(uses: StrategyUse[]): Array<{ tag: string; counts: Record<Outcome, number>; n: number }> {
  const groups = new Map<string, { tag: string; list: StrategyUse[] }>();
  for (const u of uses) {
    const tags = u.tags.length ? u.tags : ['(sem contexto)'];
    for (const t of tags) {
      const k = fold(t);
      const g = groups.get(k) ?? { tag: t, list: [] };
      g.list.push(u);
      groups.set(k, g);
    }
  }
  return [...groups.values()]
    .map((g) => ({ tag: g.tag, counts: outcomeCounts(g.list), n: g.list.length }))
    .sort((a, b) => b.n - a.n);
}

export function mostUsedItems(data: AppData, p?: Period) {
  const uses = p ? data.uses.filter((u) => inPeriod(u.at, p)) : data.uses;
  const map = new Map<string, StrategyUse[]>();
  for (const u of uses) map.set(u.itemId, [...(map.get(u.itemId) ?? []), u]);
  return [...map.entries()]
    .map(([itemId, list]) => ({ item: data.repertoire.find((i) => i.id === itemId), uses: list, counts: outcomeCounts(list) }))
    .filter((x) => x.item)
    .sort((a, b) => b.uses.length - a.uses.length);
}

/* ------------------------------------------------------------------------ */
/* Camadas antigas (reencontro)                                              */
/* ------------------------------------------------------------------------ */

export interface Resurface {
  kind: 'answer' | 'experience' | 'discovery' | 'note';
  id: string;
  at: string;
  title: string;
  excerpt: string;
}

/**
 * Escolhe, de forma estável ao longo do dia, um texto escrito há pelo menos
 * 30 dias para reencontro. Prefere "aniversários" (mesmo dia em meses/anos
 * anteriores).
 */
export function pickResurface(data: AppData, now = new Date(), rand: () => number = Math.random): Resurface | null {
  const cutoff = addDays(now, -30).toISOString();
  const qText = new Map(data.questions.map((q) => [q.id, q.text]));
  const pool: Resurface[] = [];
  for (const a of data.answers)
    if (a.text.trim() && a.updatedAt < cutoff)
      pool.push({ kind: 'answer', id: a.id, at: a.updatedAt, title: qText.get(a.questionId) ?? 'Resposta', excerpt: a.text });
  for (const x of data.experiences)
    if (x.at < cutoff && (x.learned.trim() || x.whatHappened.trim()))
      pool.push({ kind: 'experience', id: x.id, at: x.at, title: x.title || 'Uma experiência', excerpt: x.learned || x.whatHappened });
  for (const d of data.discoveries)
    if (d.at < cutoff && d.status === 'active')
      pool.push({ kind: 'discovery', id: d.id, at: d.at, title: d.title, excerpt: d.description });
  for (const n of data.notes)
    if (n.createdAt < cutoff) pool.push({ kind: 'note', id: n.id, at: n.createdAt, title: 'Nota do mapa', excerpt: n.text });
  if (!pool.length) return null;
  const md = (iso: string) => {
    const d = new Date(iso);
    return d.getDate();
  };
  const anniversaries = pool.filter((r) => md(r.at) === now.getDate());
  const from = anniversaries.length ? anniversaries : pool;
  return from[Math.floor(rand() * from.length)];
}
