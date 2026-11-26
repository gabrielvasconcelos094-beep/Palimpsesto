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
import type { MoodEntry, SleepLog, SleepTrouble } from './schema';
import { valenceIndex } from './valence';

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
  /** Qualidade: contagem de noites por nível (1–5). */
  quality: [number, number, number, number, number];
  bad: Idx;
  good: Idx;
  qualityComparable: boolean;
  troubles: Record<SleepTrouble, number>;
}

export function sleepSummary(logs: SleepLog[], entries: MoodEntry[]): SleepSummary {
  const n = nights(logs);
  const hours = n.map((x) => x.hours).sort((a, b) => a - b);
  const mean = hours.reduce((a, b) => a + b, 0) / (hours.length || 1);
  const ok = n.length >= SLEEP_MIN_NIGHTS;
  const onDays = (days: Set<string>) => valenceIndex(entries.filter((m) => days.has(m.at.slice(0, 10))));
  const short = onDays(new Set(n.filter((x) => x.hours < SHORT_SLEEP).map((x) => x.day)));
  const enough = onDays(new Set(n.filter((x) => x.hours >= ENOUGH_SLEEP).map((x) => x.day)));
  const quality: SleepSummary['quality'] = [0, 0, 0, 0, 0];
  logs.forEach((s) => s.quality != null && quality[s.quality - 1]++);
  const bad = onDays(new Set(logs.filter((s) => s.quality != null && s.quality <= 2).map((s) => s.date)));
  const good = onDays(new Set(logs.filter((s) => s.quality != null && s.quality >= 4).map((s) => s.date)));
  const troubles: Record<SleepTrouble, number> = { onset: 0, awakenings: 0, early: 0 };
  logs.forEach((s) => s.troubles.forEach((t) => troubles[t]++));
  return {
    logged: logs.length,
    nights: n.length,
    median: hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null,
    sd: ok ? Math.sqrt(hours.reduce((a, b) => a + (b - mean) ** 2, 0) / hours.length) : null,
    shortShare: ok ? n.filter((x) => x.hours < SHORT_SLEEP).length / n.length : null,
    short,
    enough,
    comparable: short.dates >= SLEEP_GROUP_MIN_DATES && enough.dates >= SLEEP_GROUP_MIN_DATES,
    quality,
    bad,
    good,
    qualityComparable: bad.dates >= SLEEP_GROUP_MIN_DATES && good.dates >= SLEEP_GROUP_MIN_DATES,
    troubles,
  };
}

export const fmtHours = (h: number | null) => (h === null ? '—' : `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`);

/** Data (AAAA-MM-DD) do dia anterior — para escrever "noite de 25 para 26". */
export function nightBefore(date: string) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
