/**
 * Sono: UMA noite por data (`sleepLogs`), separada dos registros de humor.
 *
 * `date` é a manhã em que a noite terminou (noite de 25 para 26 → 26). O humor
 * "após" uma noite é o dos registros dessa mesma data.
 *
 * Três medidas diferentes, de propósito (Diário de Sono Consensual, Carney et al., 2012):
 * - duração (horas);
 * - qualidade percebida (1–5, ancorada no quanto descansou — não em horas);
 * - dificuldades (pegar no sono, acordar durante a noite, acordar cedo demais), que
 *   correspondem aos tipos de insônia que a psiquiatria pergunta.
 *
 * A duração e, sobretudo, a REGULARIDADE acompanham o humor em estudos com diários
 * (ex.: Kaufmann et al., 2016). Tudo aqui é descritivo: associação, nunca causa.
 */
import { SLEEP_FACTORS, type MoodEntry, type SleepFactor, type SleepLog, type SleepTrouble } from './schema';
import { dayMeans, valenceIndex } from './valence';
import { ALPHA, benjaminiHochberg, fisherExactP, permutationDiffMeans } from './stats';

export const SLEEP_MIN_NIGHTS = 5;
export const SLEEP_GROUP_MIN_DATES = 3;
export const SHORT_SLEEP = 6;
export const ENOUGH_SLEEP = 7;

/** Noites com horas informadas, em ordem. */
export function nights(logs: SleepLog[]): Array<{ day: string; hours: number }> {
  return logs
    .filter((s) => s.hours != null)
    .map((s) => ({ day: s.date, hours: s.hours as number }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function sleepForDate(logs: SleepLog[], date: string): SleepLog | undefined {
  return logs.find((s) => s.date === date);
}

type Idx = { index: number | null; dates: number; records: number };

export interface SleepSummary {
  /** Noites com qualquer informação. */
  logged: number;
  nights: number;
  median: number | null;
  /** Desvio-padrão das horas entre as noites (regularidade: menor = mais regular). */
  sd: number | null;
  shortShare: number | null;
  short: Idx;
  enough: Idx;
  comparable: boolean;
  /** Diferença de humor após noites curtas × longas improvável por acaso (permutação entre datas). */
  shortClear: boolean;
  /** Qualidade: contagem de noites por nível (1–5). */
  quality: [number, number, number, number, number];
  bad: Idx;
  good: Idx;
  qualityComparable: boolean;
  qualityClear: boolean;
  troubles: Record<SleepTrouble, number>;
  /** Fatores marcados, do mais frequente ao menos; com a proporção de noites ruins com e sem o fator. */
  factors: Array<{ factor: SleepFactor; nights: number; badWith: number | null; badWithout: number | null; clear: boolean }>;
}

export function sleepSummary(logs: SleepLog[], entries: MoodEntry[]): SleepSummary {
  const n = nights(logs);
  const hours = n.map((x) => x.hours).sort((a, b) => a - b);
  const mean = hours.reduce((a, b) => a + b, 0) / (hours.length || 1);
  const ok = n.length >= SLEEP_MIN_NIGHTS;
  const onDays = (days: Set<string>) => valenceIndex(entries.filter((m) => days.has(m.at.slice(0, 10))));
  const means = dayMeans(entries);
  const meansOn = (days: Set<string>) => [...days].filter((d) => means.has(d)).map((d) => means.get(d)!.mean);
  const shortDays = new Set(n.filter((x) => x.hours < SHORT_SLEEP).map((x) => x.day));
  const enoughDays = new Set(n.filter((x) => x.hours >= ENOUGH_SLEEP).map((x) => x.day));
  const short = onDays(shortDays);
  const enough = onDays(enoughDays);
  const quality: SleepSummary['quality'] = [0, 0, 0, 0, 0];
  logs.forEach((s) => s.quality != null && quality[s.quality - 1]++);
  const badDays = new Set(logs.filter((s) => s.quality != null && s.quality <= 2).map((s) => s.date));
  const goodDays = new Set(logs.filter((s) => s.quality != null && s.quality >= 4).map((s) => s.date));
  const bad = onDays(badDays);
  const good = onDays(goodDays);
  const comparable = short.dates >= SLEEP_GROUP_MIN_DATES && enough.dates >= SLEEP_GROUP_MIN_DATES;
  const qualityComparable = bad.dates >= SLEEP_GROUP_MIN_DATES && good.dates >= SLEEP_GROUP_MIN_DATES;
  const troubles: Record<SleepTrouble, number> = { onset: 0, awakenings: 0, early: 0, nightmares: 0 };
  logs.forEach((s) => s.troubles.forEach((t) => troubles[t]++));
  return {
    logged: logs.length,
    nights: n.length,
    median: hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null,
    sd: ok ? Math.sqrt(hours.reduce((a, b) => a + (b - mean) ** 2, 0) / hours.length) : null,
    shortShare: ok ? n.filter((x) => x.hours < SHORT_SLEEP).length / n.length : null,
    short,
    enough,
    comparable,
    shortClear: comparable && permutationDiffMeans(meansOn(shortDays), meansOn(enoughDays)) < ALPHA,
    quality,
    bad,
    good,
    qualityComparable,
    qualityClear: qualityComparable && permutationDiffMeans(meansOn(badDays), meansOn(goodDays)) < ALPHA,
    troubles,
    factors: factorStats(logs),
  };
}

export const FACTOR_MIN_NIGHTS = 3;

/**
 * Para cada fator: em quantas noites apareceu e a proporção de noites ruins (qualidade
 * 1–2) com e sem ele — só entre noites com qualidade informada e com amostra mínima
 * dos dois lados. Associação, não causa.
 */
export function factorStats(logs: SleepLog[]) {
  const rated = logs.filter((s) => s.quality != null);
  const isBad = (s: SleepLog) => (s.quality as number) <= 2;
  const rows = SLEEP_FACTORS.map((factor) => {
    const nights = logs.filter((s) => (s.factors ?? []).includes(factor)).length;
    const w = rated.filter((s) => (s.factors ?? []).includes(factor));
    const wo = rated.filter((s) => !(s.factors ?? []).includes(factor));
    const ok = w.length >= FACTOR_MIN_NIGHTS && wo.length >= FACTOR_MIN_NIGHTS;
    const bw = w.filter(isBad).length;
    const bo = wo.filter(isBad).length;
    return {
      factor,
      nights,
      badWith: ok ? bw / w.length : null,
      badWithout: ok ? bo / wo.length : null,
      p: ok ? fisherExactP(bw, w.length - bw, bo, wo.length - bo) : null,
    };
  }).filter((f) => f.nights > 0);
  // Correção para vários fatores testados ao mesmo tempo (Benjamini-Hochberg).
  const tested = rows.filter((r) => r.p !== null);
  const q = benjaminiHochberg(tested.map((r) => r.p as number));
  return rows
    .map(({ p: _p, ...r }) => {
      const i = tested.findIndex((t) => t.factor === r.factor);
      return { ...r, clear: i >= 0 && q[i] < ALPHA };
    })
    .sort((a, b) => b.nights - a.nights);
}

export const fmtHours = (h: number | null) => (h === null ? '—' : `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`);

/** Data (AAAA-MM-DD) do dia anterior — para escrever "noite de 25 para 26". */
export function nightBefore(date: string) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
